/**
 * Lembretes de eventos da Agenda por DM do Discord.
 *
 * Quem dispara é um agendador externo que chama /api/cron-agenda-reminders a cada poucos minutos
 * (Vercel Cron no plano Pro, ou um serviço como cron-job.org). Cada execução procura os eventos com
 * lembrete ligado e envia, uma única vez por evento:
 *   - "m15":   15 minutos antes do início;
 *   - "start": no horário de início.
 * O que já foi enviado fica em `agenda_events/{id}.remindersSent` (a tela zera isso ao reagendar).
 *
 * Esta lógica não depende de Firebase nem de req/res: o acesso aos dados entra pelo parâmetro `store`.
 */

import {
    DEFAULT_APP_URL, normalizeBotToken, looksLikeBotToken, isValidDiscordId, sendDiscordDm, buildDmContent
} from './dm.js';

// Horário de Brasília (UTC-3, sem horário de verão desde 2019): data e hora do evento são digitadas nesse fuso
const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const CONCURRENCY = 5;

export const REMINDER_EVENT = 'agenda_reminder';
// Tolerância para o agendador atrasar: depois disso o lembrete perde o sentido e é descartado
export const REMINDER_GRACE_MS = 10 * MINUTE;
export const REMINDER_LEAD_MIN = 15;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const isSafeDocId = (value) => /^[A-Za-z0-9_-]{1,128}$/.test(String(value || ''));

/** Instante (ms) em que o evento começa, ou null se data/hora forem inválidas. */
export const eventStartMs = (event) => {
    const d = DATE_RE.exec(String(event?.date || ''));
    const t = TIME_RE.exec(String(event?.startTime || ''));
    if (!d || !t) return null;
    return Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2])) + BRT_OFFSET_MS;
};

const isoDateBRT = (ms) => new Date(ms - BRT_OFFSET_MS).toISOString().slice(0, 10);

/** Datas (YYYY-MM-DD, horário de Brasília) que podem ter lembrete a enviar agora: hoje e amanhã. */
export const candidateDates = (now) => [isoDateBRT(now), isoDateBRT(now + 24 * 60 * MINUTE)];

/**
 * Lembretes que estão na hora de sair e ainda não saíram.
 * @returns {Array<{ key: 'm15'|'start', minutes: number }>}
 */
export const dueReminders = (event, now) => {
    if (event?.remind !== true) return [];
    const start = eventStartMs(event);
    if (start === null) return [];
    const sent = event.remindersSent && typeof event.remindersSent === 'object' ? event.remindersSent : {};
    const due = [];
    if (!sent.m15 && now >= start - REMINDER_LEAD_MIN * MINUTE && now < start) {
        due.push({ key: 'm15', minutes: Math.max(1, Math.ceil((start - now) / MINUTE)) });
    }
    if (!sent.start && now >= start && now < start + REMINDER_GRACE_MS) {
        due.push({ key: 'start', minutes: 0 });
    }
    return due;
};

/** Quem recebe o lembrete: o organizador e os convidados que não recusaram. */
export const reminderRecipients = (event) => {
    const ids = (Array.isArray(event?.participantIds) ? event.participantIds : [])
        .map(String)
        .filter((id) => event?.responses?.[id]?.status !== 'recusado');
    return [...new Set([String(event?.creatorId || ''), ...ids])].filter(isSafeDocId);
};

const runWithConcurrency = async (items, limit, worker) => {
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) await worker(items[next++]);
    }));
};

/**
 * @param {object} args
 * @param {{ listEvents(dates: string[]): Promise<object[]>, markSent(id: string, key: string, iso: string): Promise<void>,
 *           getCollaborator(id: string): Promise<object|null>, getDmConfig(): Promise<object|null> }} args.store
 * @returns {Promise<{ status: number, json: object }>}
 */
export const processAgendaReminders = async ({ store, env = {}, fetchImpl = fetch, now = Date.now() }) => {
    const token = normalizeBotToken(env.DISCORD_BOT_TOKEN);
    if (!token) return { status: 503, json: { error: 'bot-nao-configurado' } };
    if (!looksLikeBotToken(token)) return { status: 502, json: { error: 'token-do-bot-invalido', reason: 'formato-invalido' } };

    // Mesmas chaves da tela Configurações > Notificações: DM ligada e o tipo de aviso marcado
    const dm = (await store.getDmConfig())?.dm;
    if (!dm?.enabled) return { status: 200, json: { skipped: 'dm-desativado', events: 0, sent: 0 } };
    if (dm.events && dm.events[REMINDER_EVENT] === false) return { status: 200, json: { skipped: 'evento-desmarcado', events: 0, sent: 0 } };

    const appUrl = (env.APP_URL || DEFAULT_APP_URL).replace(/\/+$/, '');
    const link = `${appUrl}/home?tab=agenda`;
    const discordCtx = { token, fetchImpl };

    const events = await store.listEvents(candidateDates(now));
    const totals = { events: 0, sent: 0, skipped: 0, failed: 0 };
    let tokenRejected = false;

    for (const event of events) {
        const due = dueReminders(event, now);
        if (due.length === 0) continue;
        totals.events++;

        const recipients = reminderRecipients(event);
        for (const reminder of due) {
            // Marca antes de enviar: se duas execuções se cruzarem, ninguém recebe o lembrete duas vezes
            await store.markSent(event.id, reminder.key, new Date(now).toISOString());

            const params = {
                title: event.title, date: event.date, startTime: event.startTime,
                endTime: event.endTime, location: event.location, minutes: reminder.minutes
            };
            const content = buildDmContent(REMINDER_EVENT, params, link);

            await runWithConcurrency(recipients, CONCURRENCY, async (id) => {
                if (tokenRejected) { totals.failed++; return; }
                try {
                    const colab = await store.getCollaborator(id);
                    const discordUserId = String(colab?.discordUserId || '').trim();
                    // Sem vínculo, inativo ou com o bot desligado no perfil (ausente = ligado): não é falha
                    if (!colab || colab.active === false || !isValidDiscordId(discordUserId) || colab.discordDmEnabled === false) {
                        totals.skipped++;
                        return;
                    }
                    const status = await sendDiscordDm(discordUserId, content, discordCtx);
                    if (status === 'enviado') totals.sent++;
                    else {
                        if (status === 'token-invalido') tokenRejected = true;
                        totals.failed++;
                    }
                } catch {
                    totals.failed++;
                }
            });
        }
    }

    if (tokenRejected) return { status: 502, json: { error: 'token-do-bot-invalido', reason: 'recusado', ...totals } };
    return { status: 200, json: totals };
};

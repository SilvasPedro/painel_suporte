/**
 * Regras da Agenda (funções puras, sem React/Firebase).
 *
 * Documento `agenda_events/{id}`:
 *   {
 *     title, description, location,
 *     date: 'YYYY-MM-DD', startTime: 'HH:MM', endTime: 'HH:MM' | '',
 *     creatorId, creatorName,
 *     participantIds: [uid],                       // usado nas consultas e nas regras
 *     remind: boolean,                             // lembretes por DM: 15 min antes e no horário de início
 *     remindersSent: { m15?: ISO, start?: ISO },   // gravado pelo servidor ao enviar; zera se o horário mudar
 *     responses: { [uid]: { status, name, at } },  // status: pendente | confirmado | recusado
 *     createdAt, updatedAt
 *   }
 */
import { parseISO, toISO, formatBR } from './vacationSchedule';

export const AGENDA_COLLECTION = 'agenda_events';

export const RESPONSE_STATUS = [
    { id: 'pendente', label: 'Aguardando resposta' },
    { id: 'confirmado', label: 'Confirmado' },
    { id: 'recusado', label: 'Recusado' },
];

export const responseLabel = (id) => RESPONSE_STATUS.find((s) => s.id === id)?.label || 'Aguardando resposta';

export const DEFAULT_DURATION_MIN = 60;
export const MAX_PARTICIPANTS = 100; // o envio de DMs aceita no máximo 100 destinatários por pedido

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const newEventId = () => `ev_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const toMinutes = (hhmm) => {
    if (!TIME_RE.test(hhmm || '')) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
};

/** Validação do formulário antes de gravar. @returns {string[]} erros (vazia = válido) */
export const validateEvent = (form) => {
    const errors = [];
    if (!String(form.title || '').trim()) errors.push('Informe o título do evento.');
    if (!DATE_RE.test(form.date || '') || !parseISO(form.date)) errors.push('Informe uma data válida.');
    if (!TIME_RE.test(form.startTime || '')) errors.push('Informe o horário de início.');
    if (form.endTime) {
        if (!TIME_RE.test(form.endTime)) errors.push('Horário de término inválido.');
        else if (toMinutes(form.endTime) <= toMinutes(form.startTime)) errors.push('O término precisa ser depois do início.');
    }
    const count = Array.isArray(form.participantIds) ? form.participantIds.length : 0;
    if (count === 0) errors.push('Marque pelo menos um colaborador para participar.');
    if (count > MAX_PARTICIPANTS) errors.push(`No máximo ${MAX_PARTICIPANTS} participantes por evento.`);
    return errors;
};

/**
 * Monta o documento a gravar. Quem já estava no evento mantém a resposta; quem entrou fica "pendente";
 * quem saiu é removido. Se data ou horário mudaram, as confirmações voltam a "pendente" (a pessoa
 * precisa confirmar o novo horário).
 * @returns {{ payload: object, newlyInvitedIds: string[], resetIds: string[] }}
 */
export const buildEventPayload = (form, creator, existing = null, nowISO = new Date().toISOString()) => {
    const ids = [...new Set((form.participantIds || []).map(String))];
    const names = form.participantNames || {};
    const scheduleChanged = Boolean(existing) && (
        existing.date !== form.date || existing.startTime !== form.startTime || (existing.endTime || '') !== (form.endTime || '')
    );

    const responses = {};
    const newlyInvitedIds = [];
    const resetIds = [];
    ids.forEach((id) => {
        const prev = existing?.responses?.[id];
        if (prev && !scheduleChanged) {
            responses[id] = { ...prev, name: names[id] || prev.name || '' };
        } else {
            responses[id] = { status: 'pendente', name: names[id] || prev?.name || '', at: nowISO };
            if (!prev) newlyInvitedIds.push(id);
            else if (prev.status !== 'pendente') resetIds.push(id);
        }
    });

    const payload = {
        title: String(form.title || '').trim().slice(0, 120),
        description: String(form.description || '').trim().slice(0, 1000),
        location: String(form.location || '').trim().slice(0, 120),
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime || '',
        participantIds: ids,
        responses,
        remind: form.remind === true,
        // Já enviados continuam valendo; se data/horário mudaram, os lembretes valem de novo
        remindersSent: scheduleChanged ? {} : (existing?.remindersSent || {}),
        creatorId: existing?.creatorId || creator.id,
        creatorName: existing?.creatorName || creator.name || '',
        createdAt: existing?.createdAt || nowISO,
        updatedAt: nowISO,
    };
    return { payload, newlyInvitedIds, resetIds };
};

/** Quem precisa ser avisado por DM: os recém-convidados e quem teve a confirmação zerada por mudança de horário. */
export const idsToNotify = ({ newlyInvitedIds = [], resetIds = [] }, creatorId = '') =>
    [...new Set([...newlyInvitedIds, ...resetIds])].filter((id) => id !== creatorId);

export const myResponse = (event, uid) => event?.responses?.[uid]?.status || null;

export const isParticipant = (event, uid) => Array.isArray(event?.participantIds) && event.participantIds.includes(uid);

export const eventSortKey = (e) => `${e.date || ''} ${e.startTime || '00:00'}`;

export const sortEvents = (events) => [...events].sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b)));

/** Eventos em que a pessoa participa ou que ela marcou. */
export const eventsForUser = (events, uid) =>
    events.filter((e) => isParticipant(e, uid) || e.creatorId === uid);

/** Eventos de hoje em diante (já ordenados). */
export const upcomingEvents = (events, todayISO) => sortEvents(events.filter((e) => (e.date || '') >= todayISO));

/** Convites aguardando resposta da pessoa, de hoje em diante. */
export const pendingInvites = (events, uid, todayISO) =>
    upcomingEvents(events, todayISO).filter((e) => isParticipant(e, uid) && myResponse(e, uid) === 'pendente');

/** Contagem de respostas de um evento. */
export const summarizeResponses = (event) => {
    const counts = { total: 0, pendente: 0, confirmado: 0, recusado: 0 };
    (event?.participantIds || []).forEach((id) => {
        const status = event.responses?.[id]?.status;
        counts.total++;
        counts[status === 'confirmado' || status === 'recusado' ? status : 'pendente']++;
    });
    return counts;
};

export const formatEventTime = (e) => (e.endTime ? `${e.startTime} às ${e.endTime}` : `${e.startTime}`);

export const formatEventWhen = (e) => `${formatBR(e.date)} · ${formatEventTime(e)}`;

/** Grade de 6 semanas (42 dias, domingo primeiro) do mês indicado (month 0-11). */
export const monthGrid = (year, month) => {
    const first = new Date(year, month, 1);
    const start = new Date(year, month, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
        return { iso: toISO(d), day: d.getDate(), inMonth: d.getMonth() === month };
    });
};

/** { 'YYYY-MM-DD': [eventos ordenados] } */
export const eventsByDay = (events) => {
    const map = {};
    sortEvents(events).forEach((e) => { (map[e.date] ||= []).push(e); });
    return map;
};

const rangeOf = (e) => {
    const start = toMinutes(e.startTime);
    if (start === null) return null;
    const end = toMinutes(e.endTime);
    return [start, end !== null && end > start ? end : start + DEFAULT_DURATION_MIN];
};

/**
 * Participantes que já têm outro evento no mesmo horário.
 * @returns {{ [participantId]: string[] }} títulos dos eventos conflitantes
 */
export const participantConflicts = (events, candidate, participantIds) => {
    const mine = rangeOf(candidate);
    if (!mine || !candidate.date) return {};
    const out = {};
    events.forEach((e) => {
        if (e.id && e.id === candidate.id) return;
        if (e.date !== candidate.date) return;
        const other = rangeOf(e);
        if (!other || !(mine[0] < other[1] && other[0] < mine[1])) return;
        participantIds.forEach((id) => {
            // quem recusou o outro evento não tem conflito
            if (isParticipant(e, id) && myResponse(e, id) !== 'recusado') (out[id] ||= []).push(e.title);
        });
    });
    return out;
};

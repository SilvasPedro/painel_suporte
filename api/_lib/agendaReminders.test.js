import { describe, it, expect } from 'vitest';
import { eventStartMs, candidateDates, dueReminders, reminderRecipients, processAgendaReminders } from './agendaReminders.js';
import { buildDmContent } from './dm.js';

const FAKE_TOKEN = 'MTIzNDU2.abcdEF.ghijKLmnop-qrst_uvw';
const MIN = 60 * 1000;
// Evento às 14:00 de Brasília (17:00 UTC)
const START = Date.UTC(2026, 11, 10, 17, 0);
const baseEvent = (o = {}) => ({
    id: 'ev1', title: 'Treinamento', date: '2026-12-10', startTime: '14:00', endTime: '15:00', location: 'Sala 2',
    creatorId: 'gestor', participantIds: ['ana', 'bia'], responses: {}, remind: true, ...o
});

describe('horários', () => {
    it('converte data e hora de Brasília para o instante correto', () => {
        expect(eventStartMs(baseEvent())).toBe(START);
        expect(eventStartMs({ date: 'x', startTime: '14:00' })).toBeNull();
    });
    it('hoje e amanhã em Brasília (às 22h BRT já é o dia seguinte em UTC)', () => {
        expect(candidateDates(Date.UTC(2026, 11, 11, 1, 0))).toEqual(['2026-12-10', '2026-12-11']);
    });
});

describe('dueReminders', () => {
    it('não envia antes da janela de 15 minutos', () => {
        expect(dueReminders(baseEvent(), START - 16 * MIN)).toEqual([]);
    });
    it('envia o lembrete de 15 min com os minutos restantes', () => {
        expect(dueReminders(baseEvent(), START - 15 * MIN)).toEqual([{ key: 'm15', minutes: 15 }]);
        expect(dueReminders(baseEvent(), START - 12 * MIN + 1000)).toEqual([{ key: 'm15', minutes: 12 }]);
    });
    it('envia o lembrete do início e não repete o de 15 min depois da hora', () => {
        expect(dueReminders(baseEvent(), START)).toEqual([{ key: 'start', minutes: 0 }]);
        expect(dueReminders(baseEvent(), START + 5 * MIN)).toEqual([{ key: 'start', minutes: 0 }]);
    });
    it('descarta lembrete muito atrasado', () => {
        expect(dueReminders(baseEvent(), START + 11 * MIN)).toEqual([]);
    });
    it('respeita o que já foi enviado e o lembrete desligado', () => {
        expect(dueReminders(baseEvent({ remindersSent: { m15: 'x' } }), START - 10 * MIN)).toEqual([]);
        expect(dueReminders(baseEvent({ remind: false }), START)).toEqual([]);
        expect(dueReminders(baseEvent({ remind: undefined }), START)).toEqual([]);
    });
});

describe('reminderRecipients', () => {
    it('inclui o organizador e tira quem recusou', () => {
        const e = baseEvent({ responses: { ana: { status: 'recusado' }, bia: { status: 'confirmado' } } });
        expect(reminderRecipients(e)).toEqual(['gestor', 'bia']);
    });
});

describe('buildDmContent: lembrete', () => {
    it('antes do início', () => {
        const t = buildDmContent('agenda_reminder', { title: 'Treino', date: '2026-12-10', startTime: '14:00', location: 'Sala 2', minutes: 15 }, 'https://h/x');
        expect(t).toContain('começa em 15 minutos');
        expect(t).toContain('10/12/2026 · 14:00');
        expect(t).toContain('Sala 2');
    });
    it('no início', () => {
        expect(buildDmContent('agenda_reminder', { title: 'Treino', minutes: 0 }, '')).toContain('começa agora');
    });
});

describe('processAgendaReminders', () => {
    const makeStore = ({ events = [baseEvent()], dm = { enabled: true, events: {} }, collabs = {} } = {}) => {
        const marks = [];
        return {
            marks,
            listEvents: async () => events,
            markSent: async (id, key) => { marks.push(`${id}:${key}`); },
            getCollaborator: async (id) => collabs[id] ?? null,
            getDmConfig: async () => ({ dm })
        };
    };
    const linked = { discordUserId: '123456789012345678' };
    const makeFetch = () => {
        const sent = [];
        const fetchImpl = async (url, opt = {}) => {
            if (url.endsWith('/users/@me/channels')) return { ok: true, status: 200, json: async () => ({ id: 'ch' }) };
            sent.push(JSON.parse(opt.body).content);
            return { ok: true, status: 200, json: async () => ({}) };
        };
        return { fetchImpl, sent };
    };
    const env = { DISCORD_BOT_TOKEN: FAKE_TOKEN };

    it('envia aos vinculados, pula quem não tem Discord e marca como enviado', async () => {
        const store = makeStore({ collabs: { gestor: linked, ana: linked, bia: { active: true } } });
        const { fetchImpl, sent } = makeFetch();
        const { status, json } = await processAgendaReminders({ store, env, fetchImpl, now: START - 15 * MIN });
        expect(status).toBe(200);
        expect(json).toMatchObject({ events: 1, sent: 2, skipped: 1 });
        expect(sent).toHaveLength(2);
        expect(store.marks).toEqual(['ev1:m15']);
    });

    it('não reenvia o que já foi marcado', async () => {
        const store = makeStore({ events: [baseEvent({ remindersSent: { m15: 'x' } })], collabs: { ana: linked } });
        const { fetchImpl, sent } = makeFetch();
        await processAgendaReminders({ store, env, fetchImpl, now: START - 10 * MIN });
        expect(sent).toHaveLength(0);
        expect(store.marks).toEqual([]);
    });

    it('respeita a configuração de DM e o tipo de aviso desmarcado', async () => {
        const { fetchImpl, sent } = makeFetch();
        const off = await processAgendaReminders({ store: makeStore({ dm: { enabled: false }, collabs: { ana: linked } }), env, fetchImpl, now: START });
        expect(off.json.skipped).toBe('dm-desativado');
        const unchecked = await processAgendaReminders({ store: makeStore({ dm: { enabled: true, events: { agenda_reminder: false } }, collabs: { ana: linked } }), env, fetchImpl, now: START });
        expect(unchecked.json.skipped).toBe('evento-desmarcado');
        expect(sent).toHaveLength(0);
    });

    it('respeita o bot desligado no perfil', async () => {
        const store = makeStore({ collabs: { ana: { ...linked, discordDmEnabled: false } } });
        const { fetchImpl, sent } = makeFetch();
        await processAgendaReminders({ store, env, fetchImpl, now: START });
        expect(sent).toHaveLength(0);
    });

    it('sem token do bot não faz nada', async () => {
        const r = await processAgendaReminders({ store: makeStore(), env: {}, now: START });
        expect(r.status).toBe(503);
    });
});

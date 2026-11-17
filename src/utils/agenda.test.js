import { describe, it, expect } from 'vitest';
import {
    validateEvent, buildEventPayload, idsToNotify, pendingInvites, summarizeResponses, monthGrid,
    eventsByDay, participantConflicts, upcomingEvents, eventsForUser, MAX_PARTICIPANTS, formatEventWhen
} from './agenda';
import { myVacationSummary } from './vacationSchedule';

const form = (over = {}) => ({
    title: 'Reunião', description: '', location: 'Sala 2', date: '2026-12-10',
    startTime: '14:00', endTime: '15:00', participantIds: ['a', 'b'], participantNames: { a: 'Ana', b: 'Bia' }, ...over
});

describe('validateEvent', () => {
    it('aceita um evento completo', () => expect(validateEvent(form())).toEqual([]));

    it('exige título, data, início e participantes', () => {
        const errors = validateEvent(form({ title: ' ', date: '', startTime: '', participantIds: [] }));
        expect(errors).toHaveLength(4);
    });

    it('rejeita término antes do início e hora inválida', () => {
        expect(validateEvent(form({ endTime: '13:00' }))[0]).toMatch(/depois do início/);
        expect(validateEvent(form({ startTime: '25:00' }))[0]).toMatch(/início/);
    });

    it('limita os participantes', () => {
        const many = Array.from({ length: MAX_PARTICIPANTS + 1 }, (_, i) => `u${i}`);
        expect(validateEvent(form({ participantIds: many })).join()).toMatch(/No máximo/);
    });
});

describe('buildEventPayload', () => {
    const creator = { id: 'gestor', name: 'Gestor' };

    it('evento novo: todos pendentes e todos a avisar', () => {
        const { payload, newlyInvitedIds } = buildEventPayload(form(), creator, null, '2026-11-17T10:00:00.000Z');
        expect(payload.participantIds).toEqual(['a', 'b']);
        expect(payload.responses.a).toMatchObject({ status: 'pendente', name: 'Ana' });
        expect(payload.creatorId).toBe('gestor');
        expect(newlyInvitedIds).toEqual(['a', 'b']);
    });

    it('edição sem mudar horário mantém respostas, avisa só quem entrou e remove quem saiu', () => {
        const existing = { ...form(), creatorId: 'gestor', createdAt: 'x', responses: { a: { status: 'confirmado', name: 'Ana' }, b: { status: 'recusado', name: 'Bia' } } };
        const { payload, newlyInvitedIds, resetIds } = buildEventPayload(
            form({ participantIds: ['a', 'c'], participantNames: { a: 'Ana', c: 'Caio' }, title: 'Reunião 2' }), creator, existing);
        expect(payload.responses.a.status).toBe('confirmado');
        expect(payload.responses.b).toBeUndefined();
        expect(payload.responses.c.status).toBe('pendente');
        expect(payload.createdAt).toBe('x');
        expect(newlyInvitedIds).toEqual(['c']);
        expect(resetIds).toEqual([]);
    });

    it('mudar data ou horário zera confirmações e recusas e manda nova DM', () => {
        const existing = { ...form(), creatorId: 'gestor', responses: { a: { status: 'confirmado' }, b: { status: 'pendente' } } };
        const { payload, resetIds } = buildEventPayload(form({ startTime: '16:00', endTime: '17:00' }), creator, existing);
        expect(payload.responses.a.status).toBe('pendente');
        expect(resetIds).toEqual(['a']);
        expect(idsToNotify({ newlyInvitedIds: ['c'], resetIds }, 'gestor')).toEqual(['c', 'a']);
    });

    it('quem marcou o evento não recebe aviso de si mesmo', () => {
        expect(idsToNotify({ newlyInvitedIds: ['gestor', 'a'] }, 'gestor')).toEqual(['a']);
    });
});

describe('consultas', () => {
    const events = [
        { id: '1', title: 'Passado', date: '2026-11-01', startTime: '09:00', participantIds: ['a'], responses: { a: { status: 'pendente' } } },
        { id: '2', title: 'Hoje tarde', date: '2026-11-17', startTime: '15:00', participantIds: ['a', 'b'], responses: { a: { status: 'pendente' }, b: { status: 'confirmado' } } },
        { id: '3', title: 'Hoje cedo', date: '2026-11-17', startTime: '08:00', participantIds: ['a'], responses: { a: { status: 'recusado' } } },
        { id: '4', title: 'Outro', date: '2026-12-01', startTime: '10:00', creatorId: 'a', participantIds: ['b'], responses: { b: { status: 'pendente' } } },
    ];

    it('upcomingEvents ordena e descarta o passado', () => {
        expect(upcomingEvents(events, '2026-11-17').map(e => e.id)).toEqual(['3', '2', '4']);
    });

    it('pendingInvites só traz convites sem resposta de hoje em diante', () => {
        expect(pendingInvites(events, 'a', '2026-11-17').map(e => e.id)).toEqual(['2']);
        expect(pendingInvites(events, 'b', '2026-11-17').map(e => e.id)).toEqual(['4']);
    });

    it('eventsForUser inclui quem participa e quem marcou', () => {
        expect(eventsForUser(events, 'a').map(e => e.id).sort()).toEqual(['1', '2', '3', '4']);
        expect(eventsForUser(events, 'b').map(e => e.id).sort()).toEqual(['2', '4']);
    });

    it('summarizeResponses conta por status', () => {
        expect(summarizeResponses(events[1])).toEqual({ total: 2, pendente: 1, confirmado: 1, recusado: 0 });
    });

    it('eventsByDay agrupa por data em ordem de horário', () => {
        const map = eventsByDay(events);
        expect(map['2026-11-17'].map(e => e.id)).toEqual(['3', '2']);
    });

    it('formatEventWhen mostra data e faixa de horário', () => {
        expect(formatEventWhen({ date: '2026-12-10', startTime: '14:00', endTime: '15:30' })).toBe('10/12/2026 · 14:00 às 15:30');
        expect(formatEventWhen({ date: '2026-12-10', startTime: '14:00' })).toBe('10/12/2026 · 14:00');
    });
});

describe('participantConflicts', () => {
    const events = [
        { id: 'x', title: 'Treino', date: '2026-12-10', startTime: '14:30', endTime: '15:30', participantIds: ['a', 'b'], responses: { a: { status: 'confirmado' }, b: { status: 'recusado' } } },
        { id: 'y', title: 'Outro dia', date: '2026-12-11', startTime: '14:00', participantIds: ['a'], responses: { a: { status: 'pendente' } } },
    ];
    it('aponta quem já tem evento sobreposto, ignorando recusas, outros dias e o próprio evento', () => {
        const cand = { id: 'novo', date: '2026-12-10', startTime: '14:00', endTime: '15:00' };
        expect(participantConflicts(events, cand, ['a', 'b', 'c'])).toEqual({ a: ['Treino'] });
        expect(participantConflicts(events, { ...cand, id: 'x' }, ['a'])).toEqual({});
        expect(participantConflicts(events, { ...cand, startTime: '15:30', endTime: '16:00' }, ['a'])).toEqual({});
    });
    it('sem horário de término usa 1 hora', () => {
        const cand = { date: '2026-12-10', startTime: '15:20' };
        expect(participantConflicts(events, cand, ['a'])).toEqual({ a: ['Treino'] });
    });
});

describe('monthGrid', () => {
    it('gera 42 dias começando no domingo e marca os do mês', () => {
        const grid = monthGrid(2026, 10); // novembro/2026 começa num domingo
        expect(grid).toHaveLength(42);
        expect(grid[0]).toMatchObject({ iso: '2026-11-01', inMonth: true });
        expect(grid.filter(c => c.inMonth)).toHaveLength(30);
        expect(monthGrid(2026, 11)[0].iso).toBe('2026-11-29'); // dezembro/2026 começa numa terça
    });
});

describe('myVacationSummary', () => {
    const entries = [
        { id: '1', colabId: 'a', start: '2027-07-12', end: '2027-07-21', status: 'planejada' },
        { id: '2', colabId: 'a', start: '2027-01-04', end: '2027-01-13', status: 'confirmada' },
        { id: '3', colabId: 'b', start: '2027-03-01', end: '2027-03-30' },
    ];
    it('devolve só as do colaborador, ordenadas, com total e próxima', () => {
        const s = myVacationSummary(entries, 'a', '2026-11-17');
        expect(s.entries.map(e => e.id)).toEqual(['2', '1']);
        expect(s.totalDays).toBe(20);
        expect(s.next.id).toBe('2');
        expect(s.current).toBeNull();
        expect(s.daysUntilNext).toBe(48);
    });
    it('identifica férias em andamento', () => {
        const s = myVacationSummary(entries, 'a', '2027-07-15');
        expect(s.current.id).toBe('1');
        expect(s.next).toBeNull();
    });
    it('sem registros', () => {
        expect(myVacationSummary(undefined, 'a', '2027-01-01')).toMatchObject({ entries: [], totalDays: 0, current: null, next: null });
    });
});

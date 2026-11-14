import { describe, it, expect } from 'vitest';
import {
    normalizeStatus, isClosedStatus, toMillis, formatDateOnly, formatDateTime, createEvent, createComment,
    parseComment, buildActivityFeed, getStageDates, getLastActivityMillis, getIdleLabel, describeEvent, validateComposer
} from './reportTimeline';

const at = (iso) => new Date(iso).getTime();

describe('status e datas', () => {
    it('normaliza nomes antigos para os cinco status atuais', () => {
        expect(normalizeStatus('Concluído')).toBe('Resolvido');
        expect(normalizeStatus('Recusado')).toBe('Cancelado');
        expect(normalizeStatus('Em análise')).toBe('Em Andamento');
        expect(normalizeStatus('Suspenso')).toBe('Suspenso');
        expect(normalizeStatus(undefined)).toBe('Pendente');
        expect(isClosedStatus('Concluído')).toBe(true);
        expect(isClosedStatus('Em Andamento')).toBe(false);
    });

    it('toMillis aceita ISO, Date, Timestamp e rejeita lixo', () => {
        expect(toMillis('2026-11-10T10:00:00.000Z')).toBe(at('2026-11-10T10:00:00.000Z'));
        expect(toMillis(new Date('2026-11-10T10:00:00Z'))).toBe(at('2026-11-10T10:00:00Z'));
        expect(toMillis({ seconds: 100 })).toBe(100000);
        expect(toMillis({ toMillis: () => 5 })).toBe(5);
        expect(toMillis('')).toBeNull();
        expect(toMillis('abc')).toBeNull();
    });

    it('formatDateOnly não desloca o dia de datas AAAA-MM-DD', () => {
        expect(formatDateOnly('2026-11-13')).toBe('13/11/2026');
        expect(formatDateOnly('')).toBe('--');
        expect(formatDateOnly({ seconds: new Date(2026, 10, 13, 12).getTime() / 1000 })).toBe('13/11/2026');
    });

    it('formatDateTime diferencia hoje de outros dias', () => {
        const now = new Date(2026, 10, 11, 15, 0);
        expect(formatDateTime(new Date(2026, 10, 11, 9, 5), now)).toBe('Hoje às 09:05');
        expect(formatDateTime(new Date(2026, 10, 10, 9, 5), now)).toBe('10/11/2026 às 09:05');
        expect(formatDateTime('x', now)).toBe('');
    });
});

describe('eventos e comentários', () => {
    const actor = { id: 'u1', name: 'Rafael', role: 'Gestor' };

    it('createEvent e createComment gravam autor, data e tipo', () => {
        const now = new Date('2026-11-11T12:00:00Z');
        const e = createEvent({ type: 'status', actor, from: 'Pendente', to: 'Em Andamento', now });
        expect(e).toMatchObject({ type: 'status', actorName: 'Rafael', from: 'Pendente', to: 'Em Andamento', createdAt: now.toISOString() });
        const c = createComment({ text: '  ok  ', actor, kind: 'opinion', status: 'Concluído', now });
        expect(c).toMatchObject({ kind: 'opinion', content: 'ok', status: 'Resolvido', isStaff: false });
        expect(createComment({ text: 'a', actor }).status).toBeUndefined();
    });

    it('parseComment reconhece o parecer antigo com prefixo', () => {
        const legacy = parseComment({ content: '[Parecer da Gestão • Status: Resolvido]\nCache reiniciado.' });
        expect(legacy).toMatchObject({ isOpinion: true, text: 'Cache reiniciado.' });
        expect(parseComment({ content: 'olá' })).toMatchObject({ isOpinion: false, text: 'olá' });
        expect(parseComment({ kind: 'opinion', content: 'x' }).isOpinion).toBe(true);
    });

    it('describeEvent monta o texto de cada tipo', () => {
        expect(describeEvent({ type: 'status', actorName: 'Ana', from: 'Pendente', to: 'Suspenso' }))
            .toMatchObject({ who: 'Ana', text: 'mudou o status para Suspenso', detail: 'Antes: Pendente' });
        expect(describeEvent({ type: 'assigned', actorName: 'Ana', targetName: 'Pedro' }).text).toBe('atribuiu o chamado a Pedro');
        expect(describeEvent({ type: 'assigned', actorName: 'Ana' }).text).toMatch(/fila da liderança/);
        expect(describeEvent({ type: 'watcher_added', actorName: 'Ana', targetName: 'Lucas' }).text).toMatch(/Lucas/);
    });
});

describe('linha do tempo unificada', () => {
    const report = {
        createdAt: '2026-11-10T10:00:00.000Z', creatorName: 'Camila', status: 'Em Andamento',
        events: [
            { id: 'e2', type: 'status', from: 'Pendente', to: 'Em Andamento', createdAt: '2026-11-11T09:00:00.000Z' },
            { id: 'e1', type: 'assigned', targetName: 'Pedro', createdAt: '2026-11-11T08:00:00.000Z' }
        ],
        comments: [
            { id: 'c1', content: 'Voltou a acontecer', createdAt: '2026-11-11T08:30:00.000Z' },
            { id: 'c0', content: 'sem data' }
        ]
    };

    it('mistura abertura, eventos e comentários em ordem cronológica', () => {
        const feed = buildActivityFeed(report);
        expect(feed.map(i => i.key)).toEqual(['created', 'e1', 'c1', 'e2', 'c0']);
        expect(feed[0]).toMatchObject({ kind: 'created', actorName: 'Camila' });
        expect(buildActivityFeed(null)).toEqual([]);
        expect(buildActivityFeed({ createdAt: '2026-11-10T10:00:00Z' }).length).toBe(1);
    });

    it('getStageDates usa os eventos de status', () => {
        const stages = getStageDates({
            ...report,
            events: [
                { type: 'status', to: 'Em Andamento', createdAt: '2026-11-11T09:00:00.000Z' },
                { type: 'status', to: 'Resolvido', createdAt: '2026-11-12T09:00:00.000Z' }
            ]
        });
        expect(stages.registered).toBe(at('2026-11-10T10:00:00.000Z'));
        expect(stages.progress).toBe(at('2026-11-11T09:00:00.000Z'));
        expect(stages.closed).toBe(at('2026-11-12T09:00:00.000Z'));
        expect(stages.paused).toBeNull();
        expect(getStageDates({}).progress).toBeNull();
    });
});

describe('tempo parado', () => {
    const base = { status: 'Em Andamento', createdAt: '2026-11-10T10:00:00.000Z' };

    it('usa a última movimentação do chamado', () => {
        const r = { ...base, comments: [{ createdAt: '2026-11-11T12:00:00.000Z' }], updatedAt: '2026-11-11T13:00:00.000Z' };
        expect(getLastActivityMillis(r)).toBe(at('2026-11-11T13:00:00.000Z'));
    });

    it('mostra horas, dias e some quando recente ou encerrado', () => {
        expect(getIdleLabel(base, at('2026-11-10T13:30:00.000Z'))).toBe('Sem movimentação há 3h');
        expect(getIdleLabel(base, at('2026-11-14T10:00:00.000Z'))).toBe('Sem movimentação há 4 dias');
        expect(getIdleLabel(base, at('2026-11-10T10:30:00.000Z'))).toBeNull();
        expect(getIdleLabel({ ...base, status: 'Resolvido' }, at('2026-11-20T10:00:00.000Z'))).toBeNull();
        expect(getIdleLabel(null)).toBeNull();
    });
});

describe('validateComposer', () => {
    it('comentário exige texto', () => {
        expect(validateComposer({ tab: 'comment', text: ' ', status: 'Pendente', currentStatus: 'Pendente' }).length).toBe(1);
        expect(validateComposer({ tab: 'comment', text: 'oi', status: 'Pendente', currentStatus: 'Pendente' })).toEqual([]);
    });

    it('encerrar ou suspender pede parecer; só mudar de status sem texto é aceito nos demais casos', () => {
        expect(validateComposer({ tab: 'opinion', text: '', status: 'Resolvido', currentStatus: 'Pendente' })[0]).toMatch(/encerrar/);
        expect(validateComposer({ tab: 'opinion', text: '', status: 'Cancelado', currentStatus: 'Pendente' })[0]).toMatch(/encerrar/);
        expect(validateComposer({ tab: 'opinion', text: '', status: 'Suspenso', currentStatus: 'Pendente' })[0]).toMatch(/suspensão/);
        expect(validateComposer({ tab: 'opinion', text: '', status: 'Em Andamento', currentStatus: 'Pendente' })).toEqual([]);
        expect(validateComposer({ tab: 'opinion', text: '', status: 'Pendente', currentStatus: 'Pendente' })[0]).toMatch(/parecer/);
        expect(validateComposer({ tab: 'opinion', text: 'feito', status: 'Resolvido', currentStatus: 'Pendente' })).toEqual([]);
    });
});

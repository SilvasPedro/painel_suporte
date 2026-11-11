import { describe, it, expect } from 'vitest';
import {
    toDateKey, daysBetween, getDaysToFirstContact, computeSmartPreStats, getServiceHealth,
    filterByPeriod, buildMonthlyTimeline, validateSmartPreClient, createSmartPreComment, matchesSearch, buildSmartPrePayload
} from './smartPre';

const client = (over = {}) => ({
    clientName: 'Ana', installedAt: '2026-11-01', contacted: false, status: 'monitoring', issues: [], ...over
});

describe('datas', () => {
    it('toDateKey aceita texto, ISO, Date e Timestamp', () => {
        expect(toDateKey('2026-11-05')).toBe('2026-11-05');
        expect(toDateKey('2026-11-05T10:00:00.000Z')).toBe('2026-11-05');
        expect(toDateKey(new Date(2026, 10, 5))).toBe('2026-11-05');
        expect(toDateKey({ toDate: () => new Date(2026, 10, 5) })).toBe('2026-11-05');
        expect(toDateKey('lixo')).toBe('');
        expect(toDateKey(null)).toBe('');
    });

    it('daysBetween conta dias inteiros e rejeita datas inválidas ou invertidas', () => {
        expect(daysBetween('2026-11-01', '2026-11-04')).toBe(3);
        expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1);
        expect(daysBetween('2026-11-04', '2026-11-01')).toBeNull();
        expect(daysBetween('', '2026-11-01')).toBeNull();
    });

    it('getDaysToFirstContact só existe quando houve contato', () => {
        expect(getDaysToFirstContact(client())).toBeNull();
        expect(getDaysToFirstContact(client({ contacted: true, firstContactAt: '2026-11-03' }))).toBe(2);
        expect(getDaysToFirstContact(client({ contacted: true, firstContactAt: '' }))).toBeNull();
    });
});

describe('computeSmartPreStats', () => {
    const list = [
        client({ contacted: true, firstContactAt: '2026-11-01', issues: ['slow'], status: 'resolved', resolutionType: 'remote' }),
        client({ contacted: true, firstContactAt: '2026-11-03', issues: ['no_connection', 'equipment'], status: 'in_progress', resolutionType: 'technical_visit' }),
        client({ contacted: true, firstContactAt: '2026-11-09', issues: ['no_connection'], status: 'resolved', resolutionType: 'it' }),
        client(),
    ];

    it('conta contatos, taxa e tempo médio/mediano até o primeiro contato', () => {
        const s = computeSmartPreStats(list);
        expect(s).toMatchObject({ total: 4, contacted: 3, noContact: 1, contactRate: 75 });
        expect(s.avgDaysToContact).toBe(3.3); // (0 + 2 + 8) / 3
        expect(s.medianDaysToContact).toBe(2);
    });

    it('agrupa por faixa de tempo, status e tipo de resolução', () => {
        const s = computeSmartPreStats(list);
        expect(s.buckets.find(b => b.id === 'd0').count).toBe(1);
        expect(s.buckets.find(b => b.id === 'd1_3').count).toBe(1);
        expect(s.buckets.find(b => b.id === 'd8_15').count).toBe(1);
        expect(s.statusCounts).toEqual({ monitoring: 1, in_progress: 1, resolved: 2 });
        expect(s.resolutionCounts).toMatchObject({ remote: 1, technical_visit: 1, it: 1 });
        expect(s.escalated).toBe(2);
        expect(s.escalationRate).toBe(67);
        expect(s.remoteRate).toBe(33);
        expect(s.resolvedRate).toBe(67);
    });

    it('ranqueia as solicitações mais frequentes', () => {
        const s = computeSmartPreStats(list);
        expect(s.issues[0]).toMatchObject({ id: 'no_connection', count: 2 });
        expect(s.issues.map(i => i.id)).toEqual(expect.arrayContaining(['slow', 'equipment']));
    });

    it('lista vazia não quebra', () => {
        const s = computeSmartPreStats([]);
        expect(s).toMatchObject({ total: 0, contactRate: 0, avgDaysToContact: null, medianDaysToContact: null });
    });
});

describe('getServiceHealth', () => {
    it('classifica pela taxa de contato', () => {
        expect(getServiceHealth(computeSmartPreStats([])).level).toBe('empty');
        const many = (contacted, total) => Array.from({ length: total }, (_, i) => client(i < contacted ? { contacted: true, firstContactAt: '2026-11-02', issues: ['slow'], status: 'resolved', resolutionType: 'remote' } : {}));
        expect(getServiceHealth(computeSmartPreStats(many(2, 10))).level).toBe('good');
        expect(getServiceHealth(computeSmartPreStats(many(4, 10))).level).toBe('attention');
        expect(getServiceHealth(computeSmartPreStats(many(8, 10))).level).toBe('critical');
    });

    it('muitos encaminhamentos rebaixam "indo bem" para atenção', () => {
        const list = [
            ...Array.from({ length: 2 }, () => client({ contacted: true, firstContactAt: '2026-11-02', issues: ['equipment'], status: 'resolved', resolutionType: 'technical_visit' })),
            ...Array.from({ length: 8 }, () => client())
        ];
        const health = getServiceHealth(computeSmartPreStats(list));
        expect(health.level).toBe('attention');
        expect(health.hint).toContain('encaminhamentos');
    });
});

describe('filtros e linha do tempo', () => {
    const now = new Date(2026, 10, 10);

    it('filterByPeriod usa a data de instalação', () => {
        const items = [client({ installedAt: '2026-11-08' }), client({ installedAt: '2026-10-01' }), client({ installedAt: '' })];
        expect(filterByPeriod(items, '7', now)).toHaveLength(1);
        expect(filterByPeriod(items, '90', now)).toHaveLength(2);
        expect(filterByPeriod(items, 'all', now)).toHaveLength(3);
    });

    it('buildMonthlyTimeline soma entradas e contatos por mês', () => {
        const items = [client({ installedAt: '2026-11-02', contacted: true }), client({ installedAt: '2026-11-05' }), client({ installedAt: '2026-10-20' })];
        const t = buildMonthlyTimeline(items, 3, now);
        expect(t.map(s => s.key)).toEqual(['2026-09', '2026-10', '2026-11']);
        expect(t[2]).toMatchObject({ label: 'nov/26', entered: 2, contacted: 1 });
        expect(t[1].entered).toBe(1);
    });

    it('matchesSearch procura em nome, código, telefone e cidade', () => {
        const c = client({ clientName: 'Maria Souza', erpCode: 'A123', phone: '(11) 99999', city: 'Campinas' });
        expect(matchesSearch(c, 'maria')).toBe(true);
        expect(matchesSearch(c, 'a123')).toBe(true);
        expect(matchesSearch(c, 'campinas')).toBe(true);
        expect(matchesSearch(c, 'xyz')).toBe(false);
        expect(matchesSearch(c, '')).toBe(true);
    });
});

describe('validateSmartPreClient', () => {
    const today = '2026-11-10';

    it('exige nome e data de instalação, sem data futura', () => {
        expect(validateSmartPreClient({}, today)).toHaveLength(2);
        expect(validateSmartPreClient({ clientName: 'A', installedAt: '2026-12-01' }, today)[0]).toMatch(/futura/);
        expect(validateSmartPreClient({ clientName: 'A', installedAt: '2026-11-01' }, today)).toEqual([]);
    });

    it('com contato exige data coerente, problema e forma de resolução quando resolvido', () => {
        const base = { clientName: 'A', installedAt: '2026-11-05', contacted: true };
        expect(validateSmartPreClient(base, today).join(' ')).toMatch(/primeiro contato/);
        expect(validateSmartPreClient({ ...base, firstContactAt: '2026-11-01', issues: ['slow'] }, today).join(' ')).toMatch(/anterior/);
        expect(validateSmartPreClient({ ...base, firstContactAt: '2026-11-06' }, today).join(' ')).toMatch(/problema/);
        expect(validateSmartPreClient({ ...base, firstContactAt: '2026-11-06', issues: ['slow'], status: 'resolved' }, today).join(' ')).toMatch(/resolvido/);
        expect(validateSmartPreClient({ ...base, firstContactAt: '2026-11-06', issues: ['slow'], status: 'resolved', resolutionType: 'remote' }, today)).toEqual([]);
    });
});

describe('buildSmartPrePayload', () => {
    it('sem contato zera os campos dependentes e mantém "em acompanhamento"', () => {
        const p = buildSmartPrePayload({ clientName: '  Ana ', installedAt: '2026-11-01', contacted: false, issues: ['slow'], status: 'resolved', resolutionType: 'remote', firstContactAt: '2026-11-02' });
        expect(p).toMatchObject({ clientName: 'Ana', contacted: false, firstContactAt: '', issues: [], status: 'monitoring', resolutionType: '' });
    });

    it('com contato preserva dados e ignora tratativa inválida', () => {
        const p = buildSmartPrePayload({ clientName: 'Ana', installedAt: '2026-11-01', contacted: true, firstContactAt: '2026-11-02', issues: ['slow', 'slow'], status: 'in_progress', resolutionType: 'xpto', contactChannel: 'Telefone' });
        expect(p).toMatchObject({ contacted: true, firstContactAt: '2026-11-02', issues: ['slow'], status: 'in_progress', resolutionType: '' });
        expect(Object.values(p).includes(undefined)).toBe(false);
    });
});

describe('createSmartPreComment', () => {
    it('monta o comentário no formato de Tarefas & Relatórios', () => {
        const c = createSmartPreComment({ authorId: 'u1', authorName: 'Ana', authorRole: 'Apoio', text: '  oi  ', now: new Date('2026-11-10T10:00:00Z') });
        expect(c).toMatchObject({ authorId: 'u1', authorName: 'Ana', authorRole: 'Apoio', content: 'oi', createdAt: '2026-11-10T10:00:00.000Z' });
        expect(c.id).toMatch(/^cmt_/);
    });
});

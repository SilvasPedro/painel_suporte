import { describe, it, expect } from 'vitest';
import {
    toDateKey, daysBetween, getProtocols, getClientStatus, getDaysToFirstContact, getProtocolDuration,
    computeSmartPreStats, getServiceHealth, filterByPeriod, buildMonthlyTimeline, matchesSearch,
    validateSmartPreClient, validateProtocol, formatPhone, flattenProtocols, matchesProtocolSearch, getProtocolIssueLabel, SMART_PRE_ISSUES, buildSmartPrePayload, buildProtocolRecord,
    upsertProtocol, removeProtocol, createSmartPreComment, getResolutionMeta
} from './smartPre';

const proto = (over = {}) => ({
    id: 'p1', protocol: '2611.001', openedAt: '2026-11-03', classification: 'slow', status: 'open', closedAt: '', resolutionType: '', ...over
});
const client = (over = {}) => ({ clientName: 'Ana', installedAt: '2026-11-01', protocols: [], ...over });
const closed = (over = {}) => proto({ status: 'closed', closedAt: '2026-11-05', resolutionType: 'remote', ...over });

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
});

describe('protocolos do cliente', () => {
    it('cliente recém-cadastrado não tem atendimento e fica em acompanhamento', () => {
        expect(getProtocols(client())).toEqual([]);
        expect(getClientStatus(client())).toBe('monitoring');
        expect(getDaysToFirstContact(client())).toBeNull();
    });

    it('situação do cliente vem dos protocolos: algum aberto = em tratativa; todos finalizados = resolvido', () => {
        expect(getClientStatus(client({ protocols: [proto()] }))).toBe('in_progress');
        expect(getClientStatus(client({ protocols: [closed(), proto({ id: 'p2' })] }))).toBe('in_progress');
        expect(getClientStatus(client({ protocols: [closed()] }))).toBe('resolved');
    });

    it('tempo até o primeiro contato usa a abertura do protocolo mais antigo', () => {
        const c = client({ protocols: [proto({ id: 'b', openedAt: '2026-11-09' }), proto({ id: 'a', openedAt: '2026-11-03' })] });
        expect(getDaysToFirstContact(c)).toBe(2);
        expect(getProtocols(c)[0].id).toBe('a');
    });

    it('duração do protocolo só existe quando finalizado', () => {
        expect(getProtocolDuration(proto())).toBeNull();
        expect(getProtocolDuration(closed({ openedAt: '2026-11-03', closedAt: '2026-11-06' }))).toBe(3);
    });

    it('cadastro da v4.10.0 (sem protocols) vira um protocolo legado, com visita técnica como ordem de serviço', () => {
        const legacy = { clientName: 'Velho', installedAt: '2026-11-01', contacted: true, firstContactAt: '2026-11-02', issues: ['no_connection'], status: 'resolved', resolutionType: 'technical_visit', updatedAt: '2026-11-04' };
        const list = getProtocols(legacy);
        expect(list).toHaveLength(1);
        expect(list[0]).toMatchObject({ legacy: true, classification: 'no_connection', status: 'closed', resolutionType: 'service_order', openedAt: '2026-11-02' });
        expect(getClientStatus(legacy)).toBe('resolved');
        expect(getProtocols({ clientName: 'Sem contato', contacted: false })).toEqual([]);
    });

    it('protocols presente tem prioridade sobre os campos antigos', () => {
        expect(getProtocols({ contacted: true, firstContactAt: '2026-11-02', protocols: [] })).toEqual([]);
    });
});

describe('computeSmartPreStats', () => {
    const list = [
        client({ installedAt: '2026-11-01', protocols: [closed({ openedAt: '2026-11-01', closedAt: '2026-11-02', resolutionType: 'remote', classification: 'slow' })] }),
        client({ installedAt: '2026-11-01', protocols: [
            closed({ id: 'a', openedAt: '2026-11-03', closedAt: '2026-11-08', resolutionType: 'service_order', classification: 'no_connection' }),
            proto({ id: 'b', openedAt: '2026-11-09', classification: 'no_connection' })
        ] }),
        client({ installedAt: '2026-11-01', protocols: [closed({ openedAt: '2026-11-09', closedAt: '2026-11-10', resolutionType: 'it', classification: 'equipment' })] }),
        client()
    ];

    it('conta clientes, contatos, taxa e tempo até o primeiro contato', () => {
        const s = computeSmartPreStats(list);
        expect(s).toMatchObject({ total: 4, contacted: 3, noContact: 1, contactRate: 75 });
        expect(s.avgDaysToContact).toBe(3.3); // (0 + 2 + 8) / 3
        expect(s.medianDaysToContact).toBe(2);
        expect(s.buckets.find(b => b.id === 'd0').count).toBe(1);
        expect(s.buckets.find(b => b.id === 'd1_3').count).toBe(1);
        expect(s.buckets.find(b => b.id === 'd8_15').count).toBe(1);
    });

    it('calcula protocolos abertos/finalizados, tempo de resolução e reincidência', () => {
        const s = computeSmartPreStats(list);
        expect(s).toMatchObject({ protocolsTotal: 4, openProtocols: 1, closedProtocols: 3, closeRate: 75 });
        expect(s.avgResolutionDays).toBe(2.3); // (1 + 5 + 1) / 3
        expect(s.statusCounts).toEqual({ monitoring: 1, in_progress: 1, resolved: 2 });
        expect(s.repeatClients).toBe(1);
        expect(s.repeatRate).toBe(33);
    });

    it('distribui os encerramentos entre remoto, ordem de serviço e TI', () => {
        const s = computeSmartPreStats(list);
        expect(s.resolutionCounts).toMatchObject({ remote: 1, service_order: 1, it: 1 });
        expect(s.escalated).toBe(2);
        expect(s.escalationRate).toBe(67);
        expect(s.remoteRate).toBe(33);
    });

    it('ranqueia as classificações de abertura mais frequentes (por protocolo)', () => {
        const s = computeSmartPreStats(list);
        expect(s.issues[0]).toMatchObject({ id: 'no_connection', count: 2 });
    });

    it('lista vazia não quebra', () => {
        expect(computeSmartPreStats([])).toMatchObject({ total: 0, contactRate: 0, avgDaysToContact: null, protocolsTotal: 0, avgResolutionDays: null });
    });
});

describe('getServiceHealth', () => {
    const many = (contacted, total, extra = {}) => Array.from({ length: total }, (_, i) =>
        client(i < contacted ? { protocols: [closed(extra)] } : {}));

    it('classifica pela taxa de contato', () => {
        expect(getServiceHealth(computeSmartPreStats([])).level).toBe('empty');
        expect(getServiceHealth(computeSmartPreStats(many(2, 10))).level).toBe('good');
        expect(getServiceHealth(computeSmartPreStats(many(4, 10))).level).toBe('attention');
        expect(getServiceHealth(computeSmartPreStats(many(8, 10))).level).toBe('critical');
    });

    it('muitos encaminhamentos rebaixam "indo bem" para atenção', () => {
        const health = getServiceHealth(computeSmartPreStats(many(2, 10, { resolutionType: 'service_order' })));
        expect(health.level).toBe('attention');
        expect(health.hint).toContain('encaminhamentos');
    });

    it('muitos protocolos em aberto rebaixam "indo bem" para atenção', () => {
        const items = Array.from({ length: 10 }, (_, i) => client(i < 2 ? { protocols: [proto()] } : {}));
        const health = getServiceHealth(computeSmartPreStats(items));
        expect(health.level).toBe('attention');
        expect(health.hint).toContain('em aberto');
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

    it('buildMonthlyTimeline soma entradas e clientes com atendimento por mês', () => {
        const items = [client({ installedAt: '2026-11-02', protocols: [proto()] }), client({ installedAt: '2026-11-05' }), client({ installedAt: '2026-10-20' })];
        const t = buildMonthlyTimeline(items, 3, now);
        expect(t.map(s => s.key)).toEqual(['2026-09', '2026-10', '2026-11']);
        expect(t[2]).toMatchObject({ label: 'nov/26', entered: 2, contacted: 1 });
        expect(t[1].entered).toBe(1);
    });

    it('matchesSearch procura em nome, código, telefone, cidade e número de protocolo', () => {
        const c = client({ clientName: 'Maria Souza', erpCode: 'A123', phone: '(11) 99999', city: 'Campinas', protocols: [proto({ protocol: '2611.777' })] });
        ['maria', 'a123', 'campinas', '2611.777'].forEach(t => expect(matchesSearch(c, t)).toBe(true));
        expect(matchesSearch(c, 'xyz')).toBe(false);
        expect(matchesSearch(c, '')).toBe(true);
    });
});

describe('cadastro do cliente', () => {
    const today = '2026-11-10';

    it('exige nome e data de instalação, sem data futura', () => {
        expect(validateSmartPreClient({}, today)).toHaveLength(2);
        expect(validateSmartPreClient({ clientName: 'A', installedAt: '2026-12-01' }, today)[0]).toMatch(/futura/);
        expect(validateSmartPreClient({ clientName: 'A', installedAt: '2026-11-01', email: 'x@' }, today)[0]).toMatch(/e-mail/);
        expect(validateSmartPreClient({ clientName: 'A', installedAt: '2026-11-01', phone: '(11) 9' }, today)[0]).toMatch(/celular/);
        expect(validateSmartPreClient({ clientName: 'A', installedAt: '2026-11-01', email: 'a@b.com', phone: '(11) 99999-9999' }, today)).toEqual([]);
        expect(validateSmartPreClient({ clientName: 'A', installedAt: '2026-11-01' }, today)).toEqual([]);
    });

    it('buildSmartPrePayload grava só os dados do cadastro, aparados', () => {
        expect(buildSmartPrePayload({ clientName: '  Ana ', installedAt: '2026-11-01', contacted: true, issues: ['slow'], status: 'resolved' }))
            .toEqual({ clientName: 'Ana', erpCode: '', contractCode: '', username: '', phone: '', email: '', city: '', neighborhood: '', complement: '', installedAt: '2026-11-01' });
    });
});

describe('validateProtocol', () => {
    const today = '2026-11-10';
    const c = client({ installedAt: '2026-11-05', protocols: [proto({ id: 'x', protocol: '100' })] });
    const base = { protocol: '200', openedAt: '2026-11-06', classification: 'slow', status: 'open' };
    const errs = (form) => validateProtocol(form, c, today).join(' | ');

    it('aceita um protocolo em aberto completo', () => {
        expect(validateProtocol(base, c, today)).toEqual([]);
    });

    it('exige número, abertura coerente e classificação', () => {
        expect(errs({ ...base, protocol: '' })).toMatch(/número do protocolo/);
        expect(errs({ ...base, openedAt: '' })).toMatch(/data de abertura/);
        expect(errs({ ...base, openedAt: '2026-11-20' })).toMatch(/futura/);
        // atendimentos retroativos (anteriores à adesão/cadastro) são permitidos
        expect(errs({ ...base, openedAt: '2026-11-01' })).toBe('');
        expect(errs({ ...base, openedAt: '2025-03-10' })).toBe('');
        expect(errs({ ...base, classification: '' })).toMatch(/classificação/);
    });

    it('recusa número repetido no mesmo cliente, mas permite editar o próprio protocolo', () => {
        expect(errs({ ...base, protocol: '100' })).toMatch(/já está registrado/);
        expect(validateProtocol({ ...base, id: 'x', protocol: '100' }, c, today)).toEqual([]);
    });

    it('finalizado exige data coerente e forma de encerramento', () => {
        const fin = { ...base, status: 'closed' };
        expect(errs(fin)).toMatch(/data de encerramento/);
        expect(errs({ ...fin, closedAt: '2026-11-04' })).toMatch(/anterior à abertura/);
        expect(errs({ ...fin, closedAt: '2026-11-07' })).toMatch(/como o atendimento foi encerrado/);
        expect(validateProtocol({ ...fin, closedAt: '2026-11-07', resolutionType: 'it' }, c, today)).toEqual([]);
        expect(validateProtocol({ ...fin, closedAt: '2026-11-07', resolutionType: 'technical_visit' }, c, today)).toEqual([]);
    });
});

describe('gravação de protocolos', () => {
    const now = new Date('2026-11-10T10:00:00Z');

    it('buildProtocolRecord zera o encerramento quando o protocolo está em aberto', () => {
        const r = buildProtocolRecord({ protocol: ' 55 ', openedAt: '2026-11-06', classification: 'slow', status: 'open', closedAt: '2026-11-07', resolutionType: 'it', closingNotes: 'x' }, { authorName: 'Ana', now });
        expect(r).toMatchObject({ protocol: '55', status: 'open', closedAt: '', resolutionType: '', closingNotes: '', createdByName: 'Ana', updatedAt: '2026-11-10T10:00:00.000Z' });
        expect(r.id).toMatch(/^prt_/);
        expect(Object.values(r).includes(undefined)).toBe(false);
    });

    it('finalizado converte visita técnica antiga em ordem de serviço', () => {
        const r = buildProtocolRecord({ id: 'k', protocol: '1', openedAt: '2026-11-06', classification: 'slow', status: 'closed', closedAt: '2026-11-07', resolutionType: 'technical_visit', closingNotes: ' ok ' }, { now });
        expect(r).toMatchObject({ id: 'k', status: 'closed', resolutionType: 'service_order', closingNotes: 'ok' });
        expect(getResolutionMeta('technical_visit').id).toBe('service_order');
    });

    it('upsertProtocol acrescenta ou substitui e preserva o protocolo legado', () => {
        const legacy = { installedAt: '2026-11-01', contacted: true, firstContactAt: '2026-11-02', issues: ['slow'], status: 'in_progress' };
        const added = upsertProtocol(legacy, proto({ id: 'novo', openedAt: '2026-11-05' }));
        expect(added.map(p => p.id)).toEqual(['legacy', 'novo']);
        expect(added[0].legacy).toBeUndefined();
        const replaced = upsertProtocol({ protocols: [proto({ id: 'a' })] }, proto({ id: 'a', status: 'closed' }));
        expect(replaced).toHaveLength(1);
        expect(replaced[0].status).toBe('closed');
    });

    it('removeProtocol tira só o protocolo escolhido', () => {
        const c = { protocols: [proto({ id: 'a' }), proto({ id: 'b', openedAt: '2026-11-04' })] };
        expect(removeProtocol(c, 'a').map(p => p.id)).toEqual(['b']);
    });
});

describe('createSmartPreComment', () => {
    it('monta o comentário no formato de Tarefas & Relatórios', () => {
        const c = createSmartPreComment({ authorId: 'u1', authorName: 'Ana', authorRole: 'Apoio', text: '  oi  ', now: new Date('2026-11-10T10:00:00Z') });
        expect(c).toMatchObject({ authorId: 'u1', authorName: 'Ana', authorRole: 'Apoio', content: 'oi', createdAt: '2026-11-10T10:00:00.000Z' });
        expect(c.id).toMatch(/^cmt_/);
    });
});

describe('classificação "Feedback" e "Outro"', () => {
    const today = '2026-11-10';
    const c = client({ installedAt: '2026-11-05' });
    const base = { protocol: '300', openedAt: '2026-11-06', status: 'open' };

    it('a lista tem Feedback', () => {
        expect(SMART_PRE_ISSUES.some(i => i.id === 'feedback' && i.label === 'Feedback')).toBe(true);
        expect(validateProtocol({ ...base, classification: 'feedback' }, c, today)).toEqual([]);
    });

    it('"Outro" exige informar qual é a classificação', () => {
        expect(validateProtocol({ ...base, classification: 'other' }, c, today).join(' ')).toMatch(/qual é a classificação/);
        expect(validateProtocol({ ...base, classification: 'other', classificationOther: '  ' }, c, today).join(' ')).toMatch(/qual é a classificação/);
        expect(validateProtocol({ ...base, classification: 'other', classificationOther: 'Troca de titular' }, c, today)).toEqual([]);
    });

    it('grava o texto só quando for "Outro" e mostra no rótulo', () => {
        const other = buildProtocolRecord({ ...base, classification: 'other', classificationOther: ' Troca de titular ' });
        expect(other.classificationOther).toBe('Troca de titular');
        expect(getProtocolIssueLabel(other)).toBe('Outro: Troca de titular');
        const slow = buildProtocolRecord({ ...base, classification: 'slow', classificationOther: 'sobra' });
        expect(slow.classificationOther).toBe('');
        expect(getProtocolIssueLabel(slow)).toBe('Lentidão / oscilação');
        expect(getProtocolIssueLabel({ classification: 'other' })).toBe('Outro');
    });
});

describe('flattenProtocols / matchesProtocolSearch', () => {
    const a = client({ id: 'a', clientName: 'Ana', erpCode: 'C1', protocols: [proto({ id: 'p1', protocol: '100', openedAt: '2026-10-01' }), proto({ id: 'p2', protocol: '101', openedAt: '2026-11-03', status: 'open' })] });
    const b = client({ id: 'b', clientName: 'Bruno', protocols: [proto({ id: 'p3', protocol: '200', openedAt: '2026-11-05', description: 'sem sinal' })] });
    const semProtocolo = client({ id: 'c', clientName: 'Carla', protocols: [] });

    it('junta os protocolos de todos os clientes, do mais recente ao mais antigo, com o cliente', () => {
        const list = flattenProtocols([a, b, semProtocolo]);
        expect(list.map(p => p.protocol)).toEqual(['200', '101', '100']);
        expect(list[0]).toMatchObject({ clientId: 'b', clientName: 'Bruno' });
        expect(list[2]).toMatchObject({ clientId: 'a', clientErpCode: 'C1' });
        expect(flattenProtocols()).toEqual([]);
    });

    it('busca por protocolo, cliente ou descrição', () => {
        const list = flattenProtocols([a, b]);
        expect(list.filter(p => matchesProtocolSearch(p, '200')).length).toBe(1);
        expect(list.filter(p => matchesProtocolSearch(p, 'ana')).length).toBe(2);
        expect(list.filter(p => matchesProtocolSearch(p, 'sinal')).length).toBe(1);
        expect(list.filter(p => matchesProtocolSearch(p, '')).length).toBe(3);
    });
});

describe('formatPhone', () => {
    it('aplica a máscara de celular enquanto digita', () => {
        expect(formatPhone('')).toBe('');
        expect(formatPhone('1')).toBe('(1');
        expect(formatPhone('11999')).toBe('(11) 999');
        expect(formatPhone('11999998888')).toBe('(11) 99999-8888');
        expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
        expect(formatPhone('119999988889999')).toBe('(11) 99999-8888');
    });
});

/**
 * Smart Pre — acompanhamento de clientes do novo serviço.
 * Constantes e cálculos puros (sem Firebase) usados pela tela e pela dashboard.
 *
 * Modelo (coleção `smart_pre_clients`): o cliente é cadastrado primeiro e, depois, recebe protocolos de atendimento.
 *  Cliente:   clientName, erpCode (código da conexão), contractCode, username (PPPoE), phone, email, city, neighborhood, complement, installedAt 'YYYY-MM-DD', comments[], protocols[]
 *  Protocolo: id, protocol (número), openedAt, channel, classification (id de SMART_PRE_ISSUES, definida na abertura; classificationOther descreve o 'Outro'),
 *             description, status 'open' | 'closed', closedAt, resolutionType 'remote' | 'service_order' | 'it',
 *             closingNotes, createdByName
 *  A situação do cliente é derivada dos protocolos (nenhum = em acompanhamento; algum aberto = em tratativa; todos
 *  encerrados = resolvido). Clientes da v4.10.0 (campos contacted/issues/resolutionType, sem `protocols`) continuam
 *  funcionando: viram um protocolo "legado" automaticamente.
 */

export const SMART_PRE_STATUSES = [
    { id: 'monitoring', label: 'Em acompanhamento', variant: 'info', hint: 'Sem atendimentos até agora' },
    { id: 'in_progress', label: 'Em tratativa', variant: 'warning', hint: 'Há protocolo em aberto' },
    { id: 'resolved', label: 'Resolvido', variant: 'success', hint: 'Todos os protocolos encerrados' }
];

export const PROTOCOL_STATUSES = [
    { id: 'open', label: 'Em aberto', variant: 'warning' },
    { id: 'closed', label: 'Finalizado', variant: 'success' }
];

export const SMART_PRE_RESOLUTIONS = [
    { id: 'remote', label: 'Resolvido remotamente', short: 'Remoto', color: '#10b981' },
    { id: 'service_order', label: 'Encaminhado para ordem de serviço', short: 'Ordem de serviço', color: '#f59e0b' },
    { id: 'it', label: 'Encaminhado para o TI', short: 'TI', color: '#8b5cf6' }
];

// Classificação do atendimento na abertura
export const SMART_PRE_ISSUES = [
    { id: 'no_connection', label: 'Sem conexão' },
    { id: 'slow', label: 'Lentidão / oscilação' },
    { id: 'recharge', label: 'Recarga / créditos' },
    { id: 'equipment', label: 'Equipamento / configuração' },
    { id: 'usage_doubt', label: 'Dúvida de uso' },
    { id: 'billing', label: 'Financeiro / cobrança' },
    { id: 'cancel', label: 'Insatisfação / cancelamento' },
    { id: 'feedback', label: 'Feedback' },
    { id: 'other', label: 'Outro' }
];

export const SMART_PRE_CHANNELS = ['Telefone', 'WhatsApp/Chat', 'Outro'];

export const SMART_PRE_PERIODS = [
    { id: 'all', label: 'Todo o período', days: null },
    { id: '7', label: 'Últimos 7 dias', days: 7 },
    { id: '30', label: 'Últimos 30 dias', days: 30 },
    { id: '90', label: 'Últimos 90 dias', days: 90 }
];

export const getStatusMeta = (id) => SMART_PRE_STATUSES.find(s => s.id === id) || SMART_PRE_STATUSES[0];
export const getProtocolStatusMeta = (id) => PROTOCOL_STATUSES.find(s => s.id === id) || PROTOCOL_STATUSES[0];
export const getIssueLabel = (id) => SMART_PRE_ISSUES.find(i => i.id === id)?.label || id;
export const MAX_CLASSIFICATION_OTHER = 60;

/** Rótulo da classificação do protocolo; em "Outro" mostra o que foi informado ("Outro: ..."). */
export const getProtocolIssueLabel = (protocol) => {
    const base = getIssueLabel(protocol?.classification);
    const custom = String(protocol?.classificationOther || '').trim();
    return protocol?.classification === 'other' && custom ? `${base}: ${custom}` : base;
};

// 'technical_visit' era o nome na v4.10.0; hoje é ordem de serviço
export const normalizeResolution = (id) => (id === 'technical_visit' ? 'service_order' : id || '');
export const getResolutionMeta = (id) => SMART_PRE_RESOLUTIONS.find(r => r.id === normalizeResolution(id)) || null;

const pad = (n) => String(n).padStart(2, '0');

/** Converte 'YYYY-MM-DD', ISO, Date ou Timestamp do Firestore em 'YYYY-MM-DD' ('' se inválido). */
export const toDateKey = (value) => {
    if (!value) return '';
    if (typeof value === 'string') {
        const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
    }
    const date = typeof value.toDate === 'function' ? value.toDate() : value;
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const dayNumber = (key) => {
    const [y, m, d] = key.split('-').map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/** Dias inteiros entre duas datas (null se alguma for inválida ou se o fim for anterior ao início). */
export const daysBetween = (fromValue, toValue) => {
    const a = toDateKey(fromValue);
    const b = toDateKey(toValue);
    if (!a || !b) return null;
    const diff = dayNumber(b) - dayNumber(a);
    return diff < 0 ? null : diff;
};

// ---------------------------------------------------------------------------------------------
// Protocolos
// ---------------------------------------------------------------------------------------------

/** Protocolos do cliente, do mais antigo para o mais recente (com suporte aos cadastros da v4.10.0). */
export const getProtocols = (client) => {
    if (!client) return [];
    let list;
    if (Array.isArray(client.protocols)) {
        list = client.protocols.filter(Boolean);
    } else if (client.contacted) {
        const closed = client.status === 'resolved';
        list = [{
            id: 'legacy',
            legacy: true,
            protocol: '',
            openedAt: toDateKey(client.firstContactAt) || toDateKey(client.installedAt),
            channel: client.contactChannel || '',
            classification: Array.isArray(client.issues) && client.issues[0] ? client.issues[0] : 'other',
            description: client.issueDescription || '',
            status: closed ? 'closed' : 'open',
            closedAt: closed ? (toDateKey(client.updatedAt) || toDateKey(client.firstContactAt)) : '',
            resolutionType: normalizeResolution(client.resolutionType),
            closingNotes: ''
        }];
    } else {
        list = [];
    }
    return list
        .map(p => ({ ...p, resolutionType: normalizeResolution(p.resolutionType) }))
        .sort((a, b) => String(a.openedAt || '').localeCompare(String(b.openedAt || '')));
};

export const getClientStatus = (client) => {
    const protocols = getProtocols(client);
    if (protocols.length === 0) return 'monitoring';
    return protocols.some(p => p.status !== 'closed') ? 'in_progress' : 'resolved';
};

export const hasContacted = (client) => getProtocols(client).length > 0;

/** Data do primeiro atendimento (primeira abertura de protocolo). */
export const getFirstContactDate = (client) => {
    const first = getProtocols(client).find(p => toDateKey(p.openedAt));
    return first ? toDateKey(first.openedAt) : '';
};

/** Dias entre a instalação e o primeiro atendimento (null sem atendimento ou com datas inválidas). */
export const getDaysToFirstContact = (client) => daysBetween(client?.installedAt, getFirstContactDate(client));

/** Dias entre a abertura e o encerramento de um protocolo (null se aberto ou datas inválidas). */
export const getProtocolDuration = (protocol) => (protocol?.status === 'closed' ? daysBetween(protocol.openedAt, protocol.closedAt) : null);

/** Classificações usadas nos protocolos do cliente (ids únicos). */
export const getClientIssues = (client) => [...new Set(getProtocols(client).map(p => p.classification).filter(Boolean))];

const round1 = (n) => Math.round(n * 10) / 10;
const percent = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);
const average = (values) => (values.length ? round1(values.reduce((s, v) => s + v, 0) / values.length) : null);

const median = (values) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((x, y) => x - y);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : round1((sorted[mid - 1] + sorted[mid]) / 2);
};

export const CONTACT_TIME_BUCKETS = [
    { id: 'd0', label: 'No mesmo dia', min: 0, max: 0 },
    { id: 'd1_3', label: '1 a 3 dias', min: 1, max: 3 },
    { id: 'd4_7', label: '4 a 7 dias', min: 4, max: 7 },
    { id: 'd8_15', label: '8 a 15 dias', min: 8, max: 15 },
    { id: 'd16', label: '16+ dias', min: 16, max: Infinity }
];

/** Filtra pela data de instalação (entrada na base). */
export const filterByPeriod = (clients, periodId, now = new Date()) => {
    const period = SMART_PRE_PERIODS.find(p => p.id === periodId);
    if (!period || !period.days) return clients;
    const todayKey = toDateKey(now);
    return clients.filter(c => {
        const age = daysBetween(c.installedAt, todayKey);
        return age !== null && age < period.days;
    });
};

export const matchesSearch = (client, term) => {
    const q = String(term || '').trim().toLowerCase();
    if (!q) return true;
    const protocolNumbers = getProtocols(client).map(p => p.protocol);
    return [client.clientName, client.erpCode, client.contractCode, client.username, client.phone, client.email, client.city, client.neighborhood, ...protocolNumbers]
        .some(v => String(v || '').toLowerCase().includes(q));
};

/** Indicadores da dashboard (clientes e protocolos). */
export const computeSmartPreStats = (clients = []) => {
    const total = clients.length;
    const withProtocols = clients.map(c => ({ client: c, protocols: getProtocols(c) }));
    const contactedList = withProtocols.filter(x => x.protocols.length > 0);
    const contacted = contactedList.length;
    const allProtocols = withProtocols.flatMap(x => x.protocols);

    const daysList = contactedList.map(x => getDaysToFirstContact(x.client)).filter(d => d !== null);
    const buckets = CONTACT_TIME_BUCKETS.map(b => ({
        id: b.id, label: b.label, count: daysList.filter(d => d >= b.min && d <= b.max).length
    }));

    const statusCounts = { monitoring: 0, in_progress: 0, resolved: 0 };
    clients.forEach(c => { statusCounts[getClientStatus(c)] += 1; });

    const closed = allProtocols.filter(p => p.status === 'closed');
    const open = allProtocols.length - closed.length;
    const resolutionCounts = { remote: 0, service_order: 0, it: 0, undefined: 0 };
    closed.forEach(p => {
        if (p.resolutionType && resolutionCounts[p.resolutionType] !== undefined) resolutionCounts[p.resolutionType] += 1;
        else resolutionCounts.undefined += 1;
    });

    const issueMap = new Map();
    allProtocols.forEach(p => { if (p.classification) issueMap.set(p.classification, (issueMap.get(p.classification) || 0) + 1); });
    const issues = [...issueMap.entries()]
        .map(([id, count]) => ({ id, label: getIssueLabel(id), count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const durations = closed.map(getProtocolDuration).filter(d => d !== null);
    const escalated = resolutionCounts.service_order + resolutionCounts.it;
    const repeatClients = contactedList.filter(x => x.protocols.length > 1).length;

    return {
        total,
        contacted,
        noContact: total - contacted,
        contactRate: percent(contacted, total),
        avgDaysToContact: average(daysList),
        medianDaysToContact: median(daysList),
        buckets,
        statusCounts,
        protocolsTotal: allProtocols.length,
        openProtocols: open,
        closedProtocols: closed.length,
        closeRate: percent(closed.length, allProtocols.length),
        avgResolutionDays: average(durations),
        resolutionCounts,
        escalated,
        escalationRate: percent(escalated, closed.length),
        remoteRate: percent(resolutionCounts.remote, closed.length),
        repeatClients,
        repeatRate: percent(repeatClients, contacted),
        issues
    };
};

/**
 * Saúde do serviço, para leitura rápida.
 * Regras: taxa de contato até 25% = indo bem; até 45% = atenção; acima disso = crítico.
 * Muitos encaminhamentos (ordem de serviço/TI > 35% dos protocolos encerrados) ou protocolos em aberto
 * (> 40% do total) rebaixam "indo bem" para "atenção".
 */
export const getServiceHealth = (stats) => {
    if (!stats || stats.total === 0) {
        return { level: 'empty', label: 'Sem dados', hint: 'Cadastre clientes para acompanhar o serviço.' };
    }
    let level = stats.contactRate <= 25 ? 'good' : stats.contactRate <= 45 ? 'attention' : 'critical';
    const reasons = [];
    if (stats.closedProtocols > 0 && stats.escalationRate > 35) reasons.push('muitos encaminhamentos para ordem de serviço ou TI');
    if (stats.protocolsTotal > 0 && percent(stats.openProtocols, stats.protocolsTotal) > 40) reasons.push('muitos protocolos ainda em aberto');
    if (level === 'good' && reasons.length > 0) level = 'attention';

    const labels = { good: 'Indo bem', attention: 'Requer atenção', critical: 'Crítico' };
    const base = {
        good: 'Poucos clientes precisaram acionar o suporte após a instalação.',
        attention: 'Parte relevante dos clientes está acionando o suporte.',
        critical: 'A maior parte dos clientes está acionando o suporte após a instalação.'
    }[level];
    return { level, label: labels[level], hint: reasons.length ? `${base} Atenção: ${reasons.join(' e ')}.` : base };
};

/** Entradas e clientes com atendimento por mês de instalação (últimos `months` meses). */
export const buildMonthlyTimeline = (clients = [], months = 6, now = new Date()) => {
    const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    const slots = [];
    for (let i = months - 1; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        slots.push({
            key: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
            label: `${names[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
            entered: 0,
            contacted: 0
        });
    }
    clients.forEach(c => {
        const slot = slots.find(s => s.key === toDateKey(c.installedAt).slice(0, 7));
        if (!slot) return;
        slot.entered += 1;
        if (hasContacted(c)) slot.contacted += 1;
    });
    return slots;
};

// ---------------------------------------------------------------------------------------------
// Formulários
// ---------------------------------------------------------------------------------------------

/** Validação do cadastro do cliente; devolve a lista de mensagens de erro (vazia = válido). */
export const validateSmartPreClient = (form, todayKey = toDateKey(new Date())) => {
    const errors = [];
    if (!String(form.clientName || '').trim()) errors.push('Informe o nome do cliente.');
    const installed = toDateKey(form.installedAt);
    if (!installed) errors.push('Informe a data de adesão.');
    else if (installed > todayKey) errors.push('A data de adesão não pode ser futura.');
    const email = String(form.email || '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Informe um e-mail válido.');
    const phoneDigits = onlyDigits(form.phone);
    if (phoneDigits && phoneDigits.length < 10) errors.push('Informe o celular com DDD (10 ou 11 dígitos).');
    return errors;
};

export const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

/** Máscara de celular brasileiro enquanto digita: (11) 99999-9999 (ou (11) 9999-9999 com 10 dígitos). */
export const formatPhone = (value) => {
    const d = onlyDigits(value).slice(0, 11);
    if (!d) return '';
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

/** Cadastro do cliente para gravação (sem campos undefined). Protocolos e relatos são gravados à parte. */
export const buildSmartPrePayload = (form) => ({
    clientName: String(form.clientName || '').trim(),
    erpCode: String(form.erpCode || '').trim(),
    contractCode: String(form.contractCode || '').trim(),
    username: String(form.username || '').trim(),
    phone: formatPhone(form.phone),
    email: String(form.email || '').trim().toLowerCase(),
    city: String(form.city || '').trim(),
    neighborhood: String(form.neighborhood || '').trim(),
    complement: String(form.complement || '').trim(),
    installedAt: toDateKey(form.installedAt)
});

/**
 * Validação do protocolo de atendimento.
 * @param {object} form formulário do protocolo
 * @param {object} client cliente dono do protocolo (data de instalação e demais protocolos)
 */
export const validateProtocol = (form, client, todayKey = toDateKey(new Date())) => {
    const errors = [];
    const number = String(form.protocol || '').trim();
    if (!number) errors.push('Informe o número do protocolo.');
    else {
        const duplicated = getProtocols(client).some(p => p.id !== form.id && String(p.protocol || '').trim().toLowerCase() === number.toLowerCase());
        if (duplicated) errors.push('Este protocolo já está registrado para o cliente.');
    }

    const opened = toDateKey(form.openedAt);
    if (!opened) errors.push('Informe a data de abertura do atendimento.');
    else if (opened > todayKey) errors.push('A data de abertura não pode ser futura.');

    if (!form.classification) errors.push('Selecione a classificação de abertura do atendimento.');
    else if (form.classification === 'other' && !String(form.classificationOther || '').trim()) errors.push('Informe qual é a classificação, já que ela não está na lista.');

    if (form.status === 'closed') {
        const closedAt = toDateKey(form.closedAt);
        if (!closedAt) errors.push('Informe a data de encerramento.');
        else {
            if (closedAt > todayKey) errors.push('A data de encerramento não pode ser futura.');
            if (opened && closedAt < opened) errors.push('O encerramento não pode ser anterior à abertura.');
        }
        if (!getResolutionMeta(form.resolutionType)) errors.push('Informe como o atendimento foi encerrado (remoto, ordem de serviço ou TI).');
    }
    return errors;
};

/** Registro do protocolo para gravação (encerramento só existe quando finalizado). */
export const buildProtocolRecord = (form, { authorName = '', now = new Date() } = {}) => {
    const closed = form.status === 'closed';
    return {
        id: form.id || `prt_${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`,
        protocol: String(form.protocol || '').trim(),
        openedAt: toDateKey(form.openedAt),
        channel: form.channel || '',
        classification: form.classification || '',
        classificationOther: form.classification === 'other' ? String(form.classificationOther || '').trim().slice(0, MAX_CLASSIFICATION_OTHER) : '',
        description: String(form.description || '').trim(),
        status: closed ? 'closed' : 'open',
        closedAt: closed ? toDateKey(form.closedAt) : '',
        resolutionType: closed ? normalizeResolution(form.resolutionType) : '',
        closingNotes: closed ? String(form.closingNotes || '').trim() : '',
        createdByName: form.createdByName || authorName,
        updatedByName: authorName,
        updatedAt: now.toISOString()
    };
};

/** Substitui (mesmo id) ou acrescenta um protocolo, preservando os existentes (inclusive o legado). */
export const upsertProtocol = (client, record) => {
    const list = getProtocols(client).map(({ legacy, ...rest }) => rest); // eslint-disable-line no-unused-vars
    const index = list.findIndex(p => p.id === record.id);
    if (index >= 0) list[index] = record;
    else list.push(record);
    return list;
};

export const removeProtocol = (client, protocolId) =>
    getProtocols(client).filter(p => p.id !== protocolId).map(({ legacy, ...rest }) => rest); // eslint-disable-line no-unused-vars

/** Cria um comentário no mesmo formato de Tarefas & Relatórios. */
export const createSmartPreComment = ({ authorId, authorName, authorRole, text, now = new Date() }) => ({
    id: `cmt_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    authorId: authorId || 'user',
    authorName: authorName || 'Usuário',
    authorRole: authorRole || '',
    content: String(text || '').trim(),
    createdAt: now.toISOString()
});

/**
 * Smart Pre — acompanhamento de clientes do novo serviço.
 * Constantes e cálculos puros (sem Firebase) usados pela tela e pela dashboard.
 *
 * Modelo do cliente (coleção `smart_pre_clients`):
 *  clientName, erpCode, phone, city,
 *  installedAt   'YYYY-MM-DD'  data em que o cliente entrou na base com o Smart Pre
 *  contacted     boolean       o cliente entrou em contato após a instalação
 *  firstContactAt 'YYYY-MM-DD' data do primeiro contato
 *  contactChannel, issues[] (ids de SMART_PRE_ISSUES), issueDescription
 *  status        'monitoring' | 'in_progress' | 'resolved'
 *  resolutionType '' | 'remote' | 'technical_visit' | 'it'
 *  comments[]    mesmo formato dos comentários de Tarefas & Relatórios
 */

export const SMART_PRE_STATUSES = [
    { id: 'monitoring', label: 'Em acompanhamento', variant: 'info', hint: 'Sem ocorrências até agora' },
    { id: 'in_progress', label: 'Em tratativa', variant: 'warning', hint: 'Cliente com problema em andamento' },
    { id: 'resolved', label: 'Resolvido', variant: 'success', hint: 'Problema solucionado' }
];

export const SMART_PRE_RESOLUTIONS = [
    { id: 'remote', label: 'Resolvido remotamente', short: 'Remoto', color: '#10b981' },
    { id: 'technical_visit', label: 'Visita técnica', short: 'Visita técnica', color: '#f59e0b' },
    { id: 'it', label: 'Acionamento do TI', short: 'TI', color: '#8b5cf6' }
];

export const SMART_PRE_ISSUES = [
    { id: 'no_connection', label: 'Sem conexão' },
    { id: 'slow', label: 'Lentidão / oscilação' },
    { id: 'recharge', label: 'Recarga / créditos' },
    { id: 'equipment', label: 'Equipamento / configuração' },
    { id: 'usage_doubt', label: 'Dúvida de uso' },
    { id: 'billing', label: 'Financeiro / cobrança' },
    { id: 'cancel', label: 'Insatisfação / cancelamento' },
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
export const getResolutionMeta = (id) => SMART_PRE_RESOLUTIONS.find(r => r.id === id) || null;
export const getIssueLabel = (id) => SMART_PRE_ISSUES.find(i => i.id === id)?.label || id;

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

/** Dias entre a instalação e o primeiro contato do cliente (null quando não houve contato ou dados inválidos). */
export const getDaysToFirstContact = (client) => {
    if (!client?.contacted) return null;
    return daysBetween(client.installedAt, client.firstContactAt);
};

export const normalizeIssues = (client) => {
    const list = Array.isArray(client?.issues) ? client.issues : [];
    return [...new Set(list.filter(Boolean))];
};

const round1 = (n) => Math.round(n * 10) / 10;
const percent = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

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
    return [client.clientName, client.erpCode, client.phone, client.city, client.issueDescription]
        .some(v => String(v || '').toLowerCase().includes(q));
};

/** Indicadores da dashboard. */
export const computeSmartPreStats = (clients = []) => {
    const total = clients.length;
    const contactedClients = clients.filter(c => c.contacted);
    const contacted = contactedClients.length;

    const daysList = contactedClients.map(getDaysToFirstContact).filter(d => d !== null);
    const avgDaysToContact = daysList.length ? round1(daysList.reduce((s, d) => s + d, 0) / daysList.length) : null;

    const buckets = CONTACT_TIME_BUCKETS.map(b => ({
        id: b.id,
        label: b.label,
        count: daysList.filter(d => d >= b.min && d <= b.max).length
    }));

    const statusCounts = { monitoring: 0, in_progress: 0, resolved: 0 };
    clients.forEach(c => {
        const key = statusCounts[c.status] !== undefined ? c.status : 'monitoring';
        statusCounts[key] += 1;
    });

    const resolutionCounts = { remote: 0, technical_visit: 0, it: 0, undefined: 0 };
    contactedClients.forEach(c => {
        if (resolutionCounts[c.resolutionType] !== undefined && c.resolutionType) resolutionCounts[c.resolutionType] += 1;
        else resolutionCounts.undefined += 1;
    });

    const issueMap = new Map();
    contactedClients.forEach(c => normalizeIssues(c).forEach(id => issueMap.set(id, (issueMap.get(id) || 0) + 1)));
    const issues = [...issueMap.entries()]
        .map(([id, count]) => ({ id, label: getIssueLabel(id), count }))
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    const escalated = resolutionCounts.technical_visit + resolutionCounts.it;

    return {
        total,
        contacted,
        noContact: total - contacted,
        contactRate: percent(contacted, total),
        avgDaysToContact,
        medianDaysToContact: median(daysList),
        buckets,
        statusCounts,
        openCount: statusCounts.in_progress,
        resolvedCount: statusCounts.resolved,
        resolvedRate: percent(statusCounts.resolved, contacted),
        resolutionCounts,
        escalated,
        escalationRate: percent(escalated, contacted),
        remoteRate: percent(resolutionCounts.remote, contacted),
        issues
    };
};

/**
 * Saúde do serviço, para leitura rápida.
 * Regras: taxa de contato até 25% = indo bem; até 45% = atenção; acima disso = crítico.
 * Muitos encaminhamentos (visita técnica/TI > 35% dos contatos) ou problemas em aberto
 * (> 40% dos contatos) rebaixam "indo bem" para "atenção".
 */
export const getServiceHealth = (stats) => {
    if (!stats || stats.total === 0) {
        return { level: 'empty', label: 'Sem dados', hint: 'Cadastre clientes para acompanhar o serviço.' };
    }
    let level = stats.contactRate <= 25 ? 'good' : stats.contactRate <= 45 ? 'attention' : 'critical';
    const reasons = [];
    if (stats.contacted > 0 && stats.escalationRate > 35) reasons.push('muitos encaminhamentos para visita técnica ou TI');
    if (stats.contacted > 0 && percent(stats.openCount, stats.contacted) > 40) reasons.push('muitos problemas ainda em aberto');
    if (level === 'good' && reasons.length > 0) level = 'attention';

    const labels = { good: 'Indo bem', attention: 'Requer atenção', critical: 'Crítico' };
    const base = {
        good: 'Poucos clientes precisaram acionar o suporte após a instalação.',
        attention: 'Parte relevante dos clientes está acionando o suporte.',
        critical: 'A maior parte dos clientes está acionando o suporte após a instalação.'
    }[level];
    return { level, label: labels[level], hint: reasons.length ? `${base} Atenção: ${reasons.join(' e ')}.` : base };
};

/** Entradas e contatos por mês de instalação (últimos `months` meses, do mais antigo ao mais recente). */
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
        if (c.contacted) slot.contacted += 1;
    });
    return slots;
};

/** Validação do formulário; devolve a lista de mensagens de erro (vazia = válido). */
export const validateSmartPreClient = (form, todayKey = toDateKey(new Date())) => {
    const errors = [];
    if (!String(form.clientName || '').trim()) errors.push('Informe o nome do cliente.');
    const installed = toDateKey(form.installedAt);
    if (!installed) errors.push('Informe a data de instalação.');
    else if (installed > todayKey) errors.push('A data de instalação não pode ser futura.');

    if (form.contacted) {
        const first = toDateKey(form.firstContactAt);
        if (!first) errors.push('Informe a data do primeiro contato do cliente.');
        else {
            if (first > todayKey) errors.push('A data do primeiro contato não pode ser futura.');
            if (installed && first < installed) errors.push('O primeiro contato não pode ser anterior à instalação.');
        }
        if (normalizeIssues(form).length === 0) errors.push('Selecione ao menos um problema relatado.');
        if (form.status === 'resolved' && !form.resolutionType) errors.push('Informe como o problema foi resolvido.');
    }
    return errors;
};

/** Normaliza o formulário para gravação (sem campos undefined; dados de contato zerados quando não houve contato). */
export const buildSmartPrePayload = (form) => {
    const contacted = Boolean(form.contacted);
    return {
        clientName: String(form.clientName || '').trim(),
        erpCode: String(form.erpCode || '').trim(),
        phone: String(form.phone || '').trim(),
        city: String(form.city || '').trim(),
        installedAt: toDateKey(form.installedAt),
        contacted,
        firstContactAt: contacted ? toDateKey(form.firstContactAt) : '',
        contactChannel: contacted ? (form.contactChannel || '') : '',
        issues: contacted ? normalizeIssues(form) : [],
        issueDescription: contacted ? String(form.issueDescription || '').trim() : '',
        status: contacted ? (form.status === 'resolved' ? 'resolved' : 'in_progress') : 'monitoring',
        resolutionType: contacted && getResolutionMeta(form.resolutionType) ? form.resolutionType : ''
    };
};

/** Cria um comentário no mesmo formato de Tarefas & Relatórios. */
export const createSmartPreComment = ({ authorId, authorName, authorRole, text, now = new Date() }) => ({
    id: `cmt_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    authorId: authorId || 'user',
    authorName: authorName || 'Usuário',
    authorRole: authorRole || '',
    content: String(text || '').trim(),
    createdAt: now.toISOString()
});

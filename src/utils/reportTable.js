/**
 * Regras puras da tabela de Tarefas e Relatórios: responsável, última alteração, ordenação e filtro por responsável.
 */
import { calculateSlaStatus } from './ispHelpers';
import { getTaskAssignee } from '../types/request.types';
import { getLastActivityMillis, normalizeStatus, toMillis } from './reportTimeline';

export const UNASSIGNED_FILTER = '__none';
export const MINE_FILTER = '__me';

// dir: direção do primeiro clique (a mais útil para cada coluna)
export const SORT_OPTIONS = [
    { key: 'default', label: 'Mais recentes (padrão)', dir: 'desc' },
    { key: 'updated', label: 'Última alteração', dir: 'desc' },
    { key: 'date', label: 'Data de abertura', dir: 'desc' },
    { key: 'sla', label: 'SLA (mais urgente)', dir: 'asc' },
    { key: 'priority', label: 'Prioridade', dir: 'desc' },
    { key: 'status', label: 'Status', dir: 'asc' },
    { key: 'assignee', label: 'Responsável', dir: 'asc' }
];

const STATUS_ORDER = { 'Pendente': 0, 'Em Andamento': 1, 'Suspenso': 2, 'Resolvido': 3, 'Cancelado': 4 };
const PRIORITY_WEIGHT = { 'Crítica': 4, 'Alta': 3, 'Normal': 2, 'Baixa': 1 };

export const getDefaultSortDir = (key) => SORT_OPTIONS.find(o => o.key === key)?.dir || 'desc';

export const getAssigneeName = (report) => getTaskAssignee(report)?.name || '';

/** Instante de abertura em ms. */
export const getCreatedMillis = (report) => toMillis(report?.createdAt) ?? toMillis(report?.date) ?? 0;

/** Última alteração: quando e por quem (quem só existe nos chamados atualizados depois da v4.x). */
export const getLastChange = (report) => ({
    at: getLastActivityMillis(report) ?? getCreatedMillis(report) ?? null,
    by: String(report?.lastUpdatedBy || '').trim()
});

/** "agora", "há 5 min", "há 3h", "ontem", "há 4 dias" ou a data (dd/mm/aaaa) depois de uma semana. */
export const formatRelativeTime = (ms, nowMs = Date.now()) => {
    if (ms === null || ms === undefined || !Number.isFinite(ms)) return '';
    const diffMin = Math.floor((nowMs - ms) / 60000);
    if (diffMin < 0) return 'agora';
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `há ${diffMin} min`;
    const hours = Math.floor(diffMin / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'ontem';
    if (days < 7) return `há ${days} dias`;
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** Chamado aberto sem nenhuma movimentação há `hours` horas ou mais. */
export const isStale = (report, nowMs = Date.now(), hours = 24) => {
    const s = normalizeStatus(report?.status);
    if (s === 'Resolvido' || s === 'Cancelado') return false;
    const last = getLastChange(report).at;
    return last !== null && nowMs - last >= hours * 3600 * 1000;
};

/** Filtro por responsável: '' = todos, MINE_FILTER = eu, UNASSIGNED_FILTER = sem responsável, ou o id da pessoa. */
export const matchesAssigneeFilter = (report, filter, myIds = []) => {
    if (!filter) return true;
    const assignee = getTaskAssignee(report);
    if (filter === UNASSIGNED_FILTER) return !assignee;
    if (!assignee) return false;
    const id = String(assignee.id).toLowerCase();
    if (filter === MINE_FILTER) return myIds.some(m => String(m).toLowerCase() === id);
    return id === String(filter).toLowerCase();
};

/** Responsáveis distintos dos chamados, em ordem alfabética: [{ id, name }]. */
export const listAssignees = (reports = []) => {
    const map = new Map();
    reports.forEach(r => {
        const a = getTaskAssignee(r);
        if (a && !map.has(String(a.id))) map.set(String(a.id), { id: String(a.id), name: a.name });
    });
    return [...map.values()].sort((x, y) => x.name.localeCompare(y.name, 'pt-BR'));
};

const sortValue = (report, key) => {
    switch (key) {
        case 'updated': return getLastChange(report).at ?? 0;
        case 'date': return getCreatedMillis(report);
        case 'priority': return PRIORITY_WEIGHT[report?.priority] || PRIORITY_WEIGHT.Normal;
        case 'status': return STATUS_ORDER[normalizeStatus(report?.status)] ?? 0;
        case 'assignee': return getAssigneeName(report).toLocaleLowerCase('pt-BR');
        default: return 0;
    }
};

/**
 * Ordena sem alterar a lista original. 'default' mantém a ordem recebida (mais recentes primeiro).
 * No SLA, chamados encerrados vão sempre para o fim; no responsável, "sem responsável" vai para o fim.
 */
export const sortReports = (reports = [], key = 'default', dir = 'desc') => {
    if (key === 'default') return [...reports];
    const sign = dir === 'asc' ? 1 : -1;
    const indexed = reports.map((report, index) => ({ report, index }));

    indexed.sort((a, b) => {
        if (key === 'sla') {
            const sa = calculateSlaStatus(a.report);
            const sb = calculateSlaStatus(b.report);
            const closedA = sa.status === 'resolved';
            const closedB = sb.status === 'resolved';
            if (closedA !== closedB) return closedA ? 1 : -1;
            const diff = (sa.remainingHours - sb.remainingHours) * sign;
            return diff || a.index - b.index;
        }
        if (key === 'assignee') {
            const na = getAssigneeName(a.report);
            const nb = getAssigneeName(b.report);
            if (!na !== !nb) return na ? -1 : 1;
            const cmp = na.localeCompare(nb, 'pt-BR') * sign;
            return cmp || a.index - b.index;
        }
        const va = sortValue(a.report, key);
        const vb = sortValue(b.report, key);
        if (va === vb) return a.index - b.index;
        return (va < vb ? -1 : 1) * sign;
    });
    return indexed.map(x => x.report);
};

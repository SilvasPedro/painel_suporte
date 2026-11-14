import { describe, it, expect } from 'vitest';
import {
    UNASSIGNED_FILTER, MINE_FILTER, getAssigneeName, getLastChange, formatRelativeTime, isStale,
    matchesAssigneeFilter, listAssignees, sortReports, getDefaultSortDir
} from './reportTable';

const NOW = Date.UTC(2026, 10, 14, 15, 0, 0);
const iso = (offsetMin) => new Date(NOW + offsetMin * 60000).toISOString();

const mk = (id, over = {}) => ({
    id, status: 'Pendente', priority: 'Normal', createdAt: iso(-600), category: 'task', slaHours: 48, ...over
});

describe('responsável e última alteração', () => {
    it('lê o nome do responsável em qualquer formato salvo', () => {
        expect(getAssigneeName(mk('a', { assignedTo: { id: 'p1', name: 'Pedro' } }))).toBe('Pedro');
        expect(getAssigneeName(mk('a', { assignedToId: 'p1', assignedToName: 'Pedro' }))).toBe('Pedro');
        expect(getAssigneeName(mk('a'))).toBe('');
    });

    it('última alteração usa a movimentação mais recente e quem fez', () => {
        const r = mk('a', { createdAt: iso(-600), updatedAt: iso(-30), comments: [{ createdAt: iso(-10) }], lastUpdatedBy: 'Rafael' });
        expect(getLastChange(r)).toEqual({ at: NOW - 10 * 60000, by: 'Rafael' });
        expect(getLastChange(mk('b')).by).toBe('');
        expect(getLastChange(mk('b')).at).toBe(NOW - 600 * 60000);
    });

    it('formatRelativeTime', () => {
        expect(formatRelativeTime(NOW - 20 * 1000, NOW)).toBe('agora');
        expect(formatRelativeTime(NOW - 5 * 60000, NOW)).toBe('há 5 min');
        expect(formatRelativeTime(NOW - 3 * 3600000, NOW)).toBe('há 3h');
        expect(formatRelativeTime(NOW - 30 * 3600000, NOW)).toBe('ontem');
        expect(formatRelativeTime(NOW - 4 * 86400000, NOW)).toBe('há 4 dias');
        expect(formatRelativeTime(NOW - 10 * 86400000, NOW)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
        expect(formatRelativeTime(null, NOW)).toBe('');
        expect(formatRelativeTime(NOW + 60000, NOW)).toBe('agora');
    });

    it('isStale só vale para chamados abertos parados há 24h ou mais', () => {
        expect(isStale(mk('a', { updatedAt: iso(-25 * 60) }), NOW)).toBe(true);
        expect(isStale(mk('a', { updatedAt: iso(-2 * 60) }), NOW)).toBe(false);
        expect(isStale(mk('a', { status: 'Resolvido', updatedAt: iso(-100 * 60) }), NOW)).toBe(false);
    });
});

describe('filtro por responsável', () => {
    const withBia = mk('1', { assignedTo: { id: 'bia', name: 'Bia' } });
    const none = mk('2');

    it('todos, sem responsável, eu e uma pessoa', () => {
        expect(matchesAssigneeFilter(withBia, '', [])).toBe(true);
        expect(matchesAssigneeFilter(none, UNASSIGNED_FILTER, [])).toBe(true);
        expect(matchesAssigneeFilter(withBia, UNASSIGNED_FILTER, [])).toBe(false);
        expect(matchesAssigneeFilter(withBia, MINE_FILTER, ['BIA'])).toBe(true);
        expect(matchesAssigneeFilter(none, MINE_FILTER, ['bia'])).toBe(false);
        expect(matchesAssigneeFilter(withBia, 'bia', [])).toBe(true);
        expect(matchesAssigneeFilter(withBia, 'caio', [])).toBe(false);
        expect(matchesAssigneeFilter(none, 'bia', [])).toBe(false);
    });

    it('listAssignees devolve pessoas distintas em ordem alfabética', () => {
        const list = listAssignees([withBia, mk('3', { assignedTo: { id: 'ana', name: 'Ana' } }), mk('4', { assignedTo: { id: 'bia', name: 'Bia' } }), none]);
        expect(list).toEqual([{ id: 'ana', name: 'Ana' }, { id: 'bia', name: 'Bia' }]);
    });
});

describe('sortReports', () => {
    const a = mk('a', { priority: 'Baixa', status: 'Resolvido', createdAt: iso(-300), updatedAt: iso(-10), assignedTo: { id: 'z', name: 'Zélia' } });
    const b = mk('b', { priority: 'Crítica', status: 'Pendente', createdAt: iso(-200), updatedAt: iso(-500) });
    const c = mk('c', { priority: 'Alta', status: 'Em Andamento', createdAt: iso(-100), updatedAt: iso(-60), assignedTo: { id: 'a', name: 'Ana' } });
    const ids = (list) => list.map(r => r.id).join('');

    it('padrão mantém a ordem e não altera a lista original', () => {
        const input = [a, b, c];
        expect(ids(sortReports(input, 'default'))).toBe('abc');
        sortReports(input, 'priority', 'desc');
        expect(ids(input)).toBe('abc');
    });

    it('por data de abertura, última alteração, prioridade e status', () => {
        expect(ids(sortReports([a, b, c], 'date', 'desc'))).toBe('cba');
        expect(ids(sortReports([a, b, c], 'date', 'asc'))).toBe('abc');
        expect(ids(sortReports([a, b, c], 'updated', 'desc'))).toBe('acb');
        expect(ids(sortReports([a, b, c], 'priority', 'desc'))).toBe('bca');
        expect(ids(sortReports([a, b, c], 'status', 'asc'))).toBe('bca');
    });

    it('responsável em ordem alfabética, com "sem responsável" no fim', () => {
        expect(ids(sortReports([a, b, c], 'assignee', 'asc'))).toBe('cab');
        expect(ids(sortReports([a, b, c], 'assignee', 'desc'))).toBe('acb');
    });

    it('SLA: mais urgente primeiro e encerrados sempre no fim', () => {
        // createdAt como Date (no Firestore é Timestamp), relativo ao relógio real que o cálculo de SLA usa
        const ago = (hours) => new Date(Date.now() - hours * 3600000);
        const late = mk('late', { createdAt: ago(100), slaHours: 24 });
        const fresh = mk('fresh', { createdAt: ago(1), slaHours: 24 });
        const done = mk('done', { status: 'Resolvido' });
        const order = sortReports([done, fresh, late], 'sla', 'asc').map(r => r.id);
        expect(order).toEqual(['late', 'fresh', 'done']);
        expect(sortReports([done, fresh, late], 'sla', 'desc').map(r => r.id)).toEqual(['fresh', 'late', 'done']);
    });

    it('direção inicial sugerida por coluna', () => {
        expect(getDefaultSortDir('sla')).toBe('asc');
        expect(getDefaultSortDir('updated')).toBe('desc');
        expect(getDefaultSortDir('assignee')).toBe('asc');
    });
});

import { describe, it, expect } from 'vitest';
import {
    canUserViewTask,
    filterVisibleTasks,
    isUserWatcherOnly,
    canUserManageWatchers,
    canUserAssignResponsible,
    canUserDispatchOrCloseTask,
    getTaskOriginDepartment,
    hasAssignedResponsible,
    sanitizeMarkdownInput
} from './request.types';

describe('Hubdesk v3.10.1 — RLS Visibility, Watchers, Assignee & Markdown Security', () => {
    const regularAuthor = { uid: 'u_author', id: 'u_author', name: 'Ana Autora', email: 'ana@hubdesk.com', role: 'Colaborador' };
    const regularAssignee = { uid: 'u_assignee', id: 'u_assignee', name: 'Bruno Responsável', email: 'bruno@hubdesk.com', role: 'Colaborador' };
    const regularWatcher = { uid: 'u_watcher', id: 'u_watcher', name: 'Carlos Visualizador', email: 'carlos@hubdesk.com', role: 'Colaborador' };
    const regularOutsider = { uid: 'u_outsider', id: 'u_outsider', name: 'Daniel Terceiro', email: 'daniel@hubdesk.com', role: 'Colaborador' };
    const gestorUser = { uid: 'u_gestor', id: 'u_gestor', name: 'Gisele Gestora', email: 'gisele@hubdesk.com', role: 'Gestor' };
    const supervisorUser = { uid: 'u_sup', id: 'u_sup', name: 'Sérgio Supervisor', email: 'sergio@hubdesk.com', role: 'Supervisor' };

    const unassignedTask = {
        id: 't_unassigned',
        title: 'Erro sem responsável',
        creatorId: 'u_author',
        creatorName: 'Ana Autora',
        originDepartment: 'NOC',
        assignedTo: null,
        watchers: [{ id: 'u_watcher', name: 'Carlos Visualizador', role: 'Colaborador' }]
    };

    const assignedTask = {
        id: 't_assigned',
        title: 'Tarefa atribuída ao Bruno',
        creatorId: 'u_author',
        creatorName: 'Ana Autora',
        metadata: { affectedDepartment: 'Financeiro' },
        assignedTo: { id: 'u_assignee', name: 'Bruno Responsável', email: 'bruno@hubdesk.com', role: 'Colaborador' },
        watchers: [{ id: 'u_watcher', name: 'Carlos Visualizador', role: 'Colaborador' }]
    };

    it('identifica corretamente se a tarefa possui responsável atribuído', () => {
        expect(hasAssignedResponsible(unassignedTask)).toBe(false);
        expect(hasAssignedResponsible(assignedTask)).toBe(true);
    });

    it('extrai o departamento de origem tanto de originDepartment quanto de metadata.affectedDepartment', () => {
        expect(getTaskOriginDepartment(unassignedTask)).toBe('NOC');
        expect(getTaskOriginDepartment(assignedTask)).toBe('Financeiro');
    });

    it('permite que usuário comum visualize apenas se for criador, responsável ou visualizador', () => {
        expect(canUserViewTask(assignedTask, regularAuthor)).toBe(true);
        expect(canUserViewTask(assignedTask, regularAssignee)).toBe(true);
        expect(canUserViewTask(assignedTask, regularWatcher)).toBe(true);
        expect(canUserViewTask(assignedTask, regularOutsider)).toBe(false);
        expect(canUserViewTask(unassignedTask, regularOutsider)).toBe(false);
    });

    it('direciona tarefas sem responsável automaticamente para Gestores e Supervisores', () => {
        expect(canUserViewTask(unassignedTask, gestorUser)).toBe(true);
        expect(canUserViewTask(unassignedTask, supervisorUser)).toBe(true);

        const visibleForGestor = filterVisibleTasks([unassignedTask, assignedTask], gestorUser);
        expect(visibleForGestor.map((t) => t.id)).toEqual(['t_unassigned']);
    });

    it('restringe visualizadores estritamente ao modo somente leitura', () => {
        expect(isUserWatcherOnly(assignedTask, regularWatcher)).toBe(true);
        expect(isUserWatcherOnly(assignedTask, regularAuthor)).toBe(false);
        expect(isUserWatcherOnly(assignedTask, regularAssignee)).toBe(false);
        expect(isUserWatcherOnly(assignedTask, gestorUser)).toBe(false);

        // Visualizador não pode gerenciar outros visualizadores, atribuir responsável nem fechar chamado
        expect(canUserManageWatchers(assignedTask, regularWatcher)).toBe(false);
        expect(canUserAssignResponsible(assignedTask, regularWatcher)).toBe(false);
        expect(canUserDispatchOrCloseTask(assignedTask, regularWatcher)).toBe(false);

        // Criador, responsável direto e liderança podem gerenciar a lista de visualizadores
        expect(canUserManageWatchers(assignedTask, regularAuthor)).toBe(true);
        expect(canUserManageWatchers(assignedTask, regularAssignee)).toBe(true);
        expect(canUserManageWatchers(assignedTask, gestorUser)).toBe(true);
        expect(canUserManageWatchers(assignedTask, supervisorUser)).toBe(true);
        expect(canUserManageWatchers(assignedTask, regularOutsider)).toBe(false);
    });

    it('sanitiza payloads XSS mantendo tabelas Markdown intactas', () => {
        const maliciousMarkdown = `
| Coluna 1 | Coluna 2 |
| --- | --- |
| Valor A | Valor B |

<script>alert('xss')</script>
<img src="x" onerror="alert(1)" />
[Link Malicioso](javascript:alert('xss'))
`;
        const cleaned = sanitizeMarkdownInput(maliciousMarkdown);
        expect(cleaned).not.toContain('<script>');
        expect(cleaned).not.toContain('onerror=');
        expect(cleaned).not.toContain('javascript:');
        expect(cleaned).toContain('| Coluna 1 | Coluna 2 |');
        expect(cleaned).toContain('| Valor A | Valor B |');
    });
});

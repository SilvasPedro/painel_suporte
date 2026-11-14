import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', async (importOriginal) => ({ ...(await importOriginal()), doc: vi.fn(), updateDoc: vi.fn(), arrayUnion: vi.fn((...a) => a) }));
vi.mock('../../services/discordDm', () => ({ sendReportDm: vi.fn() }));

import ReportDetailModal from './ReportDetailModal';

const report = {
    id: 'abcdef1234567890',
    title: 'Falha na fila de atendimento',
    description: 'A fila parou de atualizar.',
    status: 'Em Andamento',
    priority: 'Crítica',
    category: 'error_analysis',
    creatorId: 'u-camila',
    creatorName: 'Camila Alves',
    createdAt: '2026-11-10T16:05:00.000Z',
    due_date: '2026-11-13',
    affectedClient: 'Sim',
    howAffected: 'Assinantes sem fila por 40 minutos.',
    adminComment: 'Cache reiniciado.',
    events: [
        { id: 'e1', type: 'assigned', actorName: 'Rafael', targetName: 'Pedro', createdAt: '2026-11-11T08:00:00.000Z' },
        { id: 'e2', type: 'status', actorName: 'Pedro', from: 'Pendente', to: 'Em Andamento', createdAt: '2026-11-11T09:00:00.000Z' }
    ],
    comments: [
        { id: 'c1', authorId: 'u-camila', authorName: 'Camila Alves', content: 'Voltou a acontecer', createdAt: '2026-11-11T11:00:00.000Z' },
        { id: 'c2', kind: 'opinion', status: 'Em Andamento', authorId: 'u-rafael', authorName: 'Rafael', authorRole: 'Gestor', isStaff: true, content: 'Cache reiniciado.', createdAt: '2026-11-11T14:00:00.000Z' }
    ]
};

const collaborators = [{ id: 'u-pedro', name: 'Pedro Souza', role: 'Apoio' }, { id: 'u-lucas', name: 'Lucas', role: 'Operacional' }];
const manager = { id: 'u-rafael', uid: 'u-rafael', name: 'Rafael', role: 'Gestor', email: 'r@x.com' };

const render = (props = {}) => renderToString(
    <ReportDetailModal
        report={report}
        isOpen
        onClose={() => {}}
        onReportUpdate={() => {}}
        user={manager}
        currentUser={{ uid: 'u-rafael', name: 'Rafael', role: 'Gestor' }}
        collaborators={collaborators}
        canManageTickets
        canEditOrDelete={() => true}
        totalCount={12}
        currentIndex={2}
        {...props}
    />
);

describe('ReportDetailModal (novo layout)', () => {
    it('mostra cabeçalho, descrição, aviso de impacto e barra lateral', () => {
        const html = render();
        expect(html).toContain('ABCDEF12');
        expect(html).toContain('Falha na fila de atendimento');
        expect(html).toMatch(/3(<!-- -->)?\/(<!-- -->)?12/);
        expect(html).toContain('A fila parou de atualizar.');
        expect(html).toContain('Afetou cliente.');
        expect(html).toContain('Detalhes do chamado');
        expect(html).toContain('Prazo e SLA');
        expect(html).toContain('13/11/2026');
        expect(html).toContain('Solicitante');
        expect(html).toContain('role="dialog"');
        expect(html).toContain('aria-labelledby');
    });

    it('passo a passo e linha do tempo unificada com eventos e comentários', () => {
        const html = render();
        expect(html).toContain('Andamento do chamado');
        expect(html).toContain('abriu o chamado');
        expect(html).toContain('atribuiu o chamado a Pedro');
        expect(html).toContain('mudou o status para Em andamento');
        expect(html).toContain('Voltou a acontecer');
        expect(html).toContain('Parecer da liderança');
    });

    it('linha do tempo tem seletor de ordem, com mais antigos primeiro por padrão', () => {
        const html = render();
        expect(html).toContain('Ordem da linha do tempo');
        expect(html).toContain('Antigos');
        expect(html).toContain('Recentes');
        expect(html.indexOf('abriu o chamado')).toBeLessThan(html.indexOf('Voltou a acontecer'));
    });

    it('gestor vê as duas abas do compositor e os atalhos de despacho', () => {
        const html = render();
        expect(html).toContain('Comentário');
        expect(html).toContain('Parecer e encerramento');
        expect(html).toContain('Suspender');
        expect(html).toContain('Resolver');
        expect(html).toContain('Editar solicitação');
        expect(html).not.toContain('anexo');
    });

    it('solicitante comum só comenta e não vê ações de gestão', () => {
        const html = render({
            user: { id: 'u-camila', uid: 'u-camila', name: 'Camila', role: 'Operacional' },
            currentUser: { uid: 'u-camila', name: 'Camila', role: 'Operacional' },
            canManageTickets: false,
            canEditOrDelete: () => false
        });
        expect(html).toContain('Enviar comentário');
        expect(html).not.toContain('Parecer e encerramento');
        expect(html).not.toContain('Suspender');
        expect(html).not.toContain('Excluir');
    });

    it('visualizador fica em somente leitura, sem campo de envio', () => {
        const html = render({
            report: { ...report, watchers: [{ id: 'u-lucas', name: 'Lucas' }], watcherIds: ['u-lucas'] },
            user: { id: 'u-lucas', uid: 'u-lucas', name: 'Lucas', role: 'Operacional' },
            currentUser: { uid: 'u-lucas', name: 'Lucas', role: 'Operacional' },
            canManageTickets: false,
            canEditOrDelete: () => false
        });
        expect(html).toContain('Modo visualizador');
        expect(html).not.toContain('Enviar comentário');
    });

    it('parecer oficial aparece uma única vez no bloco de destaque', () => {
        const html = render();
        expect(html).toContain('Parecer oficial');
        expect(html.split('Parecer oficial').length - 1).toBe(2); // título + aria-label da seção
    });

    it('chamado suspenso mostra o aviso e o passo "Em pausa"', () => {
        const html = render({ report: { ...report, status: 'Suspenso' } });
        expect(html).toContain('Chamado suspenso.');
        expect(html).toContain('Em pausa');
    });

    it('não renderiza nada quando fechado', () => {
        expect(render({ isOpen: false })).toBe('');
    });
});

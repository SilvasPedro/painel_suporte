import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import SmartPreDashboard from './SmartPreDashboard';
import SmartPreFormModal from './SmartPreFormModal';
import SmartPreDetailModal from './SmartPreDetailModal';

const clients = [
    { id: '1', clientName: 'Ana Souza', installedAt: '2026-11-01', contacted: true, firstContactAt: '2026-11-03', issues: ['slow'], status: 'in_progress', resolutionType: 'remote', comments: [] },
    { id: '2', clientName: 'Bruno', installedAt: '2026-11-02', contacted: false, status: 'monitoring', issues: [] }
];

describe('telas do Smart Pre (renderização)', () => {
    it('dashboard mostra os indicadores principais', () => {
        const html = renderToString(<SmartPreDashboard clients={clients} allClients={clients} onOpenClient={() => {}} />);
        expect(html).toContain('Saúde do serviço');
        expect(html).toContain('Clientes na base');
        expect(html).toContain('Tempo médio até o contato');
        expect(html).toContain('Em tratativa agora');
        expect(html).toContain('Ana Souza');
    });

    it('dashboard sem clientes mostra o estado vazio', () => {
        const html = renderToString(<SmartPreDashboard clients={[]} allClients={[]} onOpenClient={() => {}} />);
        expect(html).toContain('Nenhum cliente no período');
    });

    it('formulário abre vazio para cadastro e preenchido para edição', () => {
        const novo = renderToString(<SmartPreFormModal isOpen onClose={() => {}} client={null} onSave={() => {}} saving={false} />);
        expect(novo).toContain('Novo cliente Smart Pre');
        const edicao = renderToString(<SmartPreFormModal isOpen onClose={() => {}} client={clients[0]} onSave={() => {}} saving={false} />);
        expect(edicao).toContain('Editar cliente Smart Pre');
        expect(edicao).toContain('Ana Souza');
        expect(edicao).toContain('Problema relatado');
    });

    it('detalhe mostra relatos e esconde o campo de relato para quem só consulta', () => {
        const props = { client: { ...clients[0], comments: [{ id: 'c', authorName: 'Maria', authorRole: 'Apoio', content: 'Cliente ligou', createdAt: '2026-11-04T10:00:00.000Z' }] }, onClose: () => {}, onEdit: () => {}, onDelete: () => {}, onSubmitUpdate: async () => true };
        const editor = renderToString(<SmartPreDetailModal {...props} canEdit />);
        expect(editor).toContain('Cliente ligou');
        expect(editor).toContain('Registre um relato');
        const leitor = renderToString(<SmartPreDetailModal {...props} canEdit={false} />);
        expect(leitor).toContain('somente de leitura');
        expect(leitor).not.toContain('Registre um relato');
    });
});

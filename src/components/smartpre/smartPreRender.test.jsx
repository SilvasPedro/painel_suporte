import React from 'react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn() }));
vi.mock('../../context/NotificationContext', () => ({ useNotification: () => ({ showToast: vi.fn() }) }));
import { renderToString } from 'react-dom/server';
import SmartPreDashboard from './SmartPreDashboard';
import SmartPreFormModal from './SmartPreFormModal';
import SmartPreDetailModal from './SmartPreDetailModal';
import EasyAuthShortcut from './EasyAuthShortcut';

const clients = [
    {
        id: '1', clientName: 'Ana Souza', installedAt: '2026-11-01', comments: [],
        protocols: [{ id: 'p1', protocol: '2611.001', openedAt: '2026-11-03', classification: 'slow', status: 'open' }]
    },
    { id: '2', clientName: 'Bruno', installedAt: '2026-11-02', protocols: [], comments: [] }
];

describe('telas do Smart Pre (renderização)', () => {
    it('dashboard mostra os indicadores principais e a fila de protocolos em aberto', () => {
        const html = renderToString(<SmartPreDashboard clients={clients} allClients={clients} onOpenClient={() => {}} />);
        expect(html).toContain('Saúde do serviço');
        expect(html).toContain('Clientes na base');
        expect(html).toContain('Tempo médio até o contato');
        expect(html).toContain('Protocolos finalizados');
        expect(html).toContain('Em tratativa agora');
        expect(html).toContain('Ana Souza');
        expect(html).toContain('#2611.001');
    });

    it('dashboard sem clientes mostra o estado vazio', () => {
        const html = renderToString(<SmartPreDashboard clients={[]} allClients={[]} onOpenClient={() => {}} />);
        expect(html).toContain('Nenhum cliente no período');
    });

    it('cadastro do cliente não pergunta sobre contato', () => {
        const novo = renderToString(<SmartPreFormModal isOpen onClose={() => {}} client={null} onSave={() => {}} saving={false} />);
        expect(novo).toContain('Novo cliente Smart Pre');
        expect(novo).toContain('Data da instalação');
        expect(novo).not.toContain('entrou em contato');
        const edicao = renderToString(<SmartPreFormModal isOpen onClose={() => {}} client={clients[0]} onSave={() => {}} saving={false} />);
        expect(edicao).toContain('Editar cliente Smart Pre');
        expect(edicao).toContain('Ana Souza');
    });

    const detailProps = {
        onClose: () => {}, onEdit: () => {}, onDelete: () => {}, onSaveProtocol: async () => true,
        onDeleteProtocol: async () => true, onSubmitComment: async () => true, authorName: 'Maria'
    };

    it('detalhe lista protocolos, relatos e permite abrir novo protocolo para quem edita', () => {
        const client = { ...clients[0], comments: [{ id: 'c', authorName: 'Maria', authorRole: 'Apoio', content: 'Cliente ligou', createdAt: '2026-11-04T10:00:00.000Z' }] };
        const html = renderToString(<SmartPreDetailModal client={client} canEdit {...detailProps} />);
        expect(html).toContain('Protocolos de atendimento');
        expect(html).toContain('#2611.001');
        expect(html).toContain('Em aberto');
        expect(html).toContain('Novo protocolo');
        expect(html).toContain('Cliente ligou');
        expect(html).toContain('Registre um relato');
    });

    it('detalhe de cliente sem atendimento orienta a registrar o primeiro protocolo', () => {
        const html = renderToString(<SmartPreDetailModal client={clients[1]} canEdit {...detailProps} />);
        expect(html).toContain('Nenhum atendimento registrado');
        expect(html).toContain('Ainda não entrou em contato');
    });

    it('atalho do EasyAuth abre o portal em nova aba e mantém as credenciais recolhidas', () => {
        const html = renderToString(<EasyAuthShortcut canConfigure={false} />);
        expect(html).toContain('href="https://app.easyauth.net/signin"');
        expect(html).toContain('target="_blank"');
        expect(html).toContain('rel="noopener noreferrer"');
        expect(html).toContain('alt="EasyAuth"');
        expect(html).toContain('Ver credenciais');
        expect(html).not.toContain('Copiar senha'); // painel fechado: nada de senha na tela
    });

    it('quem só consulta não vê botões nem campos de edição', () => {
        const html = renderToString(<SmartPreDetailModal client={clients[0]} canEdit={false} {...detailProps} />);
        expect(html).toContain('somente de leitura');
        expect(html).not.toContain('Novo protocolo');
        expect(html).not.toContain('Registre um relato');
        expect(html).not.toContain('Editar protocolo');
    });
});

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

const authState = { currentUser: null };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => authState }));
vi.mock('../../services/firebase', () => ({ auth: {}, db: {} }));
vi.mock('../../services/dataCache', () => ({ getCachedCollection: () => [] }));

import FloatingHub from './FloatingHub';
import ChatPanel from './ChatPanel';
import ExtensionsPanel from './ExtensionsPanel';

beforeEach(() => { authState.currentUser = null; });

describe('FloatingHub', () => {
    it('gestão vê o botão com as duas bolinhas (Chat IA e Ramais) e os dois painéis', () => {
        authState.currentUser = { role: 'Gestor' };
        const html = renderToString(<FloatingHub />);
        expect(html).toContain('id="floating-hub-btn"');
        expect(html).toContain('Abrir atalhos: Ramais e Chat IA');
        expect(html).toContain('Abrir chat com a IA');
        expect(html).toContain('Abrir lista de ramais');
        expect(html).toContain('Assistente de IA do Hubdesk');
        expect(html).toContain('Ramais telefônicos');
        // começa fechado: menu e painéis ocultos
        expect(html).toContain('aria-hidden="true"');
    });

    it('quem não é da gestão só tem os ramais, sem bolinha nem painel do chat', () => {
        authState.currentUser = { role: 'Operacional' };
        const html = renderToString(<FloatingHub />);
        expect(html).toContain('Abrir ramais');
        expect(html).not.toContain('Abrir chat com a IA');
        expect(html).not.toContain('Assistente de IA do Hubdesk');
        expect(html).toContain('Ramais telefônicos');
    });

    it('sem login ou usuário inativo não mostra nada', () => {
        expect(renderToString(<FloatingHub />)).toBe('');
        authState.currentUser = { role: 'Gestor', isInactive: true };
        expect(renderToString(<FloatingHub />)).toBe('');
    });
});

describe('ChatPanel', () => {
    it('mostra saudação, sugestões, campo de mensagem e o aviso de uso', () => {
        const html = renderToString(<ChatPanel isOpen onClose={() => {}} />);
        expect(html).toContain('Assistente Hubdesk');
        expect(html).toContain('Olá! Sou o assistente do Hubdesk');
        expect(html).toContain('Sugestões');
        expect(html).toContain('Relatório do desempenho da equipe no mês');
        expect(html).toContain('aria-label="Mensagem para o assistente"');
        expect(html).toContain('aria-label="Enviar mensagem"');
        expect(html).toContain('aria-label="Minimizar chat"');
        expect(html).toContain('Exclusivo da gestão');
    });

    it('fechado, fica oculto mas montado', () => {
        const html = renderToString(<ChatPanel isOpen={false} onClose={() => {}} />);
        expect(html).toContain('invisible');
        expect(html).toContain('aria-hidden="true"');
    });
});

describe('ExtensionsPanel', () => {
    it('lista os ramais e o telefone da ETECC Resolve', () => {
        const html = renderToString(<ExtensionsPanel isOpen onClose={() => {}} />);
        expect(html).toContain('Ramais Telefônicos');
        expect(html).toContain('Suporte Técnico');
        expect(html).toContain('(13) 3421-1980');
        expect(html).toContain('role="dialog"');
    });
});

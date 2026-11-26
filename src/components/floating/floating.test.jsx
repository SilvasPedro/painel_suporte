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
import { AI_AGENT_NAME } from '../../utils/floatingHub';

beforeEach(() => { authState.currentUser = null; });

describe('FloatingHub', () => {
    it('gestão vê o botão com as duas bolinhas (Atlas Bot e Ramais) e os dois painéis', () => {
        authState.currentUser = { role: 'Gestor' };
        const html = renderToString(<FloatingHub />);
        expect(html).toContain('id="floating-hub-btn"');
        expect(html).toContain('Abrir atalhos: Ramais e Atlas Bot');
        expect(html).toContain('Abrir o chat com o Atlas Bot');
        expect(html).toContain('Abrir lista de ramais');
        expect(html).toContain('Atlas Bot, Agente de IA Hubdesk');
        expect(html).not.toContain('<title>'); // o avatar é decorativo: não duplica o nome para leitores de tela
        expect(html).toContain('Ramais telefônicos');
        // começa fechado: menu e painéis ocultos
        expect(html).toContain('aria-hidden="true"');
    });

    it('quem não é da gestão só tem os ramais, sem bolinha nem painel do chat', () => {
        authState.currentUser = { role: 'Operacional' };
        const html = renderToString(<FloatingHub />);
        expect(html).toContain('Abrir ramais');
        expect(html).not.toContain('Abrir o chat com o Atlas Bot');
        expect(html).not.toContain('Atlas Bot, Agente de IA Hubdesk');
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
        expect(html).toContain(AI_AGENT_NAME);
        expect(html).toContain('extração de dados do painel, somente leitura');
        expect(html).toContain('Sugestões');
        expect(html).toContain('Relatório do desempenho da equipe no mês');
        expect(html).toContain('aria-label="Mensagem para o assistente"');
        expect(html).toContain('aria-label="Enviar mensagem"');
        expect(html).toContain('aria-label="Minimizar chat"');
        expect(html).toContain('Exclusivo da gestão');
    });

    it('cabeçalho com o nome "Atlas Bot", o título "Agente de IA Hubdesk" e o avatar do personagem', () => {
        const html = renderToString(<ChatPanel isOpen onClose={() => {}} />);
        expect(html).toContain('>Atlas Bot</h3>');
        expect(html).toContain('Agente de IA Hubdesk');
        expect(html).toContain('viewBox="0 0 256 256"'); // AtlasAvatar
        expect(html).not.toContain('Assistente Hubdesk');
    });

    it('mostra o selo "Powered by Claude AI" com o logo no cabeçalho', () => {
        const html = renderToString(<ChatPanel isOpen onClose={() => {}} />);
        expect(html).toContain('Powered by Claude AI');
        expect(html).toContain('#D97757'); // cor do logo
    });

    it('traz o botão de janela flutuante (desativado sem suporte do navegador)', () => {
        const html = renderToString(<ChatPanel isOpen onClose={() => {}} />);
        expect(html).toContain('aria-label="Abrir o chat em janela flutuante"');
        expect(html).toMatch(/<button[^>]*disabled=""[^>]*aria-label="Abrir o chat em janela flutuante"|<button[^>]*aria-label="Abrir o chat em janela flutuante"[^>]*disabled=""/);
    });

    it('na tela larga não mostra a alça de redimensionar (sem navegador, o layout é o estreito)', () => {
        const html = renderToString(<ChatPanel isOpen onClose={() => {}} />);
        expect(html).not.toContain('role="separator"');
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

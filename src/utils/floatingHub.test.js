import { describe, it, expect } from 'vitest';
import { canUseAiChat, buildChatContext, buildChatHistory, CHAT_LIMITS, SUGGESTED_PROMPTS, AI_AGENT_NAME } from './floatingHub';
import { AI_AGENT_NAME as SERVER_AGENT_NAME } from '../../api/_lib/aiPrompts.js';

describe('nome do agente de IA', () => {
    it('é o mesmo no chat (front) e no prompt do servidor', () => {
        expect(AI_AGENT_NAME).toBe(SERVER_AGENT_NAME);
        expect(AI_AGENT_NAME.trim().length).toBeGreaterThan(0);
    });
});

describe('canUseAiChat', () => {
    it('só a gestão ativa usa a IA', () => {
        expect(canUseAiChat({ role: 'Gestor' })).toBe(true);
        expect(canUseAiChat({ role: ' Supervisor ' })).toBe(true);
        expect(canUseAiChat({ role: 'Admin' })).toBe(true);
        expect(canUseAiChat({ role: 'Operacional' })).toBe(false);
        expect(canUseAiChat({ role: 'Apoio' })).toBe(false);
        expect(canUseAiChat({ role: 'Gestor', isInactive: true })).toBe(false);
        expect(canUseAiChat(null)).toBe(false);
    });

    it('o administrador mestre sempre pode', () => {
        expect(canUseAiChat({ role: 'Operacional', email: 'PedroSouzaCTT@gmail.com' })).toBe(true);
    });
});

describe('buildChatContext', () => {
    it('mantém só campos simples e curtos de cada registro', () => {
        const ctx = buildChatContext({
            collaborators: [{ id: 'a', name: 'Ana', active: true, bio: 'x'.repeat(500), tags: ['a'], meta: { k: 1 } }]
        });
        expect(ctx.appInfo).toMatch(/Hubdesk/);
        expect(ctx.collaborators[0]).toEqual({ id: 'a', name: 'Ana', active: true });
    });

    it('cabe no limite, encolhendo as listas e mantendo as avaliações mais recentes', () => {
        const evaluations = Array.from({ length: 2000 }, (_, i) => ({
            id: `e${i}`, nota: i, comentario: 'texto curto', createdAt: new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString()
        }));
        const ctx = buildChatContext({ collaborators: [{ id: 'a', name: 'Ana' }], evaluations }, 8000);
        expect(JSON.stringify(ctx).length).toBeLessThanOrEqual(8000);
        expect(ctx.evaluations.length).toBeGreaterThan(0);
        expect(ctx.evaluations.length).toBeLessThan(2000);
        expect(ctx.evaluations[0].id).toBe('e1999'); // a mais recente
        expect(ctx.collaborators).toHaveLength(1);
    });

    it('lida com listas ausentes e respeita o limite padrão do servidor', () => {
        expect(buildChatContext().collaborators).toEqual([]);
        const big = Array.from({ length: 5000 }, (_, i) => ({ id: `c${i}`, name: `Colaborador ${i}`, cargo: 'Analista de suporte' }));
        expect(JSON.stringify(buildChatContext({ collaborators: big })).length).toBeLessThanOrEqual(CHAT_LIMITS.contextChars);
    });
});

describe('buildChatHistory', () => {
    it('ignora saudação e erros, mantém as últimas mensagens e limita o texto', () => {
        const messages = [
            { role: 'assistant', content: 'Olá!', greeting: true },
            { role: 'user', content: 'pergunta' },
            { role: 'assistant', content: 'falhou', error: true },
            { role: 'assistant', content: 'a'.repeat(CHAT_LIMITS.historyText + 500) },
            { role: 'user', content: '   ' }
        ];
        const history = buildChatHistory(messages);
        expect(history.map(h => h.role)).toEqual(['user', 'assistant']);
        expect(history[1].content).toHaveLength(CHAT_LIMITS.historyText);
    });

    it('envia no máximo as últimas 20 mensagens', () => {
        const many = Array.from({ length: 50 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
        const history = buildChatHistory(many);
        expect(history).toHaveLength(CHAT_LIMITS.historyItems);
        expect(history.at(-1).content).toBe('m49');
    });
});

describe('SUGGESTED_PROMPTS', () => {
    it('traz sugestões curtas para começar a conversa', () => {
        expect(SUGGESTED_PROMPTS.length).toBeGreaterThanOrEqual(3);
        expect(SUGGESTED_PROMPTS.every(p => p.length < 80)).toBe(true);
    });
});

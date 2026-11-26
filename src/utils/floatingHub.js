/**
 * Regras do botão flutuante (Ramais e Chat IA) e do chat: quem pode usar a IA, contexto enviado e histórico.
 * Os limites espelham o servidor (api/_lib/aiGuard.js): passar deles resulta em erro 413.
 */

import { ATLAS_NAME, ATLAS_TITLE } from './atlasBot';

// Mesmos cargos que o servidor aceita nas rotas de IA (api/_lib/dm.js > isStaffUser)
export const STAFF_AI_ROLES = ['admin', 'gestor', 'supervisor', 'noc', 'diretor'];
const MASTER_EMAIL = 'pedrosouzactt@gmail.com';

export const CHAT_LIMITS = {
    message: 4000,
    historyItems: 20,
    historyText: 4000,
    contextChars: 50000 // abaixo dos 60.000 do servidor, deixando folga para o restante do corpo
};

/** O assistente de IA é exclusivo da gestão; os ramais valem para qualquer usuário ativo. */
export const canUseAiChat = (user) => {
    if (!user || user.isInactive) return false;
    if (String(user.email || '').toLowerCase() === MASTER_EMAIL) return true;
    return STAFF_AI_ROLES.includes(String(user.role || '').trim().toLowerCase());
};

// Nome do agente de IA (Atlas Bot). É o mesmo do prompt do servidor (AI_AGENT_NAME em api/_lib/aiPrompts.js; um teste confere).
export const AI_AGENT_NAME = ATLAS_NAME;
export const AI_AGENT_TITLE = ATLAS_TITLE;

// Pedidos de dados, no formato que o agente entrega melhor: o quê, de quando e como ordenar
export const SUGGESTED_PROMPTS = [
    'Relatório do desempenho da equipe no mês',
    'Ranking de notas da última semana',
    'Chamados críticos em aberto',
    'KPIs do setor abaixo da meta'
];

// Campos que só pesam no envio (anexos, textos longos e listas aninhadas) são deixados de fora
const compactDoc = (doc) => {
    const out = {};
    Object.entries(doc || {}).forEach(([key, value]) => {
        if (typeof value === 'number' || typeof value === 'boolean') out[key] = value;
        else if (typeof value === 'string' && value.length <= 120) out[key] = value;
    });
    return out;
};

const sortRecentFirst = (items) => [...items].sort((a, b) => {
    const ta = Date.parse(a?.date || a?.createdAt || a?.refMonth || '') || 0;
    const tb = Date.parse(b?.date || b?.createdAt || b?.refMonth || '') || 0;
    return tb - ta;
});

const sizeOf = (value) => {
    try { return JSON.stringify(value).length; } catch { return Infinity; }
};

/**
 * Monta o contexto da conversa (colaboradores, avaliações e KPIs) cabendo no limite do servidor.
 * Cada registro vira só os campos simples; se ainda passar do limite, as listas mais longas encolhem
 * (as avaliações mantêm as mais recentes) até caber.
 */
export const buildChatContext = ({ collaborators = [], evaluations = [], sectorKpis = [] } = {}, maxChars = CHAT_LIMITS.contextChars) => {
    const lists = {
        collaborators: (collaborators || []).map(compactDoc),
        evaluations: sortRecentFirst(evaluations || []).map(compactDoc),
        sectorKpis: sortRecentFirst(sectorKpis || []).map(compactDoc)
    };
    const build = () => ({ appInfo: 'Painel Hubdesk - Suporte Técnico', ...lists });

    let context = build();
    let guard = 0;
    while (sizeOf(context) > maxChars && guard < 200) {
        const keys = Object.keys(lists).filter(k => lists[k].length > 0);
        if (keys.length === 0) break;
        // reduz 20% da maior lista por rodada
        const biggest = keys.reduce((a, b) => (lists[b].length > lists[a].length ? b : a));
        lists[biggest] = lists[biggest].slice(0, Math.floor(lists[biggest].length * 0.8));
        context = build();
        guard += 1;
    }
    return context;
};

/** Histórico enviado à IA: sem a saudação nem erros, só as últimas mensagens e com texto limitado. */
export const buildChatHistory = (messages = []) => messages
    .filter(m => !m.error && !m.greeting && String(m.content || '').trim())
    .slice(-CHAT_LIMITS.historyItems)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content).slice(0, CHAT_LIMITS.historyText) }));

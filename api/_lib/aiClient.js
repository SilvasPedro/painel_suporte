/**
 * Cliente do Claude (Anthropic) e laço de ferramentas usados por /api/chat e /api/insights.
 */

import Anthropic from '@anthropic-ai/sdk';
import { inspectApiKey } from './aiErrors.js';
import { generateWithFallback } from './aiModels.js';

let clientInstance = null;
let clientKey = '';

/**
 * Só a variável do servidor: qualquer variável VITE_* vai para o código público do site.
 * O valor é conferido antes de usar (aspas curvas, espaços e texto junto à chave quebram a chamada).
 */
export const getAiClient = (env = process.env) => {
    const inspected = inspectApiKey(env.ANTHROPIC_API_KEY);
    if (!inspected.ok) return { failure: inspected };
    if (!clientInstance || clientKey !== inspected.key) {
        clientInstance = new Anthropic({ apiKey: inspected.key, maxRetries: 1 });
        clientKey = inspected.key;
    }
    return { ai: clientInstance };
};

/** Texto da resposta (junta os blocos de texto). */
export const textOf = (response) => (response?.content || [])
    .filter(block => block?.type === 'text')
    .map(block => block.text)
    .join('')
    .trim();

/**
 * Histórico + pergunta no formato da API: começa com "user", alterna os papéis e termina com a pergunta.
 * Mensagens vazias saem e mensagens seguidas do mesmo papel são unidas.
 */
export const buildMessages = (history = [], message = '') => {
    const raw = [...history, { role: 'user', content: message }]
        .map(item => ({ role: item?.role === 'user' ? 'user' : 'assistant', content: String(item?.content ?? '').trim() }))
        .filter(item => item.content);
    const merged = [];
    for (const item of raw) {
        const last = merged[merged.length - 1];
        if (last && last.role === item.role) last.content = `${last.content}\n\n${item.content}`;
        else merged.push({ ...item });
    }
    while (merged.length && merged[0].role !== 'user') merged.shift();
    return merged;
};

export const AI_BUDGET = {
    totalMs: 52000,       // a função da Vercel tem 60 s (vercel.json); sobra margem para responder
    minRoundMs: 12000,    // sem isso de tempo, não abre nova rodada de consultas
    maxRounds: 8,         // idas e vindas com o banco por pergunta
    maxConsultas: 40      // itens do resumo "consultou" devolvidos à tela
};

const NO_TIME_NOTE = 'O limite de consultas ou de tempo desta resposta foi atingido. Responda agora com o que já foi consultado e diga, em uma frase, o que ficou de fora.';

/**
 * Conversa com o Claude permitindo que ele chame ferramentas (consultas ao banco) quantas vezes precisar,
 * dentro do limite de rodadas e de tempo.
 * @returns {Promise<{ response: object, text: string, consultas: string[] }>}
 */
export const runWithTools = async ({
    ai, env = {}, system, messages, tools = [], execute, maxTokens = 3500,
    now = () => Date.now(), onModelSkipped, budget = AI_BUDGET
}) => {
    const startedAt = now();
    const convo = messages.map(m => ({ ...m }));
    const consultas = [];

    // Com blocos de ferramenta no histórico a API exige a lista de ferramentas; no fechamento, tool_choice "none" as bloqueia
    const call = (allowTools) => generateWithFallback({
        ai, env, onModelSkipped,
        requestOptions: { timeout: Math.max(5000, budget.totalMs - (now() - startedAt)) },
        request: {
            max_tokens: maxTokens,
            system,
            messages: convo,
            ...(tools.length ? { tools, ...(allowTools ? {} : { tool_choice: { type: 'none' } }) } : {})
        }
    });

    for (let round = 0; round < budget.maxRounds; round += 1) {
        const remaining = budget.totalMs - (now() - startedAt);
        if (round > 0 && remaining < budget.minRoundMs) break;

        const { response } = await call(true);
        if (response.stop_reason !== 'tool_use') {
            return { response, text: textOf(response), consultas };
        }

        convo.push({ role: 'assistant', content: response.content });
        const uses = response.content.filter(block => block.type === 'tool_use');
        const results = await Promise.all(uses.map(async (use) => {
            try {
                const out = await execute(use.name, use.input);
                if (consultas.length < budget.maxConsultas) consultas.push(out.resumo);
                return { type: 'tool_result', tool_use_id: use.id, content: out.text };
            } catch (error) {
                const reason = String(error?.message || 'erro desconhecido').slice(0, 500);
                if (consultas.length < budget.maxConsultas) consultas.push(`${use.name}: falhou`);
                return { type: 'tool_result', tool_use_id: use.id, is_error: true, content: `Erro na consulta: ${reason}` };
            }
        }));
        convo.push({ role: 'user', content: results });
    }

    // Limite atingido: pede o fechamento sem novas consultas
    const last = convo[convo.length - 1];
    if (last?.role === 'user' && Array.isArray(last.content)) last.content.push({ type: 'text', text: NO_TIME_NOTE });
    else convo.push({ role: 'user', content: NO_TIME_NOTE });
    const { response } = await call(false);
    return { response, text: textOf(response), consultas };
};

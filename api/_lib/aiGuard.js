/**
 * Proteção das rotas de IA (/api/chat e /api/insights).
 *
 * Antes, qualquer pessoa que conhecesse o endereço podia chamar a IA e gastar o saldo da chave.
 * Agora cada chamada precisa de:
 *  1. login válido (ID token do Firebase, com assinatura verificada);
 *  2. perfil da gestão (mesma regra do Firestore: gestor, supervisor, admin, noc, diretor);
 *  3. respeitar o limite de chamadas por minuto de cada usuário;
 *  4. corpo dentro dos tamanhos permitidos (evita enviar textos gigantes para a IA).
 *
 * Esta pasta começa com "_" para a Vercel NÃO expor estes arquivos como rotas.
 */

import { verifyFirebaseToken, isStaffUser, DEFAULT_PROJECT_ID } from './dm.js';

export const AI_LIMITS = {
    message: 4000,       // caracteres da mensagem do chat
    historyItems: 20,    // mensagens anteriores enviadas junto
    historyText: 4000,   // caracteres de cada mensagem anterior
    jsonChars: 60000,    // tamanho dos dados de contexto / desempenho (em JSON)
    shortText: 80,       // período e tipo de análise
    perMinute: 20        // chamadas por usuário por minuto
};

const WINDOW_MS = 60 * 1000;
let buckets = new Map();

export const resetRateLimit = () => { buckets = new Map(); };

/** Janela deslizante por usuário. Em serverless vale por instância, o que já barra abuso simples. */
export const checkRateLimit = (uid, now = Date.now(), limit = AI_LIMITS.perMinute) => {
    const recent = (buckets.get(uid) || []).filter(t => now - t < WINDOW_MS);
    if (recent.length >= limit) {
        buckets.set(uid, recent);
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 1000)) };
    }
    recent.push(now);
    buckets.set(uid, recent);
    // evita crescer sem limite: descarta quem não chama há mais de uma janela
    if (buckets.size > 500) {
        for (const [key, times] of buckets) if (!times.some(t => now - t < WINDOW_MS)) buckets.delete(key);
    }
    return { allowed: true, retryAfter: 0 };
};

const bearerToken = (req) => {
    const header = String(req?.headers?.authorization || '');
    return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
};

/**
 * Confere login, perfil e limite de uso.
 * @returns {Promise<{ ok: true, user: { uid: string, email: string } } | { ok: false, status: number, json: object, headers?: object }>}
 */
export const authorizeAiRequest = async ({ req, env = {}, fetchImpl = fetch, now = Date.now() }) => {
    const projectId = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;
    const idToken = bearerToken(req);

    let user;
    try {
        user = await verifyFirebaseToken(idToken, { projectId, fetchImpl, now });
    } catch {
        return { ok: false, status: 401, json: { error: 'nao-autenticado', message: 'Entre no sistema para usar a IA.' } };
    }

    let staff = false;
    try {
        staff = await isStaffUser(user, { idToken, projectId, fetchImpl });
    } catch {
        staff = false;
    }
    if (!staff) {
        return { ok: false, status: 403, json: { error: 'sem-permissao', message: 'O Atlas Bot é exclusivo da gestão.' } };
    }

    const limit = checkRateLimit(user.uid, now);
    if (!limit.allowed) {
        return {
            ok: false,
            status: 429,
            headers: { 'Retry-After': String(limit.retryAfter) },
            json: { error: 'muitas-chamadas', message: `Muitas chamadas seguidas. Tente de novo em ${limit.retryAfter}s.` }
        };
    }

    return { ok: true, user };
};

const asText = (value) => (typeof value === 'string' ? value : '');

// Texto de uma linha para entrar em prompt: sem quebras de linha e com tamanho limitado
const oneLine = (value, max) => Array.from(String(value ?? ''))
    .map(ch => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const jsonSize = (value) => {
    try { return JSON.stringify(value)?.length ?? 0; } catch { return Infinity; }
};

/** Valida e limpa o corpo do chat. */
export const validateChatBody = (body) => {
    const message = asText(body?.message).trim();
    if (!message) return { ok: false, status: 400, error: 'Nenhuma mensagem fornecida.' };
    if (message.length > AI_LIMITS.message) return { ok: false, status: 413, error: `A mensagem passa de ${AI_LIMITS.message} caracteres.` };

    const rawHistory = Array.isArray(body?.history) ? body.history : [];
    // só as mensagens mais recentes, com papel e texto válidos
    const history = rawHistory.slice(-AI_LIMITS.historyItems).map(item => ({
        role: item?.role === 'user' ? 'user' : 'assistant',
        content: asText(item?.content) || asText(item?.text)
    }));
    if (history.some(item => item.content.length > AI_LIMITS.historyText)) {
        return { ok: false, status: 413, error: 'Uma mensagem do histórico é grande demais.' };
    }

    const contextData = body?.contextData ?? null;
    if (contextData !== null && jsonSize(contextData) > AI_LIMITS.jsonChars) {
        return { ok: false, status: 413, error: 'Os dados de contexto são grandes demais.' };
    }

    return { ok: true, value: { message, history, contextData } };
};

/** Valida e limpa o corpo da análise de desempenho. */
export const validateInsightsBody = (body) => {
    const dadosColaborador = body?.dadosColaborador;
    if (!dadosColaborador || typeof dadosColaborador !== 'object') {
        return { ok: false, status: 400, error: 'Nenhum dado fornecido para análise.' };
    }
    if (jsonSize(dadosColaborador) > AI_LIMITS.jsonChars) {
        return { ok: false, status: 413, error: 'Os dados para análise são grandes demais.' };
    }
    return {
        ok: true,
        value: {
            dadosColaborador,
            periodo: oneLine(body?.periodo, AI_LIMITS.shortText),
            tipoAnalise: oneLine(body?.tipoAnalise, AI_LIMITS.shortText)
        }
    };
};

/** Responde com o erro do guard (inclui cabeçalhos como Retry-After). */
export const sendGuardError = (res, guard) => {
    Object.entries(guard.headers || {}).forEach(([name, value]) => res.setHeader(name, value));
    return res.status(guard.status).json(guard.json);
};

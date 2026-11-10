/**
 * Envio de avisos por mensagem direta (DM) do Discord, por um bot.
 *
 * Roda no servidor (função serverless da Vercel), porque o token do bot é uma senha e não pode ir
 * para o navegador. Esta pasta começa com "_" para a Vercel NÃO expor estes arquivos como rotas.
 *
 * Segurança:
 *  - Quem chama precisa estar logado: o token de login do Firebase (ID token) é validado aqui,
 *    assinatura incluída, sem depender de credenciais de administrador.
 *  - Avisos de eventos (avaliação semanal, feedback, 1:1) só podem ser disparados pela gestão.
 *    O teste (event = "test") qualquer usuário logado pode enviar, mas só para si mesmo.
 *  - Os dados do destinatário (ID do Discord) são lidos do Firestore com o próprio token de quem
 *    chamou, então as regras do Firestore continuam valendo. O ID NUNCA vem do navegador.
 */

import { createPublicKey, verify as cryptoVerify } from 'node:crypto';

export const DEFAULT_PROJECT_ID = 'prodigyapp-73141';
export const DEFAULT_APP_URL = 'https://hubdesk-etecc.vercel.app';

const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const DISCORD_API = 'https://discord.com/api/v10';

// Espelha as regras do Firestore (isStaffAdmin)
const STAFF_ROLES = ['admin', 'gestor', 'supervisor', 'noc', 'diretor'];
const MASTER_EMAIL = 'pedrosouzactt@gmail.com';

export const DM_EVENTS = ['weekly_evaluation', 'feedback', 'monthly_evaluation', 'test'];
export const MAX_RECIPIENTS = 100;
const CONCURRENCY = 5;

// ID de usuário do Discord ("snowflake"): 17 a 20 dígitos
export const isValidDiscordId = (value) => /^\d{17,20}$/.test(String(value || '').trim());

// IDs de documento do Firestore aceitos (evita montar caminhos com caracteres inesperados)
const isSafeDocId = (value) => /^[A-Za-z0-9_-]{1,128}$/.test(String(value || ''));

const b64urlToBuffer = (value) => Buffer.from(String(value).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

// -------------------------------------------------------------------------------------------
// Token do bot: limpeza, formato e verificação
// -------------------------------------------------------------------------------------------

/**
 * Deixa o token como o Discord espera, mesmo que tenha sido colado com sobras:
 * espaços ou quebras de linha nas pontas, aspas ao redor ou o prefixo "Bot ".
 */
export const normalizeBotToken = (raw) => String(raw || '')
    .trim()
    .replace(/^["']+|["']+$/g, '')
    .trim()
    .replace(/^Bot\s+/i, '')
    .trim();

// Token de bot tem 3 partes separadas por ponto. Client Secret, Public Key e ID do aplicativo NÃO têm.
export const looksLikeBotToken = (token) => /^[\w-]+\.[\w-]+\.[\w-]+$/.test(String(token || ''));

let botStatusCache = { at: 0, tokenKey: '', value: null };

export const resetBotStatusCache = () => { botStatusCache = { at: 0, tokenKey: '', value: null }; };

/**
 * Diz se o bot está pronto, consultando o Discord (GET /users/@me) sem enviar mensagem.
 * Não devolve segredos. Respostas definitivas ficam em cache por 60 s.
 * Retorno: { configured, valid, reason?, botName? }
 *   reason: 'formato-invalido' | 'recusado' | 'indisponivel'
 */
export const getBotStatus = async ({ env = {}, fetchImpl = fetch, now = Date.now() } = {}) => {
    const token = normalizeBotToken(env.DISCORD_BOT_TOKEN);
    if (!token) return { configured: false };
    if (!looksLikeBotToken(token)) return { configured: true, valid: false, reason: 'formato-invalido' };

    const tokenKey = token.slice(-8);
    if (botStatusCache.value && botStatusCache.tokenKey === tokenKey && now - botStatusCache.at < 60 * 1000) {
        return botStatusCache.value;
    }

    let value;
    try {
        const res = await fetchImpl(`${DISCORD_API}/users/@me`, {
            headers: { Authorization: `Bot ${token}`, 'User-Agent': `DiscordBot (${DEFAULT_APP_URL}, 1.0)` }
        });
        if (res.status === 401) {
            value = { configured: true, valid: false, reason: 'recusado' };
        } else if (res.ok) {
            const data = await res.json().catch(() => ({}));
            value = { configured: true, valid: true, botName: data.username || '' };
        } else {
            return { configured: true, valid: null, reason: 'indisponivel' };
        }
    } catch {
        return { configured: true, valid: null, reason: 'indisponivel' };
    }

    botStatusCache = { at: now, tokenKey, value };
    return value;
};

// -------------------------------------------------------------------------------------------
// Login do Firebase: validação do ID token
// -------------------------------------------------------------------------------------------

let jwksCache = { keys: null, at: 0 };

const getJwks = async (fetchImpl, now) => {
    if (jwksCache.keys && now - jwksCache.at < 60 * 60 * 1000) return jwksCache.keys;
    const res = await fetchImpl(JWKS_URL);
    if (!res.ok) throw new Error('Não foi possível obter as chaves de verificação do login.');
    const data = await res.json();
    jwksCache = { keys: data.keys || [], at: now };
    return jwksCache.keys;
};

export const resetJwksCache = () => { jwksCache = { keys: null, at: 0 }; };

export const verifyFirebaseToken = async (idToken, { projectId, fetchImpl = fetch, now = Date.now() } = {}) => {
    const parts = String(idToken || '').split('.');
    if (parts.length !== 3) throw new Error('Token de login inválido.');

    let header;
    let payload;
    try {
        header = JSON.parse(b64urlToBuffer(parts[0]).toString('utf8'));
        payload = JSON.parse(b64urlToBuffer(parts[1]).toString('utf8'));
    } catch {
        throw new Error('Token de login ilegível.');
    }
    if (header.alg !== 'RS256' || !header.kid) throw new Error('Token de login com algoritmo não aceito.');

    const keys = await getJwks(fetchImpl, now);
    const jwk = keys.find(k => k.kid === header.kid);
    if (!jwk) throw new Error('Chave do token de login desconhecida.');

    const validSignature = cryptoVerify(
        'RSA-SHA256',
        Buffer.from(`${parts[0]}.${parts[1]}`),
        createPublicKey({ key: jwk, format: 'jwk' }),
        b64urlToBuffer(parts[2])
    );
    if (!validSignature) throw new Error('Assinatura do token de login inválida.');

    const nowSec = Math.floor(now / 1000);
    if (payload.aud !== projectId) throw new Error('Token de login de outro projeto.');
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Emissor do token de login inválido.');
    if (!payload.sub) throw new Error('Token de login sem usuário.');
    if (!payload.exp || payload.exp <= nowSec) throw new Error('Sessão expirada. Entre novamente.');
    if (payload.iat && payload.iat > nowSec + 300) throw new Error('Token de login com data inválida.');

    return { uid: payload.sub, email: (payload.email || '').toLowerCase() };
};

// -------------------------------------------------------------------------------------------
// Firestore (REST), sempre com o token de quem chamou
// -------------------------------------------------------------------------------------------

const readString = (doc, field) => doc?.fields?.[field]?.stringValue ?? '';
const readBoolean = (doc, field) => doc?.fields?.[field]?.booleanValue;

export const getFirestoreDoc = async (path, { idToken, projectId, fetchImpl = fetch }) => {
    const res = await fetchImpl(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`,
        { headers: { Authorization: `Bearer ${idToken}` } }
    );
    if (res.status === 404) return null;
    if (!res.ok) {
        const error = new Error(`Firestore respondeu ${res.status}`);
        error.status = res.status;
        throw error;
    }
    return res.json();
};

// A pessoa é da gestão? Mesma regra do Firestore (isStaffAdmin).
export const isStaffUser = async ({ uid, email }, ctx) => {
    if (email && email === MASTER_EMAIL) return true;
    const colab = await getFirestoreDoc(`collaborators/${uid}`, ctx).catch(() => null);
    if (colab && STAFF_ROLES.includes(readString(colab, 'role').trim().toLowerCase())) return true;
    const admin = await getFirestoreDoc(`admins/${uid}`, ctx).catch(() => null);
    return Boolean(admin);
};

// -------------------------------------------------------------------------------------------
// Mensagens
// -------------------------------------------------------------------------------------------

const safeDate = (value) => (/^[\d/-]{1,10}$/.test(String(value || '')) ? String(value) : '');

// "2026-11" -> "11/2026"
const formatMonth = (value) => {
    const v = safeDate(value);
    const match = v.match(/^(\d{4})-(\d{2})$/);
    return match ? `${match[2]}/${match[1]}` : v;
};

/**
 * Texto da DM. Como é uma mensagem privada, pode trazer dados da própria pessoa (ex.: pontuação),
 * mas nunca o conteúdo de feedbacks ou de avaliações 1:1.
 */
export const buildDmContent = (event, params = {}, link = '') => {
    const where = link ? `\nAbra o Hubdesk: ${link}` : '';
    switch (event) {
        case 'weekly_evaluation': {
            const date = safeDate(params.date);
            const score = Number(params.pontuacao);
            const scoreText = Number.isFinite(score) ? ` Pontuação: **${score} pts**.` : '';
            return `📊 **Nova avaliação semanal**\nSua avaliação${date ? ` da semana (${date})` : ' da semana'} foi lançada.${scoreText}${where}`;
        }
        case 'feedback':
            return `📢 **Novo feedback**\nVocê recebeu um novo feedback. Abra o Hubdesk para ler.${where}`;
        case 'monthly_evaluation': {
            const month = formatMonth(params.refMonth);
            return `🎯 **Novo 1:1 mensal disponível**\nSeu alinhamento${month ? ` de ${month}` : ' mensal'} foi registrado. Abra para ler e confirmar ciência.${where}`;
        }
        case 'test':
            return '✅ **Teste do Hubdesk**\nSe você recebeu esta mensagem, os avisos por mensagem direta estão funcionando para a sua conta.';
        default:
            return '';
    }
};

// -------------------------------------------------------------------------------------------
// Discord
// -------------------------------------------------------------------------------------------

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const discordRequest = async (path, body, { token, fetchImpl }) => {
    const send = () => fetchImpl(`${DISCORD_API}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json',
            'User-Agent': `DiscordBot (${DEFAULT_APP_URL}, 1.0)`
        },
        body: JSON.stringify(body)
    });

    let res = await send();
    if (res.status === 429) {
        // Limite de requisições do Discord: espera o tempo indicado (até 2 s) e tenta uma vez mais
        let wait = 1000;
        try { wait = Math.min(2000, Math.ceil(((await res.json()).retry_after || 1) * 1000)); } catch { /* usa o padrão */ }
        await sleep(wait);
        res = await send();
    }

    let data = {};
    try { data = await res.json(); } catch { /* corpo vazio */ }
    return { ok: res.ok, status: res.status, code: data.code, data };
};

/**
 * Envia uma DM. Resultado: 'enviado' | 'dm-bloqueada' | 'id-invalido' | 'token-invalido' | 'erro'
 */
export const sendDiscordDm = async (discordUserId, content, ctx) => {
    const channel = await discordRequest('/users/@me/channels', { recipient_id: discordUserId }, ctx);
    if (!channel.ok) {
        if (channel.status === 401) return 'token-invalido';
        if (channel.code === 10013 || channel.code === 50035) return 'id-invalido';
        return 'erro';
    }

    // allowed_mentions vazio: a mensagem nunca marca ninguém
    const message = await discordRequest(`/channels/${channel.data.id}/messages`, { content, allowed_mentions: { parse: [] } }, ctx);
    if (message.ok) return 'enviado';
    if (message.code === 50007) return 'dm-bloqueada'; // a pessoa não aceita DMs de membros do servidor
    if (message.status === 401) return 'token-invalido';
    return 'erro';
};

// -------------------------------------------------------------------------------------------
// Fluxo completo
// -------------------------------------------------------------------------------------------

const runWithConcurrency = async (items, limit, worker) => {
    const results = new Array(items.length);
    let next = 0;
    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await worker(items[index], index);
        }
    });
    await Promise.all(runners);
    return results;
};

const summarize = (results) => {
    const summary = { sent: 0, noLink: 0, inactive: 0, blocked: 0, failed: 0 };
    for (const r of results) {
        if (r.status === 'enviado') summary.sent++;
        else if (r.status === 'sem-vinculo') summary.noLink++;
        else if (r.status === 'inativo') summary.inactive++;
        else if (r.status === 'dm-bloqueada') summary.blocked++;
        else summary.failed++;
    }
    return summary;
};

/**
 * Processa um pedido de envio e devolve { status, json }, sem depender de req/res (testável).
 */
export const processDmRequest = async ({ body, idToken, env = {}, fetchImpl = fetch, origin = '', now = Date.now() }) => {
    const token = normalizeBotToken(env.DISCORD_BOT_TOKEN);
    if (!token) return { status: 503, json: { error: 'bot-nao-configurado' } };
    // Valor que nem tem cara de token (ex.: Client Secret): evita chamadas que o Discord vai recusar
    if (!looksLikeBotToken(token)) return { status: 502, json: { error: 'token-do-bot-invalido', reason: 'formato-invalido' } };

    const projectId = env.FIREBASE_PROJECT_ID || env.VITE_FIREBASE_PROJECT_ID || DEFAULT_PROJECT_ID;

    let caller;
    try {
        caller = await verifyFirebaseToken(idToken, { projectId, fetchImpl, now });
    } catch (error) {
        return { status: 401, json: { error: 'nao-autenticado', message: error.message } };
    }

    const event = body?.event;
    if (!DM_EVENTS.includes(event)) return { status: 400, json: { error: 'evento-invalido' } };

    const firestoreCtx = { idToken, projectId, fetchImpl };

    // Teste: só para si mesmo. Eventos reais: só a gestão.
    let recipients;
    if (event === 'test') {
        recipients = [{ id: caller.uid, params: {} }];
    } else {
        if (!(await isStaffUser(caller, firestoreCtx))) return { status: 403, json: { error: 'sem-permissao' } };
        const raw = Array.isArray(body?.recipients) ? body.recipients : [];
        if (raw.length === 0) return { status: 400, json: { error: 'sem-destinatarios' } };
        if (raw.length > MAX_RECIPIENTS) return { status: 400, json: { error: 'destinatarios-demais', max: MAX_RECIPIENTS } };
        recipients = raw
            .filter(r => isSafeDocId(r?.id))
            .map(r => ({ id: String(r.id), params: r.params && typeof r.params === 'object' ? r.params : {} }));
        if (recipients.length === 0) return { status: 400, json: { error: 'destinatarios-invalidos' } };
    }

    const appUrl = (env.APP_URL || origin || DEFAULT_APP_URL).replace(/\/+$/, '');
    const link = `${appUrl}/home?tab=my_history`;
    const discordCtx = { token, fetchImpl };

    let tokenRejected = false;
    const results = await runWithConcurrency(recipients, CONCURRENCY, async (recipient) => {
        if (tokenRejected) return { id: recipient.id, status: 'erro' };
        try {
            const colab = await getFirestoreDoc(`collaborators/${recipient.id}`, firestoreCtx);
            if (!colab) return { id: recipient.id, status: 'sem-vinculo' };
            if (readBoolean(colab, 'active') === false) return { id: recipient.id, status: 'inativo' };

            const discordUserId = readString(colab, 'discordUserId').trim();
            if (!isValidDiscordId(discordUserId)) return { id: recipient.id, status: 'sem-vinculo' };

            const status = await sendDiscordDm(discordUserId, buildDmContent(event, recipient.params, link), discordCtx);
            if (status === 'token-invalido') tokenRejected = true;
            return { id: recipient.id, status };
        } catch {
            return { id: recipient.id, status: 'erro' };
        }
    });

    if (tokenRejected) return { status: 502, json: { error: 'token-do-bot-invalido', reason: 'recusado' } };
    return { status: 200, json: { event, summary: summarize(results), results } };
};

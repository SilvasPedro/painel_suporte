import { describe, it, expect, beforeEach } from 'vitest';
import { generateKeyPairSync, createSign } from 'node:crypto';
import {
    DEFAULT_PROJECT_ID,
    isValidDiscordId,
    verifyFirebaseToken,
    resetJwksCache,
    buildDmContent,
    processDmRequest,
    MAX_RECIPIENTS
} from './dm.js';

const PROJECT = DEFAULT_PROJECT_ID;
const NOW = Date.UTC(2026, 10, 10, 12, 0, 0);
const nowSec = Math.floor(NOW / 1000);

// -------- ferramentas de teste: chaves, token do Firebase e servidores falsos --------
const makeKey = (kid) => {
    const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    return { kid, privateKey, jwk: { ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' } };
};

const b64url = (input) => Buffer.from(input).toString('base64url');

const signToken = (key, claims = {}, header = {}) => {
    const h = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: key.kid, ...header }));
    const p = b64url(JSON.stringify({
        aud: PROJECT, iss: `https://securetoken.google.com/${PROJECT}`,
        sub: 'uid-gestor', email: 'gestor@empresa.com',
        iat: nowSec - 60, exp: nowSec + 3600, ...claims
    }));
    const signature = createSign('RSA-SHA256').update(`${h}.${p}`).sign(key.privateKey).toString('base64url');
    return `${h}.${p}.${signature}`;
};

const fsDoc = (fields) => ({
    fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [
        k, typeof v === 'boolean' ? { booleanValue: v } : { stringValue: String(v) }
    ]))
});

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/**
 * Fetch falso que responde às chaves do Firebase, ao Firestore e ao Discord.
 * `docs` mapeia "colecao/id" para os campos; ausente = 404.
 */
const makeFetch = ({ key, docs = {}, discord = {} }) => {
    const calls = { discord: [], firestore: [] };
    const fetchImpl = async (url, options = {}) => {
        if (url.includes('securetoken@system.gserviceaccount.com')) return json(200, { keys: [key.jwk] });

        if (url.includes('firestore.googleapis.com')) {
            const path = url.split('/documents/')[1];
            calls.firestore.push({ path, auth: options.headers?.Authorization });
            return docs[path] ? json(200, fsDoc(docs[path])) : json(404, {});
        }

        if (url.includes('discord.com/api')) {
            const body = JSON.parse(options.body);
            calls.discord.push({ url, auth: options.headers.Authorization, body });
            if (url.endsWith('/users/@me/channels')) {
                const override = discord.channel?.(body.recipient_id);
                return override || json(200, { id: `chan-${body.recipient_id}` });
            }
            const override = discord.message?.(url, body);
            return override || json(200, { id: 'msg-1' });
        }
        throw new Error(`URL inesperada no teste: ${url}`);
    };
    return { fetchImpl, calls };
};

const DISCORD_ID_ANA = '123456789012345678';
const DISCORD_ID_BIA = '223456789012345678';

const staffDocs = {
    'collaborators/uid-gestor': { role: 'Gestor' },
    'collaborators/ana': { name: 'Ana', discordUserId: DISCORD_ID_ANA, active: true },
    'collaborators/bia': { name: 'Bia', discordUserId: DISCORD_ID_BIA },
    'collaborators/caio': { name: 'Caio' } // sem vínculo
};

let key;
beforeEach(() => {
    key = key || makeKey('k1');
    resetJwksCache();
});

describe('isValidDiscordId', () => {
    it('aceita apenas IDs numéricos de 17 a 20 dígitos', () => {
        expect(isValidDiscordId('123456789012345678')).toBe(true);
        expect(isValidDiscordId(' 123456789012345678 ')).toBe(true);
        expect(isValidDiscordId('1234')).toBe(false);
        expect(isValidDiscordId('abc456789012345678')).toBe(false);
        expect(isValidDiscordId('')).toBe(false);
        expect(isValidDiscordId(undefined)).toBe(false);
    });
});

describe('verifyFirebaseToken', () => {
    it('aceita um token válido e devolve usuário e e-mail', async () => {
        const { fetchImpl } = makeFetch({ key });
        const user = await verifyFirebaseToken(signToken(key), { projectId: PROJECT, fetchImpl, now: NOW });
        expect(user).toEqual({ uid: 'uid-gestor', email: 'gestor@empresa.com' });
    });

    it('recusa token expirado, de outro projeto e de outro emissor', async () => {
        const { fetchImpl } = makeFetch({ key });
        const opts = { projectId: PROJECT, fetchImpl, now: NOW };
        await expect(verifyFirebaseToken(signToken(key, { exp: nowSec - 10 }), opts)).rejects.toThrow(/expirada/i);
        await expect(verifyFirebaseToken(signToken(key, { aud: 'outro-projeto' }), opts)).rejects.toThrow(/outro projeto/i);
        await expect(verifyFirebaseToken(signToken(key, { iss: 'https://evil.example' }), opts)).rejects.toThrow(/emissor/i);
    });

    it('recusa assinatura feita com outra chave', async () => {
        const { fetchImpl } = makeFetch({ key });
        const impostor = makeKey('k1'); // mesmo kid, chave diferente
        await expect(verifyFirebaseToken(signToken(impostor), { projectId: PROJECT, fetchImpl, now: NOW }))
            .rejects.toThrow(/assinatura/i);
    });

    it('recusa kid desconhecido, algoritmo diferente e lixo', async () => {
        const { fetchImpl } = makeFetch({ key });
        const opts = { projectId: PROJECT, fetchImpl, now: NOW };
        await expect(verifyFirebaseToken(signToken(makeKey('outro')), opts)).rejects.toThrow(/desconhecida/i);
        await expect(verifyFirebaseToken(signToken(key, {}, { alg: 'none' }), opts)).rejects.toThrow(/algoritmo/i);
        await expect(verifyFirebaseToken('isso-nao-e-um-token', opts)).rejects.toThrow();
        await expect(verifyFirebaseToken('', opts)).rejects.toThrow();
    });
});

describe('buildDmContent', () => {
    it('avaliação semanal traz a pontuação da própria pessoa e o link', () => {
        const text = buildDmContent('weekly_evaluation', { pontuacao: 142, date: '09/11/2026' }, 'https://hub.example/home?tab=my_history');
        expect(text).toContain('142 pts');
        expect(text).toContain('09/11/2026');
        expect(text).toContain('https://hub.example/home?tab=my_history');
    });

    it('feedback e 1:1 nunca trazem o conteúdo', () => {
        const feedback = buildDmContent('feedback', { comment: 'segredo' }, 'https://hub.example');
        expect(feedback).not.toContain('segredo');
        const monthly = buildDmContent('monthly_evaluation', { refMonth: '2026-10', contentMarkdown: 'segredo' }, 'https://hub.example');
        expect(monthly).toContain('10/2026');
        expect(monthly).not.toContain('segredo');
    });

    it('ignora parâmetros fora do formato esperado', () => {
        const text = buildDmContent('weekly_evaluation', { pontuacao: 'abc', date: '<script>@everyone' }, '');
        expect(text).not.toContain('script');
        expect(text).not.toContain('@everyone');
        expect(text).not.toContain('NaN');
    });

    it('evento desconhecido gera texto vazio', () => {
        expect(buildDmContent('qualquer', {}, '')).toBe('');
    });
});

describe('processDmRequest', () => {
    const env = { DISCORD_BOT_TOKEN: 'bot-token-secreto', APP_URL: 'https://hub.example/' };
    const run = async (overrides = {}, mock = {}) => {
        const { fetchImpl, calls } = makeFetch({ key, docs: staffDocs, ...mock });
        const result = await processDmRequest({
            body: { event: 'weekly_evaluation', recipients: [{ id: 'ana', params: { pontuacao: 90, date: '09/11/2026' } }] },
            idToken: signToken(key),
            env,
            fetchImpl,
            now: NOW,
            ...overrides
        });
        return { ...result, calls };
    };

    it('sem token do bot responde 503 e não chama ninguém', async () => {
        const { status, json: body, calls } = await run({ env: {} });
        expect(status).toBe(503);
        expect(body.error).toBe('bot-nao-configurado');
        expect(calls.discord).toHaveLength(0);
    });

    it('sem login válido responde 401', async () => {
        const { status, calls } = await run({ idToken: 'lixo' });
        expect(status).toBe(401);
        expect(calls.discord).toHaveLength(0);
    });

    it('evento desconhecido responde 400', async () => {
        const { status } = await run({ body: { event: 'x', recipients: [{ id: 'ana' }] } });
        expect(status).toBe(400);
    });

    it('quem não é da gestão recebe 403 e nada é enviado', async () => {
        const docs = { ...staffDocs, 'collaborators/uid-gestor': { role: 'Colaborador' } };
        const { status, calls } = await run({}, { docs });
        expect(status).toBe(403);
        expect(calls.discord).toHaveLength(0);
    });

    it('gestão envia a DM ao colaborador vinculado, com o bot e o link do site', async () => {
        const { status, json: body, calls } = await run();
        expect(status).toBe(200);
        expect(body.summary).toMatchObject({ sent: 1, noLink: 0, failed: 0 });

        const [open, message] = calls.discord;
        expect(open.body).toEqual({ recipient_id: DISCORD_ID_ANA });
        expect(open.auth).toBe('Bot bot-token-secreto');
        expect(message.url).toContain('/channels/chan-123456789012345678/messages');
        expect(message.body.content).toContain('90 pts');
        expect(message.body.content).toContain('https://hub.example/home?tab=my_history');
        expect(message.body.allowed_mentions).toEqual({ parse: [] });
    });

    it('lê o Firestore com o token de quem chamou, não com credenciais próprias', async () => {
        const token = signToken(key);
        const { calls } = await run({ idToken: token });
        expect(calls.firestore.length).toBeGreaterThan(0);
        calls.firestore.forEach(c => expect(c.auth).toBe(`Bearer ${token}`));
    });

    it('colaborador sem vínculo, inexistente ou inativo não recebe e é contado à parte', async () => {
        const docs = { ...staffDocs, 'collaborators/dede': { name: 'Dedé', discordUserId: DISCORD_ID_BIA, active: false } };
        const { json: body, calls } = await run({
            body: { event: 'feedback', recipients: [{ id: 'ana' }, { id: 'caio' }, { id: 'fantasma' }, { id: 'dede' }] }
        }, { docs });
        expect(body.summary).toMatchObject({ sent: 1, noLink: 2, inactive: 1, failed: 0 });
        expect(calls.discord.filter(c => c.url.endsWith('/messages'))).toHaveLength(1);
    });

    it('DM bloqueada pelo colaborador (50007) é informada sem derrubar o restante', async () => {
        const discord = {
            message: (url) => (url.includes('chan-223456789012345678')
                ? json(403, { code: 50007, message: 'Cannot send messages to this user' })
                : null)
        };
        const { status, json: body } = await run({
            body: { event: 'feedback', recipients: [{ id: 'ana' }, { id: 'bia' }] }
        }, { discord });
        expect(status).toBe(200);
        expect(body.summary).toMatchObject({ sent: 1, blocked: 1 });
        expect(body.results.find(r => r.id === 'bia').status).toBe('dm-bloqueada');
    });

    it('token do bot recusado pelo Discord (401) responde 502', async () => {
        const discord = { channel: () => json(401, { message: '401: Unauthorized' }) };
        const { status, json: body } = await run({}, { discord });
        expect(status).toBe(502);
        expect(body.error).toBe('token-do-bot-invalido');
    });

    it('ID do Discord inválido no cadastro não chega ao Discord', async () => {
        const docs = { ...staffDocs, 'collaborators/ana': { name: 'Ana', discordUserId: 'nao-e-id' } };
        const { json: body, calls } = await run({}, { docs });
        expect(body.summary.noLink).toBe(1);
        expect(calls.discord).toHaveLength(0);
    });

    it('exige destinatários, respeita o limite e descarta IDs com caracteres perigosos', async () => {
        expect((await run({ body: { event: 'feedback', recipients: [] } })).status).toBe(400);

        const many = Array.from({ length: MAX_RECIPIENTS + 1 }, (_, i) => ({ id: `u${i}` }));
        expect((await run({ body: { event: 'feedback', recipients: many } })).status).toBe(400);

        const unsafe = await run({ body: { event: 'feedback', recipients: [{ id: '../admins/x' }, { id: 'a/b' }] } });
        expect(unsafe.status).toBe(400);
        expect(unsafe.json.error).toBe('destinatarios-invalidos');
    });

    it('teste: qualquer usuário logado envia só para si mesmo, mesmo sem ser da gestão', async () => {
        const docs = { 'collaborators/uid-gestor': { role: 'Colaborador', name: 'Eu', discordUserId: DISCORD_ID_ANA } };
        const { status, json: body, calls } = await run({
            body: { event: 'test', recipients: [{ id: 'ana' }, { id: 'bia' }] } // ignorados no teste
        }, { docs });
        expect(status).toBe(200);
        expect(body.summary.sent).toBe(1);
        expect(calls.discord[0].body).toEqual({ recipient_id: DISCORD_ID_ANA });
        expect(calls.discord[1].body.content).toContain('Teste do Hubdesk');
    });

    it('o administrador master é tratado como gestão', async () => {
        const { status } = await run({ idToken: signToken(key, { email: 'pedrosouzactt@gmail.com' }) }, {
            docs: { ...staffDocs, 'collaborators/uid-gestor': { role: 'Colaborador' } }
        });
        expect(status).toBe(200);
    });
});

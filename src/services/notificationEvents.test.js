import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./firebase', () => ({ db: {} }));
vi.mock('./dataCache', () => ({
    getCachedCollection: vi.fn(() => []),
    buildCollectionKey: (name, options = {}) => (
        options.where && options.where.length > 0 ? `${name}?${JSON.stringify(options.where)}` : name
    )
}));

const getDocMock = vi.fn();
vi.mock('firebase/firestore', () => ({
    collection: vi.fn(() => ({})),
    doc: vi.fn(() => ({})),
    getDoc: (...args) => getDocMock(...args),
    setDoc: vi.fn(),
    writeBatch: vi.fn(() => ({ update: vi.fn(), commit: vi.fn() }))
}));

import {
    NOTIFICATION_EVENTS,
    HISTORY_EVENT_IDS,
    DEFAULT_WEBHOOK_CONFIG,
    buildNotification,
    inboxOptions,
    buildWebhookRequest,
    postToWebhook,
    dispatchTeamWebhook,
    invalidateWebhookConfigCache
} from './notificationEvents';

describe('buildNotification', () => {
    it('monta o aviso pessoal não lido, endereçado ao destinatário e com a aba do histórico', () => {
        const n = buildNotification({
            event: 'weekly_evaluation',
            toUserId: 'abc',
            toUserName: 'Ana',
            refId: 'r1',
            title: 'T',
            body: 'B',
            authorName: 'Gestor'
        });
        expect(n).toMatchObject({
            toUserId: 'abc', toUserName: 'Ana', event: 'weekly_evaluation', refId: 'r1',
            title: 'T', body: 'B', subtab: 'metrics', authorName: 'Gestor', read: false
        });
        expect(Number.isNaN(Date.parse(n.createdAt))).toBe(false);
    });

    it('cada evento aponta para a aba correta do histórico', () => {
        expect(NOTIFICATION_EVENTS.feedback.subtab).toBe('feedbacks');
        expect(NOTIFICATION_EVENTS.monthly_evaluation.subtab).toBe('monthly');
        expect(NOTIFICATION_EVENTS.weekly_evaluation.subtab).toBe('metrics');
        expect(HISTORY_EVENT_IDS).toEqual(expect.arrayContaining(['feedback', 'monthly_evaluation', 'weekly_evaluation']));
    });

    it('recusa evento desconhecido e destinatário ausente', () => {
        expect(() => buildNotification({ event: 'x', toUserId: 'a' })).toThrow();
        expect(() => buildNotification({ event: 'feedback' })).toThrow();
    });

    it('a consulta da caixa de avisos filtra pelo usuário e só traz não lidos', () => {
        expect(inboxOptions('u1').where).toEqual([['toUserId', '==', 'u1'], ['read', '==', false]]);
    });
});

describe('buildWebhookRequest', () => {
    const msg = { event: 'feedback', title: 'Título', text: 'Texto', link: 'https://hub.example' };

    it('Discord envia um embed em JSON', () => {
        const r = buildWebhookRequest('discord', msg);
        expect(r.contentType).toBe('application/json');
        const body = JSON.parse(r.body);
        expect(body.embeds[0]).toMatchObject({ title: 'Título', description: 'Texto' });
    });

    it('Slack usa o formato payload= (requisição simples, sem pré-validação CORS)', () => {
        const r = buildWebhookRequest('slack', msg);
        expect(r.simpleOnly).toBe(true);
        expect(r.contentType).toBe('application/x-www-form-urlencoded');
        const payload = JSON.parse(decodeURIComponent(r.body.replace(/^payload=/, '')));
        expect(payload.text).toContain('Título');
        expect(payload.text).toContain('Texto');
    });

    it('Teams envia um cartão adaptável e Google Chat envia texto', () => {
        const teams = JSON.parse(buildWebhookRequest('teams', msg).body);
        expect(teams.attachments[0].contentType).toBe('application/vnd.microsoft.card.adaptive');
        const chat = JSON.parse(buildWebhookRequest('googlechat', msg).body);
        expect(chat.text).toContain('Título');
    });

    it('URL genérica recebe JSON identificado pela origem e pelo evento', () => {
        const body = JSON.parse(buildWebhookRequest('generic', msg).body);
        expect(body).toMatchObject({ source: 'hubdesk', event: 'feedback', title: 'Título', text: 'Texto' });
    });
});

describe('postToWebhook', () => {
    const config = { provider: 'discord', url: 'https://discord.example/api/webhooks/1' };
    const message = { event: 'feedback', title: 'T', text: 'x' };

    beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('recusa URL vazia ou sem https', async () => {
        expect(await postToWebhook({ ...config, url: '' }, message)).toBe('error');
        expect(await postToWebhook({ ...config, url: 'http://inseguro.example' }, message)).toBe('error');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('confirma a entrega quando o serviço responde com sucesso', async () => {
        fetch.mockResolvedValueOnce({ ok: true });
        expect(await postToWebhook(config, message)).toBe('ok');
    });

    it('sem CORS, reenvia como requisição simples e informa que não foi confirmado', async () => {
        fetch.mockRejectedValueOnce(new TypeError('CORS')).mockResolvedValueOnce({ type: 'opaque' });
        expect(await postToWebhook(config, message)).toBe('sent_unverified');
        expect(fetch.mock.calls[1][1].mode).toBe('no-cors');
    });

    it('Slack vai direto como requisição simples', async () => {
        fetch.mockResolvedValueOnce({ type: 'opaque' });
        const result = await postToWebhook({ provider: 'slack', url: 'https://hooks.slack.example/x' }, message);
        expect(result).toBe('sent_unverified');
        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch.mock.calls[0][1].mode).toBe('no-cors');
    });

    it('falha de rede nos dois modos resulta em erro', async () => {
        fetch.mockRejectedValue(new TypeError('offline'));
        expect(await postToWebhook(config, message)).toBe('error');
    });
});

describe('dispatchTeamWebhook', () => {
    beforeEach(() => {
        invalidateWebhookConfigCache();
        getDocMock.mockReset();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    const asDoc = (data) => ({ exists: () => true, data: () => data });

    it('não envia quando o webhook está desativado', async () => {
        getDocMock.mockResolvedValue(asDoc({ ...DEFAULT_WEBHOOK_CONFIG, enabled: false, url: 'https://x.example' }));
        expect(await dispatchTeamWebhook({ event: 'feedback', title: 't', text: 'x' })).toBe('skipped');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('não envia eventos desmarcados nas configurações', async () => {
        getDocMock.mockResolvedValue(asDoc({
            enabled: true, provider: 'discord', url: 'https://x.example',
            events: { feedback: false, weekly_evaluation: true, monthly_evaluation: true }
        }));
        expect(await dispatchTeamWebhook({ event: 'feedback', title: 't', text: 'x' })).toBe('skipped');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('envia quando ativo e o evento está habilitado', async () => {
        getDocMock.mockResolvedValue(asDoc({ enabled: true, provider: 'discord', url: 'https://x.example' }));
        expect(await dispatchTeamWebhook({ event: 'weekly_evaluation', title: 't', text: 'x' })).toBe('ok');
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('sem permissão de leitura da configuração (usuário comum) não envia nem lança erro', async () => {
        getDocMock.mockRejectedValue(new Error('permission-denied'));
        expect(await dispatchTeamWebhook({ event: 'feedback', title: 't', text: 'x' })).toBe('skipped');
    });

    it('lê a configuração uma vez e reaproveita por alguns minutos', async () => {
        getDocMock.mockResolvedValue(asDoc({ enabled: true, provider: 'discord', url: 'https://x.example' }));
        await dispatchTeamWebhook({ event: 'feedback', title: 't', text: 'x' });
        await dispatchTeamWebhook({ event: 'feedback', title: 't', text: 'y' });
        expect(getDocMock).toHaveBeenCalledTimes(1);
    });
});

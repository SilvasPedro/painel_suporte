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
    invalidateWebhookConfigCache,
    renderWebhookText,
    describeWebhookResult,
    DEFAULT_WEBHOOK_MESSAGES
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

    it('Discord envia texto simples (permite mencionar @everyone) e não um embed', () => {
        const r = buildWebhookRequest('discord', msg);
        expect(r.contentType).toBe('application/json');
        const body = JSON.parse(r.body);
        expect(body.content).toBe('Texto');
        expect(body.embeds).toBeUndefined();
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

describe('renderWebhookText', () => {
    it('troca {link} pelo endereço, em qualquer posição', () => {
        expect(renderWebhookText('Acessem {link} para ver!', 'https://hub.example/home?tab=my_history'))
            .toBe('Acessem https://hub.example/home?tab=my_history para ver!');
    });

    it('sem {link} no modelo, acrescenta o endereço em nova linha', () => {
        expect(renderWebhookText('Há novidades.', 'https://hub.example')).toBe('Há novidades.\nhttps://hub.example');
    });

    it('sem endereço, remove o {link} sem deixar espaços duplos', () => {
        expect(renderWebhookText('Acessem {link} para ver!', '')).toBe('Acessem para ver!');
    });
});

describe('mensagens genéricas dos avisos', () => {
    it('os textos padrão não citam nomes, notas nem conteúdo e trazem o {link}', () => {
        for (const message of Object.values(DEFAULT_WEBHOOK_MESSAGES)) {
            expect(message.text).toContain('{link}');
            // nenhuma nota, quantidade ou data (o "1:1" do nome da avaliação é a única exceção)
            expect(message.text.replace('1:1', '')).not.toMatch(/\d/);
        }
        expect(DEFAULT_WEBHOOK_MESSAGES.weekly_evaluation.text).toMatch(/avaliações semanais/i);
    });
});

describe('dispatchTeamWebhook: aviso genérico', () => {
    const asDoc = (data) => ({ exists: () => true, data: () => data });
    const sentBody = () => JSON.parse(fetch.mock.calls[0][1].body);
    let storage;

    beforeEach(() => {
        invalidateWebhookConfigCache();
        getDocMock.mockReset();
        storage = {};
        vi.stubGlobal('localStorage', {
            getItem: (k) => (k in storage ? storage[k] : null),
            setItem: (k, v) => { storage[k] = String(v); }
        });
        vi.stubGlobal('window', { location: { origin: 'https://hubdesk-etecc.vercel.app' } });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('semanal: envia a mensagem padrão com o link de Meu Histórico, sem dados específicos', async () => {
        getDocMock.mockResolvedValue(asDoc({ enabled: true, provider: 'discord', url: 'https://discord.example/w' }));
        await dispatchTeamWebhook({ event: 'weekly_evaluation' });
        const { content } = sentBody();
        expect(content).toContain('Foram lançadas as avaliações semanais de desempenho');
        expect(content).toContain('https://hubdesk-etecc.vercel.app/home?tab=my_history');
        expect(content).not.toContain('{link}');
    });

    it('usa o texto e o link personalizados da configuração', async () => {
        getDocMock.mockResolvedValue(asDoc({
            enabled: true, provider: 'discord', url: 'https://discord.example/w',
            link: 'https://outro.example/historico',
            messages: { weekly_evaluation: '@everyone saiu a avaliação! {link}' }
        }));
        await dispatchTeamWebhook({ event: 'weekly_evaluation' });
        expect(sentBody().content).toBe('@everyone saiu a avaliação! https://outro.example/historico');
    });

    it('não repete o mesmo aviso em menos de 10 minutos, mas reenvia depois', async () => {
        getDocMock.mockResolvedValue(asDoc({ enabled: true, provider: 'discord', url: 'https://discord.example/w' }));
        expect(await dispatchTeamWebhook({ event: 'weekly_evaluation' })).toBe('ok');
        expect(await dispatchTeamWebhook({ event: 'weekly_evaluation' })).toBe('skipped');
        expect(fetch).toHaveBeenCalledTimes(1);

        storage['hubdesk_webhook_last_weekly_evaluation'] = String(Date.now() - 11 * 60 * 1000);
        expect(await dispatchTeamWebhook({ event: 'weekly_evaluation' })).toBe('ok');
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('o antirrepetição vale por tipo de evento', async () => {
        getDocMock.mockResolvedValue(asDoc({ enabled: true, provider: 'discord', url: 'https://discord.example/w' }));
        await dispatchTeamWebhook({ event: 'weekly_evaluation' });
        expect(await dispatchTeamWebhook({ event: 'feedback' })).toBe('ok');
    });

    it('envio que falha não ativa o antirrepetição', async () => {
        getDocMock.mockResolvedValue(asDoc({ enabled: true, provider: 'discord', url: 'https://discord.example/w' }));
        fetch.mockRejectedValue(new TypeError('offline'));
        expect(await dispatchTeamWebhook({ event: 'weekly_evaluation' })).toBe('error');
        expect(storage['hubdesk_webhook_last_weekly_evaluation']).toBeUndefined();
    });
});

describe('dispatchTeamWebhook: diagnóstico do envio', () => {
    const asDoc = (data) => ({ exists: () => true, data: () => data });
    let storage;
    let emitted;

    beforeEach(() => {
        invalidateWebhookConfigCache();
        getDocMock.mockReset();
        storage = {};
        emitted = [];
        vi.stubGlobal('localStorage', {
            getItem: (k) => (k in storage ? storage[k] : null),
            setItem: (k, v) => { storage[k] = String(v); }
        });
        vi.stubGlobal('CustomEvent', class { constructor(type, init) { this.type = type; this.detail = init?.detail; } });
        vi.stubGlobal('window', {
            location: { origin: 'https://hubdesk.example' },
            dispatchEvent: (e) => { emitted.push(e.detail); return true; }
        });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    });
    afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

    it('webhook com URL salva, mas desativado: informa o motivo "disabled"', async () => {
        getDocMock.mockResolvedValue(asDoc({ enabled: false, provider: 'discord', url: 'https://discord.example/w' }));
        expect(await dispatchTeamWebhook({ event: 'weekly_evaluation' })).toBe('skipped');
        expect(emitted[0]).toMatchObject({ event: 'weekly_evaluation', status: 'skipped', reason: 'disabled' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('configuração ilegível (regras não publicadas): informa o motivo "unreadable"', async () => {
        getDocMock.mockRejectedValue(new Error('permission-denied'));
        await dispatchTeamWebhook({ event: 'feedback' });
        expect(emitted[0]).toMatchObject({ status: 'skipped', reason: 'unreadable' });
    });

    it('webhook nunca configurado: motivo "not-configured" e nenhuma mensagem ao usuário', async () => {
        getDocMock.mockResolvedValue({ exists: () => false });
        await dispatchTeamWebhook({ event: 'feedback' });
        expect(emitted[0]).toMatchObject({ status: 'skipped', reason: 'not-configured' });
        expect(describeWebhookResult(emitted[0].status, emitted[0].reason)).toBeNull();
    });

    it('envio bem-sucedido emite o resultado "ok"', async () => {
        getDocMock.mockResolvedValue(asDoc({ enabled: true, provider: 'discord', url: 'https://discord.example/w' }));
        await dispatchTeamWebhook({ event: 'weekly_evaluation' });
        expect(emitted[0]).toMatchObject({ status: 'ok' });
    });

    it('intervalo configurado em 0 minutos envia sempre', async () => {
        getDocMock.mockResolvedValue(asDoc({ enabled: true, provider: 'discord', url: 'https://discord.example/w', cooldownMinutes: 0 }));
        expect(await dispatchTeamWebhook({ event: 'weekly_evaluation' })).toBe('ok');
        expect(await dispatchTeamWebhook({ event: 'weekly_evaluation' })).toBe('ok');
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('intervalo configurado vale para todos os eventos e informa "cooldown" ao repetir', async () => {
        getDocMock.mockResolvedValue(asDoc({ enabled: true, provider: 'discord', url: 'https://discord.example/w', cooldownMinutes: 60 }));
        await dispatchTeamWebhook({ event: 'feedback' });
        expect(await dispatchTeamWebhook({ event: 'feedback' })).toBe('skipped');
        expect(emitted[1]).toMatchObject({ status: 'skipped', reason: 'cooldown' });
    });

    it('configuração desativada é relida em segundos: ativar em outra aba passa a valer logo', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-11-10T12:00:00Z'));
        getDocMock.mockResolvedValueOnce(asDoc({ enabled: false, provider: 'discord', url: 'https://discord.example/w' }));
        expect(await dispatchTeamWebhook({ event: 'weekly_evaluation' })).toBe('skipped');

        getDocMock.mockResolvedValue(asDoc({ enabled: true, provider: 'discord', url: 'https://discord.example/w' }));
        vi.setSystemTime(new Date('2026-11-10T12:00:20Z'));
        expect(await dispatchTeamWebhook({ event: 'weekly_evaluation' })).toBe('ok');
    });
});

describe('describeWebhookResult', () => {
    it('explica cada situação ao usuário que lançou o item', () => {
        expect(describeWebhookResult('ok')).toMatchObject({ type: 'success' });
        expect(describeWebhookResult('sent_unverified')).toMatchObject({ type: 'info' });
        expect(describeWebhookResult('error')).toMatchObject({ type: 'warning' });
        expect(describeWebhookResult('skipped', 'disabled').text).toMatch(/desativado/i);
        expect(describeWebhookResult('skipped', 'unreadable').text).toMatch(/regras do Firestore/i);
        expect(describeWebhookResult('skipped', 'cooldown').text).toMatch(/não repetido/i);
        expect(describeWebhookResult('skipped', 'event-off').text).toMatch(/desmarcado/i);
        expect(describeWebhookResult('skipped', 'not-configured')).toBeNull();
    });
});

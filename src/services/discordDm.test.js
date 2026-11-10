import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { getIdToken, authMock, getWebhookConfigMock } = vi.hoisted(() => {
    const getIdToken = vi.fn(async () => 'token-do-usuario');
    return {
        getIdToken,
        authMock: { currentUser: { getIdToken: (...args) => getIdToken(...args) } },
        getWebhookConfigMock: vi.fn()
    };
});
vi.mock('./firebase', () => ({ auth: authMock }));
vi.mock('./notificationEvents', () => ({ getWebhookConfig: (...args) => getWebhookConfigMock(...args) }));

import { describeDmResult, describeBotStatus, sendDiscordDms, fetchBotStatus, isValidDiscordId, DM_ENDPOINT } from './discordDm';

const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('isValidDiscordId (app)', () => {
    it('aceita 17 a 20 dígitos', () => {
        expect(isValidDiscordId('123456789012345678')).toBe(true);
        expect(isValidDiscordId('12345')).toBe(false);
        expect(isValidDiscordId('abc')).toBe(false);
    });
});

describe('sendDiscordDms', () => {
    let emitted;

    beforeEach(() => {
        emitted = [];
        getIdToken.mockClear();
        getWebhookConfigMock.mockReset();
        authMock.currentUser = { getIdToken: (...args) => getIdToken(...args) };
        vi.stubGlobal('CustomEvent', class { constructor(type, init) { this.type = type; this.detail = init?.detail; } });
        vi.stubGlobal('window', { dispatchEvent: (e) => { emitted.push(e); return true; } });
        vi.stubGlobal('fetch', vi.fn());
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    const recipients = [{ id: 'ana', params: { pontuacao: 90 } }];
    const enabledConfig = { dm: { enabled: true, events: { weekly_evaluation: true, feedback: false } } };

    it('não faz nada sem destinatários', async () => {
        const result = await sendDiscordDms({ event: 'weekly_evaluation', recipients: [] });
        expect(result.status).toBe('skipped');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('não envia quando a gestão não ativou a DM', async () => {
        getWebhookConfigMock.mockResolvedValue({ dm: { enabled: false } });
        const result = await sendDiscordDms({ event: 'weekly_evaluation', recipients });
        expect(result).toMatchObject({ status: 'skipped', reason: 'dm-desativado' });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('não envia quando a configuração não pôde ser lida', async () => {
        getWebhookConfigMock.mockResolvedValue(null);
        expect((await sendDiscordDms({ event: 'weekly_evaluation', recipients })).status).toBe('skipped');
    });

    it('não envia eventos desmarcados', async () => {
        getWebhookConfigMock.mockResolvedValue(enabledConfig);
        const result = await sendDiscordDms({ event: 'feedback', recipients });
        expect(result).toMatchObject({ status: 'skipped', reason: 'evento-desmarcado' });
    });

    it('envia à função com o login do usuário e os destinatários, e informa o resultado', async () => {
        getWebhookConfigMock.mockResolvedValue(enabledConfig);
        fetch.mockResolvedValue(response(200, { summary: { sent: 1, noLink: 0, inactive: 0, blocked: 0, failed: 0 } }));

        const result = await sendDiscordDms({ event: 'weekly_evaluation', recipients });

        expect(result.status).toBe('done');
        const [url, options] = fetch.mock.calls[0];
        expect(url).toBe(DM_ENDPOINT);
        expect(options.headers.Authorization).toBe('Bearer token-do-usuario');
        expect(JSON.parse(options.body)).toEqual({ event: 'weekly_evaluation', recipients });
        expect(emitted[0].type).toBe('HUBDESK_DM_RESULT');
        expect(emitted[0].detail.summary.sent).toBe(1);
    });

    it('o teste ignora a configuração da gestão e não precisa de destinatários', async () => {
        fetch.mockResolvedValue(response(200, { summary: { sent: 1 } }));
        const result = await sendDiscordDms({ event: 'test' });
        expect(result.status).toBe('done');
        expect(getWebhookConfigMock).not.toHaveBeenCalled();
    });

    it('sem usuário logado não chama a função', async () => {
        authMock.currentUser = null;
        getWebhookConfigMock.mockResolvedValue(enabledConfig);
        expect((await sendDiscordDms({ event: 'weekly_evaluation', recipients })).reason).toBe('sem-login');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('falha de rede não lança erro', async () => {
        getWebhookConfigMock.mockResolvedValue(enabledConfig);
        fetch.mockRejectedValue(new TypeError('offline'));
        const result = await sendDiscordDms({ event: 'weekly_evaluation', recipients });
        expect(result.status).toBe('error');
        expect(emitted[0].detail.httpStatus).toBe(0);
    });
});

describe('fetchBotStatus', () => {
    beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('devolve o estado do bot informado pelo servidor', async () => {
        fetch.mockResolvedValueOnce(response(200, { configured: true, valid: true, botName: 'Hubdesk' }));
        expect(await fetchBotStatus()).toEqual({ configured: true, valid: true, reason: '', botName: 'Hubdesk' });
        fetch.mockResolvedValueOnce(response(200, { configured: true, valid: false, reason: 'recusado' }));
        expect(await fetchBotStatus()).toMatchObject({ configured: true, valid: false, reason: 'recusado' });
        fetch.mockResolvedValueOnce(response(200, { configured: false }));
        expect(await fetchBotStatus()).toMatchObject({ configured: false, valid: null });
    });

    it('retorna null quando a função não existe (ambiente local) ou a rede falha', async () => {
        fetch.mockResolvedValueOnce(response(404, {}));
        expect(await fetchBotStatus()).toBeNull();
        fetch.mockRejectedValueOnce(new TypeError('offline'));
        expect(await fetchBotStatus()).toBeNull();
    });
});

describe('describeDmResult', () => {
    it('função indisponível (404): silêncio nos eventos, aviso no teste', () => {
        expect(describeDmResult({ event: 'weekly_evaluation', httpStatus: 404 })).toBeNull();
        expect(describeDmResult({ event: 'test', httpStatus: 404 }).text).toMatch(/site publicado/i);
    });

    it('explica cada erro do servidor', () => {
        expect(describeDmResult({ httpStatus: 503 }).text).toMatch(/DISCORD_BOT_TOKEN/);
        expect(describeDmResult({ httpStatus: 401 }).text).toMatch(/entre novamente/i);
        expect(describeDmResult({ httpStatus: 403 }).text).toMatch(/permissão/i);
        expect(describeDmResult({ httpStatus: 502 }).text).toMatch(/token do bot/i);
    });

    it('resume os avisos em lote', () => {
        const ok = describeDmResult({ event: 'weekly_evaluation', httpStatus: 200, summary: { sent: 5, noLink: 25 } });
        expect(ok.type).toBe('success');
        expect(ok.text).toContain('5 DM(s) enviada(s)');
        expect(ok.text).toContain('25 sem Discord vinculado');

        expect(describeDmResult({ event: 'feedback', httpStatus: 200, summary: { sent: 0, noLink: 3 } }).type).toBe('info');
        expect(describeDmResult({ event: 'feedback', httpStatus: 200, summary: { sent: 1, blocked: 1 } }).type).toBe('warning');
    });

    it('teste: orienta conforme o motivo', () => {
        expect(describeDmResult({ event: 'test', httpStatus: 200, summary: { sent: 1 } }).type).toBe('success');
        expect(describeDmResult({ event: 'test', httpStatus: 200, summary: { noLink: 1 } }).text).toMatch(/salve o seu ID/i);
        expect(describeDmResult({ event: 'test', httpStatus: 200, summary: { blocked: 1 } }).text).toMatch(/mensagens diretas/i);
    });

    it('quando ninguém foi afetado, não incomoda', () => {
        expect(describeDmResult({ event: 'feedback', httpStatus: 200, summary: { inactive: 2 } })).toBeNull();
    });
});

describe('describeBotStatus', () => {
    it('cada situação do bot tem texto e tom próprios', () => {
        expect(describeBotStatus(null).tone).toBe('neutral');
        expect(describeBotStatus({ configured: false }).label).toMatch(/Falta DISCORD_BOT_TOKEN/);
        expect(describeBotStatus({ configured: true, valid: true, botName: 'Hubdesk' })).toMatchObject({ tone: 'success', label: 'Bot conectado: Hubdesk' });
        expect(describeBotStatus({ configured: true, valid: true }).label).toBe('Bot conectado');
        expect(describeBotStatus({ configured: true, valid: null, reason: 'indisponivel' }).tone).toBe('neutral');
    });

    it('token ruim traz o passo a passo para corrigir', () => {
        const refused = describeBotStatus({ configured: true, valid: false, reason: 'recusado' });
        expect(refused.tone).toBe('danger');
        expect(refused.label).toMatch(/recusado/i);
        expect(refused.hint).toMatch(/Reset Token/);
        expect(refused.hint).toMatch(/Client Secret/);
        expect(refused.hint).toMatch(/novo deploy/i);

        const wrongKind = describeBotStatus({ configured: true, valid: false, reason: 'formato-invalido' });
        expect(wrongKind.label).toMatch(/não parece um token/i);
        expect(wrongKind.hint).toMatch(/Reset Token/);
    });

    it('a mensagem de envio com token recusado também orienta a correção', () => {
        expect(describeDmResult({ httpStatus: 502 }).text).toMatch(/Reset Token/);
    });
});

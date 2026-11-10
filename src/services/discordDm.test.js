import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { getIdToken, authMock, getWebhookConfigMock, getCachedCollectionMock } = vi.hoisted(() => {
    const getIdToken = vi.fn(async () => 'token-do-usuario');
    return {
        getIdToken,
        authMock: { currentUser: { getIdToken: (...args) => getIdToken(...args) } },
        getWebhookConfigMock: vi.fn(),
        getCachedCollectionMock: vi.fn(() => [])
    };
});
vi.mock('./firebase', () => ({ auth: authMock }));
vi.mock('./notificationEvents', () => ({ getWebhookConfig: (...args) => getWebhookConfigMock(...args) }));
vi.mock('./dataCache', () => ({ getCachedCollection: (...args) => getCachedCollectionMock(...args) }));

import {
    describeDmResult, describeBotStatus, sendDiscordDms, sendReportDm, fetchBotStatus, isValidDiscordId,
    DM_ENDPOINT, DM_EVENT_META, DEFAULT_DM_CONFIG
} from './discordDm';

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
        getCachedCollectionMock.mockReset();
        getCachedCollectionMock.mockReturnValue([]);
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

describe('DM pulada por configuração: avisa quando alguém vinculado deixaria de receber', () => {
    let emitted;

    beforeEach(() => {
        emitted = [];
        getWebhookConfigMock.mockReset();
        getCachedCollectionMock.mockReset();
        vi.stubGlobal('CustomEvent', class { constructor(type, init) { this.type = type; this.detail = init?.detail; } });
        vi.stubGlobal('window', { dispatchEvent: (e) => { emitted.push(e.detail); return true; } });
        vi.stubGlobal('fetch', vi.fn());
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    const recipients = [{ id: 'ana' }];
    const linkedColabs = [{ id: 'ana', discordUserId: '123456789012345678' }, { id: 'bia' }];

    it('DM desativada e destinatário vinculado: emite o aviso com a contagem', async () => {
        getWebhookConfigMock.mockResolvedValue({ dm: { enabled: false } });
        getCachedCollectionMock.mockReturnValue(linkedColabs);
        const result = await sendDiscordDms({ event: 'feedback', recipients });
        expect(result).toMatchObject({ status: 'skipped', reason: 'dm-desativado', linked: 1 });
        expect(emitted[0]).toMatchObject({ event: 'feedback', reason: 'dm-desativado', linked: 1 });
        expect(fetch).not.toHaveBeenCalled();
    });

    it('configuração sem o bloco dm (salva antes da v4.8.0) também conta como desativada', async () => {
        getWebhookConfigMock.mockResolvedValue({ enabled: true, url: 'https://x.example' });
        getCachedCollectionMock.mockReturnValue(linkedColabs);
        const result = await sendDiscordDms({ event: 'feedback', recipients });
        expect(result.reason).toBe('dm-desativado');
        expect(emitted).toHaveLength(1);
    });

    it('DM desativada, mas ninguém vinculado: silêncio (sem incomodar quem não usa DM)', async () => {
        getWebhookConfigMock.mockResolvedValue({ dm: { enabled: false } });
        getCachedCollectionMock.mockReturnValue([{ id: 'bia' }, { id: 'ana' }]);
        await sendDiscordDms({ event: 'feedback', recipients });
        expect(emitted).toHaveLength(0);
    });

    it('evento desmarcado e destinatário vinculado: emite o aviso', async () => {
        getWebhookConfigMock.mockResolvedValue({ dm: { enabled: true, events: { feedback: false } } });
        getCachedCollectionMock.mockReturnValue(linkedColabs);
        const result = await sendDiscordDms({ event: 'feedback', recipients });
        expect(result.reason).toBe('evento-desmarcado');
        expect(emitted[0]).toMatchObject({ reason: 'evento-desmarcado', linked: 1 });
    });

    it('lista de colaboradores indisponível não quebra o envio', async () => {
        getWebhookConfigMock.mockResolvedValue({ dm: { enabled: false } });
        getCachedCollectionMock.mockImplementation(() => { throw new Error('sem cache'); });
        const result = await sendDiscordDms({ event: 'feedback', recipients });
        expect(result).toMatchObject({ status: 'skipped', linked: 0 });
    });
});

describe('describeDmResult: DM pulada por configuração', () => {
    it('orienta a ativar quando há vinculados e fica em silêncio quando não há', () => {
        const warn = describeDmResult({ event: 'feedback', reason: 'dm-desativado', linked: 2 });
        expect(warn.type).toBe('warning');
        expect(warn.text).toMatch(/2 colaborador/);
        expect(warn.text).toMatch(/Enviar DM aos colaboradores vinculados/);
        expect(warn.text).toMatch(/Salvar webhook/);
        expect(describeDmResult({ event: 'feedback', reason: 'dm-desativado', linked: 0 })).toBeNull();
    });

    it('evento desmarcado explica o motivo', () => {
        expect(describeDmResult({ event: 'feedback', reason: 'evento-desmarcado', linked: 1 }).text).toMatch(/desmarcado/i);
        expect(describeDmResult({ event: 'feedback', reason: 'evento-desmarcado', linked: 0 })).toBeNull();
    });
});

describe('sendReportDm: tarefas e relatórios', () => {
    let emitted;
    const report = { id: 'rep1', creatorId: 'ana' };
    const dmOn = { dm: { enabled: true, events: {} } };

    beforeEach(() => {
        emitted = [];
        getIdToken.mockClear();
        getWebhookConfigMock.mockReset();
        getCachedCollectionMock.mockReset();
        getCachedCollectionMock.mockReturnValue([]);
        authMock.currentUser = { uid: 'uid-gestor', getIdToken: (...args) => getIdToken(...args) };
        vi.stubGlobal('CustomEvent', class { constructor(type, init) { this.type = type; this.detail = init?.detail; } });
        vi.stubGlobal('window', { dispatchEvent: (e) => { emitted.push(e.detail); return true; } });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(200, { summary: { sent: 1 } })));
    });
    afterEach(() => { vi.unstubAllGlobals(); });

    it('mudança de status: envia o id do relatório (não o texto) e o solicitante só para contagem', async () => {
        getWebhookConfigMock.mockResolvedValue(dmOn);
        const result = await sendReportDm({ report, kind: 'status' });
        expect(result.status).toBe('done');
        const body = JSON.parse(fetch.mock.calls[0][1].body);
        expect(body).toEqual({ event: 'report_status', recipients: [{ id: 'ana' }], reportId: 'rep1' });
    });

    it('comentário: usa o evento report_comment', async () => {
        getWebhookConfigMock.mockResolvedValue(dmOn);
        await sendReportDm({ report, kind: 'comment' });
        expect(JSON.parse(fetch.mock.calls[0][1].body).event).toBe('report_comment');
    });

    it('status com comentário junto envia o indicador withComment', async () => {
        getWebhookConfigMock.mockResolvedValue(dmOn);
        await sendReportDm({ report, kind: 'status', withComment: true });
        expect(JSON.parse(fetch.mock.calls[0][1].body).params).toEqual({ withComment: true });
    });

    it('relatório sem solicitante ou sem id não envia', async () => {
        expect((await sendReportDm({ report: { id: 'rep1' }, kind: 'status' })).reason).toBe('sem-solicitante');
        expect((await sendReportDm({ report: { creatorId: 'ana' }, kind: 'status' })).reason).toBe('sem-solicitante');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('quem alterou a própria solicitação não manda DM para si mesmo', async () => {
        getWebhookConfigMock.mockResolvedValue(dmOn);
        const result = await sendReportDm({ report: { id: 'rep1', creatorId: 'uid-gestor' }, kind: 'comment' });
        expect(result.reason).toBe('proprio-autor');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('respeita a configuração: DM desativada ou tipo desmarcado', async () => {
        getWebhookConfigMock.mockResolvedValue({ dm: { enabled: false } });
        expect((await sendReportDm({ report, kind: 'status' })).reason).toBe('dm-desativado');

        getWebhookConfigMock.mockResolvedValue({ dm: { enabled: true, events: { report_comment: false } } });
        expect((await sendReportDm({ report, kind: 'comment' })).reason).toBe('evento-desmarcado');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('DM desativada com o solicitante vinculado avisa o gestor', async () => {
        getWebhookConfigMock.mockResolvedValue({ dm: { enabled: false } });
        getCachedCollectionMock.mockReturnValue([{ id: 'ana', discordUserId: '123456789012345678' }]);
        await sendReportDm({ report, kind: 'status' });
        expect(emitted[0]).toMatchObject({ event: 'report_status', reason: 'dm-desativado', linked: 1 });
    });
});

describe('tipos de DM e mensagens de tarefas/relatórios', () => {
    it('os novos tipos aparecem na configuração e vêm ativados por padrão', () => {
        const ids = DM_EVENT_META.map(e => e.id);
        expect(ids).toEqual(expect.arrayContaining(['report_status', 'report_comment']));
        expect(DEFAULT_DM_CONFIG.events.report_status).toBe(true);
        expect(DEFAULT_DM_CONFIG.events.report_comment).toBe(true);
    });

    it('só comunica ao gestor quando a DM saiu ou deu problema', () => {
        expect(describeDmResult({ event: 'report_status', httpStatus: 200, summary: { sent: 1 } }))
            .toMatchObject({ type: 'success', text: expect.stringMatching(/solicitante/i) });
        expect(describeDmResult({ event: 'report_comment', httpStatus: 200, summary: { blocked: 1 } }).type).toBe('warning');
        expect(describeDmResult({ event: 'report_status', httpStatus: 200, summary: { failed: 1 } }).type).toBe('warning');
        // muitos colaboradores não vinculam o Discord: sem ruído a cada comentário
        expect(describeDmResult({ event: 'report_comment', httpStatus: 200, summary: { noLink: 1 } })).toBeNull();
        expect(describeDmResult({ event: 'report_status', httpStatus: 200, summary: {} })).toBeNull();
    });
});

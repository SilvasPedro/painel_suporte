import { auth } from './firebase';
import { getWebhookConfig } from './notificationEvents';

/**
 * AVISOS POR MENSAGEM DIRETA (DM) NO DISCORD
 *
 * O envio acontece na função serverless /api/notify-dm (Vercel), que guarda o token do bot.
 * Este módulo só pede o envio, mandando o login do usuário para a função validar.
 * Cada colaborador recebe a DM apenas se vinculou o próprio ID do Discord no perfil.
 */

export const DM_ENDPOINT = '/api/notify-dm';

// ID de usuário do Discord: 17 a 20 dígitos
export const isValidDiscordId = (value) => /^\d{17,20}$/.test(String(value || '').trim());

export const DM_EVENT_IDS = ['weekly_evaluation', 'feedback', 'monthly_evaluation'];

export const DEFAULT_DM_CONFIG = {
    enabled: false,
    events: { weekly_evaluation: true, feedback: true, monthly_evaluation: true }
};

/**
 * Texto para o usuário a partir do resultado do envio.
 * Retorna null quando não há o que dizer (ex.: função indisponível fora do site publicado).
 */
export const describeDmResult = ({ event, httpStatus, error, summary } = {}) => {
    const isTest = event === 'test';

    if (httpStatus === 404) {
        return isTest
            ? { type: 'warning', text: 'O envio de DM só funciona no site publicado (Vercel), não no ambiente local.' }
            : null;
    }
    if (httpStatus === 503 || error === 'bot-nao-configurado') {
        return { type: 'warning', text: 'O bot do Discord ainda não está configurado no servidor (variável DISCORD_BOT_TOKEN na Vercel).' };
    }
    if (httpStatus === 401) {
        return { type: 'warning', text: 'Sessão inválida para enviar DMs. Entre novamente no sistema.' };
    }
    if (httpStatus === 403) {
        return { type: 'warning', text: 'Sem permissão para enviar avisos por DM.' };
    }
    if (httpStatus === 502 || error === 'token-do-bot-invalido') {
        return { type: 'warning', text: 'O Discord recusou o token do bot. Gere um novo token e atualize DISCORD_BOT_TOKEN na Vercel.' };
    }
    if (!summary) {
        return httpStatus && httpStatus >= 400
            ? { type: 'warning', text: 'Não foi possível enviar as DMs do Discord agora.' }
            : null;
    }

    const { sent = 0, noLink = 0, inactive = 0, blocked = 0, failed = 0 } = summary;

    if (isTest) {
        if (sent > 0) return { type: 'success', text: 'DM de teste enviada! Confira suas mensagens diretas no Discord.' };
        if (noLink > 0) return { type: 'warning', text: 'Informe e salve o seu ID do Discord no perfil antes de enviar o teste.' };
        if (blocked > 0) {
            return { type: 'warning', text: 'O Discord bloqueou a DM. Entre no mesmo servidor do bot e ative "Mensagens diretas" de membros do servidor nas suas configurações de privacidade.' };
        }
        return { type: 'warning', text: 'Não foi possível enviar a DM de teste. Confira se o ID do Discord está correto.' };
    }

    const parts = [];
    if (sent > 0) parts.push(`${sent} DM(s) enviada(s)`);
    if (noLink > 0) parts.push(`${noLink} sem Discord vinculado`);
    if (blocked > 0) parts.push(`${blocked} com DMs bloqueadas`);
    if (failed > 0) parts.push(`${failed} com falha`);
    if (inactive > 0 && parts.length === 0) return null;
    if (parts.length === 0) return null;

    const type = (blocked > 0 || failed > 0) ? 'warning' : (sent > 0 ? 'success' : 'info');
    return { type, text: `Avisos por DM no Discord: ${parts.join(' • ')}.` };
};

const emitDmResult = (detail) => {
    console.info(`[DM Discord] ${detail.event}: HTTP ${detail.httpStatus ?? '-'}`, detail.summary || detail.error || '');
    try {
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
            window.dispatchEvent(new CustomEvent('HUBDESK_DM_RESULT', { detail }));
        }
    } catch {
        // sem ambiente de navegador
    }
};

/**
 * Pede o envio de DMs. Nunca lança erro: uma falha aqui não pode atrapalhar o salvamento do item.
 * - Eventos reais (weekly_evaluation, feedback, monthly_evaluation): só saem se a gestão ativou
 *   "DM no Discord" em Configurações > Notificações e o evento está marcado.
 * - 'test': envia ao próprio usuário logado, sem depender dessa configuração.
 * @param {{ event: string, recipients?: Array<{ id: string, params?: object }> }} request
 */
export const sendDiscordDms = async ({ event, recipients = [] }) => {
    try {
        if (event !== 'test') {
            if (!recipients.length) return { status: 'skipped', reason: 'sem-destinatarios' };
            const config = await getWebhookConfig();
            const dm = config?.dm;
            if (!dm?.enabled) return { status: 'skipped', reason: 'dm-desativado' };
            if (dm.events && dm.events[event] === false) return { status: 'skipped', reason: 'evento-desmarcado' };
        }

        const user = auth.currentUser;
        if (!user) return { status: 'skipped', reason: 'sem-login' };
        const idToken = await user.getIdToken();

        const response = await fetch(DM_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ event, recipients })
        });

        let data = {};
        try { data = await response.json(); } catch { /* corpo vazio */ }

        const detail = { event, httpStatus: response.status, error: data.error, summary: data.summary };
        emitDmResult(detail);
        return { status: response.ok ? 'done' : 'error', ...detail };
    } catch (error) {
        const detail = { event, httpStatus: 0, error: String(error?.message || error) };
        emitDmResult(detail);
        return { status: 'error', ...detail };
    }
};

/**
 * Informa se o bot está configurado no servidor (sem expor segredos).
 * @returns {Promise<boolean|null>} null quando a função não está disponível (ex.: ambiente local)
 */
export const fetchBotStatus = async () => {
    try {
        const response = await fetch(DM_ENDPOINT);
        if (!response.ok) return null;
        const data = await response.json();
        return Boolean(data.configured);
    } catch {
        return null;
    }
};

import { auth } from './firebase';
import { getWebhookConfig } from './notificationEvents';
import { getCachedCollection } from './dataCache';

/**
 * AVISOS POR MENSAGEM DIRETA (DM) NO DISCORD
 *
 * O envio acontece na função serverless /api/notify-dm (Vercel), que guarda o token do bot.
 * Este módulo só pede o envio, mandando o login do usuário para a função validar.
 * Cada colaborador recebe a DM apenas se vinculou o próprio ID do Discord no perfil.
 */

export const DM_ENDPOINT = '/api/notify-dm';

// Passo a passo para corrigir um token recusado
export const TOKEN_HELP = 'No portal do Discord, abra o aplicativo > Bot > Reset Token e copie o token (não o Client Secret). '
    + 'Na Vercel, atualize DISCORD_BOT_TOKEN com apenas esse valor, sem aspas, sem espaços e sem o prefixo "Bot ", e faça um novo deploy.';

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
export const describeDmResult = ({ event, httpStatus, error, summary, reason, linked = 0 } = {}) => {
    const isTest = event === 'test';

    // DM pulada por configuração: só avisa se alguém vinculou o Discord e deixaria de receber
    if (reason === 'dm-desativado') {
        return linked > 0
            ? { type: 'warning', text: `${linked} colaborador(es) vinculou(aram) o Discord, mas o envio de DM está desativado. Em Configurações > Notificações, marque "Enviar DM aos colaboradores vinculados" e clique em "Salvar webhook".` }
            : null;
    }
    if (reason === 'evento-desmarcado') {
        return linked > 0
            ? { type: 'info', text: `Este tipo de aviso está desmarcado nas DMs (Configurações > Notificações), então ${linked} colaborador(es) vinculado(s) não receberam.` }
            : null;
    }

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
        return { type: 'warning', text: `O Discord recusou o token do bot. ${TOKEN_HELP}` };
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

// Quantos destinatários têm o Discord vinculado, usando a lista de colaboradores já carregada (sem leituras extras)
const countLinkedRecipients = (recipients) => {
    try {
        const ids = new Set(recipients.map(r => String(r.id)));
        return (getCachedCollection('collaborators') || [])
            .filter(c => ids.has(String(c.id)) && isValidDiscordId(c.discordUserId)).length;
    } catch {
        return 0;
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
    // Pula o envio e, se alguém vinculado deixaria de receber, avisa o gestor na tela
    const skip = (reason) => {
        const linked = countLinkedRecipients(recipients);
        console.info(`[DM Discord] ${event}: não enviado (${reason}); vinculados entre os destinatários: ${linked}`);
        if (linked > 0) emitDmResult({ event, reason, linked });
        return { status: 'skipped', reason, linked };
    };

    try {
        if (event !== 'test') {
            if (!recipients.length) return { status: 'skipped', reason: 'sem-destinatarios' };
            const config = await getWebhookConfig();
            const dm = config?.dm;
            if (!dm?.enabled) return skip('dm-desativado');
            if (dm.events && dm.events[event] === false) return skip('evento-desmarcado');
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
 * Estado do bot no servidor (consulta o Discord, sem enviar mensagem e sem expor segredos).
 * @returns {Promise<null|{configured:boolean, valid?:boolean|null, reason?:string, botName?:string}>}
 *   null quando a função não está disponível (ex.: ambiente local)
 */
export const fetchBotStatus = async () => {
    try {
        const response = await fetch(DM_ENDPOINT);
        if (!response.ok) return null;
        const data = await response.json();
        return {
            configured: Boolean(data.configured),
            valid: data.valid ?? null,
            reason: data.reason || '',
            botName: data.botName || ''
        };
    } catch {
        return null;
    }
};

// Texto do estado do bot para a tela de configuração
export const describeBotStatus = (status) => {
    if (!status) return { tone: 'neutral', label: 'Indisponível neste ambiente', hint: '' };
    if (!status.configured) {
        return { tone: 'warning', label: 'Falta DISCORD_BOT_TOKEN na Vercel', hint: 'Crie a variável DISCORD_BOT_TOKEN e faça um novo deploy.' };
    }
    if (status.valid === true) {
        return { tone: 'success', label: status.botName ? `Bot conectado: ${status.botName}` : 'Bot conectado', hint: '' };
    }
    if (status.reason === 'formato-invalido') {
        return { tone: 'danger', label: 'O valor configurado não parece um token de bot', hint: TOKEN_HELP };
    }
    if (status.reason === 'recusado') {
        return { tone: 'danger', label: 'Token recusado pelo Discord', hint: TOKEN_HELP };
    }
    return { tone: 'neutral', label: 'Não foi possível verificar o bot agora', hint: '' };
};

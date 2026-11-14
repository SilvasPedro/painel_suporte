import { auth } from './firebase';

/**
 * Cabeçalhos para chamar as rotas protegidas (/api/chat, /api/insights): JSON + login do usuário.
 * O servidor confere a assinatura do login e o perfil da gestão antes de responder.
 */
export const getAuthHeaders = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Entre no sistema para usar a IA.');
    const idToken = await user.getIdToken();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` };
};

/** Mensagem para o usuário a partir do status da resposta das rotas de IA. */
export const describeAiError = (status, fallback = 'Erro ao comunicar com a IA.') => {
    if (status === 401) return 'Sua sessão expirou. Entre novamente para usar a IA.';
    if (status === 403) return 'O assistente de IA é exclusivo da gestão.';
    if (status === 413) return 'Há dados demais para enviar à IA. Tente com uma pergunta ou período menor.';
    if (status === 429) return 'Muitas chamadas seguidas. Aguarde alguns segundos e tente de novo.';
    return fallback;
};

/**
 * Lê o erro de uma resposta das rotas de IA e devolve { message, detail, retryable }.
 * Usa a explicação enviada pelo servidor; se a resposta não for JSON (ex.: a função da Vercel caiu),
 * mostra o status HTTP em vez de uma mensagem genérica.
 * @param {number} status status HTTP
 * @param {object|null} data corpo JSON da resposta, ou null quando não era JSON
 */
export const readAiError = (status, data) => {
    const body = data && typeof data === 'object' ? data : null;
    if (body?.message) {
        const code = body.error ? String(body.error) : '';
        const technical = [`HTTP ${status}`, code, body.detail].filter(Boolean).join(' • ');
        return { message: String(body.message), detail: technical, retryable: body.retryable !== false && status !== 401 && status !== 403 };
    }
    if (!body) {
        return {
            message: 'O servidor não respondeu corretamente. Veja os logs da função na Vercel para o motivo.',
            detail: `HTTP ${status} • resposta sem JSON`,
            retryable: status >= 500
        };
    }
    return { message: describeAiError(status, 'Não foi possível concluir o pedido.'), detail: `HTTP ${status}${body.error ? ` • ${body.error}` : ''}`, retryable: status >= 500 };
};

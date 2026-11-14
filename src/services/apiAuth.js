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

import { processDmRequest, getBotStatus } from './_lib/dm.js';

/**
 * POST /api/notify-dm   { event, recipients: [{ id, params }] }
 *   Cabeçalho: Authorization: Bearer <ID token do Firebase de quem está logado>
 *
 * GET  /api/notify-dm   -> { configured, valid, reason?, botName? }  (testa o token no Discord; sem segredos)
 *
 * Variáveis de ambiente (Vercel > Settings > Environment Variables):
 *   DISCORD_BOT_TOKEN  token do bot (obrigatório; nunca vai para o código ou para o navegador)
 *   APP_URL            endereço do site usado no link da DM (opcional)
 *   FIREBASE_PROJECT_ID (opcional; padrão: projeto do Hubdesk)
 */
export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method === 'GET') {
        return res.status(200).json(await getBotStatus({ env: process.env }));
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido. Use POST.' });
    }

    const authorization = String(req.headers?.authorization || '');
    const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';

    try {
        const { status, json } = await processDmRequest({
            body: req.body,
            idToken,
            env: process.env,
            origin: req.headers?.origin || ''
        });
        return res.status(status).json(json);
    } catch (error) {
        console.error('[notify-dm] erro inesperado:', error?.message);
        return res.status(500).json({ error: 'erro-interno' });
    }
}

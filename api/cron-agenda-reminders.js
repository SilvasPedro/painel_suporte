import admin from 'firebase-admin';
import { timingSafeEqual } from 'node:crypto';
import { processAgendaReminders } from './_lib/agendaReminders.js';

/**
 * GET /api/cron-agenda-reminders
 *   Cabeçalho: Authorization: Bearer <CRON_SECRET>
 *
 * Envia, por DM do Discord, os lembretes dos eventos da Agenda (15 min antes e no horário de início).
 * Precisa ser chamado a cada 1 a 5 minutos por um agendador (Vercel Cron no plano Pro, cron-job.org etc.).
 *
 * Variáveis de ambiente (Vercel > Settings > Environment Variables):
 *   CRON_SECRET                senha do agendador (obrigatória; o Vercel Cron a envia sozinho no cabeçalho)
 *   FIREBASE_SERVICE_ACCOUNT   JSON da conta de serviço do Firebase (obrigatória: o servidor lê a Agenda sem login de usuário)
 *   DISCORD_BOT_TOKEN, APP_URL, FIREBASE_PROJECT_ID  as mesmas de /api/notify-dm
 */

const safeEqual = (a, b) => {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && timingSafeEqual(x, y);
};

const getDb = () => {
    if (!admin.apps.length) {
        const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!raw) return null;
        const credentials = JSON.parse(raw);
        admin.initializeApp({
            credential: admin.credential.cert(credentials),
            projectId: process.env.FIREBASE_PROJECT_ID || credentials.project_id
        });
    }
    return admin.firestore();
};

const buildStore = (db) => ({
    listEvents: async (dates) => {
        const snap = await db.collection('agenda_events').where('date', 'in', dates).get();
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
    markSent: (id, key, iso) => db.collection('agenda_events').doc(id).update({ [`remindersSent.${key}`]: iso }),
    getCollaborator: async (id) => {
        const snap = await db.collection('collaborators').doc(id).get();
        return snap.exists ? snap.data() : null;
    },
    getDmConfig: async () => {
        const snap = await db.collection('integrations').doc('team_webhook').get();
        return snap.exists ? snap.data() : null;
    }
});

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    const secret = process.env.CRON_SECRET;
    if (!secret) return res.status(503).json({ error: 'cron-nao-configurado' });
    const authorization = String(req.headers?.authorization || '');
    const provided = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
    if (!provided || !safeEqual(provided, secret)) return res.status(401).json({ error: 'nao-autorizado' });

    try {
        const db = getDb();
        if (!db) return res.status(503).json({ error: 'conta-de-servico-nao-configurada' });
        const { status, json } = await processAgendaReminders({ store: buildStore(db), env: process.env });
        return res.status(status).json(json);
    } catch (error) {
        console.error('[cron-agenda-reminders] erro inesperado:', error?.message);
        return res.status(500).json({ error: 'erro-interno' });
    }
}

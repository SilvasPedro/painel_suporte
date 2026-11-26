/**
 * Acesso do servidor ao Firestore (firebase-admin) sem login de usuário.
 *
 * O firebase-admin v14 só tem a API modular (getApps, initializeApp, cert, getFirestore): o antigo
 * `admin.apps`, `admin.credential` e `admin.firestore()` não existem mais.
 *
 * Assistente de IA (getAiReaderDb): a conta de serviço ignora as regras do Firestore, por isso as ferramentas
 * da IA (dbTools.js) só expõem leitura e a rota só roda depois do login + perfil da gestão (aiGuard.js).
 * Recomendado: conta de serviço própria só com o papel "Leitor do Cloud Datastore" (roles/datastore.viewer)
 * em FIREBASE_AI_SERVICE_ACCOUNT. Sem ela, usa FIREBASE_SERVICE_ACCOUNT (a mesma do lembrete da Agenda).
 */

import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Um app nomeado por uso, para as credenciais de um não se misturarem com as do outro
const openDb = (appName, rawCredentials, env) => {
    let app = getApps().find(candidate => candidate.name === appName);
    if (!app) {
        const credentials = JSON.parse(rawCredentials);
        app = initializeApp({
            credential: cert(credentials),
            projectId: env.FIREBASE_PROJECT_ID || credentials.project_id
        }, appName);
    }
    return getFirestore(app);
};

/** @returns {import('firebase-admin/firestore').Firestore | null} null quando não há conta de serviço configurada */
export const getAiReaderDb = (env = process.env) => {
    const raw = env.FIREBASE_AI_SERVICE_ACCOUNT || env.FIREBASE_SERVICE_ACCOUNT;
    return raw ? openDb('ai-reader', raw, env) : null;
};

/** Banco usado pelo lembrete da Agenda (precisa de leitura e de gravação em remindersSent). */
export const getAgendaDb = (env = process.env) => {
    const raw = env.FIREBASE_SERVICE_ACCOUNT;
    return raw ? openDb('agenda-cron', raw, env) : null;
};

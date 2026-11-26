/**
 * Acesso do servidor ao Firestore (firebase-admin) para o assistente de IA.
 *
 * A conta de serviço ignora as regras do Firestore, por isso as ferramentas da IA (dbTools.js) só expõem leitura
 * e a rota só roda depois do login + perfil da gestão (aiGuard.js).
 * Recomendado: criar uma conta de serviço própria só com o papel "Leitor do Cloud Datastore"
 * (roles/datastore.viewer) e colocar o JSON em FIREBASE_AI_SERVICE_ACCOUNT. Assim, mesmo um erro de código
 * não consegue gravar nada. Sem essa variável, usa FIREBASE_SERVICE_ACCOUNT (a mesma do lembrete da Agenda).
 */

import admin from 'firebase-admin';

const APP_NAME = 'ai-reader';

/** @returns {import('firebase-admin').firestore.Firestore | null} null quando não há conta de serviço configurada */
export const getAiReaderDb = (env = process.env) => {
    const raw = env.FIREBASE_AI_SERVICE_ACCOUNT || env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) return null;
    let app = admin.apps.find(a => a?.name === APP_NAME);
    if (!app) {
        const credentials = JSON.parse(raw);
        app = admin.initializeApp({
            credential: admin.credential.cert(credentials),
            projectId: env.FIREBASE_PROJECT_ID || credentials.project_id
        }, APP_NAME);
    }
    return app.firestore();
};

import { describe, it, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { getApps, deleteApp } from 'firebase-admin/app';
import { getAiReaderDb, getAgendaDb } from './adminDb.js';

// Chave RSA de verdade (gerada na hora): o SDK valida o formato da conta de serviço ao abrir a conexão.
// Este teste usa o firebase-admin real (sem rede), justamente o que um banco falso não pega:
// a versão 14 não tem mais admin.apps / admin.credential / admin.firestore().
const makeServiceAccount = (projectId) => JSON.stringify({
    type: 'service_account',
    project_id: projectId,
    private_key_id: 'teste',
    private_key: generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }),
    client_email: `leitor@${projectId}.iam.gserviceaccount.com`,
    client_id: '1'
});

describe('adminDb', () => {
    it('sem conta de serviço devolve null (o chat segue sem banco)', () => {
        expect(getAiReaderDb({})).toBeNull();
        expect(getAgendaDb({})).toBeNull();
    });

    it('abre o Firestore com a conta de serviço de IA e reaproveita o app', () => {
        const env = { FIREBASE_AI_SERVICE_ACCOUNT: makeServiceAccount('projeto-teste-ia') };
        const db = getAiReaderDb(env);
        expect(typeof db.collection).toBe('function');
        expect(typeof db.listCollections).toBe('function');
        const before = getApps().length;
        getAiReaderDb(env);
        expect(getApps().length).toBe(before);
        expect(getApps().some(a => a.name === 'ai-reader' && a.options.projectId === 'projeto-teste-ia')).toBe(true);
    });

    it('sem FIREBASE_AI_SERVICE_ACCOUNT usa FIREBASE_SERVICE_ACCOUNT e respeita FIREBASE_PROJECT_ID', () => {
        const env = { FIREBASE_SERVICE_ACCOUNT: makeServiceAccount('projeto-base'), FIREBASE_PROJECT_ID: 'projeto-forcado' };
        // app nome 'ai-reader' já existe do teste anterior; o que vale aqui é abrir sem erro
        expect(typeof getAiReaderDb(env).collection).toBe('function');
        expect(typeof getAgendaDb(env).collection).toBe('function');
        expect(getApps().find(a => a.name === 'agenda-cron').options.projectId).toBe('projeto-forcado');
    });

    it('JSON inválido levanta erro (a rota do chat captura e segue sem banco)', async () => {
        // com o app já aberto o JSON nem é lido de novo; por isso o app é removido antes
        const existing = getApps().find(a => a.name === 'ai-reader');
        if (existing) await deleteApp(existing);
        expect(() => getAiReaderDb({ FIREBASE_AI_SERVICE_ACCOUNT: '{nao e json' })).toThrow();
    });
});

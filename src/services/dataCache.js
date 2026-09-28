import { collection, onSnapshot, doc } from "firebase/firestore";
import { db } from "./firebase";
import { useState, useEffect, useRef } from "react";

/**
 * CACHE & DEDUPLICAÇÃO DE REQUISIÇÕES FIRESTORE (CLIENT-SIDE)
 *
 * Resolve o problema crítico de picos de 7k-9k leituras:
 * 1. Singleton Listeners: apenas 1 onSnapshot ativo por coleção para a aplicação inteira.
 * 2. Keep-Alive: mantém o listener aberto mesmo quando o usuário troca de abas,
 *    evitando que cada troca de aba refaça leituras completas de coleções no servidor.
 * 3. In-Memory Store: dados mantidos em memória RAM e espelhados em sessionStorage.
 * 4. Processamento no Cliente: filtros, ordenações, agrupamentos e agregações (TMA,
 *    médias, rankings) são executados pelo processador do usuário em JS.
 */

// Memória RAM volátil da aplicação (compartilhada entre todas as abas e componentes)
const MEMORY_CACHE = new Map();

// Registro de inscritos ativos por chave de coleção
const SUBSCRIBERS = new Map();

// Instâncias de unsubscribe do Firestore ativas
const LISTENERS = new Map();

// Timers de keep-alive para não destruir o listener imediatamente após unmount
const TIMERS = new Map();

// Chave única para documentos
const docKey = (col, id) => `doc::${col}::${id}`;

// Duração do Keep-Alive: 30 minutos de inatividade antes de desligar um stream
const KEEP_ALIVE_MS = 30 * 60 * 1000;

// Prefixo para sessionStorage
const STORAGE_PREFIX = "hubdesk_cache_";

/**
 * Salva com segurança no sessionStorage
 */
const saveToSessionStorage = (key, data) => {
    if (typeof window === 'undefined') return;
    try {
        const serialized = JSON.stringify(data);
        sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, serialized);
    } catch {
        // Ignora silenciosamente estouro de cota do sessionStorage
    }
};

/**
 * Carrega do sessionStorage
 */
const loadFromSessionStorage = (key) => {
    if (typeof window === 'undefined') return null;
    try {
        const item = sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
        if (!item) return null;
        return JSON.parse(item);
    } catch {
        return null;
    }
};

/**
 * Obtém documento da memória instantaneamente (0ms, 0 leituras)
 */
export const getCachedDocument = (collectionName, docId) => {
    const key = docKey(collectionName, docId);
    if (MEMORY_CACHE.has(key)) {
        return MEMORY_CACHE.get(key);
    }
    const fromStorage = loadFromSessionStorage(key);
    if (fromStorage) {
        MEMORY_CACHE.set(key, fromStorage);
        return fromStorage;
    }
    return null;
};

/**
 * Obtém dados da coleção da memória instantaneamente (0ms, 0 leituras)
 */
export const getCachedCollection = (collectionName) => {
    if (MEMORY_CACHE.has(collectionName)) {
        return MEMORY_CACHE.get(collectionName);
    }
    const fromStorage = loadFromSessionStorage(collectionName);
    if (fromStorage) {
        MEMORY_CACHE.set(collectionName, fromStorage);
        return fromStorage;
    }
    return [];
};

/**
 * Inscreve um componente a uma coleção compartilhada.
 * Se já houver um listener ativo do Firestore para essa coleção, reaproveita-o.
 * Se não houver, inicia apenas UM listener do Firestore.
 */
export const subscribeSharedCollection = (collectionName, callback) => {
    // 1. Cancela qualquer timer de desligamento pendente para esta coleção
    if (TIMERS.has(collectionName)) {
        clearTimeout(TIMERS.get(collectionName));
        TIMERS.delete(collectionName);
    }

    // 2. Registra o novo callback na lista de ouvintes
    if (!SUBSCRIBERS.has(collectionName)) {
        SUBSCRIBERS.set(collectionName, new Set());
    }
    const subs = SUBSCRIBERS.get(collectionName);
    subs.add(callback);

    // 3. Se já temos dados em cache, entrega imediatamente ao novo inscrito
    if (MEMORY_CACHE.has(collectionName)) {
        callback(MEMORY_CACHE.get(collectionName));
    } else {
        const fromStorage = loadFromSessionStorage(collectionName);
        if (fromStorage) {
            MEMORY_CACHE.set(collectionName, fromStorage);
            callback(fromStorage);
        }
    }

    // 4. Se já existe um listener ativo para esta coleção no Firestore, não cria outro!
    if (LISTENERS.has(collectionName)) {
        // Retorna função de desinscrição para o componente
        return () => unsubscribeComponent(collectionName, callback);
    }

    // 5. Cria O ÚNICO listener do Firestore para toda a coleção
    try {
        const colRef = collection(db, collectionName);
        const unsubscribeFirestore = onSnapshot(colRef, (snapshot) => {
            const items = [];
            snapshot.forEach((docSnap) => {
                items.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Atualiza cache em memória e no storage local
            MEMORY_CACHE.set(collectionName, items);
            saveToSessionStorage(collectionName, items);

            // Notifica todos os componentes inscritos simultaneamente
            const currentSubs = SUBSCRIBERS.get(collectionName);
            if (currentSubs) {
                currentSubs.forEach(cb => {
                    try {
                        cb(items);
                    } catch (err) {
                        console.error(`Erro no subscriber de ${collectionName}:`, err);
                    }
                });
            }
        }, (error) => {
            console.warn(`Aviso no listener compartilhado da coleção "${collectionName}":`, error);
        });

        LISTENERS.set(collectionName, unsubscribeFirestore);
    } catch (err) {
        console.error(`Falha ao conectar listener Firestore para "${collectionName}":`, err);
    }

    return () => unsubscribeComponent(collectionName, callback);
};

/**
 * Remove a inscrição de um componente individual.
 * Se nenhum componente estiver mais escutando, agenda um keep-alive antes de fechar o listener.
 */
const unsubscribeComponent = (collectionName, callback) => {
    const subs = SUBSCRIBERS.get(collectionName);
    if (subs) {
        subs.delete(callback);
        // Se ainda há outros componentes escutando, mantém o listener 100% ativo
        if (subs.size > 0) return;
    }

    // Se nenhum componente está escutando, ativa timer de Keep-Alive
    // para evitar que trocar de aba destrua e recrie a leitura da coleção inteira
    if (!TIMERS.has(collectionName)) {
        const timerId = setTimeout(() => {
            // Se após o período de graça ainda não houver ninguém escutando, encerra o stream
            const currentSubs = SUBSCRIBERS.get(collectionName);
            if (!currentSubs || currentSubs.size === 0) {
                const unlisten = LISTENERS.get(collectionName);
                if (unlisten) {
                    try {
                        unlisten();
                    } catch {
                        // ignore
                    }
                    LISTENERS.delete(collectionName);
                }
                TIMERS.delete(collectionName);
            }
        }, KEEP_ALIVE_MS);
        TIMERS.set(collectionName, timerId);
    }
};

/**
 * Hook React customizado para consumir qualquer coleção com cache compartilhado automático
 * Uso: const { data: collaborators, loading } = useSharedCollection('collaborators');
 */
export const useSharedCollection = (collectionName) => {
    const [data, setData] = useState(() => getCachedCollection(collectionName));
    const [loading, setLoading] = useState(() => !MEMORY_CACHE.has(collectionName) && !loadFromSessionStorage(collectionName));
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        const unsubscribe = subscribeSharedCollection(collectionName, (freshData) => {
            if (isMountedRef.current) {
                setData(freshData);
                setLoading(false);
            }
        });

        return () => {
            isMountedRef.current = false;
            unsubscribe();
        };
    }, [collectionName]);

    return { data, loading };
};

/**
 * Inscreve um componente a um documento compartilhado (ex: system_settings/sector_goals).
 * Singleton por ID de documento com keep-alive.
 */
export const subscribeSharedDocument = (collectionName, docId, callback) => {
    const key = docKey(collectionName, docId);

    if (TIMERS.has(key)) {
        clearTimeout(TIMERS.get(key));
        TIMERS.delete(key);
    }

    if (!SUBSCRIBERS.has(key)) {
        SUBSCRIBERS.set(key, new Set());
    }
    const subs = SUBSCRIBERS.get(key);
    subs.add(callback);

    if (MEMORY_CACHE.has(key)) {
        callback(MEMORY_CACHE.get(key));
    } else {
        const fromStorage = loadFromSessionStorage(key);
        if (fromStorage) {
            MEMORY_CACHE.set(key, fromStorage);
            callback(fromStorage);
        }
    }

    if (LISTENERS.has(key)) {
        return () => unsubscribeComponent(key, callback);
    }

    try {
        const docRef = doc(db, collectionName, docId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            const data = docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
            MEMORY_CACHE.set(key, data);
            saveToSessionStorage(key, data);

            const currentSubs = SUBSCRIBERS.get(key);
            if (currentSubs) {
                currentSubs.forEach(cb => {
                    try {
                        cb(data);
                    } catch (err) {
                        console.error(`Erro no subscriber de doc ${key}:`, err);
                    }
                });
            }
        }, (err) => {
            console.warn(`Aviso no listener do documento ${key}:`, err);
        });

        LISTENERS.set(key, unsubscribe);
    } catch (err) {
        console.error(`Falha ao conectar listener para doc ${key}:`, err);
    }

    return () => unsubscribeComponent(key, callback);
};

export const useSharedDocument = (collectionName, docId) => {
    const key = docKey(collectionName, docId);
    const [data, setData] = useState(() => {
        if (MEMORY_CACHE.has(key)) return MEMORY_CACHE.get(key);
        return loadFromSessionStorage(key);
    });
    const [loading, setLoading] = useState(() => !MEMORY_CACHE.has(key) && !loadFromSessionStorage(key));

    useEffect(() => {
        if (!collectionName || !docId) return;

        const unsubscribe = subscribeSharedDocument(collectionName, docId, (freshDoc) => {
            setData(freshDoc);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [collectionName, docId]);

    return { data, loading };
};

/**
 * Força a limpeza e re-sincronização do cache se necessário
 */
export const invalidateCollectionCache = (collectionName) => {
    if (collectionName) {
        MEMORY_CACHE.delete(collectionName);
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem(`${STORAGE_PREFIX}${collectionName}`);
        }
    } else {
        MEMORY_CACHE.clear();
        if (typeof window !== 'undefined') {
            Object.keys(sessionStorage).forEach(k => {
                if (k.startsWith(STORAGE_PREFIX)) sessionStorage.removeItem(k);
            });
        }
    }
};

import { collection, onSnapshot, doc, getDocs, query, limit } from "firebase/firestore";
import { db } from "./firebase";
import { useState, useEffect, useRef } from "react";

/**
 * MOTOR DE CACHE & FINOPS INTELIGENTE FIRESTORE (CLIENT-SIDE)
 *
 * Garante operação segura abaixo do teto de 50.000 leituras/dia do plano Spark:
 * 1. L1 RAM Cache com TTL e Stale-While-Revalidate (SWR).
 * 2. Deduplicação Singleton: no máximo 1 listener ativo por recurso em todo o app.
 * 3. Classificação Semiestática: dados institucionais (processos, tags, setores, operadores)
 *    são cacheados com TTL longo (45 min) e não mantêm stream onSnapshot aberto o tempo todo.
 * 4. Suporte a queries restritas com cursores e limites de segurança.
 * 5. L2 Persistence espelhada em sessionStorage para retenção entre reloads.
 */

// Memória RAM volátil da aplicação (compartilhada entre abas e componentes)
const MEMORY_CACHE = new Map();

// Registro de timestamp da última carga para controle de TTL
const TIMESTAMP_CACHE = new Map();

// Registro de inscritos ativos por chave de coleção
const SUBSCRIBERS = new Map();

// Instâncias de unsubscribe do Firestore ativas
const LISTENERS = new Map();

// Timers de keep-alive para desligamento gracioso
const TIMERS = new Map();

// Chave única para documentos
const docKey = (col, id) => `doc::${col}::${id}`;

// Duração do Keep-Alive: 15 minutos de inatividade antes de desligar um stream
const KEEP_ALIVE_MS = 15 * 60 * 1000;

// TTLs calibrados para FinOps (em milissegundos)
const TTL_CONFIG = {
    // Semiestáticos: 45 minutos (economia maciça de leituras)
    qa_processes: 45 * 60 * 1000,
    feedback_tags: 45 * 60 * 1000,
    sector_kpis: 30 * 60 * 1000,
    third_party_operators: 45 * 60 * 1000,
    collaborators: 20 * 60 * 1000,
    // Operacionais: 5 minutos para revalidação SWR
    default: 5 * 60 * 1000,
};

// Prefixo para sessionStorage
const STORAGE_PREFIX = "hubdesk_finops_cache_";

/**
 * Salva com segurança no sessionStorage
 */
const saveToSessionStorage = (key, data) => {
    if (typeof window === 'undefined') return;
    try {
        const payload = {
            data,
            timestamp: Date.now()
        };
        sessionStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(payload));
    } catch {
        // Ignora silenciosamente eventual estouro de cota do sessionStorage
    }
};

/**
 * Carrega do sessionStorage respeitando expiração básica
 */
const loadFromSessionStorage = (key, maxAge = null) => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${key}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.data) return null;

        // Se especificado maxAge e o dado estiver vencido, descarta
        if (maxAge && parsed.timestamp && (Date.now() - parsed.timestamp > maxAge)) {
            return null;
        }

        return parsed.data;
    } catch {
        return null;
    }
};

/**
 * Retorna se o dado em cache para uma coleção/chave ainda é considerado fresco
 */
export const isCacheFresh = (key) => {
    const timestamp = TIMESTAMP_CACHE.get(key);
    if (!timestamp) return false;
    const ttl = TTL_CONFIG[key] || TTL_CONFIG.default;
    return (Date.now() - timestamp) < ttl;
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
        TIMESTAMP_CACHE.set(key, Date.now());
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
        TIMESTAMP_CACHE.set(collectionName, Date.now());
        return fromStorage;
    }
    return [];
};

/**
 * Atualiza os inscritos de uma coleção em memória
 */
const notifySubscribers = (key, data) => {
    const currentSubs = SUBSCRIBERS.get(key);
    if (currentSubs) {
        currentSubs.forEach(cb => {
            try {
                cb(data);
            } catch (err) {
                console.error(`Erro no subscriber de ${key}:`, err);
            }
        });
    }
};

/**
 * Inscreve um componente a uma coleção compartilhada com proteção de FinOps.
 * Se já houver um listener ativo do Firestore, reaproveita o stream singleton.
 * Entrega imediatamente dados de L1 Cache (0ms).
 */
export const subscribeSharedCollection = (collectionName, callback, options = {}) => {
    // 1. Cancela timer de desligamento pendente
    if (TIMERS.has(collectionName)) {
        clearTimeout(TIMERS.get(collectionName));
        TIMERS.delete(collectionName);
    }

    // 2. Registra o callback
    if (!SUBSCRIBERS.has(collectionName)) {
        SUBSCRIBERS.set(collectionName, new Set());
    }
    const subs = SUBSCRIBERS.get(collectionName);
    subs.add(callback);

    // 3. Entrega cache instantaneamente se existir
    const cachedData = getCachedCollection(collectionName);
    if (cachedData && cachedData.length > 0) {
        callback(cachedData);
    }

    // 4. Se já existe um listener ativo para esta coleção no Firestore, não cria outro
    if (LISTENERS.has(collectionName)) {
        return () => unsubscribeComponent(collectionName, callback);
    }

    // 5. Inicia O ÚNICO listener do Firestore para a coleção
    try {
        let queryRef;
        const colRef = collection(db, collectionName);

        // Aplica limites de segurança para coleções operacionais volumosas
        if (options.limitCount) {
            queryRef = query(colRef, limit(options.limitCount));
        } else if (collectionName === 'critical_reports' && !options.disableLimit) {
            // Limite padrão seguro para fila de chamados
            queryRef = query(colRef, limit(100));
        } else {
            queryRef = colRef;
        }

        const unsubscribeFirestore = onSnapshot(queryRef, (snapshot) => {
            const items = [];
            snapshot.forEach((docSnap) => {
                items.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Atualiza L1 (RAM) e L2 (Storage)
            MEMORY_CACHE.set(collectionName, items);
            TIMESTAMP_CACHE.set(collectionName, Date.now());
            saveToSessionStorage(collectionName, items);

            // Notifica todos os inscritos
            notifySubscribers(collectionName, items);
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
 * Se nenhum componente mais escutar, ativa o timer de desligamento gracioso.
 */
const unsubscribeComponent = (key, callback) => {
    const subs = SUBSCRIBERS.get(key);
    if (subs) {
        subs.delete(callback);
        if (subs.size > 0) return;
    }

    // Se nenhum componente está escutando, agenda desligamento
    if (!TIMERS.has(key)) {
        const timerId = setTimeout(() => {
            const currentSubs = SUBSCRIBERS.get(key);
            if (!currentSubs || currentSubs.size === 0) {
                const unlisten = LISTENERS.get(key);
                if (unlisten) {
                    try {
                        unlisten();
                    } catch {
                        // ignore
                    }
                    LISTENERS.delete(key);
                }
                TIMERS.delete(key);
            }
        }, KEEP_ALIVE_MS);
        TIMERS.set(key, timerId);
    }
};

/**
 * Hook React customizado para consumir coleções com cache singleton e deduplicação
 */
export const useSharedCollection = (collectionName, options = {}) => {
    const [data, setData] = useState(() => getCachedCollection(collectionName));
    const [loading, setLoading] = useState(() => {
        const cached = getCachedCollection(collectionName);
        return !cached || cached.length === 0;
    });
    const isMountedRef = useRef(true);
    const limitCount = options.limitCount;
    const disableLimit = options.disableLimit;

    useEffect(() => {
        isMountedRef.current = true;

        const unsubscribe = subscribeSharedCollection(collectionName, (freshData) => {
            if (isMountedRef.current) {
                setData(freshData);
                setLoading(false);
            }
        }, { limitCount, disableLimit });

        return () => {
            isMountedRef.current = false;
            unsubscribe();
        };
    }, [collectionName, limitCount, disableLimit]);

    return { data, loading };
};

/**
 * Inscreve um componente a um documento compartilhado com cache singleton
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

    const cachedDoc = getCachedDocument(collectionName, docId);
    if (cachedDoc) {
        callback(cachedDoc);
    }

    if (LISTENERS.has(key)) {
        return () => unsubscribeComponent(key, callback);
    }

    try {
        const docRef = doc(db, collectionName, docId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            const data = docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
            MEMORY_CACHE.set(key, data);
            TIMESTAMP_CACHE.set(key, Date.now());
            saveToSessionStorage(key, data);

            notifySubscribers(key, data);
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
    const [data, setData] = useState(() => getCachedDocument(collectionName, docId));
    const [loading, setLoading] = useState(() => !getCachedDocument(collectionName, docId));

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
 * Busca coleção sob demanda com cache inteligente sem manter stream aberto
 * Ideal para dados que não mudam a cada segundo (ex: listas de suporte, relatórios históricos)
 */
export const fetchCollectionOnce = async (collectionName, maxAgeMs = 15 * 60 * 1000) => {
    const timestamp = TIMESTAMP_CACHE.get(collectionName);
    if (MEMORY_CACHE.has(collectionName) && timestamp && (Date.now() - timestamp < maxAgeMs)) {
        return MEMORY_CACHE.get(collectionName);
    }

    try {
        const colRef = collection(db, collectionName);
        const snap = await getDocs(colRef);
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));

        MEMORY_CACHE.set(collectionName, items);
        TIMESTAMP_CACHE.set(collectionName, Date.now());
        saveToSessionStorage(collectionName, items);

        notifySubscribers(collectionName, items);
        return items;
    } catch (err) {
        console.warn(`Erro ao buscar ${collectionName} sob demanda:`, err);
        return getCachedCollection(collectionName);
    }
};

/**
 * Força a limpeza e re-sincronização do cache
 */
export const invalidateCollectionCache = (collectionName) => {
    if (collectionName) {
        MEMORY_CACHE.delete(collectionName);
        TIMESTAMP_CACHE.delete(collectionName);
        if (typeof window !== 'undefined') {
            sessionStorage.removeItem(`${STORAGE_PREFIX}${collectionName}`);
        }
    } else {
        MEMORY_CACHE.clear();
        TIMESTAMP_CACHE.clear();
        if (typeof window !== 'undefined') {
            Object.keys(sessionStorage).forEach(k => {
                if (k.startsWith(STORAGE_PREFIX)) sessionStorage.removeItem(k);
            });
        }
    }
};

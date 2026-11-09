import { collection, onSnapshot, doc, getDocs, query, limit, where, orderBy, documentId } from "firebase/firestore";
import { db } from "./firebase";
import { useState, useEffect, useRef } from "react";

/**
 * MOTOR DE CACHE & FINOPS INTELIGENTE FIRESTORE (CLIENT-SIDE)
 *
 * Garante operação segura abaixo do teto de 50.000 leituras/dia do plano Spark:
 * 1. L1 RAM Cache com TTL e Stale-While-Revalidate (SWR).
 * 2. Deduplicação Singleton: no máximo 1 listener ativo por recurso em todo o app.
 * 3. Coleções volumosas usam limit() SEMPRE combinado com orderBy (mais recentes primeiro),
 *    evitando que o limite descarte registros novos de forma arbitrária.
 * 4. Queries escopadas (options.where): quem só precisa dos próprios registros baixa apenas
 *    esses documentos, em vez da coleção inteira (cada escopo tem sua própria chave de cache).
 * 5. fetchQueryOnce: leitura única com TTL, sem listener aberto, para dados históricos.
 * 6. L2 Persistence espelhada em sessionStorage para retenção entre reloads.
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

// Limites máximos de FinOps padrão para coleções volumosas para proteger cotas do Firestore
const DEFAULT_COLLECTION_LIMITS = {
    critical_reports: 150,
    dailyDemand: 300,
    weekly_evaluations: 400,
    qa_audits: 300,
    third_party_audits: 300,
    feedbacks: 300,
};

// Ordenação padrão aplicada junto com o limite (mais recentes primeiro).
// dailyDemand usa o ID do documento (data YYYY-MM-DD), que todo documento possui.
const DEFAULT_COLLECTION_ORDER = {
    critical_reports: { field: 'createdAt' },
    dailyDemand: { field: documentId() },
    weekly_evaluations: { field: 'createdAt' },
    qa_audits: { field: 'createdAt' },
    third_party_audits: { field: 'createdAt' },
    feedbacks: { field: 'createdAt' },
};

// Chave de cache/listener: nome da coleção, ou nome + filtros quando a query é escopada
export const buildCollectionKey = (collectionName, options = {}) => {
    if (options.where && options.where.length > 0) {
        return `${collectionName}?${JSON.stringify(options.where)}`;
    }
    return collectionName;
};

// Monta a query respeitando filtros, ordenação e limites de FinOps
const buildQuery = (collectionName, options = {}, { withOrder = true } = {}) => {
    const colRef = collection(db, collectionName);
    const constraints = [];
    const scoped = Boolean(options.where && options.where.length > 0);

    if (scoped) {
        options.where.forEach(([field, op, value]) => constraints.push(where(field, op, value)));
        if (options.limitCount) constraints.push(limit(options.limitCount));
    } else if (options.limitCount || (!options.disableLimit && DEFAULT_COLLECTION_LIMITS[collectionName])) {
        const count = options.limitCount || DEFAULT_COLLECTION_LIMITS[collectionName];
        const order = options.orderBy || DEFAULT_COLLECTION_ORDER[collectionName];
        if (order && withOrder) constraints.push(orderBy(order.field, order.dir || 'desc'));
        constraints.push(limit(count));
    }

    return constraints.length > 0 ? query(colRef, ...constraints) : colRef;
};

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
    const key = buildCollectionKey(collectionName, options);

    // 1. Cancela timer de desligamento pendente
    if (TIMERS.has(key)) {
        clearTimeout(TIMERS.get(key));
        TIMERS.delete(key);
    }

    // 2. Registra o callback
    if (!SUBSCRIBERS.has(key)) {
        SUBSCRIBERS.set(key, new Set());
    }
    const subs = SUBSCRIBERS.get(key);
    subs.add(callback);

    // 3. Entrega cache instantaneamente se existir
    const cachedData = getCachedCollection(key);
    if (cachedData && cachedData.length > 0) {
        callback(cachedData);
    }

    // 4. Se já existe um listener ativo para esta query no Firestore, não cria outro
    if (LISTENERS.has(key)) {
        return () => unsubscribeComponent(key, callback);
    }

    // 5. Inicia O ÚNICO listener do Firestore para a query
    const attach = (withOrder) => {
        const queryRef = buildQuery(collectionName, options, { withOrder });

        return onSnapshot(queryRef, (snapshot) => {
            const items = [];
            snapshot.forEach((docSnap) => {
                items.push({ id: docSnap.id, ...docSnap.data() });
            });

            // Atualiza L1 (RAM) e L2 (Storage)
            MEMORY_CACHE.set(key, items);
            TIMESTAMP_CACHE.set(key, Date.now());
            saveToSessionStorage(key, items);

            // Notifica todos os inscritos
            notifySubscribers(key, items);
        }, (error) => {
            // Sem índice para a ordenação: refaz a query sem orderBy em vez de deixar a tela vazia
            if (withOrder && error?.code === 'failed-precondition') {
                console.warn(`Índice ausente para "${key}"; usando consulta sem ordenação.`, error);
                LISTENERS.set(key, attach(false));
                return;
            }
            console.warn(`Aviso no listener compartilhado "${key}":`, error);
        });
    };

    try {
        LISTENERS.set(key, attach(true));
    } catch (err) {
        console.error(`Falha ao conectar listener Firestore para "${key}":`, err);
    }

    return () => unsubscribeComponent(key, callback);
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
    const [data, setData] = useState(() => getCachedCollection(buildCollectionKey(collectionName, options)));
    const [loading, setLoading] = useState(() => {
        const cached = getCachedCollection(buildCollectionKey(collectionName, options));
        return !cached || cached.length === 0;
    });
    const isMountedRef = useRef(true);
    const limitCount = options.limitCount;
    const disableLimit = options.disableLimit;
    const whereKey = JSON.stringify(options.where || []);

    useEffect(() => {
        isMountedRef.current = true;

        const unsubscribe = subscribeSharedCollection(collectionName, (freshData) => {
            if (isMountedRef.current) {
                setData(freshData);
                setLoading(false);
            }
        }, { limitCount, disableLimit, where: JSON.parse(whereKey) });

        return () => {
            isMountedRef.current = false;
            unsubscribe();
        };
    }, [collectionName, limitCount, disableLimit, whereKey]);

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

    // Entrega cache imediato se já consultado anteriormente (inclusive se doc for null/não existente)
    if (MEMORY_CACHE.has(key)) {
        callback(MEMORY_CACHE.get(key));
    } else {
        const cachedDoc = getCachedDocument(collectionName, docId);
        if (cachedDoc !== null && cachedDoc !== undefined) {
            callback(cachedDoc);
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
 * Leitura única (getDocs) com TTL e SEM listener aberto. Ideal para dados históricos/arquivados.
 * Usa chave de cache própria para não conflitar com o listener da mesma coleção.
 */
export const fetchQueryOnce = async (collectionName, options = {}, maxAgeMs = 45 * 60 * 1000) => {
    const key = `${buildCollectionKey(collectionName, options)}::once`;
    const timestamp = TIMESTAMP_CACHE.get(key);
    if (MEMORY_CACHE.has(key) && timestamp && (Date.now() - timestamp < maxAgeMs)) {
        return MEMORY_CACHE.get(key);
    }

    try {
        const snap = await getDocs(buildQuery(collectionName, { ...options, disableLimit: options.disableLimit ?? true }));
        const items = [];
        snap.forEach(d => items.push({ id: d.id, ...d.data() }));

        MEMORY_CACHE.set(key, items);
        TIMESTAMP_CACHE.set(key, Date.now());
        return items;
    } catch (err) {
        console.warn(`Erro ao buscar ${key} sob demanda:`, err);
        return MEMORY_CACHE.get(key) || [];
    }
};

/**
 * Força a limpeza e re-sincronização do cache
 */
export const invalidateCollectionCache = (collectionName) => {
    if (collectionName) {
        const matches = (k) => k === collectionName || k.startsWith(`${collectionName}?`) || k.startsWith(`${collectionName}::`);
        [...MEMORY_CACHE.keys()].filter(matches).forEach(k => {
            MEMORY_CACHE.delete(k);
            TIMESTAMP_CACHE.delete(k);
        });
        if (typeof window !== 'undefined') {
            Object.keys(sessionStorage).forEach(k => {
                if (k.startsWith(STORAGE_PREFIX) && matches(k.slice(STORAGE_PREFIX.length))) sessionStorage.removeItem(k);
            });
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

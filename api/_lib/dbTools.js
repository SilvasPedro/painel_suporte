/**
 * Ferramentas de LEITURA do Firestore para o assistente de IA (Claude).
 *
 * A IA enxerga todas as coleções e subcoleções, mas só consegue ler: aqui existem apenas get, consulta com filtros,
 * contagem/soma/média e listagem de coleções. Não há nenhuma chamada de escrita, então não há como gravar,
 * alterar ou apagar nada por este caminho.
 *
 * Campos com cara de segredo (senha, token, chave, webhook...) voltam como "[oculto]": a IA analisa os dados
 * do suporte sem poder repetir credenciais no chat.
 */

import { Timestamp, AggregateField } from 'firebase-admin/firestore';

export const DB_LIMITS = {
    maxDocs: 300,          // documentos por consulta
    defaultDocs: 50,
    maxOffset: 5000,
    maxFilters: 6,
    maxResultChars: 60000, // tamanho do JSON devolvido à IA em uma chamada
    maxStringChars: 3000,  // textos mais longos são cortados
    maxDepth: 8,
    maxFields: 40
};

const OPERATORS = ['==', '!=', '<', '<=', '>', '>=', 'in', 'not-in', 'array-contains', 'array-contains-any'];

// Nomes de campo que guardam segredos
const SENSITIVE_KEY = /(pass(word|wd)?|senha|secret|token|private.?key|api.?key|credential|authorization|webhook)/i;
export const isSensitiveKey = (key) => SENSITIVE_KEY.test(String(key));

const HIDDEN = '[oculto]';

/** Converte um valor do Firestore em JSON simples (datas em ISO, referências em caminho, segredos ocultos). */
export const serialize = (value, depth = 0) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') {
        return value.length > DB_LIMITS.maxStringChars ? `${value.slice(0, DB_LIMITS.maxStringChars)}…[texto cortado]` : value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return String(value);
    if (typeof value.toDate === 'function') {
        const date = value.toDate();
        return Number.isNaN(date.getTime()) ? null : date.toISOString();
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
    if (typeof value.path === 'string' && value.firestore) return `ref:${value.path}`;
    if (typeof value.latitude === 'number' && typeof value.longitude === 'number') return { latitude: value.latitude, longitude: value.longitude };
    if (value instanceof Uint8Array) return '[dado binário]';
    if (depth >= DB_LIMITS.maxDepth) return '[aninhado demais]';
    if (Array.isArray(value)) return value.map(item => serialize(item, depth + 1));
    if (typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, inner]) => [
            key,
            isSensitiveKey(key) ? HIDDEN : serialize(inner, depth + 1)
        ]));
    }
    return String(value);
};

const toPlainDoc = (snap) => ({ id: snap.id, caminho: snap.ref.path, dados: serialize(snap.data() || {}) });

/** Caminho de coleção tem número ímpar de partes; o de documento, par. */
const splitPath = (path, kind) => {
    const parts = String(path ?? '').trim().replace(/^\/+|\/+$/g, '').split('/');
    const valid = parts.length > 0 && parts.every(part => part.length > 0 && part.length <= 200 && !part.includes('..'));
    const isCollection = parts.length % 2 === 1;
    if (!valid || (kind === 'colecao') !== isCollection) {
        throw new Error(kind === 'colecao'
            ? `"${path}" não é um caminho de coleção válido (ex.: "weekly_evaluations" ou "collaborators/ID/subcolecao").`
            : `"${path}" não é um caminho de documento válido (ex.: "collaborators/ID").`);
    }
    return parts.join('/');
};

// Valor de filtro: objeto {"timestamp": "2026-11-01T00:00:00-03:00"} vira data do Firestore
const coerceValue = (value) => {
    if (Array.isArray(value)) return value.map(coerceValue);
    if (value && typeof value === 'object' && typeof value.timestamp === 'string') {
        const date = new Date(value.timestamp);
        if (Number.isNaN(date.getTime())) throw new Error(`Data inválida em filtro: "${value.timestamp}". Use ISO 8601, ex.: 2026-11-01T00:00:00-03:00.`);
        return Timestamp.fromDate(date);
    }
    return value;
};

const applyFilters = (query, filtros) => {
    if (filtros === undefined || filtros === null) return query;
    if (!Array.isArray(filtros)) throw new Error('"filtros" deve ser uma lista de {campo, operador, valor}.');
    if (filtros.length > DB_LIMITS.maxFilters) throw new Error(`No máximo ${DB_LIMITS.maxFilters} filtros por consulta.`);
    return filtros.reduce((q, filtro) => {
        const campo = String(filtro?.campo ?? '').trim();
        const operador = String(filtro?.operador ?? '==').trim();
        if (!campo) throw new Error('Cada filtro precisa de "campo".');
        if (!OPERATORS.includes(operador)) throw new Error(`Operador "${operador}" inválido. Use: ${OPERATORS.join(', ')}.`);
        return q.where(campo, operador, coerceValue(filtro.valor));
    }, query);
};

const openQuery = (db, input) => {
    if (input.grupo_de_colecoes) {
        const name = String(input.colecao ?? '').trim();
        if (!name || name.includes('/')) throw new Error('Com "grupo_de_colecoes", informe só o nome da subcoleção (sem "/").');
        return db.collectionGroup(name);
    }
    return db.collection(splitPath(input.colecao, 'colecao'));
};

const integerBetween = (value, min, max, fallback) => {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export const TOOL_DEFINITIONS = [
    {
        name: 'listar_colecoes',
        description: 'Lista as coleções do banco de dados (Firestore) com a quantidade de documentos de cada uma. Com "documento", lista as subcoleções daquele documento. Use primeiro para descobrir o que existe.',
        input_schema: {
            type: 'object',
            properties: {
                documento: { type: 'string', description: 'Caminho de um documento (ex.: "collaborators/abc123") para listar as subcoleções dele. Omita para listar as coleções raiz.' }
            }
        }
    },
    {
        name: 'ler_documento',
        description: 'Lê um documento pelo caminho completo (somente leitura).',
        input_schema: {
            type: 'object',
            properties: { caminho: { type: 'string', description: 'Ex.: "collaborators/abc123" ou "system_settings/sector_goals".' } },
            required: ['caminho']
        }
    },
    {
        name: 'consultar_colecao',
        description: `Consulta documentos de uma coleção com filtros, ordenação e paginação (somente leitura). Devolve até ${DB_LIMITS.maxDocs} documentos por chamada; use "pular" para ver os seguintes. Para descobrir os nomes dos campos, consulte antes com limite 1. Para totais, prefira a ferramenta "agregar".`,
        input_schema: {
            type: 'object',
            properties: {
                colecao: { type: 'string', description: 'Caminho da coleção (ex.: "weekly_evaluations"). Com grupo_de_colecoes, só o nome da subcoleção.' },
                grupo_de_colecoes: { type: 'boolean', description: 'true para consultar todas as subcoleções com esse nome, em qualquer documento.' },
                filtros: {
                    type: 'array',
                    description: 'Filtros combinados com E. Datas gravadas como Timestamp: valor {"timestamp":"2026-11-01T00:00:00-03:00"}. Datas gravadas como texto: compare como texto (ex.: "2026-11-01").',
                    items: {
                        type: 'object',
                        properties: {
                            campo: { type: 'string' },
                            operador: { type: 'string', enum: OPERATORS },
                            valor: { description: 'Texto, número, booleano, lista (para in/not-in/array-contains-any) ou {"timestamp": ISO}.' }
                        },
                        required: ['campo', 'valor']
                    }
                },
                ordenar_por: { type: 'string', description: 'Campo para ordenar. Combinar filtro de desigualdade com ordenação em outro campo pode exigir índice; se der erro, ordene só pelo campo filtrado.' },
                direcao: { type: 'string', enum: ['asc', 'desc'] },
                limite: { type: 'integer', description: `Padrão ${DB_LIMITS.defaultDocs}, máximo ${DB_LIMITS.maxDocs}.` },
                pular: { type: 'integer', description: `Quantos documentos pular (paginação), máximo ${DB_LIMITS.maxOffset}.` },
                campos: { type: 'array', items: { type: 'string' }, description: 'Devolver só estes campos (reduz o tamanho). Omita para trazer tudo.' }
            },
            required: ['colecao']
        }
    },
    {
        name: 'agregar',
        description: 'Conta documentos ou calcula soma/média de um campo numérico, com filtros opcionais, direto no banco (sem trazer os documentos). Ideal para totais e indicadores.',
        input_schema: {
            type: 'object',
            properties: {
                colecao: { type: 'string' },
                grupo_de_colecoes: { type: 'boolean' },
                filtros: { type: 'array', items: { type: 'object', properties: { campo: { type: 'string' }, operador: { type: 'string', enum: OPERATORS }, valor: {} }, required: ['campo', 'valor'] } },
                operacao: { type: 'string', enum: ['contagem', 'soma', 'media'] },
                campo: { type: 'string', description: 'Campo numérico (obrigatório para soma e média).' }
            },
            required: ['colecao', 'operacao']
        }
    }
];

/**
 * Cria o executor das ferramentas.
 * @param {{ db: object }} deps `db` é o Firestore (firebase-admin) ou um equivalente nos testes.
 * @returns {{ execute: (name: string, input: object) => Promise<{ text: string, resumo: string }> }}
 */
export const createDbTools = ({ db }) => {
    const json = (value) => JSON.stringify(value);

    const handlers = {
        listar_colecoes: async (input) => {
            const owner = input.documento ? db.doc(splitPath(input.documento, 'documento')) : db;
            const refs = await owner.listCollections();
            const colecoes = await Promise.all(refs.map(async (ref) => {
                try {
                    const snap = await ref.count().get();
                    return { colecao: ref.path, documentos: snap.data().count };
                } catch {
                    return { colecao: ref.path, documentos: null };
                }
            }));
            return { text: json({ colecoes }), resumo: `listou ${colecoes.length} coleções` };
        },

        ler_documento: async (input) => {
            const path = splitPath(input.caminho, 'documento');
            const snap = await db.doc(path).get();
            if (!snap.exists) return { text: json({ existe: false, caminho: path }), resumo: `${path} (não existe)` };
            return { text: json({ existe: true, ...toPlainDoc(snap) }), resumo: path };
        },

        consultar_colecao: async (input) => {
            let query = applyFilters(openQuery(db, input), input.filtros);
            if (input.ordenar_por) query = query.orderBy(String(input.ordenar_por), input.direcao === 'desc' ? 'desc' : 'asc');
            const limite = integerBetween(input.limite, 1, DB_LIMITS.maxDocs, DB_LIMITS.defaultDocs);
            const pular = integerBetween(input.pular, 0, DB_LIMITS.maxOffset, 0);
            if (pular) query = query.offset(pular);
            query = query.limit(limite);
            if (Array.isArray(input.campos) && input.campos.length) {
                query = query.select(...input.campos.slice(0, DB_LIMITS.maxFields).map(String));
            }

            const snap = await query.get();
            const documentos = [];
            let size = 0;
            let cortado = false;
            for (const doc of snap.docs) {
                const item = toPlainDoc(doc);
                const itemSize = json(item).length;
                if (size + itemSize > DB_LIMITS.maxResultChars) { cortado = true; break; }
                size += itemSize;
                documentos.push(item);
            }
            const out = {
                colecao: input.colecao,
                retornados: documentos.length,
                pode_haver_mais: snap.size >= limite || cortado,
                ...(cortado ? { aviso: 'Resultado cortado pelo tamanho. Use "campos", filtros ou "limite" menores e "pular" para continuar.' } : {}),
                documentos
            };
            return { text: json(out), resumo: `${input.colecao} (${documentos.length} docs)` };
        },

        agregar: async (input) => {
            const query = applyFilters(openQuery(db, input), input.filtros);
            const operacao = String(input.operacao);
            let resultado;
            if (operacao === 'contagem') {
                resultado = (await query.count().get()).data().count;
            } else if (operacao === 'soma' || operacao === 'media') {
                const campo = String(input.campo ?? '').trim();
                if (!campo) throw new Error('"campo" é obrigatório para soma e média.');
                const aggregate = operacao === 'soma' ? AggregateField.sum(campo) : AggregateField.average(campo);
                resultado = (await query.aggregate({ valor: aggregate }).get()).data().valor;
            } else {
                throw new Error('Operação inválida. Use contagem, soma ou media.');
            }
            return {
                text: json({ colecao: input.colecao, operacao, campo: input.campo ?? null, resultado }),
                resumo: `${operacao} em ${input.colecao}`
            };
        }
    };

    return {
        execute: async (name, input = {}) => {
            const handler = Object.hasOwn(handlers, name) ? handlers[name] : null;
            if (!handler) throw new Error(`Ferramenta desconhecida: ${name}`);
            return handler(input && typeof input === 'object' ? input : {});
        }
    };
};

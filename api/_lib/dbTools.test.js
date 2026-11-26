import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { createDbTools, serialize, isSensitiveKey, TOOL_DEFINITIONS, DB_LIMITS } from './dbTools.js';

// Falso Firestore: guarda tudo em memória e registra as chamadas. Qualquer método de escrita derruba o teste.
const makeDb = (data) => {
    const calls = [];
    const snapOf = (path, fields) => ({
        id: path.split('/').pop(), ref: { path }, exists: fields !== undefined, data: () => fields
    });
    const forbidden = (name) => () => { throw new Error(`escrita proibida: ${name}`); };
    const makeQuery = (path, state = { filters: [] }) => {
        const query = {
            where: (campo, operador, valor) => { calls.push(['where', campo, operador, valor]); return makeQuery(path, { ...state, filters: [...state.filters, [campo, operador, valor]] }); },
            orderBy: (campo, dir) => { calls.push(['orderBy', campo, dir]); return makeQuery(path, { ...state, order: [campo, dir] }); },
            offset: (n) => makeQuery(path, { ...state, offset: n }),
            limit: (n) => makeQuery(path, { ...state, limit: n }),
            select: (...fields) => { calls.push(['select', ...fields]); return makeQuery(path, { ...state, select: fields }); },
            get: async () => {
                let docs = Object.entries(data[path] || {}).map(([id, fields]) => snapOf(`${path}/${id}`, fields));
                for (const [campo, op, valor] of state.filters) {
                    if (op === '==') docs = docs.filter(d => d.data()[campo] === valor);
                }
                docs = docs.slice(state.offset || 0, (state.offset || 0) + (state.limit ?? docs.length));
                return { docs, size: docs.length };
            },
            count: () => ({ get: async () => ({ data: () => ({ count: Object.keys(data[path] || {}).length }) }) }),
            aggregate: (spec) => ({ get: async () => ({ data: () => ({ valor: Object.values(data[path] || {}).reduce((s, d) => s + (d.nota || 0), 0) }), spec }) }),
            add: forbidden('add'), set: forbidden('set'), update: forbidden('update'), delete: forbidden('delete')
        };
        return query;
    };
    const db = {
        calls,
        collection: (path) => makeQuery(path),
        collectionGroup: (name) => makeQuery(`group:${name}`),
        doc: (path) => ({
            get: async () => {
                const idx = path.lastIndexOf('/');
                return snapOf(path, (data[path.slice(0, idx)] || {})[path.slice(idx + 1)]);
            },
            listCollections: async () => [{ path: `${path}/sub`, count: () => ({ get: async () => ({ data: () => ({ count: 2 }) }) }) }],
            set: forbidden('set'), update: forbidden('update'), delete: forbidden('delete')
        }),
        listCollections: async () => Object.keys(data).map(path => ({ path, count: () => ({ get: async () => ({ data: () => ({ count: Object.keys(data[path]).length }) }) }) })),
        batch: forbidden('batch'), runTransaction: forbidden('runTransaction')
    };
    return db;
};

const sample = {
    collaborators: {
        a1: { name: 'Ana', role: 'Gestor', nota: 8, password: 'x', createdAt: Timestamp.fromDate(new Date('2026-11-10T12:00:00Z')) },
        b2: { name: 'Bruno', role: 'Operacional', nota: 6, discord: { webhookUrl: 'https://hook', ok: true } }
    },
    weekly_evaluations: { e1: { colabId: 'a1', score: 90 } }
};

describe('serialize', () => {
    it('datas viram ISO, referências viram caminho e segredos ficam ocultos', () => {
        const out = serialize({
            quando: Timestamp.fromDate(new Date('2026-11-10T12:00:00Z')),
            ref: { path: 'collaborators/a1', firestore: {} },
            senha: 'abc', nested: { apiKey: 'k', ok: 1 }, lista: [{ token: 't', x: 2 }], vazio: null
        });
        expect(out).toEqual({
            quando: '2026-11-10T12:00:00.000Z', ref: 'ref:collaborators/a1',
            senha: '[oculto]', nested: { apiKey: '[oculto]', ok: 1 }, lista: [{ token: '[oculto]', x: 2 }], vazio: null
        });
    });

    it('corta textos enormes e estruturas muito fundas', () => {
        expect(serialize('a'.repeat(DB_LIMITS.maxStringChars + 50))).toMatch(/texto cortado/);
        let deep = { v: 1 };
        for (let i = 0; i < 12; i += 1) deep = { n: deep };
        expect(JSON.stringify(serialize(deep))).toContain('aninhado demais');
    });

    it('isSensitiveKey reconhece nomes de segredo em português e inglês', () => {
        for (const key of ['password', 'senha', 'authToken', 'fcmTokens', 'private_key', 'apiKey', 'webhookUrl', 'client_secret']) expect(isSensitiveKey(key)).toBe(true);
        for (const key of ['name', 'role', 'email', 'score', 'status']) expect(isSensitiveKey(key)).toBe(false);
    });
});

describe('ferramentas', () => {
    const tools = () => createDbTools({ db: makeDb(sample) });

    it('só existem ferramentas de leitura', () => {
        expect(TOOL_DEFINITIONS.map(t => t.name)).toEqual(['listar_colecoes', 'ler_documento', 'consultar_colecao', 'agregar']);
    });

    it('listar_colecoes traz o total de cada coleção e aceita um documento para as subcoleções', async () => {
        const root = JSON.parse((await tools().execute('listar_colecoes', {})).text);
        expect(root.colecoes).toEqual([{ colecao: 'collaborators', documentos: 2 }, { colecao: 'weekly_evaluations', documentos: 1 }]);
        const sub = JSON.parse((await tools().execute('listar_colecoes', { documento: 'collaborators/a1' })).text);
        expect(sub.colecoes[0].colecao).toBe('collaborators/a1/sub');
    });

    it('ler_documento devolve o documento com segredos ocultos e avisa quando não existe', async () => {
        const found = JSON.parse((await tools().execute('ler_documento', { caminho: 'collaborators/a1' })).text);
        expect(found).toMatchObject({ existe: true, id: 'a1', caminho: 'collaborators/a1' });
        expect(found.dados).toMatchObject({ name: 'Ana', password: '[oculto]', createdAt: '2026-11-10T12:00:00.000Z' });
        const missing = JSON.parse((await tools().execute('ler_documento', { caminho: 'collaborators/zzz' })).text);
        expect(missing.existe).toBe(false);
    });

    it('caminhos inválidos são recusados', async () => {
        await expect(tools().execute('ler_documento', { caminho: 'collaborators' })).rejects.toThrow(/documento válido/);
        await expect(tools().execute('consultar_colecao', { colecao: 'collaborators/a1' })).rejects.toThrow(/coleção válido/);
        await expect(tools().execute('ler_documento', { caminho: '' })).rejects.toThrow();
        await expect(tools().execute('ler_documento', { caminho: 'a/../b' })).rejects.toThrow();
    });

    it('consultar_colecao filtra, limita, ordena e projeta campos', async () => {
        const db = makeDb(sample);
        const { execute } = createDbTools({ db });
        const out = JSON.parse((await execute('consultar_colecao', {
            colecao: 'collaborators',
            filtros: [{ campo: 'role', operador: '==', valor: 'Gestor' }],
            ordenar_por: 'name', direcao: 'desc', limite: 5, campos: ['name', 'role']
        })).text);
        expect(out.retornados).toBe(1);
        expect(out.documentos[0]).toMatchObject({ id: 'a1', caminho: 'collaborators/a1' });
        expect(out.documentos[0].dados.password).toBe('[oculto]');
        expect(db.calls).toEqual(expect.arrayContaining([['where', 'role', '==', 'Gestor'], ['orderBy', 'name', 'desc'], ['select', 'name', 'role']]));
    });

    it('filtro com data {"timestamp"} vira Timestamp do Firestore e data inválida é recusada', async () => {
        const db = makeDb(sample);
        const { execute } = createDbTools({ db });
        await execute('consultar_colecao', { colecao: 'collaborators', filtros: [{ campo: 'createdAt', operador: '>=', valor: { timestamp: '2026-11-01T00:00:00-03:00' } }] });
        const where = db.calls.find(c => c[0] === 'where');
        expect(where[3]).toBeInstanceOf(Timestamp);
        await expect(execute('consultar_colecao', { colecao: 'collaborators', filtros: [{ campo: 'createdAt', operador: '>=', valor: { timestamp: 'ontem' } }] })).rejects.toThrow(/Data inválida/);
    });

    it('operador desconhecido, filtros demais e limite fora da faixa', async () => {
        const { execute } = tools();
        await expect(execute('consultar_colecao', { colecao: 'collaborators', filtros: [{ campo: 'a', operador: 'LIKE', valor: 1 }] })).rejects.toThrow(/inválido/);
        const many = Array.from({ length: DB_LIMITS.maxFilters + 1 }, () => ({ campo: 'a', operador: '==', valor: 1 }));
        await expect(execute('consultar_colecao', { colecao: 'collaborators', filtros: many })).rejects.toThrow(/No máximo/);
        const out = JSON.parse((await execute('consultar_colecao', { colecao: 'collaborators', limite: 99999, pular: -5 })).text);
        expect(out.retornados).toBe(2);
    });

    it('resultado grande é cortado e avisa como continuar', async () => {
        const big = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`d${i}`, { texto: 'x'.repeat(2900), n: i }]));
        const { execute } = createDbTools({ db: makeDb({ relatos: big }) });
        const out = JSON.parse((await execute('consultar_colecao', { colecao: 'relatos', limite: 300 })).text);
        expect(out.retornados).toBeLessThan(40);
        expect(out.pode_haver_mais).toBe(true);
        expect(out.aviso).toMatch(/pular/);
        expect(JSON.stringify(out).length).toBeLessThan(DB_LIMITS.maxResultChars + 2000);
    });

    it('grupo_de_colecoes exige só o nome da subcoleção', async () => {
        const { execute } = tools();
        await expect(execute('consultar_colecao', { colecao: 'a/b', grupo_de_colecoes: true })).rejects.toThrow(/sem "\/"/);
        await expect(execute('consultar_colecao', { colecao: 'comments', grupo_de_colecoes: true })).resolves.toBeTruthy();
    });

    it('agregar: contagem, soma e erros de uso', async () => {
        const { execute } = tools();
        expect(JSON.parse((await execute('agregar', { colecao: 'collaborators', operacao: 'contagem' })).text).resultado).toBe(2);
        expect(JSON.parse((await execute('agregar', { colecao: 'collaborators', operacao: 'soma', campo: 'nota' })).text).resultado).toBe(14);
        await expect(execute('agregar', { colecao: 'collaborators', operacao: 'soma' })).rejects.toThrow(/campo/);
        await expect(execute('agregar', { colecao: 'collaborators', operacao: 'mediana' })).rejects.toThrow(/Operação inválida/);
    });

    it('ferramenta desconhecida (inclusive de escrita) é recusada', async () => {
        const { execute } = tools();
        await expect(execute('gravar_documento', {})).rejects.toThrow(/desconhecida/);
        await expect(execute('constructor', {})).rejects.toThrow(/desconhecida/);
        await expect(execute('__proto__', {})).rejects.toThrow(/desconhecida/);
    });
});

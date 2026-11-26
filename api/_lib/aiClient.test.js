import { describe, it, expect, beforeEach } from 'vitest';
import { buildMessages, textOf, runWithTools, getAiClient, AI_BUDGET } from './aiClient.js';
import { resetWorkingModel } from './aiModels.js';

beforeEach(() => resetWorkingModel());

const text = (t) => ({ type: 'text', text: t });
const toolUse = (id, name, input) => ({ type: 'tool_use', id, name, input });

// Falso cliente: responde na ordem de `script`; guarda uma cópia dos pedidos
const makeAi = (script) => {
    const requests = [];
    let i = 0;
    return {
        requests,
        messages: {
            create: async (params) => {
                requests.push(JSON.parse(JSON.stringify(params)));
                const next = script[Math.min(i, script.length - 1)];
                i += 1;
                if (next instanceof Error) throw next;
                return next;
            }
        }
    };
};

describe('buildMessages', () => {
    it('começa em "user", alterna os papéis e termina na pergunta', () => {
        const out = buildMessages([
            { role: 'assistant', content: 'Olá!' },
            { role: 'user', content: 'a' },
            { role: 'user', content: 'b' },
            { role: 'assistant', content: '   ' },
            { role: 'assistant', content: 'c' }
        ], 'pergunta');
        expect(out).toEqual([
            { role: 'user', content: 'a\n\nb' },
            { role: 'assistant', content: 'c' },
            { role: 'user', content: 'pergunta' }
        ]);
    });

    it('sem histórico, só a pergunta', () => {
        expect(buildMessages([], 'oi')).toEqual([{ role: 'user', content: 'oi' }]);
    });
});

describe('textOf', () => {
    it('junta só os blocos de texto', () => {
        expect(textOf({ content: [text('Olá '), toolUse('1', 'x', {}), text('mundo')] })).toBe('Olá mundo');
        expect(textOf({})).toBe('');
    });
});

describe('getAiClient', () => {
    it('sem chave válida devolve a falha explicada', () => {
        expect(getAiClient({}).failure).toMatchObject({ error: 'chave-nao-configurada' });
        expect(getAiClient({ ANTHROPIC_API_KEY: 'AIzaxxxxxxxxxxxxxxxxxxxxxxxxxxxx' }).failure).toMatchObject({ error: 'chave-formato-invalido' });
        expect(getAiClient({ ANTHROPIC_API_KEY: `sk-ant-api03-${'a'.repeat(40)}` }).ai).toBeTruthy();
    });
});

describe('runWithTools', () => {
    const base = { system: 'sys', messages: [{ role: 'user', content: 'quantos colaboradores?' }] };

    it('sem pedido de ferramenta, responde direto', async () => {
        const ai = makeAi([{ content: [text('Dois.')], stop_reason: 'end_turn' }]);
        const out = await runWithTools({ ...base, ai, tools: [], execute: undefined });
        expect(out.text).toBe('Dois.');
        expect(out.consultas).toEqual([]);
        expect(ai.requests[0].tools).toBeUndefined();
    });

    it('executa a ferramenta, devolve o resultado ao modelo e usa a resposta final', async () => {
        const ai = makeAi([
            { content: [text('Vou consultar.'), toolUse('t1', 'agregar', { colecao: 'collaborators', operacao: 'contagem' })], stop_reason: 'tool_use' },
            { content: [text('São 2 colaboradores.')], stop_reason: 'end_turn' }
        ]);
        const seen = [];
        const out = await runWithTools({
            ...base, ai, tools: [{ name: 'agregar' }],
            execute: async (name, input) => { seen.push([name, input]); return { text: '{"resultado":2}', resumo: 'contagem em collaborators' }; }
        });
        expect(seen).toEqual([['agregar', { colecao: 'collaborators', operacao: 'contagem' }]]);
        expect(out.text).toBe('São 2 colaboradores.');
        expect(out.consultas).toEqual(['contagem em collaborators']);
        // segundo pedido: pergunta, resposta do modelo com tool_use e o tool_result correspondente
        const second = ai.requests[1].messages;
        expect(second[1].role).toBe('assistant');
        expect(second[2]).toEqual({ role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: '{"resultado":2}' }] });
    });

    it('erro da ferramenta volta ao modelo como is_error para ele corrigir a consulta', async () => {
        const ai = makeAi([
            { content: [toolUse('t1', 'consultar_colecao', { colecao: 'x' })], stop_reason: 'tool_use' },
            { content: [text('Não consegui ler.')], stop_reason: 'end_turn' }
        ]);
        const out = await runWithTools({ ...base, ai, tools: [{ name: 'consultar_colecao' }], execute: async () => { throw new Error('índice ausente'); } });
        const result = ai.requests[1].messages[2].content[0];
        expect(result).toMatchObject({ type: 'tool_result', tool_use_id: 't1', is_error: true });
        expect(result.content).toMatch(/índice ausente/);
        expect(out.consultas).toEqual(['consultar_colecao: falhou']);
    });

    it('várias ferramentas na mesma rodada são respondidas juntas', async () => {
        const ai = makeAi([
            { content: [toolUse('a', 'agregar', {}), toolUse('b', 'agregar', {})], stop_reason: 'tool_use' },
            { content: [text('ok')], stop_reason: 'end_turn' }
        ]);
        await runWithTools({ ...base, ai, tools: [{ name: 'agregar' }], execute: async () => ({ text: '1', resumo: 'r' }) });
        expect(ai.requests[1].messages[2].content.map(r => r.tool_use_id)).toEqual(['a', 'b']);
    });

    it('limite de rodadas: pede o fechamento sem novas consultas (tool_choice none)', async () => {
        const loop = { content: [toolUse('t', 'agregar', {})], stop_reason: 'tool_use' };
        const ai = makeAi([loop, loop, { content: [text('Resumo parcial.')], stop_reason: 'end_turn' }]);
        const out = await runWithTools({
            ...base, ai, tools: [{ name: 'agregar' }], execute: async () => ({ text: '1', resumo: 'r' }),
            budget: { ...AI_BUDGET, maxRounds: 2 }
        });
        expect(out.text).toBe('Resumo parcial.');
        const last = ai.requests[2];
        expect(last.tool_choice).toEqual({ type: 'none' });
        expect(last.tools).toBeTruthy(); // a API exige a lista quando há tool_use no histórico
        const closing = last.messages[last.messages.length - 1];
        expect(closing.role).toBe('user');
        expect(JSON.stringify(closing.content)).toMatch(/limite de consultas ou de tempo/);
    });

    it('pouco tempo restante também encerra as consultas', async () => {
        let clock = 0;
        const loop = { content: [toolUse('t', 'agregar', {})], stop_reason: 'tool_use' };
        const ai = makeAi([loop, { content: [text('fim')], stop_reason: 'end_turn' }]);
        const out = await runWithTools({
            ...base, ai, tools: [{ name: 'agregar' }], now: () => clock,
            execute: async () => { clock += AI_BUDGET.totalMs - 1000; return { text: '1', resumo: 'r' }; }
        });
        expect(out.text).toBe('fim');
        expect(ai.requests).toHaveLength(2);
        expect(ai.requests[1].tool_choice).toEqual({ type: 'none' });
    });

    it('envia o prompt de sistema e o limite de tokens', async () => {
        const ai = makeAi([{ content: [text('x')], stop_reason: 'end_turn' }]);
        await runWithTools({ ...base, ai, maxTokens: 777 });
        expect(ai.requests[0]).toMatchObject({ system: 'sys', max_tokens: 777 });
    });
});

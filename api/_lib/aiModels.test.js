import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_MODELS, cleanModelName, getModelCandidates, generateWithFallback, resetWorkingModel, getWorkingModel } from './aiModels.js';

const sdkError = (code, status, message) => Object.assign(
    new Error(JSON.stringify({ error: { code, message, status } })),
    { name: 'ApiError', status: code }
);
const notFound = (model) => sdkError(404, 'NOT_FOUND', `This model models/${model} is no longer available to new users.`);

// Falso "ai": cada modelo responde com o que está em `behaviors` (texto ou erro)
const makeAi = (behaviors) => {
    const calls = [];
    return {
        calls,
        models: {
            generateContent: async (params) => {
                calls.push({ model: params.model, hasThinking: Boolean(params.config?.thinkingConfig) });
                const behavior = behaviors[params.model];
                if (behavior instanceof Error) throw behavior;
                return { text: behavior ?? 'ok' };
            }
        }
    };
};

const request = { contents: [{ role: 'user', parts: [{ text: 'oi' }] }], config: { temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } } };

beforeEach(() => resetWorkingModel());

describe('lista de modelos', () => {
    it('cleanModelName aceita nomes seguros e o prefixo models/', () => {
        expect(cleanModelName('gemini-3.8-flash')).toBe('gemini-3.8-flash');
        expect(cleanModelName(' models/Gemini-3-Flash ')).toBe('gemini-3-flash');
        expect(cleanModelName('gemini flash')).toBe('');
        expect(cleanModelName('../../etc/passwd')).toBe('');
        expect(cleanModelName('')).toBe('');
        expect(cleanModelName(undefined)).toBe('');
    });

    it('GEMINI_MODEL vem primeiro, sem repetir e ignorando valor inválido', () => {
        expect(getModelCandidates({})).toEqual(DEFAULT_MODELS);
        expect(getModelCandidates({ GEMINI_MODEL: 'gemini-9-pro' })).toEqual(['gemini-9-pro', ...DEFAULT_MODELS]);
        expect(getModelCandidates({ GEMINI_MODEL: DEFAULT_MODELS[1] })[0]).toBe(DEFAULT_MODELS[1]);
        expect(new Set(getModelCandidates({ GEMINI_MODEL: DEFAULT_MODELS[1] })).size).toBe(DEFAULT_MODELS.length);
        expect(getModelCandidates({ GEMINI_MODEL: 'valor inválido!' })).toEqual(DEFAULT_MODELS);
    });
});

describe('generateWithFallback', () => {
    it('usa o primeiro modelo quando ele responde', async () => {
        const ai = makeAi({});
        const { response, model } = await generateWithFallback({ ai, request });
        expect(model).toBe(DEFAULT_MODELS[0]);
        expect(response.text).toBe('ok');
        expect(ai.calls).toHaveLength(1);
        expect(getWorkingModel()).toBe(DEFAULT_MODELS[0]);
    });

    it('pula modelos aposentados (404) e lembra o que funcionou', async () => {
        const skipped = [];
        const ai = makeAi({ [DEFAULT_MODELS[0]]: notFound(DEFAULT_MODELS[0]), [DEFAULT_MODELS[1]]: notFound(DEFAULT_MODELS[1]) });
        const result = await generateWithFallback({ ai, request, onModelSkipped: (m) => skipped.push(m) });
        expect(result.model).toBe(DEFAULT_MODELS[2]);
        expect(skipped).toEqual([DEFAULT_MODELS[0], DEFAULT_MODELS[1]]);

        // na próxima chamada começa direto pelo que funcionou
        const ai2 = makeAi({});
        await generateWithFallback({ ai: ai2, request });
        expect(ai2.calls[0].model).toBe(DEFAULT_MODELS[2]);
    });

    it('GEMINI_MODEL é tentado antes dos padrões', async () => {
        const ai = makeAi({});
        const { model } = await generateWithFallback({ ai, request, env: { GEMINI_MODEL: 'gemini-9-pro' } });
        expect(model).toBe('gemini-9-pro');
    });

    it('se todos estiverem indisponíveis, sobe o último erro para a rota explicar', async () => {
        const behaviors = Object.fromEntries(DEFAULT_MODELS.map(m => [m, notFound(m)]));
        await expect(generateWithFallback({ ai: makeAi(behaviors), request })).rejects.toThrow(/no longer available/);
    });

    it('outros erros (cota, chave) não trocam de modelo', async () => {
        const ai = makeAi({ [DEFAULT_MODELS[0]]: sdkError(429, 'RESOURCE_EXHAUSTED', 'quota exceeded') });
        await expect(generateWithFallback({ ai, request })).rejects.toThrow(/quota/);
        expect(ai.calls).toHaveLength(1);
    });

    it('modelo que recusa thinkingConfig é repetido sem esse parâmetro', async () => {
        let first = true;
        const ai = {
            calls: [],
            models: {
                generateContent: async (params) => {
                    ai.calls.push({ model: params.model, hasThinking: Boolean(params.config?.thinkingConfig) });
                    if (first) {
                        first = false;
                        throw sdkError(400, 'INVALID_ARGUMENT', 'Unknown name "thinkingBudget": Cannot find field. thinking_config is not supported');
                    }
                    return { text: 'ok' };
                }
            }
        };
        const { model } = await generateWithFallback({ ai, request });
        expect(model).toBe(DEFAULT_MODELS[0]);
        expect(ai.calls).toEqual([
            { model: DEFAULT_MODELS[0], hasThinking: true },
            { model: DEFAULT_MODELS[0], hasThinking: false }
        ]);
    });
});

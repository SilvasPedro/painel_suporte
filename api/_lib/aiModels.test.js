import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_MODELS, cleanModelName, getModelCandidates, generateWithFallback, resetWorkingModel, getWorkingModel } from './aiModels.js';

const sdkError = (status, type, message) => Object.assign(
    new Error(`${status} ${JSON.stringify({ type: 'error', error: { type, message } })}`),
    { name: 'APIError', status, error: { type: 'error', error: { type, message } } }
);
const notFound = (model) => sdkError(404, 'not_found_error', `model: ${model}`);

// Falso cliente: cada modelo responde com o que está em `behaviors` (texto ou erro)
const makeAi = (behaviors) => {
    const calls = [];
    return {
        calls,
        messages: {
            create: async (params, options) => {
                calls.push({ model: params.model, options });
                const behavior = behaviors[params.model];
                if (behavior instanceof Error) throw behavior;
                return { content: [{ type: 'text', text: behavior ?? 'ok' }], stop_reason: 'end_turn' };
            }
        }
    };
};

const request = { max_tokens: 100, messages: [{ role: 'user', content: 'oi' }] };

beforeEach(() => resetWorkingModel());

describe('lista de modelos', () => {
    it('cleanModelName aceita nomes seguros', () => {
        expect(cleanModelName('claude-sonnet-5-5')).toBe('claude-sonnet-5-5');
        expect(cleanModelName(' Claude-Haiku-5-5 ')).toBe('claude-haiku-5-5');
        expect(cleanModelName('claude sonnet')).toBe('');
        expect(cleanModelName('../../etc/passwd')).toBe('');
        expect(cleanModelName('')).toBe('');
        expect(cleanModelName(undefined)).toBe('');
    });

    it('ANTHROPIC_MODEL vem primeiro, sem repetir e ignorando valor inválido', () => {
        expect(getModelCandidates({})).toEqual(DEFAULT_MODELS);
        expect(getModelCandidates({ ANTHROPIC_MODEL: 'claude-opus-5-5' })).toEqual(['claude-opus-5-5', ...DEFAULT_MODELS]);
        expect(getModelCandidates({ ANTHROPIC_MODEL: DEFAULT_MODELS[1] })[0]).toBe(DEFAULT_MODELS[1]);
        expect(new Set(getModelCandidates({ ANTHROPIC_MODEL: DEFAULT_MODELS[1] })).size).toBe(DEFAULT_MODELS.length);
        expect(getModelCandidates({ ANTHROPIC_MODEL: 'valor inválido!' })).toEqual(DEFAULT_MODELS);
    });
});

describe('generateWithFallback', () => {
    it('usa o primeiro modelo quando ele responde e repassa as opções da chamada', async () => {
        const ai = makeAi({});
        const { response, model } = await generateWithFallback({ ai, request, requestOptions: { timeout: 1234 } });
        expect(model).toBe(DEFAULT_MODELS[0]);
        expect(response.content[0].text).toBe('ok');
        expect(ai.calls).toHaveLength(1);
        expect(ai.calls[0].options).toEqual({ timeout: 1234 });
        expect(getWorkingModel()).toBe(DEFAULT_MODELS[0]);
    });

    it('pula modelo indisponível (404) e lembra o que funcionou', async () => {
        const skipped = [];
        const ai = makeAi({ [DEFAULT_MODELS[0]]: notFound(DEFAULT_MODELS[0]) });
        const result = await generateWithFallback({ ai, request, onModelSkipped: (m) => skipped.push(m) });
        expect(result.model).toBe(DEFAULT_MODELS[1]);
        expect(skipped).toEqual([DEFAULT_MODELS[0]]);

        // na próxima chamada começa direto pelo que funcionou
        const ai2 = makeAi({});
        await generateWithFallback({ ai: ai2, request });
        expect(ai2.calls[0].model).toBe(DEFAULT_MODELS[1]);
    });

    it('ANTHROPIC_MODEL é tentado antes dos padrões', async () => {
        const ai = makeAi({});
        const { model } = await generateWithFallback({ ai, request, env: { ANTHROPIC_MODEL: 'claude-opus-5-5' } });
        expect(model).toBe('claude-opus-5-5');
    });

    it('se todos estiverem indisponíveis, sobe o último erro para a rota explicar', async () => {
        const behaviors = Object.fromEntries(DEFAULT_MODELS.map(m => [m, notFound(m)]));
        await expect(generateWithFallback({ ai: makeAi(behaviors), request })).rejects.toThrow(/model:/);
    });

    it('outros erros (limite, chave) não trocam de modelo', async () => {
        const ai = makeAi({ [DEFAULT_MODELS[0]]: sdkError(429, 'rate_limit_error', 'rate limit exceeded') });
        await expect(generateWithFallback({ ai, request })).rejects.toThrow(/rate limit/);
        expect(ai.calls).toHaveLength(1);
    });
});

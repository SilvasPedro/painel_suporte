/**
 * Escolha do modelo do Gemini.
 *
 * O Google aposenta modelos com frequência (o gemini-2.5-flash deixou de aceitar contas novas), então o
 * modelo não fica mais fixo no código:
 *  1. GEMINI_MODEL (variável na Vercel) vale primeiro, se existir;
 *  2. depois a lista padrão, do mais novo para o mais antigo;
 *  3. se um modelo responde "não disponível" (404), a rota tenta o próximo e lembra qual funcionou.
 */

import { classifyGeminiError } from './aiErrors.js';

export const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3-flash', 'gemini-2.5-flash'];

// Nome de modelo seguro: letras minúsculas, números, ponto, hífen e sublinhado (aceita o prefixo "models/")
const MODEL_NAME = /^[a-z0-9][a-z0-9._-]{1,60}$/;

export const cleanModelName = (value) => {
    const name = String(value || '').trim().replace(/^models\//, '').toLowerCase();
    return MODEL_NAME.test(name) ? name : '';
};

/** Modelos a tentar, em ordem, sem repetir. */
export const getModelCandidates = (env = {}) => {
    const list = [cleanModelName(env.GEMINI_MODEL), ...DEFAULT_MODELS].filter(Boolean);
    return [...new Set(list)];
};

let workingModel = '';
export const resetWorkingModel = () => { workingModel = ''; };
export const getWorkingModel = () => workingModel;

const isThinkingRejection = (error) => {
    const failure = classifyGeminiError(error);
    return failure.error === 'pedido-recusado' && /thinking/i.test(`${error?.message || ''} ${failure.detail}`);
};

const withoutThinking = (config = {}) => {
    const { thinkingConfig, ...rest } = config; // eslint-disable-line no-unused-vars
    return rest;
};

/**
 * Chama generateContent com o primeiro modelo disponível.
 * - 404 ("modelo não disponível"): passa para o próximo da lista.
 * - 400 por causa de thinkingConfig (modelos novos mudam esse parâmetro): repete o mesmo modelo sem ele.
 * Outros erros sobem para a rota, que os explica ao usuário.
 * @returns {Promise<{ response: object, model: string }>}
 */
export const generateWithFallback = async ({ ai, request, env = {}, onModelSkipped = () => {} }) => {
    const candidates = getModelCandidates(env);
    // começa pelo modelo que já funcionou nesta instância, se ele ainda estiver na lista
    const ordered = workingModel && candidates.includes(workingModel)
        ? [workingModel, ...candidates.filter(m => m !== workingModel)]
        : candidates;

    let lastError = null;
    for (const model of ordered) {
        let config = request.config;
        for (let attempt = 0; attempt < 2; attempt += 1) {
            try {
                const response = await ai.models.generateContent({ ...request, model, config });
                workingModel = model;
                return { response, model };
            } catch (error) {
                lastError = error;
                if (attempt === 0 && config?.thinkingConfig && isThinkingRejection(error)) {
                    config = withoutThinking(config);
                    continue;
                }
                if (classifyGeminiError(error).error === 'modelo-indisponivel') {
                    onModelSkipped(model, error);
                    break; // próximo modelo
                }
                throw error;
            }
        }
    }
    throw lastError;
};

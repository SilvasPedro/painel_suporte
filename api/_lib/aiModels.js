/**
 * Escolha do modelo do Claude.
 *
 * Modelos são aposentados com o tempo, então o modelo não fica fixo no código:
 *  1. ANTHROPIC_MODEL (variável na Vercel) vale primeiro, se existir;
 *  2. depois a lista padrão, do mais capaz para o mais rápido;
 *  3. se um modelo responde "não encontrado" (404), a rota tenta o próximo e lembra qual funcionou.
 */

import { classifyAiError } from './aiErrors.js';

export const DEFAULT_MODELS = ['claude-sonnet-5-5', 'claude-haiku-5-5'];

// Nome de modelo seguro: letras minúsculas, números, ponto, hífen e sublinhado
const MODEL_NAME = /^[a-z0-9][a-z0-9._-]{1,80}$/;

export const cleanModelName = (value) => {
    const name = String(value || '').trim().toLowerCase();
    return MODEL_NAME.test(name) ? name : '';
};

/** Modelos a tentar, em ordem, sem repetir. */
export const getModelCandidates = (env = {}) => {
    const list = [cleanModelName(env.ANTHROPIC_MODEL), ...DEFAULT_MODELS].filter(Boolean);
    return [...new Set(list)];
};

let workingModel = '';
export const resetWorkingModel = () => { workingModel = ''; };
export const getWorkingModel = () => workingModel;

/**
 * Chama messages.create com o primeiro modelo disponível.
 * - 404 ("modelo não encontrado"): passa para o próximo da lista.
 * Outros erros sobem para a rota, que os explica ao usuário.
 * @returns {Promise<{ response: object, model: string }>}
 */
export const generateWithFallback = async ({ ai, request, requestOptions, env = {}, onModelSkipped = () => {} }) => {
    const candidates = getModelCandidates(env);
    // começa pelo modelo que já funcionou nesta instância, se ele ainda estiver na lista
    const ordered = workingModel && candidates.includes(workingModel)
        ? [workingModel, ...candidates.filter(m => m !== workingModel)]
        : candidates;

    let lastError = null;
    for (const model of ordered) {
        try {
            const response = await ai.messages.create({ ...request, model }, requestOptions);
            workingModel = model;
            return { response, model };
        } catch (error) {
            lastError = error;
            if (classifyAiError(error).error === 'modelo-indisponivel') {
                onModelSkipped(model, error);
                continue; // próximo modelo
            }
            throw error;
        }
    }
    throw lastError;
};

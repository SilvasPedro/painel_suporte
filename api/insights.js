import { GoogleGenAI } from '@google/genai';
import { authorizeAiRequest, validateInsightsBody, sendGuardError } from './_lib/aiGuard.js';
import { buildInsightsPrompts } from './_lib/aiPrompts.js';
import { generateWithFallback } from './_lib/aiModels.js';
import { classifyGeminiError, emptyReplyError, errorBody, sanitizeDetail, inspectApiKey } from './_lib/aiErrors.js';

let aiInstance = null;
let aiInstanceKey = '';

// Só a variável do servidor: qualquer variável VITE_* vai para o código público do site.
// O valor é conferido antes de usar (aspas curvas, espaços e texto junto à chave quebram a chamada).
function getAI() {
  const inspected = inspectApiKey(process.env.GEMINI_API_KEY);
  if (!inspected.ok) return { failure: inspected };
  if (!aiInstance || aiInstanceKey !== inspected.key) {
    aiInstance = new GoogleGenAI({ apiKey: inspected.key });
    aiInstanceKey = inspected.key;
  }
  return { ai: aiInstance };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  // Permitir apenas requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  // Login, perfil da gestão e limite de uso antes de gastar a cota da IA
  const guard = await authorizeAiRequest({ req, env: process.env });
  if (!guard.ok) return sendGuardError(res, guard);

  const parsed = validateInsightsBody(req.body);
  if (!parsed.ok) return res.status(parsed.status).json({ error: 'pedido-invalido', message: parsed.error });
  const { dadosColaborador, periodo, tipoAnalise } = parsed.value;

  const { ai, failure: keyFailure } = getAI();
  if (!ai) {
    return res.status(503).json(errorBody({ ...keyFailure, retryable: false }));
  }

  try {
    const { systemPrompt, userPrompt } = buildInsightsPrompts({ dadosColaborador, periodo, tipoAnalise });

    const { response } = await generateWithFallback({
      ai,
      env: process.env,
      onModelSkipped: (model) => console.warn(`Modelo ${model} indisponível; tentando o próximo.`),
      request: {
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2,
          maxOutputTokens: 1000,
          thinkingConfig: { thinkingBudget: 0 }
        }
      }
    });

    const insights = (response.text || '').trim();
    if (!insights) {
      const failure = emptyReplyError(response);
      return res.status(failure.httpStatus).json(errorBody(failure));
    }
    return res.status(200).json({ insights });

  } catch (error) {
    const failure = classifyGeminiError(error);
    console.error('Erro na rota de insights (Gemini):', failure.error, sanitizeDetail(error?.message, 400));
    return res.status(failure.httpStatus).json(errorBody(failure));
  }
}

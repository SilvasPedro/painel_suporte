import { authorizeAiRequest, validateInsightsBody, sendGuardError } from './_lib/aiGuard.js';
import { buildInsightsPrompts } from './_lib/aiPrompts.js';
import { generateWithFallback } from './_lib/aiModels.js';
import { classifyAiError, emptyReplyError, errorBody, sanitizeDetail } from './_lib/aiErrors.js';
import { getAiClient, textOf } from './_lib/aiClient.js';

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

  const { ai, failure: keyFailure } = getAiClient(process.env);
  if (!ai) {
    return res.status(503).json(errorBody({ ...keyFailure, retryable: false }));
  }

  try {
    const { systemPrompt, userPrompt } = buildInsightsPrompts({ dadosColaborador, periodo, tipoAnalise });

    const { response } = await generateWithFallback({
      ai,
      env: process.env,
      onModelSkipped: (model) => console.warn(`Modelo ${model} indisponível; tentando o próximo.`),
      requestOptions: { timeout: 50000 },
      request: {
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 1500
      }
    });

    const insights = textOf(response);
    if (!insights) {
      const failure = emptyReplyError(response);
      return res.status(failure.httpStatus).json(errorBody(failure));
    }
    return res.status(200).json({ insights });

  } catch (error) {
    const failure = classifyAiError(error);
    console.error('Erro na rota de insights (Claude):', failure.error, sanitizeDetail(error?.message, 400));
    return res.status(failure.httpStatus).json(errorBody(failure));
  }
}

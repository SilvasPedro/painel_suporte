import { authorizeAiRequest, validateChatBody, sendGuardError } from './_lib/aiGuard.js';
import { buildChatSystemPrompt } from './_lib/aiPrompts.js';
import { classifyAiError, emptyReplyError, errorBody, sanitizeDetail } from './_lib/aiErrors.js';
import { getAiClient, buildMessages, runWithTools } from './_lib/aiClient.js';
import { getAiReaderDb } from './_lib/adminDb.js';
import { createDbTools, TOOL_DEFINITIONS } from './_lib/dbTools.js';

// Conexão de leitura com o banco; sem conta de serviço, o chat segue só com os dados de contexto
function getDbTools() {
  try {
    const db = getAiReaderDb(process.env);
    return db ? createDbTools({ db }) : null;
  } catch (error) {
    console.error('Banco indisponível para a IA:', sanitizeDetail(error?.message, 200));
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  // Login, perfil da gestão e limite de uso antes de gastar a cota da IA
  const guard = await authorizeAiRequest({ req, env: process.env });
  if (!guard.ok) return sendGuardError(res, guard);

  const parsed = validateChatBody(req.body);
  if (!parsed.ok) return res.status(parsed.status).json({ error: 'pedido-invalido', message: parsed.error });
  const { message, history, contextData } = parsed.value;

  const { ai, failure: keyFailure } = getAiClient(process.env);
  if (!ai) {
    return res.status(503).json(errorBody({ ...keyFailure, retryable: false }));
  }

  try {
    const dbTools = getDbTools();
    const { response, text, consultas } = await runWithTools({
      ai,
      env: process.env,
      onModelSkipped: (model) => console.warn(`Modelo ${model} indisponível; tentando o próximo.`),
      // cache_control: o contexto e as instruções são reaproveitados nas perguntas seguintes (mais rápido e barato)
      system: [{ type: 'text', text: buildChatSystemPrompt({ contextData, dbAvailable: Boolean(dbTools) }), cache_control: { type: 'ephemeral' } }],
      messages: buildMessages(history, message),
      tools: dbTools ? TOOL_DEFINITIONS : [],
      execute: dbTools ? dbTools.execute : undefined,
      maxTokens: 3500
    });

    if (!text) {
      const failure = emptyReplyError(response);
      return res.status(failure.httpStatus).json(errorBody(failure));
    }
    return res.status(200).json({ reply: text, consultas });

  } catch (error) {
    const failure = classifyAiError(error);
    // O motivo completo fica nos logs da Vercel (sem chaves) e o resumo vai para a tela
    console.error('Erro na rota de chat (Claude):', failure.error, sanitizeDetail(error?.message, 400));
    return res.status(failure.httpStatus).json(errorBody(failure));
  }
}

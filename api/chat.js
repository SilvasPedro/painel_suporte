import { GoogleGenAI } from '@google/genai';
import { authorizeAiRequest, validateChatBody, sendGuardError } from './_lib/aiGuard.js';
import { buildChatSystemPrompt } from './_lib/aiPrompts.js';
import { classifyGeminiError, emptyReplyError, errorBody, sanitizeDetail } from './_lib/aiErrors.js';

let aiInstance = null;
function getAI() {
  // Só a variável do servidor: qualquer variável VITE_* vai para o código público do site
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return null;
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
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

  const ai = getAI();
  if (!ai) {
    return res.status(503).json(errorBody({
      error: 'chave-nao-configurada',
      message: 'A chave da IA ainda não foi configurada no servidor. Crie a variável GEMINI_API_KEY na Vercel (sem prefixo VITE_) e faça um novo deploy.',
      detail: 'GEMINI_API_KEY ausente',
      retryable: false
    }));
  }

  try {
    const formattedHistory = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...formattedHistory,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: buildChatSystemPrompt({ contextData }),
        temperature: 0.2,
        maxOutputTokens: 1200,
        thinkingConfig: { thinkingBudget: 0 } // respostas curtas e rápidas, sem gastar o limite pensando
      }
    });

    const reply = (response.text || '').trim();
    if (!reply) {
      const failure = emptyReplyError(response);
      return res.status(failure.httpStatus).json(errorBody(failure));
    }
    return res.status(200).json({ reply });

  } catch (error) {
    const failure = classifyGeminiError(error);
    // O motivo completo fica nos logs da Vercel (sem chaves) e o resumo vai para a tela
    console.error('Erro na rota de chat (Gemini):', failure.error, sanitizeDetail(error?.message, 400));
    return res.status(failure.httpStatus).json(errorBody(failure));
  }
}

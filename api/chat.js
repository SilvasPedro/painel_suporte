import { GoogleGenAI } from '@google/genai';

let aiInstance = null;
function getAI() {
 const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { message, history, contextData } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Nenhuma mensagem fornecida.' });
    }

    const ai = getAI();
    if (!ai) {
      return res.status(200).json({
        reply: "⚠️ *Aviso*: A variável de ambiente `GEMINI_API_KEY` não está configurada. Por favor, adicione sua chave de API para habilitar o chat com a IA."
      });
    }

    const systemPrompt = `
Você é o assistente inteligente do painel Hubdesk.
Você ajuda os gestores a analisar dados de suporte técnico, KPIs e escalas.
Responda de forma clara, prestativa e objetiva.
Use os seguintes dados de contexto (se fornecidos) para basear suas respostas:
${contextData ? JSON.stringify(contextData, null, 2) : 'Nenhum dado de contexto fornecido no momento.'}
    `;

    // Converte o histórico garantindo um fallback seguro para a string de texto
    const formattedHistory = (history || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content || msg.text || '' }]
    }));

    // String atualizada para contornar o bloqueio de novas chaves
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite", 
      contents: [
        ...formattedHistory,
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
      }
    });

    return res.status(200).json({ reply: response.text });

  } catch (error) {
    console.error('Erro na rota de chat (Gemini):', error);
    return res.status(500).json({ 
      error: 'Falha ao processar a mensagem com a IA.' 
    });
  }
}

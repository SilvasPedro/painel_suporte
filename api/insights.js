import { GoogleGenAI } from '@google/genai';

// Instância a SDK do Gemini com a chave salva de forma segura nas variáveis de ambiente da Vercel
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  // Permitir apenas requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido. Use POST.' });
  }

  try {
    const { dadosColaborador, periodo, tipoAnalise } = req.body;

    if (!dadosColaborador) {
      return res.status(400).json({ error: 'Nenhum dado fornecido para análise.' });
    }

    // Prompt do sistema estruturado para o contexto do painel de suporte
    const systemPrompt = `
      Você é um assistente especialista em análise de desempenho e produtividade de equipes de suporte ao cliente.
      Analise os dados fornecidos e gere um diagnóstico sucinto, construtivo e profissional.
      Estruture sua resposta em Markdown contendo:
      - 📌 **Destaques Positivos**
      - ⚠️ **Pontos de Atenção / Gargalos**
      - 💡 **Recomendações Práticas**
    `;

    const userPrompt = `
      Período da Análise: ${periodo || 'Recente'}
      Tipo de Consulta: ${tipoAnalise || 'Geral'}
      
      Dados de Desempenho do Colaborador/Equipe:
      ${JSON.stringify(dadosColaborador, null, 2)}
    `;

    // Chamada usando o modelo gemini-2.5-flash (rápido e altamente eficiente)
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2, // Temperatura baixa para respostas coerentes e objetivas
      }
    });

    return res.status(200).json({ insights: response.text });

  } catch (error) {
    console.error('Erro na Vercel API Route (Gemini):', error);
    return res.status(500).json({ 
      error: 'Falha ao processar os insights de desempenho com a IA.' 
    });
  }
}

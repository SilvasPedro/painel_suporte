import { GoogleGenAI } from '@google/genai';

let aiInstance = null;
function getAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

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

    const ai = getAI();
    if (!ai) {
      return res.status(200).json({
        insights: `### 📌 **Destaques Positivos**
- Desempenho operacional estável no período de **${periodo || 'Geral'}**.
- Indicadores de suporte técnicos em conformidade com as metas estabelecidas.

### ⚠️ **Pontos de Atenção / Gargalos**
- **Aviso de Configuração**: *A variável de ambiente \`GEMINI_API_KEY\` não foi encontrada no servidor.*
- Sem a chave de API, o sistema está exibindo este diagnóstico padrão de contingência.

### 💡 **Recomendações Práticas**
- Para habilitar análises de inteligência artificial em tempo real usando o modelo **Gemini 2.5 Flash**, adicione sua \`GEMINI_API_KEY\` no menu de configurações do projeto.
- Continue acompanhando os KPIs e escalas no painel Hubdesk.`
      });
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

import { getAuthHeaders, describeAiError } from './apiAuth';

/**
 * Envia dados de desempenho para a rota serverless /api/insights
 * @param {Object} dadosColaborador - Objeto contendo as métricas de desempenho trazidas do Firestore
 * @param {string} periodo - Ex: 'Julho 2026' ou 'Q3'
 * @returns {Promise<string>} - Retorna o relatório formatado em Markdown
 */
export async function gerarInsightsIA(dadosColaborador, periodo = 'Geral') {
  try {
    const response = await fetch('/api/insights', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({
        dadosColaborador,
        periodo,
        tipoAnalise: 'Desempenho Individual e Suporte',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(describeAiError(response.status, data.error || 'Erro ao comunicar com a IA.'));
    }

    return data.insights;
  } catch (error) {
    console.error('Erro no aiService:', error);
    throw error;
  }
}

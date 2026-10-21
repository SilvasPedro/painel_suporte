/**
 * MOTOR CENTRAL DE CÁLCULO DE PONTUAÇÃO E DESEMPENHO (DRY - Single Source of Truth)
 *
 * Fórmula Oficial HubDesk:
 * - Atendimentos Finalizados: +1 pt
 * - Ligações Atendidas: +2 pts
 * - Atendimentos Huggy: +1 pt
 * - Ligações Perdidas: -5 pts
 */

export const SCORING_WEIGHTS = {
    FINALIZADOS: 1,
    LIGACOES_ATENDIDAS: 2,
    ATENDIMENTOS_HUGGY: 1,
    LIGACOES_PERDIDAS: -5
};

/**
 * Normaliza e extrai número seguro a partir de string ou número
 */
const safeNumber = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
};

/**
 * Calcula a pontuação total a partir de um objeto de avaliação ou métricas semanais
 * @param {Object} item Objeto contendo os dados de atendimento
 * @returns {number} Pontuação inteira calculada
 */
export const calculatePerformanceScore = (item = {}) => {
    if (!item) return 0;

    // Se já tiver pontuação calculada e for válida no registro, pode ser priorizada se especificado
    const finalizados = safeNumber(item.Atendimentos_Finalizados ?? item.finalizados);
    const ligAtendidas = safeNumber(item.Ligacoes_Atendidas ?? item.atendidas);
    const huggy = safeNumber(item.Atendimentos_Huggy ?? item.huggy);
    const ligPerdidas = safeNumber(item.Ligacoes_Perdidas ?? item.perdidas);

    return (finalizados * SCORING_WEIGHTS.FINALIZADOS) +
           (ligAtendidas * SCORING_WEIGHTS.LIGACOES_ATENDIDAS) +
           (huggy * SCORING_WEIGHTS.ATENDIMENTOS_HUGGY) +
           (ligPerdidas * SCORING_WEIGHTS.LIGACOES_PERDIDAS);
};

/**
 * Retorna o detalhamento ponto a ponto para tooltips, relatórios e auditorias
 */
export const calculateScoreBreakdown = (item = {}) => {
    const finalizados = safeNumber(item.Atendimentos_Finalizados ?? item.finalizados);
    const ligAtendidas = safeNumber(item.Ligacoes_Atendidas ?? item.atendidas);
    const huggy = safeNumber(item.Atendimentos_Huggy ?? item.huggy);
    const ligPerdidas = safeNumber(item.Ligacoes_Perdidas ?? item.perdidas);

    const ptsFinalizados = finalizados * SCORING_WEIGHTS.FINALIZADOS;
    const ptsLigAtendidas = ligAtendidas * SCORING_WEIGHTS.LIGACOES_ATENDIDAS;
    const ptsHuggy = huggy * SCORING_WEIGHTS.ATENDIMENTOS_HUGGY;
    const ptsLigPerdidas = ligPerdidas * SCORING_WEIGHTS.LIGACOES_PERDIDAS;

    return {
        finalizados,
        ligAtendidas,
        huggy,
        ligPerdidas,
        ptsFinalizados,
        ptsLigAtendidas,
        ptsHuggy,
        ptsLigPerdidas,
        total: ptsFinalizados + ptsLigAtendidas + ptsHuggy + ptsLigPerdidas
    };
};

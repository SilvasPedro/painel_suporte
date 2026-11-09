/**
 * MOTOR CENTRAL DE CÁLCULO DE PONTUAÇÃO E DESEMPENHO (DRY - Single Source of Truth)
 *
 * Fórmula Oficial HubDesk:
 * - Atendimentos Finalizados: +1 pt
 * - Ligações Atendidas: +2 pts
 * - Ligações Realizadas: +1 pt
 * - Huggy: % de aproveitamento (Finalizados ÷ Iniciados, inteiro, máx. 100%) × 0,5 pt por 1%
 *   (registros antigos, com apenas Atendimentos_Huggy, mantêm +1 pt por atendimento)
 * - Ligações Perdidas: -5 pts
 */

export const SCORING_WEIGHTS = {
    FINALIZADOS: 1,
    LIGACOES_ATENDIDAS: 2,
    LIGACOES_REALIZADAS: 1,
    ATENDIMENTOS_HUGGY: 1, // legado: registros anteriores à separação Iniciados x Finalizados
    HUGGY_PONTOS_POR_PERCENTUAL: 0.5,
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
 * Estatísticas do Huggy (chat) de uma avaliação.
 * - Novo formato (Huggy_Iniciados / Huggy_Finalizados): aproveitamento = finalizados ÷ iniciados,
 *   inteiro (arredonda para baixo) e limitado a 100%; vale 0,5 pt por 1%. Sem iniciados, 0%.
 * - Formato legado (apenas Atendimentos_Huggy): +1 pt por atendimento, sem percentual.
 */
export const getHuggyStats = (item = {}) => {
    const rawIni = item?.Huggy_Iniciados ?? item?.huggyIniciados;
    const rawFin = item?.Huggy_Finalizados ?? item?.huggyFinalizados;
    const hasNew = (rawIni !== undefined && rawIni !== null) || (rawFin !== undefined && rawFin !== null);

    if (hasNew) {
        const iniciados = safeNumber(rawIni);
        const finalizados = safeNumber(rawFin);
        const percentual = iniciados > 0
            ? Math.min(100, Math.floor((finalizados * 100) / iniciados + 1e-9))
            : 0;
        return {
            legado: false,
            iniciados,
            finalizados,
            volume: finalizados,
            percentual,
            pontos: percentual * SCORING_WEIGHTS.HUGGY_PONTOS_POR_PERCENTUAL
        };
    }

    const volume = safeNumber(item?.Atendimentos_Huggy ?? item?.huggyVol ?? item?.huggy);
    return {
        legado: true,
        iniciados: null,
        finalizados: volume,
        volume,
        percentual: null,
        pontos: volume * SCORING_WEIGHTS.ATENDIMENTOS_HUGGY
    };
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
    const huggyPontos = getHuggyStats(item).pontos;
    const ligPerdidas = safeNumber(item.Ligacoes_Perdidas ?? item.perdidas);
    const ligRealizadas = safeNumber(item.Ligacoes_Realizadas ?? item.realizadas);

    return (finalizados * SCORING_WEIGHTS.FINALIZADOS) +
           (ligAtendidas * SCORING_WEIGHTS.LIGACOES_ATENDIDAS) +
           (ligRealizadas * SCORING_WEIGHTS.LIGACOES_REALIZADAS) +
           huggyPontos +
           (ligPerdidas * SCORING_WEIGHTS.LIGACOES_PERDIDAS);
};

/**
 * Retorna o detalhamento ponto a ponto para tooltips, relatórios e auditorias
 */
export const calculateScoreBreakdown = (item = {}) => {
    const finalizados = safeNumber(item.Atendimentos_Finalizados ?? item.finalizados);
    const ligAtendidas = safeNumber(item.Ligacoes_Atendidas ?? item.atendidas);
    const huggyStats = getHuggyStats(item);
    const huggy = huggyStats.volume;
    const ligPerdidas = safeNumber(item.Ligacoes_Perdidas ?? item.perdidas);
    const ligRealizadas = safeNumber(item.Ligacoes_Realizadas ?? item.realizadas);

    const ptsFinalizados = finalizados * SCORING_WEIGHTS.FINALIZADOS;
    const ptsLigAtendidas = ligAtendidas * SCORING_WEIGHTS.LIGACOES_ATENDIDAS;
    const ptsLigRealizadas = ligRealizadas * SCORING_WEIGHTS.LIGACOES_REALIZADAS;
    const ptsHuggy = huggyStats.pontos;
    const ptsLigPerdidas = ligPerdidas * SCORING_WEIGHTS.LIGACOES_PERDIDAS;

    return {
        finalizados,
        ligAtendidas,
        huggy,
        huggyIniciados: huggyStats.iniciados,
        huggyFinalizados: huggyStats.finalizados,
        huggyPercentual: huggyStats.percentual,
        huggyLegado: huggyStats.legado,
        ligPerdidas,
        ligRealizadas,
        ptsFinalizados,
        ptsLigAtendidas,
        ptsLigRealizadas,
        ptsHuggy,
        ptsLigPerdidas,
        total: ptsFinalizados + ptsLigAtendidas + ptsLigRealizadas + ptsHuggy + ptsLigPerdidas
    };
};

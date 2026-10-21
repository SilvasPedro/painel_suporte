import { describe, it, expect } from 'vitest';
import { calculatePerformanceScore, calculateScoreBreakdown, SCORING_WEIGHTS } from './scoringCalculations';

describe('calculatePerformanceScore', () => {
    it('deve calcular a pontuação corretamente usando os pesos padrão', () => {
        // finalizados: 10 * 1 = 10
        // ligAtendidas: 20 * 2 = 40
        // huggy: 15 * 1 = 15
        // ligPerdidas: 2 * -5 = -10
        // Total esperado = 10 + 40 + 15 - 10 = 55
        const evalData = {
            Atendimentos_Finalizados: 10,
            Ligacoes_Atendidas: 20,
            Atendimentos_Huggy: 15,
            Ligacoes_Perdidas: 2
        };

        const score = calculatePerformanceScore(evalData);
        expect(score).toBe(55);
    });

    it('deve suportar chaves alternativas (camelCase)', () => {
        const evalData = {
            finalizados: 5,
            atendidas: 10,
            huggy: 5,
            perdidas: 0
        };

        const score = calculatePerformanceScore(evalData);
        expect(score).toBe(5 * 1 + 10 * 2 + 5 * 1 + 0);
        expect(score).toBe(30);
    });

    it('deve lidar com valores nulos, vazios ou indefinidos sem quebrar', () => {
        expect(calculatePerformanceScore(null)).toBe(0);
        expect(calculatePerformanceScore({})).toBe(0);
        expect(calculatePerformanceScore({
            Atendimentos_Finalizados: '',
            Ligacoes_Atendidas: null,
            Atendimentos_Huggy: undefined,
            Ligacoes_Perdidas: 'invalid'
        })).toBe(0);
    });

    it('deve penalizar ligações perdidas mesmo se os outros campos forem 0', () => {
        const evalData = {
            Ligacoes_Perdidas: 4
        };
        expect(calculatePerformanceScore(evalData)).toBe(-20);
    });
});

describe('calculateScoreBreakdown', () => {
    it('deve retornar cada componente da fórmula detalhado', () => {
        const evalData = {
            Atendimentos_Finalizados: 8,
            Ligacoes_Atendidas: 12,
            Atendimentos_Huggy: 6,
            Ligacoes_Perdidas: 1
        };

        const breakdown = calculateScoreBreakdown(evalData);
        expect(breakdown.ptsFinalizados).toBe(8);
        expect(breakdown.ptsLigAtendidas).toBe(24);
        expect(breakdown.ptsHuggy).toBe(6);
        expect(breakdown.ptsLigPerdidas).toBe(-5);
        expect(breakdown.total).toBe(33);
    });
});

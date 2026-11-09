import { describe, it, expect } from 'vitest';
import { calculatePerformanceScore, calculateScoreBreakdown, getHuggyStats, SCORING_WEIGHTS } from './scoringCalculations';

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

describe('Ligações Realizadas (+1 pt)', () => {
    it('soma 1 ponto por ligação realizada na pontuação', () => {
        const evalData = {
            Atendimentos_Finalizados: 10,
            Ligacoes_Atendidas: 20,
            Ligacoes_Realizadas: 8,
            Atendimentos_Huggy: 15,
            Ligacoes_Perdidas: 2
        };
        // 10 + 40 + 8 + 15 - 10
        expect(calculatePerformanceScore(evalData)).toBe(63);
        expect(SCORING_WEIGHTS.LIGACOES_REALIZADAS).toBe(1);
    });

    it('registros antigos sem o campo continuam com a mesma pontuação', () => {
        const legacy = { Atendimentos_Finalizados: 10, Ligacoes_Atendidas: 20, Atendimentos_Huggy: 15, Ligacoes_Perdidas: 2 };
        expect(calculatePerformanceScore(legacy)).toBe(55);
    });

    it('aceita a chave alternativa e inclui o campo no extrato', () => {
        expect(calculatePerformanceScore({ realizadas: 7 })).toBe(7);
        const breakdown = calculateScoreBreakdown({ Ligacoes_Realizadas: 4, Ligacoes_Atendidas: 1 });
        expect(breakdown.ligRealizadas).toBe(4);
        expect(breakdown.ptsLigRealizadas).toBe(4);
        expect(breakdown.total).toBe(4 + 2);
    });
});

describe('Huggy: aproveitamento (Finalizados ÷ Iniciados) com 0,5 pt por 1%', () => {
    it('calcula o % inteiro (arredonda para baixo) e dá 0,5 pt por 1%', () => {
        // 50 finalizados de 60 iniciados = 83,33% -> 83% -> 41,5 pts
        const stats = getHuggyStats({ Huggy_Iniciados: 60, Huggy_Finalizados: 50 });
        expect(stats.percentual).toBe(83);
        expect(stats.pontos).toBe(41.5);
        expect(stats.legado).toBe(false);
        expect(stats.volume).toBe(50);
    });

    it('100% vale 50 pts e o percentual é limitado a 100%', () => {
        expect(getHuggyStats({ Huggy_Iniciados: 40, Huggy_Finalizados: 40 }).pontos).toBe(50);
        const over = getHuggyStats({ Huggy_Iniciados: 40, Huggy_Finalizados: 55 });
        expect(over.percentual).toBe(100);
        expect(over.pontos).toBe(50);
    });

    it('sem iniciados o aproveitamento é 0% (sem divisão por zero)', () => {
        const stats = getHuggyStats({ Huggy_Iniciados: 0, Huggy_Finalizados: 12 });
        expect(stats.percentual).toBe(0);
        expect(stats.pontos).toBe(0);
    });

    it('soma o aproveitamento à pontuação total e substitui o antigo +1 por atendimento', () => {
        const score = calculatePerformanceScore({
            Atendimentos_Finalizados: 10,
            Ligacoes_Atendidas: 20,
            Ligacoes_Realizadas: 8,
            Huggy_Iniciados: 50,
            Huggy_Finalizados: 40, // 80% = 40 pts
            Ligacoes_Perdidas: 2
        });
        // 10 + 40 + 8 + 40 - 10
        expect(score).toBe(88);
        const breakdown = calculateScoreBreakdown({ Huggy_Iniciados: 50, Huggy_Finalizados: 40 });
        expect(breakdown.huggyPercentual).toBe(80);
        expect(breakdown.ptsHuggy).toBe(40);
        expect(breakdown.total).toBe(40);
    });

    it('registros antigos (apenas Atendimentos_Huggy) mantêm +1 pt por atendimento', () => {
        const stats = getHuggyStats({ Atendimentos_Huggy: 15 });
        expect(stats.legado).toBe(true);
        expect(stats.percentual).toBeNull();
        expect(stats.pontos).toBe(15);
        expect(calculatePerformanceScore({ Atendimentos_Huggy: 15 })).toBe(15);
    });
});

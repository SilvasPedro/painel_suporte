import { describe, it, expect } from 'vitest';
import { normalizeEvals, weeklySeries, colabRanking, scoreDistribution, goalAdherence, normalizeGoals, weekOverWeek, deltaPct } from './dashboardAnalytics';

const colabs = { a: { id: 'a', name: 'Ana', shift: 'Tarde' }, b: { id: 'b', name: 'Bia', shift: 'Noturno', active: false } };
const evals = [
    { colabId: 'a', date: '2026-11-02', pontuacao: 100, Atendimentos_Finalizados: 50, Ligacoes_Atendidas: 9, Ligacoes_Perdidas: 1, TMA_Telefonia: '00:05:00' },
    { colabId: 'a', date: '2026-11-09', pontuacao: 120, Atendimentos_Finalizados: 60, Ligacoes_Atendidas: 10, Ligacoes_Perdidas: 0, TMA_Telefonia: '00:04:00' },
    { colabId: 'b', date: '2026-11-09', pontuacao: 999 },
];

describe('dashboardAnalytics', () => {
    const rows = normalizeEvals(evals, colabs);
    it('ignora colaboradores inativos', () => expect(rows).toHaveLength(2));
    it('agrega semanas e calcula taxa de perdidas', () => {
        const s = weeklySeries(rows);
        expect(s).toHaveLength(2);
        expect(s[0].lostRate).toBe(10);
        expect(weekOverWeek(s, 'avgScore').delta).toBeCloseTo(20);
    });
    it('ranking com tendência', () => {
        const r = colabRanking(rows);
        expect(r[0]).toMatchObject({ name: 'Ana', avgScore: 110, trend: 20 });
    });
    it('distribuição soma todas as avaliações', () => {
        expect(scoreDistribution(rows).reduce((s, b) => s + b.count, 0)).toBe(2);
    });
    it('aderência a metas', () => {
        const goals = normalizeGoals({ tmr: '00:20:00', fcr: 80, recurrence: 20 });
        const a = goalAdherence([{ tmr: 10, fcr: 90, recurrence: 10 }, { tmr: 25, fcr: 70, recurrence: 30 }], goals);
        expect(a.fcr).toMatchObject({ hits: 1, pct: 50, streak: 0, missStreak: 1 });
    });
    it('deltaPct sem base retorna null', () => expect(deltaPct(5, 0)).toBeNull());
});

import { describe, it, expect } from 'vitest';
import { 
    calculateUserLevel, 
    normalizeShiftName, 
    evaluateCollaboratorBadges,
    BADGES_CATALOG 
} from './userProfile';

describe('userProfile - calculateUserLevel', () => {
    it('deve retornar nível 1 se não houver emblemas', () => {
        expect(calculateUserLevel([])).toBe(1);
        expect(calculateUserLevel(null)).toBe(1);
        expect(calculateUserLevel(undefined)).toBe(1);
    });

    it('deve retornar o nível proporcional ao número de emblemas ativos', () => {
        expect(calculateUserLevel(['emblema_desempenho'])).toBe(1);
        expect(calculateUserLevel(['emblema_desempenho', 'emblema_auditorias'])).toBe(2);
        expect(calculateUserLevel(['b1', 'b2', 'b3', 'b4', 'b5'])).toBe(5);
        expect(calculateUserLevel(['b1', 'b2', 'b3', 'b4', 'b5', 'b6'])).toBe(6);
    });

    it('deve limitar o nível máximo em 6', () => {
        expect(calculateUserLevel(['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8'])).toBe(6);
    });
});

describe('userProfile - normalizeShiftName', () => {
    it('deve normalizar termos legados como Manhã e Noite', () => {
        expect(normalizeShiftName('Manhã')).toBe('Manhã I');
        expect(normalizeShiftName('Noite')).toBe('Noturno');
        expect(normalizeShiftName('Tarde I')).toBe('Tarde I');
    });

    it('deve retornar "Manhã I" como fallback para entradas vazias', () => {
        expect(normalizeShiftName('')).toBe('Manhã I');
        expect(normalizeShiftName(null)).toBe('Manhã I');
    });
});

describe('userProfile - evaluateCollaboratorBadges', () => {
    const mockColab = {
        id: 'colab_1',
        name: 'Carlos Silva',
        shift: 'Manhã I'
    };

    it('deve conceder emblema de auditorias quando conformidade for >= 85%', () => {
        const mockAudits = [
            { colabId: 'colab_1', status: 'Conforme' },
            { colabId: 'colab_1', status: 'Conforme' },
            { colabId: 'colab_1', status: 'Conforme' },
            { colabId: 'colab_1', status: 'Conforme' },
            { colabId: 'colab_1', status: 'Não Conforme' }, // 4/5 = 80% (abaixo)
        ];

        let result = evaluateCollaboratorBadges({
            collaborator: mockColab,
            weeklyEvaluations: [],
            qaAudits: mockAudits,
            thirdPartyAudits: [],
            allCollaborators: [mockColab]
        });

        expect(result.automatedMap.emblema_auditorias).toBe(false);
        expect(result.badgeDetails.emblema_auditorias.unlocked).toBe(false);

        // Adiciona mais conformes: 9/10 = 90% (acima de 85%)
        const mockAuditsHigh = [
            ...mockAudits,
            { colabId: 'colab_1', status: 'Conforme' },
            { colabId: 'colab_1', status: 'Conforme' },
            { colabId: 'colab_1', status: 'Conforme' },
            { colabId: 'colab_1', status: 'Conforme' },
            { colabId: 'colab_1', status: 'Conforme' }
        ];

        result = evaluateCollaboratorBadges({
            collaborator: mockColab,
            weeklyEvaluations: [],
            qaAudits: mockAuditsHigh,
            thirdPartyAudits: [],
            allCollaborators: [mockColab]
        });

        expect(result.automatedMap.emblema_auditorias).toBe(true);
        expect(result.activeBadges.includes('emblema_auditorias')).toBe(true);
    });

    it('deve conceder emblema Fila Limpa quando chamadas perdidas <= 2% das atendidas', () => {
        // 100 atendidas e 2 perdidas = 2.0% (<= 2%) => Ganha
        const evalsValid = [
            {
                colabId: 'colab_1',
                date: '2026-10-15',
                Ligacoes_Atendidas: 100,
                Ligacoes_Perdidas: 2,
                Atendimentos_Finalizados: 10
            }
        ];

        const resultValid = evaluateCollaboratorBadges({
            collaborator: mockColab,
            weeklyEvaluations: evalsValid,
            qaAudits: [],
            thirdPartyAudits: [],
            allCollaborators: [mockColab]
        });

        expect(resultValid.automatedMap.emblema_zero_perdidas).toBe(true);
        expect(resultValid.activeBadges.includes('emblema_zero_perdidas')).toBe(true);
    });

    it('não deve conceder emblema Fila Limpa se perdidas > 2%', () => {
        // 100 atendidas e 5 perdidas = 5.0% (> 2%) => Não ganha
        const evalsHigh = [
            {
                colabId: 'colab_1',
                date: '2026-10-15',
                Ligacoes_Atendidas: 100,
                Ligacoes_Perdidas: 5,
                Atendimentos_Finalizados: 10
            }
        ];

        const resultHigh = evaluateCollaboratorBadges({
            collaborator: mockColab,
            weeklyEvaluations: evalsHigh,
            qaAudits: [],
            thirdPartyAudits: [],
            allCollaborators: [mockColab]
        });

        expect(resultHigh.automatedMap.emblema_zero_perdidas).toBe(false);
        expect(resultHigh.activeBadges.includes('emblema_zero_perdidas')).toBe(false);
    });
});

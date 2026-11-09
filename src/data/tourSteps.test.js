import { describe, it, expect } from 'vitest';
import { getTourType, buildTourSteps, getTourStorageKey, TOUR_VERSION } from './tourSteps';
import { getRoleLabel, normalizeRole, ROLES } from '../services/rbac';

const allowAll = () => true;
const ids = (steps) => steps.map(s => s.id);

describe('getTourType', () => {
    it('Gestor, Supervisor e admin master recebem o tour de liderança', () => {
        expect(getTourType({ normalizedRole: 'gestor', isMasterAdmin: false })).toBe('leadership');
        expect(getTourType({ normalizedRole: 'supervisor', isMasterAdmin: false })).toBe('leadership');
        expect(getTourType({ normalizedRole: 'colaborador', isMasterAdmin: true })).toBe('leadership');
    });

    it('Operacional e Apoio recebem o tour operacional', () => {
        expect(getTourType({ normalizedRole: 'colaborador', isMasterAdmin: false })).toBe('operational');
        expect(getTourType({ normalizedRole: 'apoio', isMasterAdmin: false })).toBe('operational');
    });
});

describe('buildTourSteps', () => {
    it('começa com boas-vindas e termina com a conclusão, nos dois tours', () => {
        for (const type of ['operational', 'leadership']) {
            const steps = buildTourSteps(type, allowAll);
            expect(steps[0].id).toBe('welcome');
            expect(steps[steps.length - 1].id).toBe('finish');
            expect(steps[0].target).toBeUndefined();
        }
    });

    it('o tour de liderança cobre as telas de gestão; o operacional não', () => {
        const lead = ids(buildTourSteps('leadership', allowAll));
        const oper = ids(buildTourSteps('operational', allowAll));
        expect(lead).toEqual(expect.arrayContaining(['hub', 'audits', 'third_party_audits', 'settings', 'data_manager']));
        expect(oper).not.toContain('settings');
        expect(oper).not.toContain('audits');
        expect(oper).toEqual(expect.arrayContaining(['my_dashboard', 'my_history']));
    });

    it('só inclui telas que o usuário pode visualizar', () => {
        const onlyBasics = (moduleId) => ['rankings'].includes(moduleId);
        const steps = ids(buildTourSteps('operational', onlyBasics));
        expect(steps).toContain('rankings');
        expect(steps).not.toContain('reports');
        expect(steps).not.toContain('day_off_schedule');
    });

    it('todo passo com alvo aponta para um data-tour e ids são únicos', () => {
        for (const type of ['operational', 'leadership']) {
            const steps = buildTourSteps(type, allowAll);
            steps.filter(s => s.target).forEach(s => expect(s.target).toMatch(/^\[data-tour="[\w-]+"\]$/));
            expect(new Set(ids(steps)).size).toBe(steps.length);
        }
    });

    it('no celular resume as telas em um passo e só usa alvos visíveis', () => {
        const steps = buildTourSteps('leadership', allowAll, true);
        expect(ids(steps)).toContain('screens-summary');
        expect(ids(steps)).toContain('mobile-menu');
        const targets = steps.filter(s => s.target).map(s => s.target);
        expect(targets.some(t => t.includes('nav-'))).toBe(false);
        expect(targets.some(t => t.includes('sidebar'))).toBe(false);
    });
});

describe('persistência do tour', () => {
    it('a chave local é por usuário e por versão', () => {
        expect(getTourStorageKey('abc')).toBe(`hubdesk_tour_v${TOUR_VERSION}_abc`);
        expect(getTourStorageKey('abc')).not.toBe(getTourStorageKey('xyz'));
    });
});

describe('cargo Operacional', () => {
    it('exibe Operacional para registros antigos "Colaborador" e vazios', () => {
        expect(getRoleLabel('Colaborador')).toBe('Operacional');
        expect(getRoleLabel('colaborador')).toBe('Operacional');
        expect(getRoleLabel('Operacional')).toBe('Operacional');
        expect(getRoleLabel('')).toBe('Operacional');
        expect(getRoleLabel(undefined)).toBe('Operacional');
    });

    it('preserva cargos fora do padrão e os demais cargos', () => {
        expect(getRoleLabel('NOC')).toBe('NOC');
        expect(getRoleLabel('Gestor')).toBe('Gestor');
    });

    it('mantém o id interno colaborador, com o nome de exibição Operacional', () => {
        expect(normalizeRole('Operacional')).toBe('colaborador');
        expect(normalizeRole('Colaborador')).toBe('colaborador');
        expect(ROLES.find(r => r.id === 'colaborador').label).toBe('Operacional');
    });
});

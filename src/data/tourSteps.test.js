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

    it('Qualidade recebe o tour de qualidade; o admin master segue com o de liderança', () => {
        expect(getTourType({ normalizedRole: 'qualidade', isMasterAdmin: false })).toBe('quality');
        expect(getTourType({ normalizedRole: 'qualidade', isMasterAdmin: true })).toBe('leadership');
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

describe('tour de Qualidade', () => {
    it('apresenta os módulos e avisa que o acesso é somente de visualização', () => {
        const steps = buildTourSteps('quality', allowAll);
        const list = ids(steps);
        expect(steps[0].id).toBe('welcome');
        expect(steps[0].body).toMatch(/somente para visualização/);
        expect(list).toContain('quality-readonly');
        expect(steps.find(s => s.id === 'quality-readonly').body).toMatch(/não cria, edita nem exclui/);
        expect(list).toEqual(expect.arrayContaining(['dashboard', 'audits', 'third_party_audits', 'reports', 'settings']));
        expect(list[list.length - 1]).toBe('finish');
        expect(steps[steps.length - 1].body).toMatch(/somente de visualização/);
    });

    it('todo módulo apresentado leva o selo de somente visualização', () => {
        const modules = buildTourSteps('quality', allowAll).filter(s => s.target && s.target.includes('nav-'));
        expect(modules.length).toBeGreaterThan(5);
        modules.forEach(s => expect(s.badge).toBe('Somente visualização'));
    });

    it('só inclui módulos que o usuário pode visualizar e mantém ids únicos e alvos válidos', () => {
        const steps = buildTourSteps('quality', (m) => ['audits', 'rankings'].includes(m));
        expect(ids(steps)).toEqual(expect.arrayContaining(['audits', 'rankings']));
        expect(ids(steps)).not.toContain('settings');
        const all = buildTourSteps('quality', allowAll);
        expect(new Set(ids(all)).size).toBe(all.length);
        all.filter(s => s.target).forEach(s => expect(s.target).toMatch(/^\[data-tour="[\w-]+"\]$/));
    });

    it('no celular resume os módulos em um passo e mantém o aviso de visualização', () => {
        const steps = buildTourSteps('quality', allowAll, true);
        expect(ids(steps)).toEqual(expect.arrayContaining(['mobile-menu', 'quality-readonly', 'screens-summary']));
        expect(steps.filter(s => s.target).some(s => s.target.includes('nav-'))).toBe(false);
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

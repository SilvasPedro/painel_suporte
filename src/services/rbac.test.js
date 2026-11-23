import { describe, it, expect } from 'vitest';

// O módulo importa o Firestore apenas para persistir a matriz; nos testes só usamos a parte pura.
import { vi } from 'vitest';
vi.mock('./firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn() }));
vi.mock('./dataCache', () => ({ subscribeSharedDocument: vi.fn(), getCachedDocument: vi.fn() }));

const {
    ROLES,
    ACCESS_LEVEL_IDS,
    DEFAULT_ROLE_PERMISSIONS,
    SYSTEM_MODULES,
    resolveAccessLevel,
    getAccessLevelInfo,
    normalizeRole
} = await import('./rbac');

describe('níveis de acesso', () => {
    it('expõe os cinco níveis com os rótulos oficiais', () => {
        expect(ROLES.map(r => r.label)).toEqual(['Supervisor', 'Líder', 'Apoio', 'Operacional', 'Qualidade']);
        expect(ACCESS_LEVEL_IDS).toEqual(['gestor', 'supervisor', 'apoio', 'colaborador', 'qualidade']);
    });

    it('mantém Operacional no índice 3 (usado por fallback em MyProfile)', () => {
        expect(ROLES[3].id).toBe('colaborador');
    });

    it('usa o accessLevel quando válido, independente do cargo digitado', () => {
        expect(resolveAccessLevel({ accessLevel: 'apoio', role: 'Gestor' })).toBe('apoio');
        expect(resolveAccessLevel({ accessLevel: 'qualidade', role: 'Supervisor de Operações' })).toBe('qualidade');
        expect(resolveAccessLevel({ accessLevel: 'supervisor', role: 'Analista' })).toBe('supervisor');
    });

    it('sem accessLevel (ou inválido) deriva o nível do cargo, como antes da migração', () => {
        expect(resolveAccessLevel({ role: 'Gestor' })).toBe('gestor');
        expect(resolveAccessLevel({ role: 'Admin' })).toBe('gestor');
        expect(resolveAccessLevel({ role: 'Supervisor' })).toBe('supervisor');
        expect(resolveAccessLevel({ role: 'Apoio' })).toBe('apoio');
        expect(resolveAccessLevel({ role: 'Analista de Suporte' })).toBe('colaborador');
        expect(resolveAccessLevel({ accessLevel: 'inexistente', role: 'Apoio' })).toBe('apoio');
        expect(resolveAccessLevel(null)).toBe('colaborador');
    });

    it('o cargo "Qualidade" sozinho NÃO concede o nível Qualidade (só o accessLevel explícito)', () => {
        expect(normalizeRole('Analista de Qualidade')).toBe('colaborador');
        expect(resolveAccessLevel({ role: 'Qualidade' })).toBe('colaborador');
    });

    it('getAccessLevelInfo devolve o rótulo do nível', () => {
        expect(getAccessLevelInfo({ accessLevel: 'gestor' }).label).toBe('Supervisor');
        expect(getAccessLevelInfo({ role: 'Supervisor' }).label).toBe('Líder');
    });
});

describe('matriz padrão de permissões', () => {
    const moduleIds = Object.keys(DEFAULT_ROLE_PERMISSIONS.gestor);

    it('define todos os módulos para todos os níveis', () => {
        SYSTEM_MODULES.forEach(mod => {
            ACCESS_LEVEL_IDS.forEach(level => {
                expect(DEFAULT_ROLE_PERMISSIONS[level][mod.id], `${level}/${mod.id}`).toBeDefined();
            });
        });
    });

    it('Supervisor tem acesso total', () => {
        moduleIds.forEach(id => {
            expect(DEFAULT_ROLE_PERMISSIONS.gestor[id]).toEqual({ view: true, edit: true });
        });
    });

    it('Líder não vê Configurações nem Gestão de Dados', () => {
        expect(DEFAULT_ROLE_PERMISSIONS.supervisor.settings.view).toBe(false);
        expect(DEFAULT_ROLE_PERMISSIONS.supervisor.data_manager.view).toBe(false);
        expect(DEFAULT_ROLE_PERMISSIONS.supervisor.hub.edit).toBe(true);
    });

    it('Qualidade vê todas as telas e não edita nada além do próprio perfil', () => {
        moduleIds.forEach(id => {
            expect(DEFAULT_ROLE_PERMISSIONS.qualidade[id].view, `${id} view`).toBe(true);
            expect(DEFAULT_ROLE_PERMISSIONS.qualidade[id].edit, `${id} edit`).toBe(id === 'my_profile');
        });
    });

    it('Operacional não acessa telas de gestão', () => {
        ['hub', 'settings', 'data_manager', 'audits', 'metrics'].forEach(id => {
            expect(DEFAULT_ROLE_PERMISSIONS.colaborador[id].view).toBe(false);
        });
    });
});

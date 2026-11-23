import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

let mockUser = null;
vi.mock('./AuthContext', () => ({ useAuth: () => ({ currentUser: mockUser }) }));
vi.mock('../services/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(), setDoc: vi.fn() }));
vi.mock('../services/dataCache', () => ({ subscribeSharedDocument: vi.fn(() => () => {}), getCachedDocument: vi.fn() }));

const { PermissionsProvider, usePermissions } = await import('./PermissionsContext');

// renderToString não roda efeitos: vale a matriz padrão (DEFAULT_ROLE_PERMISSIONS)
const capabilities = (user) => {
    mockUser = user;
    let result;
    const Probe = () => {
        const p = usePermissions();
        result = {
            level: p.normalizedRole,
            readOnly: p.isReadOnlyLevel,
            manageTeam: p.canManageTeam,
            view: (m) => p.canView(m),
            edit: (m) => p.canEdit(m)
        };
        return null;
    };
    renderToString(<PermissionsProvider><Probe /></PermissionsProvider>);
    return result;
};

describe('PermissionsContext com níveis de acesso', () => {
    it('Supervisor edita tudo e gerencia a equipe', () => {
        const c = capabilities({ accessLevel: 'gestor', role: 'Analista de Suporte' });
        expect(c.level).toBe('gestor');
        expect(c.manageTeam).toBe(true);
        expect(c.edit('settings')).toBe(true);
        expect(c.edit('data_manager')).toBe(true);
    });

    it('Líder não gerencia a equipe nem acessa Configurações e Gestão de Dados', () => {
        const c = capabilities({ accessLevel: 'supervisor', role: 'Gestor' });
        expect(c.level).toBe('supervisor');
        expect(c.manageTeam).toBe(false);
        expect(c.view('settings')).toBe(false);
        expect(c.view('data_manager')).toBe(false);
        expect(c.edit('hub')).toBe(true);
    });

    it('Qualidade vê tudo e não edita nada, mesmo com cargo de Gestor', () => {
        const c = capabilities({ accessLevel: 'qualidade', role: 'Gestor de Qualidade' });
        expect(c.level).toBe('qualidade');
        expect(c.readOnly).toBe(true);
        expect(c.manageTeam).toBe(false);
        ['hub', 'settings', 'data_manager', 'reports', 'audits', 'DailyQueueTracker', 'orgchart'].forEach(m => {
            expect(c.view(m), `view ${m}`).toBe(true);
            expect(c.edit(m), `edit ${m}`).toBe(false);
        });
        expect(c.edit('my_profile')).toBe(true);
    });

    it('Apoio edita a demanda diária, mas não vê Configurações', () => {
        const c = capabilities({ accessLevel: 'apoio', role: 'Analista' });
        expect(c.edit('DailyQueueTracker')).toBe(true);
        expect(c.view('settings')).toBe(false);
        expect(c.manageTeam).toBe(false);
    });

    it('Operacional não acessa a demanda diária nem o Hub', () => {
        const c = capabilities({ accessLevel: 'colaborador', role: 'Apoio' });
        expect(c.level).toBe('colaborador');
        expect(c.view('DailyQueueTracker')).toBe(false);
        expect(c.view('hub')).toBe(false);
    });

    it('sem accessLevel deriva do cargo (usuários ainda não migrados)', () => {
        expect(capabilities({ role: 'Gestor' }).level).toBe('gestor');
        expect(capabilities({ role: 'Supervisor' }).level).toBe('supervisor');
        expect(capabilities({ role: 'Apoio' }).level).toBe('apoio');
        expect(capabilities({ role: 'Analista' }).level).toBe('colaborador');
    });

    it('o cargo não concede acesso quando há nível explícito', () => {
        const c = capabilities({ accessLevel: 'colaborador', role: 'Gestor' });
        expect(c.manageTeam).toBe(false);
        expect(c.edit('settings')).toBe(false);
    });
});

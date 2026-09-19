/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
    ROLES,
    SYSTEM_MODULES,
    DEFAULT_ROLE_PERMISSIONS,
    normalizeRole,
    subscribeRolesPermissions,
    saveRolesPermissions
} from '../services/rbac';

const PermissionsContext = createContext();

export const PermissionsProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const [permissionsMatrix, setPermissionsMatrix] = useState(DEFAULT_ROLE_PERMISSIONS);
    const [loadingPermissions, setLoadingPermissions] = useState(true);

    // Ouvinte em tempo real da matriz de permissões no Firestore
    useEffect(() => {
        const unsubscribe = subscribeRolesPermissions((data) => {
            if (data) {
                // Mescla com os padrões caso falte algum módulo ou role
                const merged = { ...DEFAULT_ROLE_PERMISSIONS };
                Object.keys(DEFAULT_ROLE_PERMISSIONS).forEach((roleKey) => {
                    merged[roleKey] = {
                        ...DEFAULT_ROLE_PERMISSIONS[roleKey],
                        ...(data[roleKey] || {})
                    };
                });
                setPermissionsMatrix(merged);
            } else {
                setPermissionsMatrix(DEFAULT_ROLE_PERMISSIONS);
            }
            setLoadingPermissions(false);
        });

        return () => unsubscribe();
    }, []);

    // Determina a role normalizada do usuário atual
    const normalizedRole = useMemo(() => {
        if (!currentUser) return 'colaborador';
        return normalizeRole(currentUser.role);
    }, [currentUser]);

    // Verifica se é administrador master (acesso irrestrito)
    const isMasterAdmin = useMemo(() => {
        if (!currentUser) return false;
        const role = String(currentUser.role || '').toLowerCase();
        return role === 'admin' || role.includes('master');
    }, [currentUser]);

    // Objeto informativo da role atual
    const activeRoleInfo = useMemo(() => {
        return ROLES.find(r => r.id === normalizedRole) || ROLES.find(r => r.id === 'colaborador');
    }, [normalizedRole]);

    // Checagem se pode VISUALIZAR um módulo específico
    const canView = useCallback((moduleId) => {
        if (!moduleId) return false;
        if (isMasterAdmin) return true;
        const rolePerms = permissionsMatrix[normalizedRole];
        if (!rolePerms || !rolePerms[moduleId]) {
            return DEFAULT_ROLE_PERMISSIONS[normalizedRole]?.[moduleId]?.view ?? false;
        }
        return Boolean(rolePerms[moduleId].view);
    }, [isMasterAdmin, permissionsMatrix, normalizedRole]);

    // Checagem se pode EDITAR/LANÇAR em um módulo específico
    const canEdit = useCallback((moduleId) => {
        if (!moduleId) return false;
        if (isMasterAdmin) return true;
        const rolePerms = permissionsMatrix[normalizedRole];
        if (!rolePerms || !rolePerms[moduleId]) {
            return DEFAULT_ROLE_PERMISSIONS[normalizedRole]?.[moduleId]?.edit ?? false;
        }
        // Se não puder ver, por definição não pode editar
        if (!rolePerms[moduleId].view) return false;
        return Boolean(rolePerms[moduleId].edit);
    }, [isMasterAdmin, permissionsMatrix, normalizedRole]);

    // Checagem se tem acesso a pelo menos uma tela administrativa/operacional
    const hasAnyAdminTabAccess = useMemo(() => {
        if (isMasterAdmin || normalizedRole === 'gestor') return true;
        return SYSTEM_MODULES.some(mod => canView(mod.id));
    }, [isMasterAdmin, normalizedRole, canView]);

    // Salvar nova matriz no Firestore
    const saveMatrix = useCallback(async (newMatrix) => {
        await saveRolesPermissions(newMatrix);
        setPermissionsMatrix(newMatrix);
    }, []);

    // Restaurar padrões de uma role específica
    const resetRole = useCallback(async (roleId) => {
        if (!DEFAULT_ROLE_PERMISSIONS[roleId]) return;
        const updated = {
            ...permissionsMatrix,
            [roleId]: { ...DEFAULT_ROLE_PERMISSIONS[roleId] }
        };
        await saveRolesPermissions(updated);
        setPermissionsMatrix(updated);
    }, [permissionsMatrix]);

    return (
        <PermissionsContext.Provider
            value={{
                permissions: permissionsMatrix,
                loadingPermissions,
                normalizedRole,
                activeRoleInfo,
                isMasterAdmin,
                canView,
                canEdit,
                hasAnyAdminTabAccess,
                saveMatrix,
                resetRole
            }}
        >
            {children}
        </PermissionsContext.Provider>
    );
};

export const usePermissions = () => {
    const context = useContext(PermissionsContext);
    if (!context) {
        throw new Error('usePermissions deve ser usado dentro de um PermissionsProvider');
    }
    return context;
};

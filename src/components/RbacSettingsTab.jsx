import React, { useState, useMemo } from 'react';
import {
    ShieldCheck,
    Check,
    X,
    RotateCcw,
    Save,
    Loader2,
    Search,
    AlertCircle,
    Eye,
    Edit3,
    CheckCircle2,
    Lock,
    Unlock
} from 'lucide-react';
import { ROLES, SYSTEM_MODULES, DEFAULT_ROLE_PERMISSIONS } from '../services/rbac';
import { usePermissions } from '../context/PermissionsContext';
import { useNotification } from '../context/NotificationContext';

const RbacSettingsTab = () => {
    const { permissions, saveMatrix } = usePermissions();
    const { showToast } = useNotification();

    // Role selecionada para configuração
    const [selectedRole, setSelectedRole] = useState('supervisor');
    
    // Cópia local de trabalho da matriz para edição com estado de rascunho
    const [localMatrix, setLocalMatrix] = useState(permissions || DEFAULT_ROLE_PERMISSIONS);
    const [prevPermissions, setPrevPermissions] = useState(permissions);
    if (permissions !== prevPermissions) {
        setPrevPermissions(permissions);
        setLocalMatrix(permissions);
    }

    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('Todos');

    // Role atualmente selecionada
    const currentRoleMeta = useMemo(() => {
        return ROLES.find(r => r.id === selectedRole) || ROLES[0];
    }, [selectedRole]);

    // Permissões da role atualmente selecionada
    const currentRolePerms = useMemo(() => {
        return localMatrix[selectedRole] || DEFAULT_ROLE_PERMISSIONS[selectedRole] || {};
    }, [localMatrix, selectedRole]);

    // Grupos disponíveis para filtro
    const availableGroups = useMemo(() => {
        const groups = new Set(SYSTEM_MODULES.map(m => m.group));
        return ['Todos', ...Array.from(groups)];
    }, []);

    // Módulos filtrados por pesquisa e grupo
    const filteredModules = useMemo(() => {
        return SYSTEM_MODULES.filter(mod => {
            const matchesSearch = mod.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                mod.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                mod.group.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesGroup = selectedGroup === 'Todos' || mod.group === selectedGroup;
            return matchesSearch && matchesGroup;
        });
    }, [searchTerm, selectedGroup]);

    // Alternar permissão de visualização
    const handleToggleView = (moduleId) => {
        const currentModPerm = currentRolePerms[moduleId] || { view: false, edit: false };
        const newView = !currentModPerm.view;
        // Se desligar a visualização, a edição também deve ser desligada obrigatoriamente
        const newEdit = newView ? currentModPerm.edit : false;

        setLocalMatrix(prev => ({
            ...prev,
            [selectedRole]: {
                ...prev[selectedRole],
                [moduleId]: {
                    view: newView,
                    edit: newEdit
                }
            }
        }));
    };

    // Alternar permissão de edição
    const handleToggleEdit = (moduleId) => {
        const currentModPerm = currentRolePerms[moduleId] || { view: false, edit: false };
        // Só permite editar se tiver visualização ativa
        if (!currentModPerm.view) return;

        const newEdit = !currentModPerm.edit;
        setLocalMatrix(prev => ({
            ...prev,
            [selectedRole]: {
                ...prev[selectedRole],
                [moduleId]: {
                    ...currentModPerm,
                    edit: newEdit
                }
            }
        }));
    };

    // Ações em massa para a role selecionada
    const handleAllowAll = () => {
        const updated = { ...(localMatrix[selectedRole] || {}) };
        SYSTEM_MODULES.forEach(mod => {
            updated[mod.id] = { view: true, edit: true };
        });
        setLocalMatrix(prev => ({ ...prev, [selectedRole]: updated }));
        showToast(`Todas as permissões foram liberadas para ${currentRoleMeta.label}.`, 'info');
    };

    const handleReadOnlyAll = () => {
        const updated = { ...(localMatrix[selectedRole] || {}) };
        SYSTEM_MODULES.forEach(mod => {
            updated[mod.id] = { view: true, edit: false };
        });
        setLocalMatrix(prev => ({ ...prev, [selectedRole]: updated }));
        showToast(`Modo Apenas Leitura configurado para ${currentRoleMeta.label}.`, 'info');
    };

    const handleResetToDefault = async () => {
        const defaults = DEFAULT_ROLE_PERMISSIONS[selectedRole];
        if (!defaults) return;
        setLocalMatrix(prev => ({
            ...prev,
            [selectedRole]: { ...defaults }
        }));
        showToast(`Padrões restaurados na prévia para ${currentRoleMeta.label}. Clique em Salvar para fixar.`, 'info');
    };

    // Salvar no Firestore
    const handleSave = async () => {
        setSaving(true);
        try {
            await saveMatrix(localMatrix);
            showToast(`Matriz de permissões atualizada com sucesso no banco de dados!`, 'success');
        } catch (error) {
            console.error(error);
            showToast(`Erro ao salvar permissões: ${error.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Estatísticas da role selecionada
    const stats = useMemo(() => {
        let viewCount = 0;
        let editCount = 0;
        SYSTEM_MODULES.forEach(mod => {
            const p = currentRolePerms[mod.id];
            if (p?.view) viewCount++;
            if (p?.edit) editCount++;
        });
        return { viewCount, editCount, total: SYSTEM_MODULES.length };
    }, [currentRolePerms]);

    return (
        <div className="space-y-6">
            {/* Header da aba RBAC */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <ShieldCheck className="w-6 h-6 text-red-600" />
                            Controle de Acesso por Cargo (RBAC)
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Configure de forma granular quais telas cada função pode <span className="font-semibold text-gray-700">Visualizar</span> no menu e quais pode <span className="font-semibold text-gray-700">Editar/Lançar</span> dados.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-bold transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Salvar Permissões
                        </button>
                    </div>
                </div>

                {/* Seleção de Cargo com Cards/Tabs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
                    {ROLES.map((role) => {
                        const isSelected = selectedRole === role.id;
                        // Contagem de acessos desta role
                        const rPerms = localMatrix[role.id] || DEFAULT_ROLE_PERMISSIONS[role.id] || {};
                        const vCount = SYSTEM_MODULES.filter(m => rPerms[m.id]?.view).length;
                        const eCount = SYSTEM_MODULES.filter(m => rPerms[m.id]?.edit).length;

                        return (
                            <button
                                key={role.id}
                                type="button"
                                onClick={() => setSelectedRole(role.id)}
                                className={`text-left p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                                    isSelected
                                        ? 'border-red-600 bg-red-50/50 shadow-md ring-2 ring-red-100'
                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="font-bold text-base text-gray-900">{role.label}</span>
                                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${role.badgeColor}`}>
                                        {vCount}/{SYSTEM_MODULES.length} Telas
                                    </span>
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                                    {role.description}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-gray-600 pt-2 border-t border-gray-100">
                                    <span className="flex items-center gap-1">
                                        <Eye className="w-3.5 h-3.5 text-blue-600" /> {vCount} Ver
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Edit3 className="w-3.5 h-3.5 text-emerald-600" /> {eCount} Editar
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Painel do Cargo Selecionado e Ações Rápidas */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-black text-lg">
                        {currentRoleMeta.label.charAt(0)}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-gray-900">Configurando: {currentRoleMeta.label}</span>
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${currentRoleMeta.badgeColor}`}>
                                {currentRoleMeta.label}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500">
                            {stats.viewCount} telas com visualização liberada • {stats.editCount} com permissão de edição
                        </p>
                    </div>
                </div>

                {/* Botões de Ações Rápidas */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleAllowAll}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors flex items-center gap-1.5"
                    >
                        <Unlock className="w-3.5 h-3.5" /> Liberar Tudo
                    </button>
                    <button
                        type="button"
                        onClick={handleReadOnlyAll}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors flex items-center gap-1.5"
                    >
                        <Eye className="w-3.5 h-3.5" /> Apenas Leitura
                    </button>
                    <button
                        type="button"
                        onClick={handleResetToDefault}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 transition-colors flex items-center gap-1.5"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrões
                    </button>
                </div>
            </div>

            {/* Barra de Filtros e Pesquisa */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                    <input
                        type="text"
                        placeholder="Buscar tela ou módulo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500"
                    />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                    {availableGroups.map(grp => (
                        <button
                            key={grp}
                            type="button"
                            onClick={() => setSelectedGroup(grp)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                                selectedGroup === grp
                                    ? 'bg-zinc-900 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {grp}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabela / Grid de Permissões */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-950 text-white text-xs uppercase tracking-wider">
                                <th className="py-3.5 px-6 font-semibold">Módulo / Tela</th>
                                <th className="py-3.5 px-4 font-semibold w-40 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Eye className="w-4 h-4 text-blue-400" />
                                        Visualizar (Acesso)
                                    </div>
                                </th>
                                <th className="py-3.5 px-4 font-semibold w-40 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Edit3 className="w-4 h-4 text-emerald-400" />
                                        Editar (Ações)
                                    </div>
                                </th>
                                <th className="py-3.5 px-6 font-semibold w-44 text-right">Status do Acesso</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {filteredModules.map((mod) => {
                                const perms = currentRolePerms[mod.id] || { view: false, edit: false };
                                const canViewMod = Boolean(perms.view);
                                const canEditMod = Boolean(perms.edit && perms.view);

                                return (
                                    <tr key={mod.id} className="hover:bg-gray-50/80 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-start gap-3">
                                                <div className="pt-0.5">
                                                    <span className="text-xs px-2 py-0.5 rounded font-medium bg-gray-100 text-gray-600 border border-gray-200 mr-2">
                                                        {mod.group}
                                                    </span>
                                                    <span className="font-bold text-gray-900">{mod.label}</span>
                                                    <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-xl">
                                                        {mod.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Toggle Visualizar */}
                                        <td className="py-4 px-4 text-center">
                                            <label className="relative inline-flex items-center cursor-pointer justify-center">
                                                <input
                                                    type="checkbox"
                                                    checked={canViewMod}
                                                    onChange={() => handleToggleView(mod.id)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                            <span className="block text-[11px] font-medium text-gray-500 mt-1">
                                                {canViewMod ? 'Permitido' : 'Bloqueado'}
                                            </span>
                                        </td>

                                        {/* Toggle Editar */}
                                        <td className="py-4 px-4 text-center">
                                            <label className={`relative inline-flex items-center justify-center ${!canViewMod ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}>
                                                <input
                                                    type="checkbox"
                                                    disabled={!canViewMod}
                                                    checked={canEditMod}
                                                    onChange={() => handleToggleEdit(mod.id)}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                            </label>
                                            <span className="block text-[11px] font-medium text-gray-500 mt-1">
                                                {!canViewMod ? 'Requer Ver' : canEditMod ? 'Pode Editar' : 'Apenas Ver'}
                                            </span>
                                        </td>

                                        {/* Tag de Status */}
                                        <td className="py-4 px-6 text-right">
                                            {!canViewMod ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                                                    <Lock className="w-3 h-3" /> Sem Acesso
                                                </span>
                                            ) : canEditMod ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <CheckCircle2 className="w-3 h-3" /> Ver & Editar
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                                                    <Eye className="w-3 h-3" /> Apenas Leitura
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Rodapé informativo */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>
                            Ao desmarcar <strong>Visualizar</strong>, a tela será ocultada do menu lateral e o acesso direto será bloqueado para o cargo selecionado.
                        </span>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 bg-zinc-900 hover:bg-black text-white px-4 py-2 rounded-lg font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RbacSettingsTab;

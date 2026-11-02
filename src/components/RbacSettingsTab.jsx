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
    Unlock,
    Filter,
    Layers,
    Sparkles
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
            showToast(`Matriz de permissões RBAC sincronizada com sucesso!`, 'success');
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
        <div className="w-full min-w-0 space-y-6">
            
            {/* Header da aba RBAC */}
            <div className="w-full bg-surface rounded-3xl border border-subtle shadow-xs p-6 lg:p-8 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                Segurança Corporativa
                            </span>
                            <span className="text-xs text-muted-hub">&bull;</span>
                            <span className="text-xs font-semibold text-secondary-hub">Matriz RBAC Granular</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold text-primary-hub flex items-center gap-2.5">
                            <ShieldCheck className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                            Controle de Acesso por Cargo (RBAC)
                        </h2>
                        <p className="text-xs sm:text-sm text-secondary-hub max-w-3xl leading-relaxed">
                            Defina com precisão milimétrica quais telas cada perfil operacional pode <strong className="text-primary-hub">Visualizar</strong> na barra de navegação e quais tem autorização para <strong className="text-primary-hub">Editar e Lançar</strong> registros.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-rose-950/20 disabled:opacity-50 cursor-pointer active:scale-95"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Permissões
                        </button>
                    </div>
                </div>

                {/* Seleção de Cargo com Cards Bento 100% Width */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 pt-2">
                    {ROLES.map((role) => {
                        const isSelected = selectedRole === role.id;
                        const rPerms = localMatrix[role.id] || DEFAULT_ROLE_PERMISSIONS[role.id] || {};
                        const vCount = SYSTEM_MODULES.filter(m => rPerms[m.id]?.view).length;
                        const eCount = SYSTEM_MODULES.filter(m => rPerms[m.id]?.edit).length;

                        return (
                            <button
                                key={role.id}
                                type="button"
                                onClick={() => setSelectedRole(role.id)}
                                className={`text-left p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                                    isSelected
                                        ? 'border-rose-500 bg-rose-500/10 shadow-sm ring-2 ring-rose-500/20'
                                        : 'border-subtle bg-subtle/50 hover:border-border-hub hover:bg-subtle'
                                }`}
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-sm sm:text-base text-primary-hub">{role.label}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${role.badgeColor}`}>
                                            {vCount}/{SYSTEM_MODULES.length} Telas
                                        </span>
                                    </div>
                                    <p className="text-xs text-secondary-hub line-clamp-2 mb-3 leading-relaxed">
                                        {role.description}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-secondary-hub pt-2.5 border-t border-subtle">
                                    <span className="flex items-center gap-1 font-medium">
                                        <Eye className="w-3.5 h-3.5 text-blue-500" /> {vCount} Ver
                                    </span>
                                    <span className="flex items-center gap-1 font-medium">
                                        <Edit3 className="w-3.5 h-3.5 text-emerald-500" /> {eCount} Editar
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Painel do Cargo Selecionado e Ações Rápidas */}
            <div className="w-full bg-surface rounded-2xl border border-subtle shadow-xs p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-950 text-white flex items-center justify-center font-black text-lg shadow-xs">
                        {currentRoleMeta.label.charAt(0)}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-base sm:text-lg font-bold text-primary-hub">Configurando: {currentRoleMeta.label}</span>
                            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${currentRoleMeta.badgeColor}`}>
                                {currentRoleMeta.label}
                            </span>
                        </div>
                        <p className="text-xs text-secondary-hub">
                            {stats.viewCount} telas com visualização liberada &bull; {stats.editCount} com permissão de edição
                        </p>
                    </div>
                </div>

                {/* Botões de Ações Rápidas */}
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleAllowAll}
                        className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/25 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                        <Unlock className="w-3.5 h-3.5" /> Liberar Tudo
                    </button>
                    <button
                        type="button"
                        onClick={handleReadOnlyAll}
                        className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/25 transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                        <Eye className="w-3.5 h-3.5" /> Apenas Leitura
                    </button>
                    <button
                        type="button"
                        onClick={handleResetToDefault}
                        className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-subtle text-secondary-hub hover:bg-surface border border-subtle transition-colors flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                        <RotateCcw className="w-3.5 h-3.5" /> Restaurar Padrões
                    </button>
                </div>
            </div>

            {/* Barra de Filtros e Pesquisa 100% Width */}
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-subtle shadow-xs">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-muted-hub absolute left-3 top-2.5" />
                    <input
                        type="text"
                        placeholder="Buscar módulo ou tela..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-subtle border border-subtle rounded-xl text-xs text-primary-hub placeholder:text-muted-hub outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 focus:bg-surface font-medium"
                    />
                </div>

                <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
                    {availableGroups.map(grp => (
                        <button
                            key={grp}
                            type="button"
                            onClick={() => setSelectedGroup(grp)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                                selectedGroup === grp
                                    ? 'bg-rose-600 text-white shadow-xs'
                                    : 'bg-subtle text-secondary-hub hover:bg-surface border border-subtle'
                            }`}
                        >
                            {grp}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabela de Permissões 100% Width */}
            <div className="w-full bg-surface rounded-3xl border border-subtle shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-subtle/80 text-secondary-hub text-[11px] uppercase tracking-wider font-bold border-b border-subtle">
                                <th className="py-3.5 px-6 font-semibold">Módulo / Tela</th>
                                <th className="py-3.5 px-4 font-semibold w-44 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Eye className="w-4 h-4 text-blue-500" />
                                        Visualizar (Acesso)
                                    </div>
                                </th>
                                <th className="py-3.5 px-4 font-semibold w-44 text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Edit3 className="w-4 h-4 text-emerald-500" />
                                        Editar (Ações)
                                    </div>
                                </th>
                                <th className="py-3.5 px-6 font-semibold w-48 text-right">Status do Acesso</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs text-secondary-hub divide-y divide-subtle">
                            {filteredModules.map((mod) => {
                                const perms = currentRolePerms[mod.id] || { view: false, edit: false };
                                const canViewMod = Boolean(perms.view);
                                const canEditMod = Boolean(perms.edit && perms.view);

                                return (
                                    <tr key={mod.id} className="hover:bg-subtle/50 transition-colors">
                                        <td className="py-4 px-6">
                                            <div className="flex items-start gap-3">
                                                <div className="pt-0.5">
                                                    <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-subtle text-secondary-hub border border-subtle mr-2 uppercase">
                                                        {mod.group}
                                                    </span>
                                                    <span className="font-bold text-primary-hub text-sm">{mod.label}</span>
                                                    <p className="text-xs text-secondary-hub mt-1 leading-relaxed max-w-xl">
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
                                                <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                            <span className="block text-[11px] font-semibold text-secondary-hub mt-1">
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
                                                <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                            </label>
                                            <span className="block text-[11px] font-semibold text-secondary-hub mt-1">
                                                {!canViewMod ? 'Requer Ver' : canEditMod ? 'Pode Editar' : 'Apenas Ver'}
                                            </span>
                                        </td>

                                        {/* Tag de Status */}
                                        <td className="py-4 px-6 text-right">
                                            {!canViewMod ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-subtle text-muted-hub border border-subtle">
                                                    <Lock className="w-3.5 h-3.5" /> Sem Acesso
                                                </span>
                                            ) : canEditMod ? (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                                                    <CheckCircle2 className="w-3.5 h-3.5" /> Ver & Editar
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25">
                                                    <Eye className="w-3.5 h-3.5" /> Apenas Leitura
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
                <div className="p-4 bg-subtle/50 border-t border-subtle flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-secondary-hub">
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>
                            Ao desmarcar <strong>Visualizar</strong>, a tela será ocultada do menu lateral e o acesso direto será bloqueado para o cargo selecionado.
                        </span>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 bg-zinc-900 dark:bg-rose-600 hover:bg-black dark:hover:bg-rose-500 text-white px-4 py-2 rounded-xl font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50 active:scale-95"
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

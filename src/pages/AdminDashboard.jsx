import React, { useState, useMemo } from 'react';
import {
    Users, BarChart2, Settings as SettingsIcon, LogOut, ShieldAlert,
    TrendingUp, Clock, Star, ClipboardList, Target, Trophy,
    Rocket, Activity, CheckSquare, Phone, MessageCircle,
    Award, AlertTriangle, Database, CheckCircle, Loader2, ShieldCheck, CalendarDays, Calendar, Network,
    ChevronDown, ChevronRight, Menu, X, FileText, Info, Shield, User, History, Lock
} from 'lucide-react';
import { updatePassword } from 'firebase/auth';
import { auth } from '../services/firebase';
import { logout } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { useNotification } from '../context/NotificationContext';

import DashboardOverview from './DashboardOverview';
import CollaboratorsHub from './CollaboratorsHub';
import WeeklyMetrics from './WeeklyMetrics';
import SectorKPIs from './SectorKPIs';
import DataManager from './DataManager';
import Settings from './Settings';
import Reports from './Reports';
import Audits from './Audits';
import Rankings from './Rankings';
import DailyQueueTracker from './DailyDemandLaunch';
import SundaySchedule from './SundaySchedule';
import DailySchedule from './DailySchedule';
import OrgChart from './OrgChart';
import MonthlyEvaluations from './MonthlyEvaluations';
import MyDashboard from './MyDashboard';
import MyHistory from './MyHistory';

// Importação da logo estendida
import logoExtended from '../assets/logo_extended.png';
const logo = logoExtended;

const AdminDashboard = () => {
    const { canView, canEdit, activeRoleInfo, normalizedRole } = usePermissions();
    const { currentUser } = useAuth();
    const { showToast } = useNotification();

    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loadingPassword, setLoadingPassword] = useState(false);

    const [expandedMenus, setExpandedMenus] = useState({
        individual: true,
        geral: true,
        operacional: true,
        escalas: true,
        gestao: true
    });

    const toggleMenu = (menuId) => {
        if (isSidebarCollapsed) {
            setIsSidebarCollapsed(false);
            setExpandedMenus(prev => ({ ...prev, [menuId]: true }));
        } else {
            setExpandedMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showToast("As senhas digitadas não coincidem.", "error");
            return;
        }
        if (newPassword.length < 6) {
            showToast("A senha deve ter pelo menos 6 caracteres.", "error");
            return;
        }

        setLoadingPassword(true);
        try {
            await updatePassword(auth.currentUser, newPassword);
            showToast("Senha alterada com sucesso!", "success");
            setIsPasswordModalOpen(false);
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            if (error.code === 'auth/requires-recent-login') {
                showToast("Por segurança, saia e faça login novamente para alterar sua senha.", "error");
            } else {
                showToast("Erro ao alterar senha: " + error.message, "error");
            }
        } finally {
            setLoadingPassword(false);
        }
    };

    const navMenus = useMemo(() => [
        {
            id: 'individual',
            title: 'Meu Espaço',
            icon: User,
            items: [
                { id: 'my_dashboard', label: 'Meu Desempenho', icon: Activity },
                { id: 'my_history', label: 'Meu Histórico', icon: History },
            ]
        },
        {
            id: 'geral',
            title: 'Principal',
            icon: BarChart2,
            items: [
                { id: 'dashboard', label: 'Visão Geral KPIs', icon: BarChart2 },
                { id: 'hub', label: 'Hub da Equipe', icon: Users },
                { id: 'orgchart', label: 'Organograma', icon: Network },
            ]
        },
        {
            id: 'operacional',
            title: 'Lançamentos/Análise',
            icon: TrendingUp,
            items: [
                { id: 'metrics', label: 'Avaliações Semanais', icon: TrendingUp },
                { id: 'monthly_evaluations', label: 'Análise Mensal (1:1)', icon: FileText },
                { id: 'DailyQueueTracker', label: 'Demanda Diária', icon: Activity },
                { id: 'reports', label: 'Relatórios Críticos', icon: ClipboardList },
                { id: 'audits', label: 'Auditorias QA', icon: ShieldCheck },
                { id: 'rankings', label: 'Rankings da Equipe', icon: Trophy },
            ]
        },
        {
            id: 'escalas',
            title: 'Escalas',
            icon: Calendar,
            items: [
                { id: 'daily_schedule', label: 'Escala Diária', icon: CalendarDays },
                { id: 'schedule', label: 'Escala de Plantão', icon: Calendar },
            ]
        },
        {
            id: 'gestao',
            title: 'Gestão & Sistema',
            icon: SettingsIcon,
            items: [
                { id: 'sector_kpis', label: 'KPIs do Setor', icon: Target },
                { id: 'data_manager', label: 'Gestão de Dados', icon: Database },
                { id: 'settings', label: 'Configurações', icon: SettingsIcon },
            ]
        }
    ], []);

    // Menus visíveis conforme matriz de permissões RBAC
    const visibleMenus = useMemo(() => {
        return navMenus.map(menu => ({
            ...menu,
            items: menu.items.filter(item => canView(item.id))
        })).filter(menu => menu.items.length > 0);
    }, [canView, navMenus]);

    // Primeira aba permitida para fallback seguro
    const firstAllowedTab = useMemo(() => {
        for (const menu of visibleMenus) {
            if (menu.items.length > 0) {
                return menu.items[0].id;
            }
        }
        return null;
    }, [visibleMenus]);

    // Determina a aba efetivamente ativa sem disparar re-render em cascata
    const effectiveActiveTab = canView(activeTab) ? activeTab : (firstAllowedTab || activeTab);

    const renderContent = () => {
        if (!canView(effectiveActiveTab)) {
            return (
                <div className="flex-1 p-8 flex flex-col items-center justify-center text-center bg-gray-50 h-full">
                    <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-sm">
                        <ShieldAlert className="w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">Acesso Restrito ao Módulo</h2>
                    <p className="text-sm text-gray-500 max-w-md mt-2 leading-relaxed">
                        Seu perfil atual (<strong className="text-gray-800">{activeRoleInfo?.label || normalizedRole}</strong>) não possui permissão de visualização para este módulo.
                    </p>
                    {firstAllowedTab && (
                        <button
                            onClick={() => setActiveTab(firstAllowedTab)}
                            className="mt-6 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg shadow-sm transition-all cursor-pointer"
                        >
                            Ir para Início
                        </button>
                    )}
                </div>
            );
        }

        switch (effectiveActiveTab) {
            case 'my_dashboard':
                return <MyDashboard currentUserId={currentUser?.firestoreId || currentUser?.uid} currentUser={currentUser} />;
            case 'my_history':
                return <MyHistory currentUserId={currentUser?.firestoreId || currentUser?.uid} />;
            case 'dashboard':
                return <DashboardOverview />;
            case 'hub':
                return <CollaboratorsHub />;
            case 'rankings':
                return <Rankings />;
            case 'orgchart':
                return <OrgChart readOnly={!canEdit('orgchart')} />;
            case 'metrics':
                return <WeeklyMetrics />;
            case 'monthly_evaluations':
                return <MonthlyEvaluations />;
            case 'schedule':
                return <SundaySchedule readOnly={!canEdit('schedule')} />;
            case 'daily_schedule':
                return <DailySchedule readOnly={!canEdit('daily_schedule')} />;
            case 'sector_kpis':
                return <SectorKPIs />;
            case 'data_manager':
                return <DataManager />;
            case 'reports':
                return <Reports />;
            case 'audits':
                return <Audits />;
            case 'settings':
                return <Settings />;
            case 'DailyQueueTracker':
                return <DailyQueueTracker />;
            default:
                return <DashboardOverview />;
        }
    };

    return (
        <div className="h-screen bg-gray-50 flex overflow-hidden">
            <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-zinc-950 text-white flex flex-col hidden md:flex shrink-0 border-r border-zinc-800 transition-all duration-300 relative z-20`}>
                <div className="p-4 flex items-center justify-between border-b border-zinc-800 shrink-0 h-20">
                    {!isSidebarCollapsed && (
                        <div className="flex items-center gap-3 overflow-hidden">
                            <img src={logo} alt="HubDesk Logo" className="h-10 w-auto shrink-0" />
                            <span className="text-lg font-bold tracking-wider truncate">HUB<span className="text-red-500">DESK</span></span>
                        </div>
                    )}
                    <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className={`p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors shrink-0 ${isSidebarCollapsed ? 'mx-auto' : ''}`}>
                        <Menu className="w-5 h-5" />
                    </button>
                </div>

                {/* Badge do Usuário e Cargo RBAC */}
                {!isSidebarCollapsed ? (
                    <div className="mx-3 mt-3 p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center font-black text-xs shrink-0">
                            {activeRoleInfo?.label?.charAt(0) || 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-white truncate">
                                {currentUser?.name || currentUser?.email?.split('@')[0] || 'Usuário'}
                            </p>
                            <span className={`inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-full font-bold border ${activeRoleInfo?.badgeColor || 'bg-zinc-800 text-zinc-300'}`}>
                                {activeRoleInfo?.label || normalizedRole}
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center mt-3">
                        <div className="w-9 h-9 rounded-lg bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center font-black text-xs" title={`Cargo: ${activeRoleInfo?.label || normalizedRole}`}>
                            {activeRoleInfo?.label?.charAt(0) || 'U'}
                        </div>
                    </div>
                )}

                <nav className="flex-1 p-3 space-y-4 overflow-y-auto scrollbar-hide">
                    {visibleMenus.map(menu => (
                        <div key={menu.id} className="space-y-1">
                            {/* Header do Menu */}
                            {!isSidebarCollapsed ? (
                                <button 
                                    onClick={() => toggleMenu(menu.id)}
                                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors"
                                >
                                    <span>{menu.title}</span>
                                    {expandedMenus[menu.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </button>
                            ) : (
                                <div className="flex justify-center py-2 mb-1 border-b border-zinc-800/50">
                                    <menu.icon className="w-4 h-4 text-zinc-600" title={menu.title} />
                                </div>
                            )}

                            {/* Itens do Menu */}
                            {(expandedMenus[menu.id] || isSidebarCollapsed) && (
                                <div className="space-y-1">
                                    {menu.items.map(item => {
                                        const Icon = item.icon;
                                        const isActive = effectiveActiveTab === item.id;
                                        return (
                                            <button 
                                                key={item.id}
                                                onClick={() => setActiveTab(item.id)} 
                                                title={isSidebarCollapsed ? item.label : ""}
                                                className={`w-full flex items-center rounded-lg transition-colors ${
                                                    isSidebarCollapsed ? 'justify-center p-3' : 'px-4 py-2.5 gap-3'
                                                } ${
                                                    isActive 
                                                    ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' 
                                                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'
                                                }`}
                                            >
                                                <Icon className={`${isSidebarCollapsed ? 'w-6 h-6' : 'w-5 h-5'} shrink-0`} />
                                                {!isSidebarCollapsed && <span className="font-medium text-sm whitespace-nowrap">{item.label}</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-zinc-800 shrink-0 bg-zinc-950/50 space-y-1">
                    <button 
                        onClick={() => setIsPasswordModalOpen(true)} 
                        className={`w-full flex items-center py-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4 gap-3'}`} 
                        title={isSidebarCollapsed ? "Alterar Senha" : ""}
                    >
                        <Lock className="w-5 h-5 shrink-0" />
                        {!isSidebarCollapsed && <span className="text-sm font-medium">Alterar Senha</span>}
                    </button>
                    <button onClick={logout} className={`w-full flex items-center py-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4 gap-3'}`} title={isSidebarCollapsed ? "Sair do sistema" : ""}>
                        <LogOut className="w-5 h-5 shrink-0" />
                        {!isSidebarCollapsed && <span className="text-sm font-medium">Sair do sistema</span>}
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 relative">
                {renderContent()}
            </main>

            {isPasswordModalOpen && (
                <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[90] backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 bg-zinc-950 text-white flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2">
                                <Lock className="w-4 h-4 text-red-500" /> Alterar Minha Senha
                            </h3>
                            <button onClick={() => setIsPasswordModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdatePassword} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Nova Senha</label>
                                <input 
                                    type="password" 
                                    required 
                                    minLength={6} 
                                    value={newPassword} 
                                    onChange={(e) => setNewPassword(e.target.value)} 
                                    placeholder="Mínimo 6 caracteres" 
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none text-sm" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Confirmar Nova Senha</label>
                                <input 
                                    type="password" 
                                    required 
                                    minLength={6} 
                                    value={confirmPassword} 
                                    onChange={(e) => setConfirmPassword(e.target.value)} 
                                    placeholder="Repita a nova senha" 
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none text-sm" 
                                />
                            </div>
                            <div className="pt-2 flex justify-end gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => setIsPasswordModalOpen(false)} 
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={loadingPassword} 
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                    {loadingPassword ? 'Salvando...' : 'Atualizar Senha'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
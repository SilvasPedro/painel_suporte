import React, { useState, useMemo } from 'react';
import {
    Users, BarChart2, Settings as SettingsIcon, LogOut, ShieldAlert,
    TrendingUp, Clock, Star, ClipboardList, Target, Trophy,
    Rocket, Activity, CheckSquare, Phone, MessageCircle,
    Award, AlertTriangle, Database, CheckCircle, Loader2, ShieldCheck, CalendarDays, Calendar, Network,
    ChevronDown, ChevronRight, Menu, X, FileText, Info, Shield, User, History, Lock
} from 'lucide-react';
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
import ChangePasswordModal from '../components/ChangePasswordModal';
import LogoutConfirmModal from '../components/LogoutConfirmModal';

// Importação da logo da barra de navegação (navbar_logo_red)
import navbarLogoRed from '../assets/navbar_logo_red.png';
const logo = navbarLogoRed;

const AdminDashboard = () => {
    const { canView, canEdit, activeRoleInfo, normalizedRole } = usePermissions();
    const { currentUser } = useAuth();
    const { showToast } = useNotification();

    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

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
                <div className={`p-4 flex items-center ${isSidebarCollapsed ? 'justify-center flex-col gap-1' : 'justify-between'} border-b border-zinc-800 shrink-0 h-20`}>
                    {!isSidebarCollapsed ? (
                        <div className="flex items-center gap-3 overflow-hidden">
                            <img src={logo} alt="HubDesk Logo" className="h-10 w-auto shrink-0 object-contain" />
                            <span className="text-lg font-bold tracking-wider truncate">HUB<span className="text-red-500">DESK</span></span>
                        </div>
                    ) : (
                        <button onClick={() => setIsSidebarCollapsed(false)} className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors shrink-0 flex items-center justify-center cursor-pointer" title="Expandir menu">
                            <img src={logo} alt="HubDesk Logo" className="h-8 w-auto shrink-0 object-contain" />
                        </button>
                    )}
                    <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className={`p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors shrink-0 ${isSidebarCollapsed ? 'hidden' : ''}`} title="Recolher menu">
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
                        id="btn-sidebar-change-password"
                        onClick={() => setIsPasswordModalOpen(true)} 
                        className={`w-full flex items-center py-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4 gap-3'}`} 
                        title={isSidebarCollapsed ? "Alterar Senha" : ""}
                    >
                        <Lock className="w-5 h-5 shrink-0" />
                        {!isSidebarCollapsed && <span className="text-sm font-medium">Alterar Senha</span>}
                    </button>
                    <button 
                        id="btn-sidebar-logout"
                        onClick={() => setIsLogoutModalOpen(true)} 
                        className={`w-full flex items-center py-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4 gap-3'}`} 
                        title={isSidebarCollapsed ? "Sair do sistema" : ""}
                    >
                        <LogOut className="w-5 h-5 shrink-0" />
                        {!isSidebarCollapsed && <span className="text-sm font-medium">Sair do sistema</span>}
                    </button>

                    {/* Rodapé com a versão v3.0 do projeto */}
                    <div className={`pt-3 border-t border-zinc-800/80 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between px-1'}`}>
                        {!isSidebarCollapsed && (
                            <span className="text-[11px] font-medium text-zinc-500 tracking-wide">
                                HubDesk Suporte
                            </span>
                        )}
                        <span 
                            id="system-version-badge"
                            className="px-2 py-0.5 rounded-md bg-zinc-900 border border-zinc-800 text-[10px] font-mono font-bold text-zinc-400 shadow-2xs"
                            title="Versão do Sistema: v3.0"
                        >
                            v3.0
                        </span>
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 relative">
                {renderContent()}
            </main>

            {/* Modal de Alteração de Senha com Indicador Visual (Fraca, Média, Forte) */}
            <ChangePasswordModal 
                isOpen={isPasswordModalOpen} 
                onClose={() => setIsPasswordModalOpen(false)} 
                showToast={showToast} 
            />

            {/* Modal de Confirmação de Logout (Sair ou Voltar) */}
            <LogoutConfirmModal
                isOpen={isLogoutModalOpen}
                onClose={() => setIsLogoutModalOpen(false)}
                onConfirm={logout}
                userName={currentUser?.name}
            />
        </div>
    );
};

export default AdminDashboard;
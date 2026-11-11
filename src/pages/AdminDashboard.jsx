import React, { useState, useMemo, useEffect, useCallback, Suspense, lazy } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users, BarChart2, Settings as SettingsIcon, LogOut, ShieldAlert,
    TrendingUp, Clock, Star, ClipboardList, Target, Trophy,
    Rocket, Activity, CheckSquare, Phone, MessageCircle,
    Award, AlertTriangle, Database, CheckCircle, Loader2, ShieldCheck, CalendarDays, Calendar, Network,
    ChevronDown, ChevronRight, Menu, X, FileText, Info, Shield, User, History, Lock, Sparkles, Headphones, Coffee, Search, Compass, Wifi, SlidersHorizontal
} from 'lucide-react';
import { cn } from '../utils/cn';
import { logout } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { useNotification } from '../context/NotificationContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import ProductTour from '../components/tour/ProductTour';
import MenuCustomizerModal from '../components/MenuCustomizerModal';
import { applyMenuLayout, normalizeLayout, getMenuLayoutStorageKey, findSectionOfItem } from '../utils/menuLayout';
import { TOUR_VERSION, getTourType, getTourStorageKey, buildTourSteps } from '../data/tourSteps';

// Carregamento sob demanda (Code-Splitting) para máxima performance de inicialização
const DashboardOverview = lazy(() => import('./DashboardOverview'));
const CollaboratorsHub = lazy(() => import('./CollaboratorsHub'));
const WeeklyMetrics = lazy(() => import('./WeeklyMetrics'));
const SectorKPIs = lazy(() => import('./SectorKPIs'));
const DataManager = lazy(() => import('./DataManager'));
const Settings = lazy(() => import('./Settings'));
const Reports = lazy(() => import('./Reports'));
const Audits = lazy(() => import('./Audits'));
const ThirdPartyAudits = lazy(() => import('./ThirdPartyAudits'));
const SmartPre = lazy(() => import('./SmartPre'));
const Rankings = lazy(() => import('./Rankings'));
const DailyQueueTracker = lazy(() => import('./DailyDemandLaunch'));
const DayOffSchedule = lazy(() => import('./DayOffSchedule'));
const OperationalSchedules = lazy(() => import('./OperationalSchedules'));
const OrgChart = lazy(() => import('./OrgChart'));
const MonthlyEvaluations = lazy(() => import('./MonthlyEvaluations'));
const MyDashboard = lazy(() => import('./MyDashboard'));
const MyHistory = lazy(() => import('./MyHistory'));
const MyProfile = lazy(() => import('./MyProfile'));

import ChangePasswordModal from '../components/ChangePasswordModal';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import VersionChangelogModal from '../components/VersionChangelogModal';
import ThemeSelector from '../components/ThemeSelector';
import NotificationBell from '../components/NotificationBell';
import { CommandPalette } from '../components/ui';
import { CURRENT_VERSION } from '../data/changelogData';
import { calculateUserLevel } from '../services/userProfile';

// Loader visual suave durante a troca de abas
const PageLoader = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-canvas h-full">
        <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs font-medium text-secondary-hub mt-3 animate-pulse">Carregando módulo...</span>
    </div>
);

// Importação do ícone da barra de navegação (mesmo ícone do favicon)
import faviconLogo from '../assets/favicon_red.png';
const logo = faviconLogo;

// Menu padrão. Cada usuário pode renomear as seções e reposicionar os itens (ver utils/menuLayout.js).
const DEFAULT_NAV_MENUS = [
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
        id: 'equipe',
        title: 'Equipe',
        icon: Users,
        items: [
            { id: 'hub', label: 'Hub da Equipe', icon: Users },
            { id: 'orgchart', label: 'Organograma', icon: Network },
            { id: 'rankings', label: 'Rankings da Equipe', icon: Trophy },
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
            { id: 'reports', label: 'Tarefas & Relatórios', icon: ClipboardList },
            { id: 'audits', label: 'Auditorias QA', icon: ShieldCheck },
            { id: 'third_party_audits', label: 'Auditoria Terceirizada', icon: Headphones },
            { id: 'smart_pre', label: 'Smart Pre', icon: Wifi },
        ]
    },
    {
        id: 'escalas',
        title: 'Escalas',
        icon: Calendar,
        items: [
            { id: 'day_off_schedule', label: 'Escala de Folgas', icon: Coffee },
            { id: 'daily_schedule', label: 'Escala Diária & Plantão', icon: CalendarDays },
        ]
    },
    {
        id: 'gestao',
        title: 'Gestão & Sistema',
        icon: SettingsIcon,
        items: [
            { id: 'dashboard', label: 'Visão Geral KPIs', icon: BarChart2 },
            { id: 'sector_kpis', label: 'KPIs do Setor', icon: Target },
            { id: 'data_manager', label: 'Gestão de Dados', icon: Database },
            { id: 'settings', label: 'Configurações', icon: SettingsIcon },
        ]
    }
];

const AdminDashboard = () => {
    const { canView, canEdit, activeRoleInfo, normalizedRole, isMasterAdmin } = usePermissions();
    const { currentUser } = useAuth();
    const { 
        showToast, 
        pulseHistory, 
        pulseReports, 
        clearPulseHistory, 
        clearPulseReports 
    } = useNotification();

    const userLevel = useMemo(() => {
        return calculateUserLevel(currentUser?.badges);
    }, [currentUser?.badges]);

    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'dashboard';

    const setActiveTab = useCallback((tabId) => {
        setSearchParams(prev => {
            const next = new URLSearchParams(prev);
            if (tabId === 'dashboard') {
                next.delete('tab');
            } else {
                next.set('tab', tabId);
            }
            return next;
        }, { replace: false });
    }, [setSearchParams]);

    useEffect(() => {
        const handleNavigateTab = (e) => {
            if (e.detail?.tab) {
                // Se for 'history', no Admin mapeia para 'my_history' ou 'history'
                const target = e.detail.tab === 'history' ? 'my_history' : e.detail.tab;
                setActiveTab(target);
            }
        };
        window.addEventListener('HUBDESK_NAVIGATE_TAB', handleNavigateTab);
        return () => window.removeEventListener('HUBDESK_NAVIGATE_TAB', handleNavigateTab);
    }, [setActiveTab]);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);
    const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

    // Atalho global Ctrl+K / Cmd+K para abrir a Command Palette (Quick Search)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setIsCommandPaletteOpen(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const [expandedMenus, setExpandedMenus] = useState({
        individual: true,
        equipe: true,
        operacional: true,
        escalas: true,
        gestao: true
    });

    // ---------------------------------------------------------------------
    // TOUR GUIADO DO PRIMEIRO ACESSO (Operacional/Apoio x Gestor/Supervisor)
    // ---------------------------------------------------------------------
    const [tourOpen, setTourOpen] = useState(false);
    const [tourIsMobile, setTourIsMobile] = useState(false);
    const tourType = getTourType({ normalizedRole, isMasterAdmin });
    const tourUserId = currentUser?.firestoreId || currentUser?.uid;

    // ---------------------------------------------------------------------
    // PERSONALIZAÇÃO DO MENU (nome/ordem das seções e posição dos itens, por usuário)
    // Fica no perfil do colaborador (vale em qualquer aparelho) e em cópia local (funciona sem perfil).
    // ---------------------------------------------------------------------
    const [layoutOverride, setLayoutOverride] = useState(undefined); // undefined = usar o que está salvo
    const [isMenuCustomizerOpen, setIsMenuCustomizerOpen] = useState(false);
    const profileMenuLayout = currentUser?.menuLayout;
    const storedMenuLayout = useMemo(() => {
        if (profileMenuLayout) return normalizeLayout(profileMenuLayout);
        if (!tourUserId) return null;
        try { return normalizeLayout(localStorage.getItem(getMenuLayoutStorageKey(tourUserId))); } catch { return null; }
    }, [profileMenuLayout, tourUserId]);
    const menuLayout = layoutOverride !== undefined ? layoutOverride : storedMenuLayout;
    const navMenus = useMemo(() => applyMenuLayout(DEFAULT_NAV_MENUS, menuLayout), [menuLayout]);

    const handleSaveMenuLayout = useCallback(async (layout) => {
        setLayoutOverride(layout);
        setIsMenuCustomizerOpen(false);
        if (tourUserId) {
            try {
                if (layout) localStorage.setItem(getMenuLayoutStorageKey(tourUserId), JSON.stringify(layout));
                else localStorage.removeItem(getMenuLayoutStorageKey(tourUserId));
            } catch { /* sem acesso ao armazenamento */ }
            try {
                await updateDoc(doc(db, 'collaborators', tourUserId), { menuLayout: layout ? JSON.stringify(layout) : '' });
            } catch {
                // Sem perfil de colaborador ou sem permissão: a cópia local já mantém a personalização neste aparelho
            }
        }
        showToast(layout ? 'Menu personalizado salvo.' : 'Menu restaurado para o padrão.', 'success');
    }, [tourUserId, showToast, setIsMenuCustomizerOpen]);

    const tourSteps = useMemo(
        () => buildTourSteps(tourType, canView, tourIsMobile),
        [tourType, canView, tourIsMobile]
    );

    // Abre sozinho apenas na primeira vez (controle local + campo gravado no perfil do colaborador)
    useEffect(() => {
        if (!tourUserId || currentUser?.isInactive) return undefined;
        let seenLocally = false;
        try { seenLocally = localStorage.getItem(getTourStorageKey(tourUserId)) === '1'; } catch { /* sem acesso ao armazenamento */ }
        const seenInProfile = Number(currentUser?.tourVersion || 0) >= TOUR_VERSION;
        if (seenLocally || seenInProfile) return undefined;

        const timer = setTimeout(() => {
            setTourIsMobile(window.innerWidth < 768);
            setTourOpen(true);
        }, 900);
        return () => clearTimeout(timer);
    }, [tourUserId, currentUser?.isInactive, currentUser?.tourVersion]);

    // Prepara a tela para o passo atual: menu lateral aberto e grupo do item expandido
    const handleTourBeforeStep = useCallback((step) => {
        if (step.target && !step.target.includes('mobile-menu')) setIsSidebarCollapsed(false);
        const sectionId = findSectionOfItem(navMenus, step.requires || step.id) || step.menu;
        if (sectionId) setExpandedMenus(prev => (prev[sectionId] ? prev : { ...prev, [sectionId]: true }));
    }, [setIsSidebarCollapsed, setExpandedMenus, navMenus]);

    const handleTourFinish = useCallback(async () => {
        setTourOpen(false);
        if (!tourUserId) return;
        try { localStorage.setItem(getTourStorageKey(tourUserId), '1'); } catch { /* sem acesso ao armazenamento */ }
        try {
            await updateDoc(doc(db, 'collaborators', tourUserId), {
                tourVersion: TOUR_VERSION,
                tourType,
                tourCompletedAt: new Date().toISOString()
            });
        } catch {
            // Sem permissão ou sem documento de colaborador: o controle local já evita repetir o tour
        }
    }, [tourUserId, tourType]);

    const handleReplayTour = useCallback(() => {
        setIsMobileMenuOpen(false);
        setTourIsMobile(window.innerWidth < 768);
        setTourOpen(true);
    }, [setIsMobileMenuOpen]);

    const toggleMenu = (menuId) => {
        if (isSidebarCollapsed) {
            setIsSidebarCollapsed(false);
            setExpandedMenus(prev => ({ ...prev, [menuId]: true }));
        } else {
            setExpandedMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
        }
    };


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
    const isProfileActive = effectiveActiveTab === 'my_profile';

    // Rótulo textual da aba atual para exibição na barra de topo
    const currentMenuLabel = useMemo(() => {
        if (effectiveActiveTab === 'my_profile') return 'Meu Perfil';
        for (const menu of navMenus) {
            const found = menu.items.find(i => i.id === effectiveActiveTab);
            if (found) return found.label;
        }
        return 'Painel';
    }, [navMenus, effectiveActiveTab]);

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
            case 'my_profile':
                return <MyProfile currentUserId={currentUser?.firestoreId || currentUser?.uid} currentUser={currentUser} />;
            case 'my_dashboard':
                return <MyDashboard currentUserId={currentUser?.firestoreId || currentUser?.uid} currentUser={currentUser} />;
            case 'my_history':
                return <MyHistory currentUserId={currentUser?.firestoreId || currentUser?.uid} />;
            case 'dashboard':
                return <DashboardOverview onNavigate={setActiveTab} />;
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
            case 'day_off_schedule':
                return <DayOffSchedule readOnly={!canEdit('day_off_schedule')} />;
            case 'operational_schedules':
            case 'daily_schedule':
                return <OperationalSchedules initialTab="diaria" readOnly={!canEdit('daily_schedule')} />;
            case 'schedule':
                return <OperationalSchedules initialTab="plantao" readOnly={!canEdit('schedule')} />;
            case 'sector_kpis':
                return <SectorKPIs />;
            case 'data_manager':
                return <DataManager />;
            case 'reports':
                return <Reports />;
            case 'audits':
                return <Audits />;
            case 'third_party_audits':
                return <ThirdPartyAudits />;
            case 'smart_pre':
                return <SmartPre />;
            case 'settings':
                return <Settings />;
            case 'DailyQueueTracker':
                return <DailyQueueTracker />;
            default:
                return <DashboardOverview onNavigate={setActiveTab} />;
        }
    };

    return (
        <div className="h-screen bg-gray-50 flex overflow-hidden">
            {/* BARRA LATERAL ULTRA-MODERNA (MAGIC DESIGN SYSTEM) */}
            <aside data-tour="sidebar" className={cn(
                "app-sidebar bg-zinc-950/95 text-white flex flex-col hidden md:flex shrink-0 border-r border-zinc-800/80 transition-all duration-300 relative z-20 backdrop-blur-xl select-none overflow-hidden",
                isSidebarCollapsed ? "w-20" : "w-64"
            )}>
                {/* Iluminação Ambiente Volumétrica Carmesim */}
                <div className="pointer-events-none absolute -top-24 -left-24 w-56 h-56 bg-rose-500/10 rounded-full blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -right-24 w-48 h-48 bg-rose-500/5 rounded-full blur-3xl" />

                {/* Topo: Logo & Botão de Recolher */}
                <div className={cn(
                    "p-4 flex items-center shrink-0 h-20 border-b border-zinc-800/80 relative z-10",
                    isSidebarCollapsed ? "justify-center flex-col gap-1" : "justify-between"
                )}>
                    {!isSidebarCollapsed ? (
                        <div className="flex items-center gap-3 overflow-hidden group">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500/20 via-zinc-900 to-zinc-950 border border-rose-500/30 flex items-center justify-center shrink-0 p-2 shadow-lg shadow-rose-950/40 relative">
                                <img src={logo} alt="HubDesk Logo" className="w-full h-full object-contain filter drop-shadow" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="font-brand text-lg font-black tracking-tight text-white select-none">
                                        HUB<span className="text-rose-500">DESK</span>
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/20 text-[9px] font-bold text-rose-400 font-mono">
                                        v3.11
                                    </span>
                                </div>
                                <p className="text-[10px] text-zinc-500 font-medium truncate uppercase tracking-widest mt-0.5">
                                    Central de Operações
                                </p>
                            </div>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsSidebarCollapsed(false)} 
                            className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500/20 via-zinc-900 to-zinc-950 border border-rose-500/30 flex items-center justify-center shrink-0 p-2 shadow-lg shadow-rose-950/40 cursor-pointer hover:scale-105 transition-transform" 
                            title="Expandir menu lateral"
                        >
                            <img src={logo} alt="HubDesk Logo" className="w-full h-full object-contain" />
                        </button>
                    )}

                    <button 
                        onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                        className={cn(
                            "p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-xl transition-colors cursor-pointer shrink-0 border border-transparent hover:border-zinc-700/50",
                            isSidebarCollapsed && "hidden"
                        )} 
                        title="Recolher menu lateral"
                    >
                        <Menu className="w-4 h-4" />
                    </button>
                </div>

                {/* Quick Launcher: Busca & Command Palette (Ctrl+K) */}
                {!isSidebarCollapsed ? (
                    <div className="px-3 pt-3 relative z-10">
                        <button
                            type="button"
                            onClick={() => setIsCommandPaletteOpen(true)}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 text-xs text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer group shadow-2xs"
                            title="Buscar módulos e comandos rápidos (Ctrl + K)"
                        >
                            <span className="flex items-center gap-2">
                                <Search className="w-3.5 h-3.5 text-zinc-500 group-hover:text-rose-400 transition-colors" />
                                <span className="text-[11px] font-medium">Buscar módulo...</span>
                            </span>
                            <kbd className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/80 text-[10px] font-mono font-bold text-zinc-400">
                                ⌘K
                            </kbd>
                        </button>
                    </div>
                ) : (
                    <div className="flex justify-center pt-3 relative z-10">
                        <button
                            type="button"
                            onClick={() => setIsCommandPaletteOpen(true)}
                            className="w-10 h-10 rounded-xl bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 hover:border-rose-500/30 flex items-center justify-center text-zinc-400 hover:text-rose-400 transition-all cursor-pointer shadow-2xs"
                            title="Buscar módulo (Ctrl + K)"
                        >
                            <Search className="w-4 h-4" />
                        </button>
                    </div>
                )}

                {/* Crachá Digital do Usuário com Nível & Perfil */}
                {!isSidebarCollapsed ? (
                    <div className="px-3 pt-2 relative z-10">
                        <button 
                            type="button"
                            data-tour="profile" onClick={() => setActiveTab('my_profile')}
                            className={cn(
                                "w-full p-2.5 rounded-2xl flex items-center gap-3 transition-all text-left cursor-pointer group relative overflow-hidden",
                                isProfileActive 
                                    ? "bg-gradient-to-r from-rose-500/15 via-zinc-900 to-zinc-900 border border-rose-500/40 shadow-lg shadow-rose-950/30" 
                                    : "bg-zinc-900/50 hover:bg-zinc-900/80 border border-zinc-800/80 hover:border-zinc-700"
                            )}
                            title={`Meu Perfil • Nível ${userLevel} (${activeRoleInfo?.label || normalizedRole})`}
                        >
                            {isProfileActive && (
                                <span className="absolute left-0 top-2 bottom-2 w-1 bg-rose-500 rounded-r-full shadow-sm shadow-rose-500" />
                            )}

                            <div className="relative">
                                <div className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center font-brand font-black text-xs shrink-0 overflow-hidden shadow-sm transition-transform group-hover:scale-105",
                                    isProfileActive 
                                        ? "bg-zinc-950 text-white ring-2 ring-rose-500/40" 
                                        : "bg-zinc-950 text-zinc-300 ring-1 ring-zinc-800"
                                    )}>
                                    {(currentUser?.photoURL || currentUser?.photoUrl) ? (
                                        <img src={currentUser.photoURL || currentUser.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        activeRoleInfo?.label?.charAt(0) || 'U'
                                    )}
                                </div>
                            </div>

                            <div className="min-w-0 flex-1">
                                <p className={cn(
                                    "font-brand text-xs font-bold truncate leading-tight transition-colors",
                                    isProfileActive ? "text-rose-400" : "text-white group-hover:text-rose-300"
                                )}>
                                    {currentUser?.name || currentUser?.email?.split('@')[0] || 'Usuário'}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                                        {activeRoleInfo?.label || normalizedRole}
                                    </span>
                                    <span 
                                        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30"
                                        title={`Nível ${userLevel} de 8`}
                                    >
                                        <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                        Nv.{userLevel}
                                    </span>
                                </div>
                            </div>
                        </button>
                    </div>
                ) : (
                    <div className="flex justify-center pt-2 relative z-10">
                        <div className="relative">
                            <button 
                                type="button"
                                data-tour="profile" onClick={() => setActiveTab('my_profile')}
                                className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center font-brand font-black text-xs overflow-hidden cursor-pointer transition-all",
                                    isProfileActive
                                        ? "bg-rose-500 text-white ring-2 ring-rose-500/40 shadow-lg shadow-rose-500/30 scale-105"
                                        : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800"
                                )}
                                title={`Meu Perfil: ${currentUser?.name || 'Usuário'} • Nível ${userLevel}`}
                            >
                                {(currentUser?.photoURL || currentUser?.photoUrl) ? (
                                    <img src={currentUser.photoURL || currentUser.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    activeRoleInfo?.label?.charAt(0) || 'U'
                                )}
                            </button>
                            <span 
                                className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded-full bg-amber-500 text-zinc-950 text-[9px] font-mono font-black border border-zinc-950 shadow-xs"
                                title={`Nível ${userLevel}`}
                            >
                                {userLevel}
                            </span>
                        </div>
                    </div>
                )}

                {/* Navegação Hierárquica em Categorias */}
                <nav className="flex-1 p-3 space-y-4 overflow-y-auto scrollbar-hide relative z-10">
                    {visibleMenus.map(menu => (
                        <div key={menu.id} className="space-y-1">
                            {/* Header da Categoria */}
                            {!isSidebarCollapsed ? (
                                <button 
                                    onClick={() => toggleMenu(menu.id)}
                                    className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider hover:text-zinc-300 transition-colors cursor-pointer group"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-1 h-1 rounded-full bg-zinc-600 group-hover:bg-rose-400 transition-colors" />
                                        <span>{menu.title}</span>
                                    </span>
                                    <span className="text-zinc-600 group-hover:text-zinc-400 transition-transform">
                                        {expandedMenus[menu.id] ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                    </span>
                                </button>
                            ) : (
                                <div className="flex justify-center py-2 mb-1 border-b border-zinc-800/40">
                                    <menu.icon className="w-3.5 h-3.5 text-zinc-600" title={menu.title} />
                                </div>
                            )}

                            {/* Itens da Categoria */}
                            {(expandedMenus[menu.id] || isSidebarCollapsed) && (
                                <div className="space-y-0.5">
                                    {menu.items.map(item => {
                                        const Icon = item.icon;
                                        const isActive = effectiveActiveTab === item.id;
                                        const isHistory = item.id === 'my_history' || item.id === 'history';
                                        const isReports = item.id === 'reports';
                                        const showPulse = (isHistory && pulseHistory) || (isReports && pulseReports);

                                        return (
                                            <button 
                                                key={item.id}
                                                data-tour={`nav-${item.id}`}
                                                onClick={() => {
                                                    setActiveTab(item.id);
                                                    if (isHistory) clearPulseHistory();
                                                    if (isReports) clearPulseReports();
                                                }} 
                                                title={isSidebarCollapsed ? item.label : ""}
                                                className={cn(
                                                    "w-full flex items-center rounded-xl transition-all cursor-pointer relative group",
                                                    isSidebarCollapsed ? "justify-center p-2.5" : "px-3 py-2 gap-3",
                                                    isActive 
                                                        ? "text-rose-400 font-bold" 
                                                        : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60"
                                                )}
                                            >
                                                {/* Pílula Ativa com Framer Motion */}
                                                {isActive && (
                                                    <motion.div
                                                        layoutId="active-sidebar-pill"
                                                        className="absolute inset-0 bg-gradient-to-r from-rose-500/20 via-rose-500/10 to-transparent rounded-xl border-l-2 border-rose-500 shadow-xs z-0"
                                                        transition={{ type: "spring", stiffness: 400, damping: 35 }}
                                                    />
                                                )}

                                                <div className="relative shrink-0 flex items-center justify-center z-10">
                                                    <Icon className={cn(
                                                        "transition-transform duration-200 group-hover:scale-110",
                                                        isSidebarCollapsed ? "w-5 h-5" : "w-4 h-4",
                                                        isActive ? "text-rose-400" : "text-zinc-400 group-hover:text-zinc-200"
                                                    )} />
                                                    {isSidebarCollapsed && showPulse && (
                                                        <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                                        </span>
                                                    )}
                                                </div>

                                                {!isSidebarCollapsed && (
                                                    <div className="flex items-center justify-between flex-1 min-w-0 z-10">
                                                        <span className="text-xs truncate tracking-tight select-none">
                                                            {item.label}
                                                        </span>
                                                        {showPulse && (
                                                            <span 
                                                                className="relative flex h-2 w-2 shrink-0 ml-1.5"
                                                                title={isHistory ? "Novo feedback recebido!" : "Novas demandas ou atualizações!"}
                                                            >
                                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </nav>

                {/* Rodapé Executivo da Barra Lateral */}
                <div className="p-3 border-t border-zinc-800/80 shrink-0 bg-zinc-950/80 space-y-1 relative z-10">
                    <div className={cn("grid gap-1", isSidebarCollapsed ? "grid-cols-1" : "grid-cols-2")}>
                        <button 
                            id="btn-sidebar-change-password"
                            onClick={() => setIsPasswordModalOpen(true)} 
                            className={cn(
                                "flex items-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all cursor-pointer py-2",
                                isSidebarCollapsed ? "justify-center px-0" : "px-2.5 gap-2"
                            )} 
                            title="Alterar Senha de Acesso"
                        >
                            <Lock className="w-3.5 h-3.5 shrink-0" />
                            {!isSidebarCollapsed && <span className="text-[11px] font-medium truncate">Senha</span>}
                        </button>

                        <button 
                            id="btn-sidebar-logout"
                            onClick={() => setIsLogoutModalOpen(true)} 
                            className={cn(
                                "flex items-center rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer py-2",
                                isSidebarCollapsed ? "justify-center px-0" : "px-2.5 gap-2"
                            )} 
                            title="Sair do sistema"
                        >
                            <LogOut className="w-3.5 h-3.5 shrink-0" />
                            {!isSidebarCollapsed && <span className="text-[11px] font-medium truncate">Sair</span>}
                        </button>
                    </div>

                    {/* Personalizar o menu lateral */}
                    <button
                        type="button"
                        data-tour="menu-customize"
                        onClick={() => setIsMenuCustomizerOpen(true)}
                        className={cn(
                            "w-full flex items-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all cursor-pointer py-2",
                            isSidebarCollapsed ? "justify-center px-0" : "px-2.5 gap-2"
                        )}
                        title="Personalizar o menu: nome e ordem das seções e posição das telas"
                    >
                        <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                        {!isSidebarCollapsed && <span className="text-[11px] font-medium truncate">Personalizar menu</span>}
                    </button>

                    {/* Rever o tour guiado */}
                    <button
                        type="button"
                        data-tour="tour-replay"
                        onClick={handleReplayTour}
                        className={cn(
                            "w-full flex items-center rounded-xl text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition-all cursor-pointer py-2",
                            isSidebarCollapsed ? "justify-center px-0" : "px-2.5 gap-2"
                        )}
                        title="Rever o tour guiado"
                    >
                        <Compass className="w-3.5 h-3.5 shrink-0" />
                        {!isSidebarCollapsed && <span className="text-[11px] font-medium truncate">Tour guiado</span>}
                    </button>

                    {/* Versão do Sistema & Trigger do Changelog */}
                    <button
                        type="button"
                        id="system-version-card"
                        onClick={() => setIsChangelogModalOpen(true)}
                        className={cn(
                            "w-full pt-2.5 mt-1 border-t border-zinc-800/60 flex items-center group transition-colors cursor-pointer text-left",
                            isSidebarCollapsed ? "justify-center" : "justify-between px-1"
                        )}
                        title={`HubDesk Suporte ${CURRENT_VERSION} • Ver Changelog`}
                    >
                        {!isSidebarCollapsed && (
                            <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors">
                                HubDesk Suporte
                            </span>
                        )}
                        <span 
                            id="system-version-badge"
                            className="px-2 py-0.5 rounded-md bg-zinc-900 group-hover:bg-rose-950/60 border border-zinc-800 group-hover:border-rose-800/60 text-[10px] font-mono font-bold text-zinc-400 group-hover:text-rose-400 shadow-2xs transition-all"
                        >
                            {CURRENT_VERSION}
                        </span>
                    </button>
                </div>
            </aside>

            {/* Menu Drawer Lateral no Mobile com Efeito Blur */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 md:hidden flex animate-in fade-in duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                >
                    <div 
                        className="mobile-drawer-sidebar w-72 bg-zinc-950 text-white h-full flex flex-col shadow-2xl border-r border-zinc-800/80 animate-in slide-in-from-left duration-200 relative overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="pointer-events-none absolute -top-20 -left-20 w-48 h-48 bg-rose-500/10 rounded-full blur-2xl" />

                        <div className="p-4 flex items-center justify-between border-b border-zinc-800/80 h-16 shrink-0 relative z-10">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500/20 via-zinc-900 to-zinc-950 border border-rose-500/30 flex items-center justify-center p-1.5 shadow-2xs">
                                    <img src={logo} alt="HubDesk Logo" className="w-full h-full object-contain" />
                                </div>
                                <span className="font-brand text-lg font-black tracking-tight text-white flex items-center select-none">
                                    HUB<span className="text-rose-500 ml-0.5">DESK</span>
                                </span>
                            </div>
                            <button 
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors border border-transparent hover:border-zinc-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Crachá do Usuário Mobile */}
                        <button 
                            type="button"
                            onClick={() => {
                                setActiveTab('my_profile');
                                setIsMobileMenuOpen(false);
                            }}
                            className={cn(
                                "p-3 mx-3 mt-3 rounded-2xl flex items-center gap-3 shrink-0 text-left cursor-pointer transition-all relative overflow-hidden",
                                isProfileActive
                                    ? "bg-gradient-to-r from-rose-500/15 via-zinc-900 to-zinc-900 border border-rose-500/40 shadow-lg shadow-rose-950/30"
                                    : "bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80"
                            )}
                            title={`Ir para Meu Perfil • Nível ${userLevel}`}
                        >
                            {isProfileActive && (
                                <span className="absolute left-0 top-2 bottom-2 w-1 bg-rose-500 rounded-r-full shadow-sm shadow-rose-500" />
                            )}
                            <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center font-brand font-black text-xs shrink-0 overflow-hidden shadow-2xs transition-all",
                                isProfileActive
                                    ? "bg-rose-500 text-white ring-2 ring-rose-500/40 shadow-md shadow-rose-500/30"
                                    : "bg-zinc-950 text-zinc-300 ring-1 ring-zinc-800"
                            )}>
                                {(currentUser?.photoURL || currentUser?.photoUrl) ? (
                                    <img src={currentUser.photoURL || currentUser.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    activeRoleInfo?.label?.charAt(0) || 'U'
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                    <p className="font-brand font-bold text-xs truncate text-white">
                                        {currentUser?.name || currentUser?.email?.split('@')[0] || 'Usuário'}
                                    </p>
                                    {isProfileActive && (
                                        <span className="text-[9px] font-black uppercase tracking-wider text-rose-300 bg-rose-950 border border-rose-500/40 px-1.5 py-0.5 rounded-md shrink-0">
                                            Atual
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                                        {activeRoleInfo?.label || normalizedRole}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30">
                                        <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                        Nv.{userLevel}
                                    </span>
                                </div>
                            </div>
                        </button>

                        {/* Itens de navegação mobile */}
                        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
                            {visibleMenus.map(menu => (
                                <div key={menu.id} className="space-y-1">
                                    <div className="px-3 py-1 text-[10px] font-extrabold text-zinc-500 uppercase tracking-wider">
                                        {menu.title}
                                    </div>
                                    <div className="space-y-0.5">
                                        {menu.items.map(item => {
                                            const Icon = item.icon;
                                            const isActive = effectiveActiveTab === item.id;
                                            const isHistory = item.id === 'my_history' || item.id === 'history';
                                            const isReports = item.id === 'reports';
                                            const showPulse = (isHistory && pulseHistory) || (isReports && pulseReports);

                                            return (
                                                <button
                                                    key={item.id}
                                                    onClick={() => {
                                                        setActiveTab(item.id);
                                                        if (isHistory) clearPulseHistory();
                                                        if (isReports) clearPulseReports();
                                                        setIsMobileMenuOpen(false);
                                                    }}
                                                    className={cn(
                                                        "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-colors text-left",
                                                        isActive 
                                                            ? "bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30" 
                                                            : "text-zinc-400 hover:bg-zinc-900/60 hover:text-white"
                                                    )}
                                                >
                                                    <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-rose-400" : "text-zinc-400")} />
                                                    <span className="truncate">{item.label}</span>
                                                    {showPulse && (
                                                        <span className="relative flex h-2 w-2 shrink-0 ml-auto">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </nav>

                        {/* Rodapé mobile */}
                        <div className="p-3 border-t border-zinc-800/80 shrink-0 bg-zinc-950/80">
                            <button
                                onClick={() => {
                                    setIsMobileMenuOpen(false);
                                    setIsMenuCustomizerOpen(true);
                                }}
                                className="w-full mb-2 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-zinc-800"
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" /> Personalizar menu
                            </button>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        setIsPasswordModalOpen(true);
                                    }}
                                    className="flex-1 py-2 text-xs font-semibold text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-zinc-800"
                                >
                                    <Lock className="w-3.5 h-3.5" /> Senha
                                </button>
                                <button
                                    onClick={() => {
                                        setIsMobileMenuOpen(false);
                                        setIsLogoutModalOpen(true);
                                    }}
                                    className="flex-1 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl flex items-center justify-center gap-1.5 transition-colors border border-rose-500/20"
                                >
                                    <LogOut className="w-3.5 h-3.5" /> Sair
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <main className="flex-1 flex flex-col overflow-hidden bg-canvas relative">
                {/* Barra de Topo Unificada com Seletor Rápido de Tema (z-50 para sobrepor cabeçalhos sticky de tabelas) */}
                <header className="h-14 border-b border-subtle bg-surface px-4 sm:px-6 flex items-center justify-between shrink-0 z-50 relative shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                        <button 
                            type="button"
                            data-tour="mobile-menu" onClick={() => setIsMobileMenuOpen(true)} 
                            className="p-2 rounded-lg text-secondary-hub hover:text-primary-hub hover:bg-subtle md:hidden transition-colors cursor-pointer shrink-0" 
                            title="Abrir Menu de Navegação"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-2 text-xs font-semibold text-secondary-hub min-w-0">
                            <span className="text-muted-hub hidden sm:inline">HubDesk</span>
                            <span className="text-muted-hub hidden sm:inline">/</span>
                            <span className="text-primary-hub font-bold truncate">
                                {currentMenuLabel}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {/* Botão de Busca Rápida / Command Palette (Ctrl+K) */}
                        <button
                            type="button"
                            data-tour="search"
                            onClick={() => setIsCommandPaletteOpen(true)}
                            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-subtle hover:bg-surface border border-subtle text-xs text-secondary-hub hover:text-primary-hub transition-all cursor-pointer shadow-2xs"
                            title="Buscar ou navegar (Ctrl + K)"
                        >
                            <Search className="w-3.5 h-3.5 text-muted-hub" />
                            <span>Buscar...</span>
                            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-subtle text-muted-hub ml-1">
                                Ctrl K
                            </kbd>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsCommandPaletteOpen(true)}
                            className="sm:hidden p-2 rounded-lg text-secondary-hub hover:text-primary-hub hover:bg-subtle transition-colors cursor-pointer"
                            title="Buscar (Ctrl + K)"
                        >
                            <Search className="w-4 h-4" />
                        </button>

                        <div data-tour="notifications" className="flex items-center">
                            <NotificationBell />
                        </div>
                        <div data-tour="theme" className="flex items-center">
                            <ThemeSelector variant="compact" />
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <Suspense fallback={<PageLoader />}>
                        {renderContent()}
                    </Suspense>
                </div>
            </main>

            {/* Tour guiado (primeiro acesso ou sob demanda) */}
            {tourOpen && (
                <ProductTour
                    steps={tourSteps}
                    onBeforeStep={handleTourBeforeStep}
                    onFinish={handleTourFinish}
                />
            )}

            {/* Command Palette Global (Ctrl + K) */}
            <CommandPalette
                isOpen={isCommandPaletteOpen}
                onClose={() => setIsCommandPaletteOpen(false)}
                menus={visibleMenus}
                onSelectTab={setActiveTab}
                onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
                onOpenChangelogModal={() => setIsChangelogModalOpen(true)}
                onOpenLogoutModal={() => setIsLogoutModalOpen(true)}
            />

            {/* Personalização do menu lateral (remontado a cada abertura para partir do que está salvo) */}
            {isMenuCustomizerOpen && (
                <MenuCustomizerModal
                    isOpen
                    onClose={() => setIsMenuCustomizerOpen(false)}
                    defaults={DEFAULT_NAV_MENUS}
                    layout={menuLayout}
                    canViewItem={canView}
                    onSave={handleSaveMenuLayout}
                />
            )}

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

            {/* Modal de Changelog da Versão 3.1 */}
            <VersionChangelogModal
                isOpen={isChangelogModalOpen}
                onClose={() => setIsChangelogModalOpen(false)}
            />
        </div>
    );
};

export default AdminDashboard;
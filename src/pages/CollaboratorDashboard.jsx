import React, { useState, useEffect, useMemo } from 'react';
import {
    Clock, Target, RefreshCw, Star, Phone, MessageSquare,
    ShieldCheck, Rocket, User, Hourglass, BarChart2, History, LogOut,
    Search, Eye, X, Database, TrendingUp, Users, CheckCircle, Filter,
    KeyRound, Settings, Activity, Calendar, CalendarDays, Network, FileText, Menu, Sparkles, Coffee
} from 'lucide-react';
import { logout } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import Reports from './Reports';
import DailyQueueTracker from './DailyDemandLaunch';
import DayOffSchedule from './DayOffSchedule';
import OperationalSchedules from './OperationalSchedules';
import OrgChart from './OrgChart';
import ChangePasswordModal from '../components/ChangePasswordModal';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import VersionChangelogModal from '../components/VersionChangelogModal';
import ThemeSelector from '../components/ThemeSelector';
import NotificationBell from '../components/NotificationBell';
import MyHistory from './MyHistory';
import MyProfile from './MyProfile';
import MyDashboard from './MyDashboard';
import { calculateUserLevel } from '../services/userProfile';
import { CURRENT_VERSION } from '../data/changelogData';

// Importação do ícone da barra de navegação (mesmo ícone do favicon)
import faviconLogo from '../assets/favicon_red.png';
const logo = faviconLogo;

const ExtensionsBalloon = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {isOpen && (
                <div className="absolute bottom-16 right-0 mb-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
                    <div className="bg-zinc-950 p-4 text-white flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-red-500" />
                            <h3 className="font-bold text-sm">Lista de Ramais</h3>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="p-4 overflow-y-auto max-h-[60vh] space-y-4 text-sm">
                        
                        <div>
                            <h4 className="font-bold text-xs text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Uso Geral</h4>
                            <ul className="space-y-1">
                                <li className="flex justify-between items-center"><span className="text-gray-700">Suporte</span> <strong className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded">20</strong></li>
                                <li className="flex justify-between items-center"><span className="text-gray-700">Financeiro</span> <strong className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded">21</strong></li>
                                <li className="flex justify-between items-center"><span className="text-gray-700">Comercial</span> <strong className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded">22</strong></li>
                                <li className="flex justify-between items-center"><span className="text-gray-700">Torre de Serviços</span> <strong className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded">25</strong></li>
                                <li className="flex justify-between items-center"><span className="text-gray-700">Retenção</span> <strong className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded">28</strong></li>
                                <li className="flex justify-between items-center"><span className="text-gray-700">Cobrança</span> <strong className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded">32</strong></li>
                                <li className="flex justify-between items-center"><span className="text-gray-700">Auto-Desbloqueio</span> <strong className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded">5002</strong></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-xs text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Feriados</h4>
                            <ul className="space-y-1">
                                <li className="flex justify-between items-center"><span className="text-gray-700">Suporte Feriado</span> <strong className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded">27</strong></li>
                                <li className="flex justify-between items-center"><span className="text-gray-700">Financeiro Feriado</span> <strong className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded">34</strong></li>
                                <li className="flex justify-between items-center"><span className="text-gray-700">Comercial Feriado</span> <strong className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded">30</strong></li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-xs text-gray-500 uppercase tracking-widest mb-2 border-b pb-1">Transferências</h4>
                            <ul className="space-y-1">
                                <li className="text-gray-700"><strong className="text-red-600 text-base">##</strong> - Transferência Direta</li>
                                <li className="text-gray-700"><strong className="text-red-600 text-base">**</strong> - Transferência Assistida</li>
                            </ul>
                        </div>

                        <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
                            <h4 className="font-bold text-[10px] text-blue-600 uppercase tracking-widest flex items-center gap-1.5 mb-1"><Clock className="w-3.5 h-3.5" /> Horários ETECC Resolve</h4>
                            <p className="text-xs text-blue-800 leading-relaxed">
                                Seg a Sex: <strong className="text-blue-900">08:30 às 17:30</strong><br/>
                                Sábados: <strong className="text-blue-900">08:30 às 16:00</strong>
                            </p>
                        </div>
                    </div>
                </div>
            )}
            
            <button 
                onClick={() => setIsOpen(!isOpen)}
                className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${isOpen ? 'bg-zinc-800 text-white shadow-zinc-500/20 rotate-12' : 'bg-red-600 text-white hover:bg-red-700 hover:scale-105 shadow-red-600/30'}`}
                title="Lista de Ramais"
            >
                {isOpen ? <X className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
            </button>
        </div>
    );
};

const CollaboratorDashboard = ({ currentUserId }) => {
    const [activeTab, setActiveTab] = useState('dashboard');

    useEffect(() => {
        const handleNavigateTab = (e) => {
            if (e.detail?.tab) {
                setActiveTab(e.detail.tab);
            }
        };
        window.addEventListener('HUBDESK_NAVIGATE_TAB', handleNavigateTab);
        return () => window.removeEventListener('HUBDESK_NAVIGATE_TAB', handleNavigateTab);
    }, []);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { currentUser } = useAuth();
    const { 
        showToast, 
        pulseHistory, 
        pulseReports, 
        clearPulseHistory, 
        clearPulseReports 
    } = useNotification();

    // Estados dos Modais
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);

    // Nível calculado com base nos emblemas ativos (de 1 a 8)
    const userLevel = useMemo(() => calculateUserLevel(currentUser?.badges), [currentUser?.badges]);
    const isProfileActive = activeTab === 'profile' || activeTab === 'my_profile';

    const currentTabLabel = useMemo(() => {
        const labels = {
            profile: 'Meu Perfil',
            my_profile: 'Meu Perfil',
            dashboard: 'Meu Desempenho',
            history: 'Meu Histórico',
            reports: 'Relatórios Individuais',
            day_off_schedule: 'Escala de Folgas',
            schedule: 'Escala de Plantão',
            daily_schedule: 'Escala Diária',
            orgchart: 'Organograma Operacional',
            DailyQueueTracker: 'Lançamento de Demandas'
        };
        return labels[activeTab] || 'Meu Espaço';
    }, [activeTab]);

    const renderContent = () => {
        switch (activeTab) {
            case 'profile':
            case 'my_profile':
                return <MyProfile currentUserId={currentUserId} currentUser={currentUser} />;
            case 'dashboard':
                return <MyDashboard currentUserId={currentUserId} currentUser={currentUser} />;
            case 'history':
                return <MyHistory currentUserId={currentUserId} />;
            case 'reports':
                return <Reports />;
            case 'day_off_schedule':
                return <DayOffSchedule readOnly={true} />;
            case 'operational_schedules':
            case 'daily_schedule':
                return <OperationalSchedules initialTab="diaria" readOnly={true} />;
            case 'schedule':
                return <OperationalSchedules initialTab="plantao" readOnly={true} />;
            case 'orgchart':
                return <OrgChart readOnly={true} />;
            case 'DailyQueueTracker':
                return <DailyQueueTracker />;
            default:
                return <MyDashboard currentUserId={currentUserId} currentUser={currentUser} />;

        }
    };

    return (
        <div className="h-screen bg-gray-50 flex overflow-hidden">
            <aside className="w-64 bg-zinc-950 text-white flex flex-col hidden md:flex shrink-0 border-r border-zinc-800">
                <div className="p-6 flex items-center gap-3 border-b border-zinc-800 shrink-0">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-center shrink-0 p-1.5 shadow-2xs">
                        {/* Ícone oficial da barra de navegação (mesmo do favicon) */}
                        <img src={logo} alt="HubDesk Logo" className="w-full h-full object-contain" />
                    </div>
                    <span className="font-brand text-xl font-extrabold tracking-tight text-white flex items-center select-none truncate">
                        HUB<span className="text-red-500 font-black ml-0.5">DESK</span>
                    </span>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-hide">
                    <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                        <BarChart2 className="w-5 h-5" />
                        <span className="font-medium">Dashboard</span>
                    </button>



                    <button 
                        onClick={() => { setActiveTab('history'); clearPulseHistory(); }} 
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'history' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}
                    >
                        <History className="w-5 h-5 shrink-0" />
                        <span className="font-medium">Meu Histórico</span>
                        {pulseHistory && (
                            <span 
                                className="relative flex h-2.5 w-2.5 shrink-0 ml-auto"
                                title="Novo feedback recebido!"
                            >
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 shadow-xs shadow-red-500"></span>
                            </span>
                        )}
                    </button>

                    {/* BOTÕES DE ESCALAS */}
                    <button onClick={() => setActiveTab('day_off_schedule')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'day_off_schedule' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                        <Coffee className="w-5 h-5" /> <span className="font-medium">Escala de Folgas</span>
                    </button>

                    <button onClick={() => setActiveTab('daily_schedule')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'daily_schedule' || activeTab === 'schedule' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                        <CalendarDays className="w-5 h-5" /> <span className="font-medium">Escala Diária & Plantão</span>
                    </button>

                    <button 
                        onClick={() => { setActiveTab('reports'); clearPulseReports(); }} 
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'reports' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}
                    >
                        <ShieldCheck className="w-5 h-5 shrink-0" />
                        <span className="font-medium">Tarefas & Relatórios</span>
                        {pulseReports && (
                            <span 
                                className="relative flex h-2.5 w-2.5 shrink-0 ml-auto"
                                title="Novas tarefas ou atualizações de chamados!"
                            >
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 shadow-xs shadow-red-500"></span>
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('DailyQueueTracker')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'DailyQueueTracker' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}
                    >
                        <Activity className="w-5 h-5" />
                        <span className="font-medium">Demanda Diária</span>
                    </button>

                    <button onClick={() => setActiveTab('orgchart')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'orgchart' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                        <Network className="w-5 h-5" /> <span className="font-medium">Organograma</span>
                    </button>
                </nav>



                <div className="p-3 border-t border-zinc-800 shrink-0 bg-zinc-950/50 space-y-1">
                    {/* Card oficial onde detém a Role, a Foto e o Nível com clique para o Perfil */}
                    <button 
                        type="button"
                        onClick={() => setActiveTab('profile')}
                        className={`w-full p-2.5 mb-2 rounded-xl flex items-center gap-3 transition-all text-left cursor-pointer group shadow-2xs relative ${
                            isProfileActive
                                ? 'bg-gradient-to-r from-red-950/70 via-zinc-900 to-zinc-900 border-2 border-red-500 shadow-lg shadow-red-950/60 ring-2 ring-red-500/25'
                                : 'bg-zinc-900 hover:bg-zinc-800/90 border border-zinc-800/80'
                        }`}
                        title={`Meu Perfil (v3.6) • Nível ${userLevel}${isProfileActive ? ' (Tela Atual)' : ''}`}
                    >
                        {isProfileActive && (
                            <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-red-500 rounded-r-full shadow-sm shadow-red-500" />
                        )}
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 overflow-hidden relative shadow-2xs transition-all bg-red-600/20 text-red-500 border border-red-500/30">
                            {(currentUser?.photoURL || currentUser?.photoUrl) ? (
                                <img src={currentUser.photoURL || currentUser.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                currentUser?.name?.charAt(0) || 'C'
                            )}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                                <p className={`text-xs truncate transition-colors ${
                                    isProfileActive ? 'font-black text-white' : 'font-bold text-white group-hover:text-red-400'
                                }`}>
                                    {currentUser?.name || currentUser?.email?.split('@')[0] || 'Colaborador'}
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                    isProfileActive 
                                        ? 'bg-red-500/20 text-red-200 border-red-500/40' 
                                        : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                }`}>
                                    {currentUser?.role || 'Atendimento'}
                                </span>
                                <span 
                                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-2xs"
                                    title={`Nível ${userLevel} de 8 com base nos emblemas ativos`}
                                >
                                    <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                    Nível {userLevel}
                                </span>
                            </div>
                        </div>
                    </button>

                    <button 
                        onClick={() => setIsPasswordModalOpen(true)} 
                        className="w-full flex items-center gap-3 px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                    >
                        <KeyRound className="w-4 h-4" />
                        <span className="text-sm font-medium">Alterar senha</span>
                    </button>

                    <button 
                        onClick={() => setIsLogoutModalOpen(true)} 
                        className="w-full flex items-center gap-3 px-4 py-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm font-medium">Sair do sistema</span>
                    </button>

                    {/* Rodapé com a versão do projeto e trigger do Changelog */}
                    <button 
                        type="button"
                        id="colab-version-card"
                        onClick={() => setIsChangelogModalOpen(true)}
                        className="w-full pt-3 mt-1 border-t border-zinc-800/80 flex items-center justify-between px-1 group transition-colors cursor-pointer text-left"
                        title={`Versão do Sistema: ${CURRENT_VERSION} • Clique para ver o Changelog`}
                    >
                        <span className="text-[11px] font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors tracking-wide">
                            HubDesk Suporte
                        </span>
                        <span 
                            className="px-2 py-0.5 rounded-md bg-zinc-900 group-hover:bg-red-950/60 border border-zinc-800 group-hover:border-red-800/60 text-[10px] font-mono font-bold text-zinc-400 group-hover:text-red-400 shadow-2xs transition-all flex items-center gap-1.5"
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            {CURRENT_VERSION}
                        </span>
                    </button>
                </div>
            </aside>

            {/* Menu Drawer Mobile para Colaboradores */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 md:hidden flex animate-in fade-in duration-200"
                    onClick={() => setIsMobileMenuOpen(false)}
                >
                    <div 
                        className="mobile-drawer-sidebar w-72 bg-zinc-950 text-white h-full flex flex-col shadow-2xl border-r border-zinc-800 animate-in slide-in-from-left duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-4 flex items-center justify-between border-b border-zinc-800 h-16 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center p-1 shadow-2xs">
                                    <img src={logo} alt="HubDesk Logo" className="w-full h-full object-contain" />
                                </div>
                                <span className="font-brand text-lg font-extrabold tracking-tight text-white flex items-center select-none">
                                    HUB<span className="text-red-500 font-black ml-0.5">DESK</span>
                                </span>
                            </div>
                            <button 
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Card do Usuário no Mobile com clique para Perfil e Nível */}
                        <button 
                            type="button"
                            onClick={() => {
                                setActiveTab('profile');
                                setIsMobileMenuOpen(false);
                            }}
                            className={`p-3 mx-3 mt-3 rounded-xl flex items-center gap-3 shrink-0 text-left cursor-pointer transition-all shadow-2xs relative ${
                                isProfileActive
                                    ? 'bg-gradient-to-r from-red-950/70 via-zinc-900 to-zinc-900 border-2 border-red-500 shadow-lg shadow-red-950/60 ring-2 ring-red-500/25'
                                    : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80'
                            }`}
                            title={`Ir para Meu Perfil • Nível ${userLevel}${isProfileActive ? ' (Tela Atual)' : ''}`}
                        >
                            {isProfileActive && (
                                <span className="absolute -left-1 top-1/2 -translate-y-1/2 w-1.5 h-7 bg-red-500 rounded-r-full shadow-sm shadow-red-500" />
                            )}
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 overflow-hidden shadow-2xs transition-all ${
                                isProfileActive
                                    ? 'bg-red-600 text-white ring-2 ring-red-500 border border-white/20 shadow-md shadow-red-500/30'
                                    : 'bg-red-600/20 text-red-500 border border-red-500/30'
                            }`}>
                                {(currentUser?.photoURL || currentUser?.photoUrl) ? (
                                    <img src={currentUser.photoURL || currentUser.photoUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    currentUser?.name?.charAt(0) || 'C'
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                    <p className={`text-xs truncate transition-colors ${
                                        isProfileActive ? 'font-black text-white' : 'font-bold text-white'
                                    }`}>
                                        {currentUser?.name || currentUser?.email?.split('@')[0] || 'Colaborador'}
                                    </p>
                                    {isProfileActive && (
                                        <span className="text-[9px] font-black uppercase tracking-wider text-red-300 bg-red-950 border border-red-500/50 px-1.5 py-0.5 rounded-md shrink-0 shadow-2xs animate-pulse">
                                            Tela Atual
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                    <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                        isProfileActive
                                            ? 'bg-red-500/20 text-red-200 border-red-500/40'
                                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                    }`}>
                                        {currentUser?.role || 'Atendimento'}
                                    </span>
                                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                        <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                        Nível {userLevel}
                                    </span>
                                </div>
                            </div>
                        </button>

                        <div className="p-4 flex-1 space-y-1 overflow-y-auto">
                            <button onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-red-600/10 text-red-500 font-bold border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                                <Activity className="w-5 h-5" /> <span className="font-medium">Meu Desempenho</span>
                            </button>
                            <button 
                                onClick={() => { setActiveTab('history'); clearPulseHistory(); setIsMobileMenuOpen(false); }} 
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'history' ? 'bg-red-600/10 text-red-500 font-bold border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}
                            >
                                <History className="w-5 h-5 shrink-0" />
                                <span className="font-medium">Meu Histórico</span>
                                {pulseHistory && (
                                    <span className="relative flex h-2.5 w-2.5 shrink-0 ml-auto">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 shadow-xs shadow-red-500"></span>
                                    </span>
                                )}
                            </button>
                            <button 
                                onClick={() => { setActiveTab('reports'); clearPulseReports(); setIsMobileMenuOpen(false); }} 
                                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'reports' ? 'bg-red-600/10 text-red-500 font-bold border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}
                            >
                                <ShieldCheck className="w-5 h-5 shrink-0" />
                                <span className="font-medium">Tarefas & Relatórios</span>
                                {pulseReports && (
                                    <span className="relative flex h-2.5 w-2.5 shrink-0 ml-auto">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600 shadow-xs shadow-red-500"></span>
                                    </span>
                                )}
                            </button>
                            <button onClick={() => { setActiveTab('day_off_schedule'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'day_off_schedule' ? 'bg-red-600/10 text-red-500 font-bold border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                                <Coffee className="w-5 h-5" /> <span className="font-medium">Escala de Folgas</span>
                            </button>
                            <button onClick={() => { setActiveTab('daily_schedule'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'daily_schedule' || activeTab === 'schedule' ? 'bg-red-600/10 text-red-500 font-bold border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                                <CalendarDays className="w-5 h-5" /> <span className="font-medium">Escala Diária & Plantão</span>
                            </button>
                            <button onClick={() => { setActiveTab('demands'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'demands' ? 'bg-red-600/10 text-red-500 font-bold border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                                <Database className="w-5 h-5" /> <span className="font-medium">Lançamentos</span>
                            </button>
                            <button onClick={() => { setActiveTab('orgchart'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'orgchart' ? 'bg-red-600/10 text-red-500 font-bold border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                                <Network className="w-5 h-5" /> <span className="font-medium">Organograma</span>
                            </button>
                        </div>

                        <div className="p-4 border-t border-zinc-800 shrink-0 bg-zinc-950/50">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setIsMobileMenuOpen(false); setIsPasswordModalOpen(true); }}
                                    className="flex-1 py-2 text-xs font-semibold text-zinc-400 hover:text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                                >
                                    <KeyRound className="w-3.5 h-3.5" /> Senha
                                </button>
                                <button
                                    onClick={() => { setIsMobileMenuOpen(false); setIsLogoutModalOpen(true); }}
                                    className="flex-1 py-2 text-xs font-semibold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                                >
                                    <LogOut className="w-3.5 h-3.5" /> Sair
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 relative">
                {/* Barra de Topo com Seletor Rápido de Tema (z-50 para sobrepor cabeçalhos sticky de tabelas) */}
                <header className="h-14 border-b border-gray-200 bg-white px-4 sm:px-6 flex items-center justify-between shrink-0 z-50 relative shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                        <button 
                            type="button"
                            onClick={() => setIsMobileMenuOpen(true)} 
                            className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 md:hidden transition-colors cursor-pointer shrink-0" 
                            title="Abrir Menu de Navegação"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 min-w-0">
                            <span className="text-gray-400 hidden sm:inline">HubDesk</span>
                            <span className="text-gray-300 hidden sm:inline">/</span>
                            <span className="text-gray-900 font-bold truncate">
                                {currentTabLabel}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <NotificationBell />
                        <ThemeSelector variant="compact" />
                    </div>
                </header>

                <div className="flex-1 overflow-hidden flex flex-col">
                    {renderContent()}
                </div>
                <ExtensionsBalloon />
            </main>

            {/* MODAL DE ALTERAÇÃO DE SENHA */}
            <ChangePasswordModal 
                isOpen={isPasswordModalOpen} 
                onClose={() => setIsPasswordModalOpen(false)} 
                showToast={showToast} 
            />

            {/* MODAL DE CONFIRMAÇÃO DE LOGOUT */}
            <LogoutConfirmModal
                isOpen={isLogoutModalOpen}
                onClose={() => setIsLogoutModalOpen(false)}
                onConfirm={logout}
                userName={currentUser?.name}
            />

            {/* MODAL DE CHANGELOG DA VERSÃO 3.1 */}
            <VersionChangelogModal
                isOpen={isChangelogModalOpen}
                onClose={() => setIsChangelogModalOpen(false)}
            />

        </div>
    );
};

export default CollaboratorDashboard;

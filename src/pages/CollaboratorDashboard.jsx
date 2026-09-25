import React, { useState, useEffect, useMemo } from 'react';
import {
    Clock, Target, RefreshCw, Star, Phone, MessageSquare,
    ShieldCheck, Rocket, User, Hourglass, BarChart2, History, LogOut,
    Search, Eye, X, Database, TrendingUp, Users, CheckCircle, Filter,
    KeyRound, Settings, Activity, Calendar, CalendarDays, Network, FileText, Menu
} from 'lucide-react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { logout } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import ReactMarkdown from 'react-markdown';
import Reports from './Reports';
import DailyQueueTracker from './DailyDemandLaunch'
import SundaySchedule from './SundaySchedule'; // ADICIONE ESTA LINHA
import DailySchedule from './DailySchedule';
import OrgChart from './OrgChart';
import ChangePasswordModal from '../components/ChangePasswordModal';
import LogoutConfirmModal from '../components/LogoutConfirmModal';
import VersionChangelogModal from '../components/VersionChangelogModal';
import ThemeSelector from '../components/ThemeSelector';
import MyHistory from './MyHistory';
import MyProfile from './MyProfile';
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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const { currentUser } = useAuth();
    const { showToast } = useNotification();

    // Estados dos Modais
    const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);

    const currentTabLabel = useMemo(() => {
        const labels = {
            profile: 'Meu Perfil',
            dashboard: 'Meu Desempenho',
            history: 'Meu Histórico',
            reports: 'Relatórios Individuais',
            schedule: 'Escala de Domingo',
            daily_schedule: 'Escala Diária',
            orgchart: 'Organograma Operacional',
            DailyQueueTracker: 'Lançamento de Demandas'
        };
        return labels[activeTab] || 'Meu Espaço';
    }, [activeTab]);

    const renderContent = () => {
        switch (activeTab) {
            case 'profile':
                return <MyProfile currentUserId={currentUserId} currentUser={currentUser} />;
            case 'dashboard':
                return <MyDashboardOverview currentUserId={currentUserId} currentUser={currentUser} />;
            case 'history':
                return <MyHistory currentUserId={currentUserId} />;
            case 'reports':
                return <Reports />;
            case 'schedule':
                return <SundaySchedule readOnly={true} />; // ADICIONE ESTA LINHA
            case 'daily_schedule':
                return <DailySchedule readOnly={true} />;
            case 'orgchart':
                return <OrgChart readOnly={true} />;
            case 'DailyQueueTracker':
                return <DailyQueueTracker />;
            default:
                return <MyDashboardOverview currentUserId={currentUserId} currentUser={currentUser} />;

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
                    <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'profile' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                        <User className="w-5 h-5" />
                        <span className="font-medium">Meu Perfil</span>
                    </button>

                    <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                        <BarChart2 className="w-5 h-5" />
                        <span className="font-medium">Dashboard</span>
                    </button>



                    <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'history' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                        <History className="w-5 h-5" />
                        <span className="font-medium">Meu Histórico</span>
                    </button>

                    {/* ADICIONE O NOVO BOTÃO DA ESCALA AQUI */}
                    <button onClick={() => setActiveTab('schedule')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'schedule' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                        <Calendar className="w-5 h-5" /> <span className="font-medium">Escala de Plantão</span>
                    </button>

                    {/* NOVO BOTÃO: ESCALA DIÁRIA */}
                    <button onClick={() => setActiveTab('daily_schedule')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'daily_schedule' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                        <CalendarDays className="w-5 h-5" /> <span className="font-medium">Escala Diária</span>
                    </button>

                    <button onClick={() => setActiveTab('reports')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'reports' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                        <ShieldCheck className="w-5 h-5" />
                        <span className="font-medium">Relatórios Críticos</span>
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



                <div className="p-4 border-t border-zinc-800 shrink-0 bg-zinc-950/50 space-y-1">
                    <div className="flex items-center gap-3 mb-3 px-2">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
                            <User className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div className="overflow-hidden">
                            <p className="text-sm font-medium text-white truncate" title={currentUser?.name}>
                                {currentUser?.name || 'Colaborador'}
                            </p>
                            <p className="text-xs text-zinc-500 truncate" title={currentUser?.role}>
                                {currentUser?.role || 'Atendimento'}
                            </p>
                        </div>
                    </div>

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

                        <div className="p-4 flex-1 space-y-1 overflow-y-auto">
                            <button onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-red-600/10 text-red-500 font-bold border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                                <Activity className="w-5 h-5" /> <span className="font-medium">Meu Desempenho</span>
                            </button>
                            <button onClick={() => { setActiveTab('history'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${activeTab === 'history' ? 'bg-red-600/10 text-red-500 font-bold border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                                <History className="w-5 h-5" /> <span className="font-medium">Meu Histórico</span>
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
                {/* Barra de Topo com Seletor Rápido de Tema */}
                <header className="h-14 border-b border-gray-200 bg-white px-4 sm:px-6 flex items-center justify-between shrink-0 z-10 shadow-2xs">
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

const timeToDecimal = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length !== 3) return 0;
    return (parseInt(parts[0], 10) * 60) + parseInt(parts[1], 10) + (parseInt(parts[2], 10) / 60);
};

const formatTime = (decimalMinutes) => {
    if (!decimalMinutes && decimalMinutes !== 0) return "00:00:00";
    const totalSeconds = Math.round(decimalMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const TrendIndicator = ({ type, current, previous }) => {
    if (!current || !previous) return null;
    let isUp = false; let isGood = false;
    if (type === 'tmr') {
        const curVal = timeToDecimal(current); const prevVal = timeToDecimal(previous);
        if (curVal === prevVal) return null; isUp = curVal > prevVal; isGood = curVal < prevVal;
    } else if (type === 'fcr') {
        const curVal = Number(current); const prevVal = Number(previous);
        if (curVal === prevVal) return null; isUp = curVal > prevVal; isGood = curVal > prevVal;
    } else if (type === 'recurrence') {
        const curVal = Number(current); const prevVal = Number(previous);
        if (curVal === prevVal) return null; isUp = curVal > prevVal; isGood = curVal < prevVal;
    }
    const colorClass = isGood ? "fill-emerald-500" : "fill-red-500";
    const pathObj = isUp ? "M12 4l8 16H4z" : "M12 20l8-16H4z";
    return <svg className={`w-4 h-4 mb-1.5 ${colorClass}`} viewBox="0 0 24 24"><path d={pathObj} /></svg>;
};

// ==========================================
// SUB-COMPONENTE: Visão Geral do Colaborador
// ==========================================
const MyDashboardOverview = ({ currentUserId, currentUser }) => {
    const [loading, setLoading] = useState(true);
    const [globalKpi, setGlobalKpi] = useState({ tmr: '00:00:00', fcr: 0, recurrence: 0 });
    const [prevGlobalKpi, setPrevGlobalKpi] = useState(null);
    const [goals, setGoals] = useState({ tmr: '00:20:00', fcr: 80, recurrence: 20 });
    const [allEvals, setAllEvals] = useState([]);
    const [colabsFull, setColabsFull] = useState({});

    const [myTaskToday, setMyTaskToday] = useState(null);
    const [nextSundayShift, setNextSundayShift] = useState(null);

    const [reportStats, setReportCounts] = useState({ pending: 0, inProgress: 0, resolved: 0 });
    const [unreadFeedbacks, setUnreadFeedbacks] = useState(0);
    const [myAudits, setMyAudits] = useState([]);

    const formatChartDate = (dateString) => {
        if (!dateString) return '';
        const parts = dateString.split('/');
        return parts.length === 3 ? `${parts[0]}/${parts[1]}` : dateString;
    };

    useEffect(() => {

        const unsubSchedule = onSnapshot(doc(db, "daily_schedules", "fixed_schedule"), (docSnap) => {
            if (docSnap.exists()) {
                const assignments = docSnap.data().assignments || {};
                const dayMap = { 0: 'domingo', 1: 'segunda', 2: 'terca', 3: 'quarta', 4: 'quinta', 5: 'sexta', 6: 'sabado' };
                const todayId = dayMap[new Date().getDay()];

                if (todayId && assignments[todayId]) {
                    const dayData = assignments[todayId];
                    let task = null;
                    if (dayData.telefonia?.find(u => u.id === currentUserId)) task = "Telefonia";
                    else if (dayData.huggy?.find(u => u.id === currentUserId)) task = "Huggy";
                    else if (dayData.apoio?.find(u => u.id === currentUserId)) task = "Apoio";
                    setMyTaskToday(task);
                } else {
                    setMyTaskToday(null);
                }
            }
        });

        // LÓGICA CORRIGIDA: Buscar próximo domingo em toda a coleção (todos os meses)
        const qSunday = query(collection(db, "sunday_schedules"));
        const unsubSunday = onSnapshot(qSunday, (querySnapshot) => {
            let next = null;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Percorre todos os documentos da coleção (cada documento é um mês)
            querySnapshot.forEach((doc) => {
                const assignments = doc.data().assignments || {};

                // Percorre todos os dias registrados nesse mês
                for (const [dateStr, colabs] of Object.entries(assignments)) {
                    // Verifica se o colaborador está escalado neste dia
                    if (colabs.some(c => c.id === currentUserId)) {
                        const shiftDate = new Date(dateStr + 'T00:00:00');

                        // Se a data for igual ou futura a hoje
                        if (shiftDate >= today) {
                            // Se ainda não temos um próximo, ou se esta data é mais próxima que a anterior salva
                            if (!next || shiftDate < new Date(next)) {
                                next = dateStr;
                            }
                        }
                    }
                }
            });
            setNextSundayShift(next);
        });

        const unsubGoals = onSnapshot(doc(db, "system_settings", "sector_goals"), (docSnap) => {
            if (docSnap.exists()) setGoals(docSnap.data());
        });

        const unsubKpi = onSnapshot(collection(db, "sector_kpis"), (snap) => {
            const kpis = [];
            snap.forEach(d => kpis.push(d.data()));
            kpis.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            if (kpis.length > 0) { setGlobalKpi(kpis[0]); if (kpis.length > 1) setPrevGlobalKpi(kpis[1]); }
        });

        const unsubColabs = onSnapshot(collection(db, "collaborators"), (snap) => {
            const map = {}; snap.forEach(d => map[d.id] = d.data()); setColabsFull(map);
        });

        const unsubEvals = onSnapshot(collection(db, "weekly_evaluations"), (snap) => {
            const evals = []; snap.forEach(d => evals.push({ id: d.id, ...d.data() }));
            evals.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
            setAllEvals(evals); setLoading(false);
        });

        const qReports = query(collection(db, "critical_reports"), where("creatorId", "==", currentUserId));
        const unsubReports = onSnapshot(qReports, (snap) => {
            let pending = 0; let inProgress = 0; let resolved = 0;
            snap.forEach(doc => {
                const data = doc.data();
                if (data.status === 'Pendente') pending++;
                if (data.status === 'Em Andamento') inProgress++;
                if (data.status === 'Resolvido') resolved++;
            });
            setReportCounts({ pending, inProgress, resolved });
        });

        const unsubFeedbacks = onSnapshot(collection(db, "feedbacks"), (snap) => {
            let unreadCount = 0;
            snap.forEach(doc => {
                const data = doc.data();
                if ((data.colabId === currentUserId || data.collaboratorId === currentUserId) && !data.read) {
                    unreadCount++;
                }
            });
            setUnreadFeedbacks(unreadCount);
        });

        const qAudits = query(collection(db, "qa_audits"), where("colabId", "==", currentUserId));
        const unsubAudits = onSnapshot(qAudits, (snap) => {
            const fetched = [];
            snap.forEach(d => fetched.push(d.data()));
            setMyAudits(fetched);
        });



        return () => { unsubKpi(); unsubEvals(); unsubGoals(); unsubColabs(); unsubReports(); unsubFeedbacks(); unsubAudits(); unsubSchedule(); unsubSunday(); };
    }, [currentUserId]);

    const formatDateBR = (dateStr) => {
        if (!dateStr) return '';
        const [_y, m, d] = dateStr.split('-');
        return `${d}/${m}`;
    };

    const qaStats = useMemo(() => {
        const total = myAudits.length;
        const conformes = myAudits.filter(a => a.status === 'Conforme').length;
        const taxa = total > 0 ? ((conformes / total) * 100).toFixed(1) : "0.0";
        return { total, taxa };
    }, [myAudits]);

    const { myStats, chartData, shiftAvgPts } = useMemo(() => {
        const defaultStats = { totalPoints: 0, avgPoints: 0, avgTmaTel: '00:00:00', avgTmaHuggy: '00:00:00' };
        if (allEvals.length === 0) return { myStats: defaultStats, chartData: [], shiftAvgPts: 0 };

        const myEvals = allEvals.filter(e => e.colabId === currentUserId || e.collaboratorId === currentUserId);
        let sumPoints = 0, sumTmaTel = 0, sumTmaHuggy = 0;
        const formattedChartData = [];

        myEvals.forEach(e => {
            let pts = e.pontuacao ?? (Number(e.Atendimentos_Finalizados || 0) * 1 + Number(e.Ligacoes_Atendidas || 0) * 2 + Number(e.Atendimentos_Huggy || 0) * 1 + Number(e.Ligacoes_Perdidas || 0) * -5);
            const telDec = timeToDecimal(e.TMA_Telefonia); const huggyDec = timeToDecimal(e.TMA_Huggy);
            sumPoints += pts; sumTmaTel += telDec; sumTmaHuggy += huggyDec;
            formattedChartData.push({ date: formatChartDate(e.date), pontos: pts, tmaTelDec: telDec, tmaHuggyDec: huggyDec });
        });

        const count = myEvals.length || 1;
        const latestDate = allEvals.reduce((max, e) => (e.date > max ? e.date : max), '');
        const currentWeekAll = allEvals.filter(e => e.date === latestDate);
        const myShift = currentUser?.shift || colabsFull[currentUserId]?.shift || 'Manhã';
        const isDayShift = myShift === 'Manhã' || myShift === 'Tarde';

        let shiftSum = 0; let shiftCount = 0;
        currentWeekAll.forEach(e => {
            const cId = e.colabId || e.collaboratorId;
            const cShift = colabsFull[cId]?.shift || 'Manhã';
            if (isDayShift === (cShift === 'Manhã' || cShift === 'Tarde')) {
                shiftSum += e.pontuacao ?? 0; shiftCount++;
            }
        });

        return {
            myStats: { totalPoints: sumPoints, avgPoints: (sumPoints / count).toFixed(1), avgTmaTel: formatTime(sumTmaTel / count), avgTmaHuggy: formatTime(sumTmaHuggy / count) },
            chartData: formattedChartData,
            shiftAvgPts: shiftCount > 0 ? Math.round(shiftSum / shiftCount) : 0
        };
    }, [allEvals, currentUserId, currentUser, colabsFull]);

    if (loading) {
        return <div className="flex-1 flex items-center justify-center bg-gray-50 h-full"><Hourglass className="w-8 h-8 text-red-600 animate-spin" /></div>;
    }

    return (
        <div className="flex-1 p-6 h-full overflow-y-auto bg-gray-50 flex flex-col space-y-8">

            {/* CARDS DE PLANTÃO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card Plantão Hoje */}
                <div className={`p-4 rounded-xl border flex items-center gap-4 shadow-xs ${myTaskToday ? 'bg-red-900 text-white border-red-900 shadow-sm' : 'bg-white border-gray-200'}`}>
                    <div className={`p-3 rounded-lg ${myTaskToday ? 'bg-red-700' : 'bg-gray-100'}`}>
                        <CalendarDays className={`w-6 h-6 ${myTaskToday ? 'text-white' : 'text-gray-500'}`} />
                    </div>
                    <div>
                        <p className={`text-xs font-bold uppercase tracking-widest ${myTaskToday ? 'text-white' : 'text-gray-400'}`}>minha tarefa de hoje</p>
                        <h2 className="text-xl font-black">
                            {myTaskToday ? `${myTaskToday}` : "Sem escala para hoje"}
                        </h2>
                    </div>
                </div>

                {/* Card Próximo Domingo */}
                <div className={`p-4 rounded-xl border flex items-center gap-4 shadow-xs ${nextSundayShift ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white border-gray-200'}`}>
                    <div className={`p-3 rounded-lg ${nextSundayShift ? 'bg-emerald-700' : 'bg-gray-100'}`}>
                        <Users className={`w-6 h-6 ${nextSundayShift ? 'text-white' : 'text-gray-500'}`} />
                    </div>
                    <div>
                        <p className={`text-xs font-bold uppercase tracking-widest ${nextSundayShift ? 'text-emerald-200' : 'text-gray-400'}`}>Próximo Plantão Domingo</p>
                        <h2 className="text-xl font-black">
                            {nextSundayShift ? `Dia ${formatDateBR(nextSundayShift)}` : "Nenhum plantão agendado"}
                        </h2>
                    </div>
                </div>
            </div>
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white p-6 rounded-xl border border-gray-200 shadow-xs gap-4 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Meu Desempenho</h1>
                    <p className="text-sm text-gray-500">Visão geral de indicadores e qualidade.</p>
                </div>

                <div className="flex flex-wrap gap-4 w-full xl:w-auto mt-4 xl:mt-0">
                    <div className="flex-1 sm:flex-none flex items-center gap-3 bg-gradient-to-br from-fuchsia-500 to-fuchsia-600 px-4 py-2.5 rounded-lg border border-fuchsia-400 shadow-sm min-w-[140px]">
                        <div className="p-1.5 bg-white/20 rounded-md shrink-0">
                            <MessageSquare className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-fuchsia-100 uppercase tracking-tight line-clamp-1">Feedbacks Novos</span>
                            <span className="text-xl font-black text-white leading-tight">{unreadFeedbacks}</span>
                        </div>
                    </div>

                    <div className="flex-1 sm:flex-none flex items-center gap-3 bg-gradient-to-br from-amber-500 to-amber-600 px-4 py-2.5 rounded-lg border border-amber-400 shadow-sm min-w-[140px]">
                        <div className="p-1.5 bg-white/20 rounded-md shrink-0">
                            <Clock className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-amber-100 uppercase tracking-tight line-clamp-1">Relatos Pendentes</span>
                            <span className="text-xl font-black text-white leading-tight">{reportStats.pending}</span>
                        </div>
                    </div>

                    <div className="flex-1 sm:flex-none flex items-center gap-3 bg-gradient-to-br from-blue-500 to-blue-600 px-4 py-2.5 rounded-lg border border-blue-400 shadow-sm min-w-[140px]">
                        <div className="p-1.5 bg-white/20 rounded-md shrink-0">
                            <Hourglass className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-blue-100 uppercase tracking-tight line-clamp-1">Em Andamento</span>
                            <span className="text-xl font-black text-white leading-tight">{reportStats.inProgress}</span>
                        </div>
                    </div>

                    <div className="flex-1 sm:flex-none flex items-center gap-3 bg-gradient-to-br from-emerald-500 to-emerald-600 px-4 py-2.5 rounded-lg border border-emerald-400 shadow-sm min-w-[140px]">
                        <div className="p-1.5 bg-white/20 rounded-md shrink-0">
                            <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-emerald-100 uppercase tracking-tight line-clamp-1">Relatos Concluídos</span>
                            <span className="text-xl font-black text-white leading-tight">{reportStats.resolved}</span>
                        </div>
                    </div>

                </div>
            </header>


            <div className="mb-8">
                <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4"><Rocket className="w-4 h-4 text-gray-500" /> KPIs Globais do Setor</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <DashboardCard title="TMR Global" value={globalKpi.tmr || '00:00:00'} subtitle="Tempo Médio Resolução" goalText={`Meta: ≤ ${goals.tmr}`} icon={<Clock className="w-5 h-5 text-purple-500" />} trend={<TrendIndicator type="tmr" current={globalKpi.tmr} previous={prevGlobalKpi?.tmr} />} />
                    <DashboardCard title="FCR Global" value={`${globalKpi.fcr || 0}%`} subtitle="First Call Resolution" goalText={`Meta: ≥ ${goals.fcr}%`} icon={<Target className="w-5 h-5 text-rose-500" />} trend={<TrendIndicator type="fcr" current={globalKpi.fcr} previous={prevGlobalKpi?.fcr} />} />
                    <DashboardCard title="Reincidência" value={`${globalKpi.recurrence || 0}%`} subtitle="Taxa de Retorno" goalText={`Meta: ≤ ${goals.recurrence}%`} icon={<RefreshCw className="w-5 h-5 text-blue-500" />} trend={<TrendIndicator type="recurrence" current={globalKpi.recurrence} previous={prevGlobalKpi?.recurrence} />} />
                </div>
            </div>

            <div className="mb-8">
                <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4"><User className="w-4 h-4 text-gray-500" /> Minhas Médias (Geral) & Qualidade</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <DashboardCard title="Pontuação (Acumulada)" value={myStats.totalPoints} subtitle={<span>Média semanal: <strong>{myStats.avgPoints} pts</strong></span>} icon={<Star className="w-5 h-5 text-emerald-500" />} />
                    <DashboardCard title="Média do Meu Turno" value={shiftAvgPts} subtitle="Última semana (Equipe)" icon={<Users className="w-5 h-5 text-blue-500" />} />
                    <DashboardCard title="Média TMA Tel" value={myStats.avgTmaTel} subtitle="Tempo médio em linha" icon={<Phone className="w-5 h-5 text-rose-500" />} />
                    <DashboardCard title="Média TMA Chat" value={myStats.avgTmaHuggy} subtitle="Tempo médio no Huggy" icon={<MessageSquare className="w-5 h-5 text-indigo-400" />} />
                    <DashboardCard title="Conformidade QA" value={`${qaStats.taxa}%`} subtitle={`Baseado em ${qaStats.total} auditorias`} icon={<ShieldCheck className="w-5 h-5 text-amber-500" />} />
                </div>
            </div>

            <div>
                <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4"><TrendingUp className="w-4 h-4 text-gray-500" /> Evolução Temporal</h2>
                {chartData.length === 0 ? <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm text-center text-gray-400">Nenhuma avaliação registrada para desenhar o gráfico.</div> : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs h-72 flex flex-col"><h3 className="text-sm font-bold text-gray-700 mb-4 shrink-0">Produtividade</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><defs><linearGradient id="colorPts" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} /><Area type="monotone" dataKey="pontos" stroke="#10b981" strokeWidth={2} fill="url(#colorPts)" /></AreaChart></ResponsiveContainer></div></div>
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs h-72 flex flex-col"><h3 className="text-sm font-bold text-gray-700 mb-4 shrink-0">TMA Telefonia</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><defs><linearGradient id="colorTel" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={formatTime} /><Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} formatter={val => [formatTime(val), "TMA Tel"]} /><Area type="monotone" dataKey="tmaTelDec" stroke="#3b82f6" strokeWidth={2} fill="url(#colorTel)" /></AreaChart></ResponsiveContainer></div></div>
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs h-72 flex flex-col"><h3 className="text-sm font-bold text-gray-700 mb-4 shrink-0">TMA Huggy</h3><div className="flex-1 min-h-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}><defs><linearGradient id="colorHuggy" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={formatTime} /><Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} formatter={val => [formatTime(val), "TMA Huggy"]} /><Area type="monotone" dataKey="tmaHuggyDec" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorHuggy)" /></AreaChart></ResponsiveContainer></div></div>
                    </div>
                )}
            </div>
        </div>
    );
};

const DashboardCard = ({ title, value, subtitle, goalText, icon, trend }) => (
    <div className="bg-white rounded-xl shadow-xs p-5 border border-gray-200 flex flex-col relative overflow-hidden h-full">
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
            <div className="p-1 bg-gray-50 rounded-full border border-gray-100">{icon}</div>
        </div>
        <div className="flex items-end gap-2 mt-1"><div className="text-3xl font-extrabold tracking-tight text-gray-900">{value}</div>{trend}</div>
        <div className="mt-2 pt-2 border-t border-gray-50 flex justify-between items-center">
            <div className="text-[10px] text-gray-400 font-medium">{subtitle}</div>
            {goalText && <div className="text-[10px] text-gray-500 font-bold bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{goalText}</div>}
        </div>
    </div>
);

export default CollaboratorDashboard;

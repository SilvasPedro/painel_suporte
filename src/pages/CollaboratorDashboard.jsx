import React, { useState, useEffect, useMemo } from 'react';
import { 
    Clock, Target, RefreshCw, Star, Phone, MessageSquare, 
    ShieldCheck, Rocket, User, Loader2, BarChart2, History, LogOut,
    Search, Eye, X, Database, TrendingUp, Settings as SettingsIcon, Users, CheckCircle, Filter
} from 'lucide-react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { logout } from '../services/auth';
import { useAuth } from '../context/AuthContext'; 
import Settings from './Settings';
import Reports from './Reports'; 

// --- DICIONÁRIO DE TRADUÇÃO ---
const translateKey = (key) => {
    const dictionary = {
        createdBy: 'Criado por',
        protocol: 'Protocolo',
        comment: 'Comentário',
        method: 'Meio / Canal',
        type: 'Tipo',
        date: 'Data Referência',
        fcr: 'FCR (%)',
        tmr: 'TMR',
        recurrence: 'Reincidência (%)',
        Atendimentos_Finalizados: 'Atendimentos Finalizados',
        Atendimentos_Huggy: 'Atendimentos Huggy',
        Ligacoes_Atendidas: 'Ligações Atendidas',
        Ligacoes_Perdidas: 'Ligações Perdidas',
        TMA_Telefonia: 'TMA Telefonia',
        TMA_Huggy: 'TMA Huggy',
        TME_Telefonia: 'TME Telefonia',
        pontuacao: 'Pontuação'
    };
    return dictionary[key] || key;
};

// --- FUNÇÃO PARA CONVERTER DATA EM VALOR MATEMÁTICO (USADA PARA ORDENAÇÃO) ---
const parseDateObj = (dateStr) => {
    if (!dateStr) return 0;
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) {
            return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
        }
    }
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
        }
    }
    return 0;
};

const CollaboratorDashboard = ({ currentUserId }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const { currentUser } = useAuth(); 

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <MyDashboardOverview currentUserId={currentUserId} currentUser={currentUser} />;
            case 'history':
                return <MyHistory currentUserId={currentUserId} />;
            case 'reports':
                return <Reports />;
            case 'settings':
                return <Settings />;
            default:
                return <MyDashboardOverview currentUserId={currentUserId} currentUser={currentUser} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex overflow-hidden">
            <aside className="w-64 bg-zinc-950 text-white flex flex-col hidden md:flex shrink-0 border-r border-zinc-800">
                <div className="p-6 flex items-center gap-3 border-b border-zinc-800 shrink-0">
                    <div className="p-2 bg-red-600 rounded-lg">
                        <BarChart2 className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-lg font-bold tracking-wider">HUB<span className="text-red-500">DESK</span></span>
                </div>
                
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                        <BarChart2 className="w-5 h-5" />
                        <span className="font-medium">Dashboard</span>
                    </button>

                    <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'history' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                        <History className="w-5 h-5" />
                        <span className="font-medium">Meu Histórico</span>
                    </button>

                    <button onClick={() => setActiveTab('reports')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'reports' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                        <ShieldCheck className="w-5 h-5" />
                        <span className="font-medium">Relatórios Críticos</span>
                    </button>

                    <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                        <SettingsIcon className="w-5 h-5" />
                        <span className="font-medium">Configurações</span>
                    </button>
                </nav>

                <div className="p-4 border-t border-zinc-800 shrink-0 bg-zinc-950/50">
                    <div className="flex items-center gap-3 mb-4 px-2">
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
                    <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm font-medium">Sair do sistema</span>
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 relative">
                {renderContent()}
            </main>
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
    return <svg className={`w-4 h-4 mb-1.5 ${colorClass}`} viewBox="0 0 24 24"><path d={pathObj}/></svg>;
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
    const [reportStats, setReportCounts] = useState({ pending: 0, resolved: 0 });

    const formatChartDate = (dateString) => {
        if (!dateString) return '';
        const parts = dateString.split('/');
        return parts.length === 3 ? `${parts[0]}/${parts[1]}` : dateString;
    };

    useEffect(() => {
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
            let pending = 0; let resolved = 0;
            snap.forEach(doc => {
                const data = doc.data();
                if (data.status === 'Pendente') pending++;
                if (data.status === 'Resolvido') resolved++;
            });
            setReportCounts({ pending, resolved });
        });

        return () => { unsubKpi(); unsubEvals(); unsubGoals(); unsubColabs(); unsubReports(); };
    }, [currentUserId]);

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
        return <div className="flex-1 flex items-center justify-center bg-gray-50 h-full"><Loader2 className="w-8 h-8 text-red-600 animate-spin" /></div>;
    }

    return (
        <div className="flex-1 p-6 h-full overflow-y-auto">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Meu Desempenho</h1>
                    <p className="text-sm text-gray-500">Visão geral de indicadores e qualidade.</p>
                </div>
                
                <div className="flex gap-4 mt-4 md:mt-0">
                    <div className="flex items-center gap-3 bg-amber-50 px-4 py-2.5 rounded-lg border border-amber-100 shadow-sm">
                        <div className="p-1.5 bg-amber-500 rounded-md">
                            <Clock className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-tight">Relatos Pendentes</span>
                            <span className="text-xl font-black text-amber-900 leading-tight">{reportStats.pending}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-emerald-50 px-4 py-2.5 rounded-lg border border-emerald-100 shadow-sm">
                        <div className="p-1.5 bg-emerald-500 rounded-md">
                            <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">Relatos Concluídos</span>
                            <span className="text-xl font-black text-emerald-900 leading-tight">{reportStats.resolved}</span>
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
                    <DashboardCard title="Conformidade QA" value="87.5%" subtitle="Baseado em 8 auditorias" icon={<ShieldCheck className="w-5 h-5 text-amber-500" />} />
                </div>
            </div>

            <div>
                <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4"><TrendingUp className="w-4 h-4 text-gray-500" /> Evolução Temporal</h2>
                {chartData.length === 0 ? <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm text-center text-gray-400">Nenhuma avaliação registrada para desenhar o gráfico.</div> : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-72"><h3 className="text-sm font-bold text-gray-700 mb-4">Produtividade</h3><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="colorPts" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} /><Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} /><Area type="monotone" dataKey="pontos" stroke="#10b981" strokeWidth={2} fill="url(#colorPts)" /></AreaChart></ResponsiveContainer></div>
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-72"><h3 className="text-sm font-bold text-gray-700 mb-4">TMA Telefonia</h3><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="colorTel" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} tickFormatter={formatTime} /><Tooltip contentStyle={{borderRadius: '8px', border: 'none'}} formatter={val => [formatTime(val), "TMA Tel"]} /><Area type="monotone" dataKey="tmaTelDec" stroke="#3b82f6" strokeWidth={2} fill="url(#colorTel)" /></AreaChart></ResponsiveContainer></div>
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-72"><h3 className="text-sm font-bold text-gray-700 mb-4">TMA Huggy</h3><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="colorHuggy" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} dy={10} /><YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} tickFormatter={formatTime} /><Tooltip contentStyle={{borderRadius: '8px', border: 'none'}} formatter={val => [formatTime(val), "TMA Huggy"]} /><Area type="monotone" dataKey="tmaHuggyDec" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorHuggy)" /></AreaChart></ResponsiveContainer></div>
                    </div>
                )}
            </div>
        </div>
    );
};

const DashboardCard = ({ title, value, subtitle, goalText, icon, trend }) => (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200 flex flex-col relative overflow-hidden h-full">
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

// ==========================================
// SUB-COMPONENTE: MEU HISTÓRICO (COM FILTRO E ORDENAÇÃO CORRIGIDOS)
// ==========================================
const MyHistory = ({ currentUserId }) => {
    const [activeTab, setActiveTab] = useState('feedbacks'); 
    const [searchTerm, setSearchTerm] = useState(''); 
    const [dateFilter, setDateFilter] = useState('');
    
    const [data, setData] = useState([]); 
    const [loading, setLoading] = useState(true); 
    const [viewingItem, setViewingItem] = useState(null);

    const getSafeDateString = item => {
        if (item.date) { 
            if (typeof item.date === 'string' && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) { 
                const [y, m, d] = item.date.split('-'); 
                return `${d}/${m}/${y}`; 
            } 
            return item.date; 
        }
        return item.createdAt ? (typeof item.createdAt.toDate === 'function' ? item.createdAt.toDate().toLocaleDateString('pt-BR') : new Date(item.createdAt).toLocaleDateString('pt-BR')) : 'Sem data';
    };

    useEffect(() => {
        setLoading(true); 
        let col = activeTab === 'feedbacks' ? 'feedbacks' : 'weekly_evaluations';
        const q = query(collection(db, col)); 
        
        const unsub = onSnapshot(q, snap => {
            const res = []; 
            snap.forEach(d => { 
                const dt = d.data(); 
                if (dt.colabId === currentUserId || dt.collaboratorId === currentUserId) {
                    res.push({ id: d.id, ...dt }); 
                }
            });
            
            // AQUI É A MÁGICA DA ORDENAÇÃO: 
            // Lê o texto da data de referência e ordena em ORDEM CRESCENTE baseada nela.
            res.sort((a, b) => {
                const timeA = a.date ? parseDateObj(a.date) : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
                const timeB = b.date ? parseDateObj(b.date) : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
                return timeA - timeB; 
            });
            
            setData(res); 
            setLoading(false);
        });
        return () => unsub();
    }, [activeTab, currentUserId]);

    // Extrai os meses e datas disponíveis no banco para montar a lista suspensa
    const filterOptions = useMemo(() => {
        const months = new Set();
        const dates = new Set();

        data.forEach(item => {
            const safeDate = getSafeDateString(item);
            if (safeDate && safeDate !== 'Sem data' && safeDate !== 'Data inválida') {
                dates.add(safeDate);
                const parts = safeDate.split('/');
                if (parts.length === 3) {
                    months.add(`${parts[1]}/${parts[2]}`);
                }
            }
        });

        const sortedDates = Array.from(dates).sort((a, b) => parseDateObj(b) - parseDateObj(a));
        const sortedMonths = Array.from(months).sort((a, b) => {
            const [m1, y1] = a.split('/');
            const [m2, y2] = b.split('/');
            return new Date(y2, m2 - 1, 1).getTime() - new Date(y1, m1 - 1, 1).getTime();
        });

        return { months: sortedMonths, dates: sortedDates };
    }, [data]);

    const filteredData = data.filter(i => {
        const matchSearch = searchTerm === '' || (i.type && i.type.toLowerCase().includes(searchTerm.toLowerCase()));
        const safeDate = getSafeDateString(i);
        const matchDate = dateFilter === '' || safeDate.includes(dateFilter);
        return matchSearch && matchDate;
    });

    return (
        <div className="flex-1 p-6 h-full overflow-y-auto flex flex-col">
            <header className="mb-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm shrink-0">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><History className="w-6 h-6 text-red-600" />Meu Histórico</h1>
                <p className="text-sm text-gray-500">Acompanhe seus lançamentos e avaliações recebidas.</p>
            </header>
            
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 shrink-0 space-y-4">
                <div className="flex space-x-2 border-b border-gray-100 pb-4">
                    <button onClick={() => setActiveTab('feedbacks')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'feedbacks' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}><MessageSquare className="w-4 h-4"/> Feedbacks</button>
                    <button onClick={() => setActiveTab('metrics')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'metrics' ? 'bg-red-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}><TrendingUp className="w-4 h-4"/> Desempenho</button>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                        <input type="text" placeholder="Buscar por tipo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg outline-none text-sm" />
                    </div>
                    
                    {/* AQUI ESTÁ O NOVO FILTRO SUSPENSO INTELIGENTE DE DATA */}
                    <div className="md:w-64 relative">
                        <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                        <select 
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none text-sm appearance-none bg-white cursor-pointer text-gray-600 font-medium"
                        >
                            <option value="">Todo o Período</option>
                            {filterOptions.months.length > 0 && (
                                <optgroup label="Por Mês">
                                    {filterOptions.months.map(m => <option key={m} value={m}>{m}</option>)}
                                </optgroup>
                            )}
                            {filterOptions.dates.length > 0 && (
                                <optgroup label="Datas Específicas">
                                    {filterOptions.dates.map(d => <option key={d} value={d}>{d}</option>)}
                                </optgroup>
                            )}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                {loading ? <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 text-red-600 animate-spin" /></div> : filteredData.length === 0 ? <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center"><Database className="w-12 h-12 mb-3 opacity-20" /><p className="text-lg font-medium text-gray-500">Nenhum registro encontrado com estes filtros.</p></div> : (
                    <div className="overflow-x-auto flex-1">
                        <table className="min-w-full divide-y divide-gray-200 text-sm whitespace-nowrap">
                            <thead className="bg-zinc-950 text-white sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-left font-semibold">Data</th>
                                    <th className="px-6 py-3 text-left font-semibold">Resumo</th>
                                    <th className="px-6 py-3 text-right font-semibold">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredData.map(i => (
                                    <tr key={i.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-gray-500">{getSafeDateString(i)}</td>
                                        <td className="px-6 py-4">{activeTab === 'feedbacks' ? <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${i.type === 'Elogio' ? 'bg-emerald-100 text-emerald-700' : i.type === 'Ponto de Melhoria' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>{i.type}</span> : <span className="text-gray-600">Pontuação: <strong className="text-gray-900">{i.pontuacao || 0} pts</strong></span>}</td>
                                        <td className="px-6 py-4 text-right"><button onClick={() => setViewingItem(i)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1 ml-auto"><Eye className="w-4 h-4" /> <span className="text-xs font-bold">Ler</span></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {viewingItem && (
                <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-4 bg-zinc-950 text-white flex justify-between items-center">
                            <h3 className="font-bold">Detalhes</h3>
                            <button onClick={() => setViewingItem(null)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
                        </div>
                        <div className="p-6 space-y-4 text-sm max-h-[60vh] overflow-y-auto">
                            {Object.entries(viewingItem).map(([k, v]) => { 
                                if (['id', 'createdAt', 'colabId', 'collaboratorId', 'colabName'].includes(k)) return null; 
                                return (
                                    <div key={k} className="border-b border-gray-100 pb-2">
                                        <span className="block text-xs font-bold text-gray-400 uppercase">{translateKey(k)}</span>
                                        <span className="block text-gray-900 mt-1 whitespace-pre-wrap">{v?.toString() || 'Vazio'}</span>
                                    </div>
                                ); 
                            })}
                        </div>
                        <div className="p-4 bg-gray-50 border-t border-gray-200">
                            <button onClick={() => setViewingItem(null)} className="w-full py-2 bg-gray-200 text-gray-800 rounded-lg font-medium hover:bg-gray-300">Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CollaboratorDashboard;
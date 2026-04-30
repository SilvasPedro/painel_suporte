import React, { useState, useEffect, useMemo } from 'react';
import { 
    Clock, Target, RefreshCw, Star, Phone, MessageSquare, 
    ShieldCheck, Rocket, User, Loader2, BarChart2, History, LogOut,
    Search, Calendar, Eye, X, Database, TrendingUp
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { logout } from '../services/auth';
import { useAuth } from '../context/AuthContext'; 

// --- DICIONÁRIO DE TRADUÇÃO (Reaproveitado do DataManager) ---
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

const CollaboratorDashboard = ({ currentUserId }) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const { currentUser } = useAuth(); 

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return <MyDashboardOverview currentUserId={currentUserId} />;
            case 'history':
                return <MyHistory currentUserId={currentUserId} />;
            case 'audits':
                return <div className="p-8 flex flex-col items-center justify-center text-gray-400 text-center h-full">
                    <ShieldCheck className="w-16 h-16 mb-4 opacity-20" />
                    <h2 className="text-xl font-bold text-gray-600 mb-2">Minhas Auditorias</h2>
                    <p>Este módulo está em desenvolvimento e estará disponível em breve.</p>
                </div>;
            default:
                return <MyDashboardOverview currentUserId={currentUserId} />;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex overflow-hidden">
            {/* SIDEBAR DO COLABORADOR */}
            <aside className="w-64 bg-zinc-950 text-white flex flex-col hidden md:flex shrink-0">
                <div className="p-6 flex items-center gap-3 border-b border-zinc-800 shrink-0">
                    <div className="p-2 bg-red-600 rounded-lg">
                        <BarChart2 className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-lg font-bold tracking-wider">SUPPORT<span className="text-red-500">SYS</span></span>
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

                    <button onClick={() => setActiveTab('audits')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'audits' ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'}`}>
                        <ShieldCheck className="w-5 h-5" />
                        <span className="font-medium">Minhas Auditorias</span>
                    </button>
                </nav>

                <div className="p-4 border-t border-zinc-800 shrink-0">
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

            {/* ÁREA PRINCIPAL DINÂMICA */}
            <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 relative">
                {renderContent()}
            </main>
        </div>
    );
};

// ==========================================
// FUNÇÕES DE CONVERSÃO & SETA DE TENDÊNCIA
// ==========================================
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
    if (current === undefined || previous === undefined || current === null || previous === null) return null;

    let isUp = false;
    let isGood = false;

    if (type === 'tmr') {
        const curVal = timeToDecimal(current);
        const prevVal = timeToDecimal(previous);
        if (curVal === prevVal) return null;
        isUp = curVal > prevVal;
        isGood = curVal < prevVal; 
    } else if (type === 'fcr') {
        const curVal = Number(current);
        const prevVal = Number(previous);
        if (curVal === prevVal) return null;
        isUp = curVal > prevVal;
        isGood = curVal > prevVal; 
    } else if (type === 'recurrence') {
        const curVal = Number(current);
        const prevVal = Number(previous);
        if (curVal === prevVal) return null;
        isUp = curVal > prevVal;
        isGood = curVal < prevVal; 
    }

    const colorClass = isGood ? "fill-emerald-500" : "fill-red-500";
    const pathObj = isUp ? "M12 4l8 16H4z" : "M12 20l8-16H4z"; 

    return (
        <svg className={`w-4 h-4 mb-1.5 ${colorClass}`} viewBox="0 0 24 24">
            <path d={pathObj}/>
        </svg>
    );
};

// ==========================================
// SUB-COMPONENTE: Visão Geral do Colaborador
// ==========================================
const MyDashboardOverview = ({ currentUserId }) => {
    const [loading, setLoading] = useState(true);
    const [globalKpi, setGlobalKpi] = useState({ tmr: '00:00:00', fcr: 0, recurrence: 0 });
    const [prevGlobalKpi, setPrevGlobalKpi] = useState(null); 
    const [myEvals, setMyEvals] = useState([]);

    const formatChartDate = (dateString) => {
        if (!dateString) return '';
        const parts = dateString.split('/');
        if (parts.length === 3) return `${parts[0]}/${parts[1]}`;
        return dateString;
    };

    useEffect(() => {
        const unsubKpi = onSnapshot(collection(db, "sector_kpis"), (snap) => {
            const kpis = [];
            snap.forEach(d => kpis.push(d.data()));
            kpis.sort((a, b) => {
                const da = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const dbDate = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return dbDate - da; 
            });
            
            if (kpis.length > 0) {
                setGlobalKpi(kpis[0]); 
                if (kpis.length > 1) {
                    setPrevGlobalKpi(kpis[1]); 
                }
            }
        });

        const qEvals = query(
            collection(db, "weekly_evaluations"),
            where("colabId", "==", currentUserId)
        );

        const unsubEvals = onSnapshot(qEvals, (snap) => {
            const evals = [];
            snap.forEach(d => evals.push({ id: d.id, ...d.data() }));
            
            evals.sort((a, b) => {
                const da = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                const dbDate = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
                return da - dbDate; 
            });
            
            setMyEvals(evals);
            setLoading(false);
        });

        return () => { unsubKpi(); unsubEvals(); };
    }, [currentUserId]);

    const { myStats, chartData } = useMemo(() => {
        const defaultStats = {
            totalPoints: 0, avgPoints: 0, avgTmaTel: '00:00:00', avgTmaHuggy: '00:00:00'
        };

        if (myEvals.length === 0) return { myStats: defaultStats, chartData: [] };

        let sumPoints = 0, sumTmaTel = 0, sumTmaHuggy = 0;
        const formattedChartData = [];

        myEvals.forEach(e => {
            let pts = e.pontuacao;
            if (pts === undefined) {
                pts = (Number(e.Atendimentos_Finalizados || 0) * 1) + 
                      (Number(e.Ligacoes_Atendidas || 0) * 2) + 
                      (Number(e.Atendimentos_Huggy || 0) * 1) + 
                      (Number(e.Ligacoes_Perdidas || 0) * -5);
            }

            const telDec = timeToDecimal(e.TMA_Telefonia);
            const huggyDec = timeToDecimal(e.TMA_Huggy);

            sumPoints += pts;
            sumTmaTel += telDec;
            sumTmaHuggy += huggyDec;

            formattedChartData.push({
                date: formatChartDate(e.date),
                pontos: pts,
                tmaTelDec: telDec,
                tmaHuggyDec: huggyDec
            });
        });

        const count = myEvals.length;

        return {
            myStats: {
                totalPoints: sumPoints,
                avgPoints: (sumPoints / count).toFixed(1),
                avgTmaTel: formatTime(sumTmaTel / count),
                avgTmaHuggy: formatTime(sumTmaHuggy / count)
            },
            chartData: formattedChartData
        };
    }, [myEvals]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 h-full">
                <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 h-full overflow-y-auto">
            <header className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900">Meu Desempenho</h1>
                <p className="text-sm text-gray-500">Visão geral de indicadores e qualidade.</p>
            </header>

            <div className="mb-8">
                <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <Rocket className="w-4 h-4 text-gray-500" /> KPIs Globais do Setor
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <DashboardCard 
                        title="TMR Global" 
                        value={globalKpi.tmr || '00:00:00'} 
                        subtitle="Tempo Médio Resolução" 
                        icon={<Clock className="w-5 h-5 text-gray-400" />}
                        trend={<TrendIndicator type="tmr" current={globalKpi.tmr} previous={prevGlobalKpi?.tmr} />}
                    />
                    <DashboardCard 
                        title="FCR Global" 
                        value={`${globalKpi.fcr || 0}%`} 
                        subtitle="First Call Resolution" 
                        icon={<Target className="w-5 h-5 text-gray-400" />}
                        trend={<TrendIndicator type="fcr" current={globalKpi.fcr} previous={prevGlobalKpi?.fcr} />}
                    />
                    <DashboardCard 
                        title="Reincidência" 
                        value={`${globalKpi.recurrence || 0}%`} 
                        subtitle="Taxa de Retorno" 
                        icon={<RefreshCw className="w-5 h-5 text-gray-400" />}
                        trend={<TrendIndicator type="recurrence" current={globalKpi.recurrence} previous={prevGlobalKpi?.recurrence} />}
                    />
                </div>
            </div>

            <div className="mb-8">
                <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <User className="w-4 h-4 text-gray-500" /> Minhas Médias (Geral) & Qualidade
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <DashboardCard 
                        title="Pontuação (Acumulada)" 
                        value={myStats.totalPoints} 
                        subtitle={<span>Média semanal: <strong>{myStats.avgPoints} pts</strong></span>} 
                        icon={<Star className="w-5 h-5 text-gray-400" />}
                    />
                    <DashboardCard 
                        title="Média TMA Tel" 
                        value={myStats.avgTmaTel} 
                        subtitle="Tempo médio em linha" 
                        icon={<Phone className="w-5 h-5 text-gray-400" />}
                    />
                    <DashboardCard 
                        title="Média TMA Chat" 
                        value={myStats.avgTmaHuggy} 
                        subtitle="Tempo médio no Huggy" 
                        icon={<MessageSquare className="w-5 h-5 text-gray-400" />}
                    />
                    <DashboardCard 
                        title="Conformidade QA" 
                        value="87.5%" 
                        subtitle="Baseado em 8 auditorias" 
                        icon={<ShieldCheck className="w-5 h-5 text-gray-400" />}
                    />
                </div>
            </div>

            <div>
                <h2 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <TrendingUp className="w-4 h-4 text-gray-500" /> Evolução Temporal
                </h2>

                {myEvals.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm text-center text-gray-400">
                        Nenhuma avaliação registrada no sistema para desenhar o gráfico.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-72">
                            <h3 className="text-sm font-bold text-gray-700 mb-4">Evolução de Produtividade</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorPts" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} />
                                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                                    <Area type="monotone" dataKey="pontos" name="Pontuação" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPts)" activeDot={{ r: 5 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-72">
                            <h3 className="text-sm font-bold text-gray-700 mb-4">TMA Telefonia</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorTel" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} tickFormatter={formatTime} />
                                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(val) => [formatTime(val), "TMA Telefonia"]} />
                                    <Area type="monotone" dataKey="tmaTelDec" name="TMA Telefonia" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorTel)" activeDot={{ r: 5 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col h-72">
                            <h3 className="text-sm font-bold text-gray-700 mb-4">TMA Huggy (Chat)</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorHuggy" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9CA3AF', fontSize: 11}} tickFormatter={formatTime} />
                                    <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} formatter={(val) => [formatTime(val), "TMA Huggy"]} />
                                    <Area type="monotone" dataKey="tmaHuggyDec" name="TMA Huggy" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorHuggy)" activeDot={{ r: 5 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

const DashboardCard = ({ title, value, subtitle, icon, trend }) => (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200 flex flex-col relative overflow-hidden">
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{title}</h3>
            <div className="p-1 bg-gray-50 rounded-full border border-gray-100">
                {icon}
            </div>
        </div>
        <div className="flex items-end gap-2 mt-1">
            <div className="text-3xl font-extrabold tracking-tight text-gray-900">
                {value}
            </div>
            {trend} 
        </div>
        <div className="text-xs text-gray-400 mt-2 font-medium">
            {subtitle}
        </div>
    </div>
);

// ==========================================
// SUB-COMPONENTE: MEU HISTÓRICO (SOMENTE LEITURA)
// ==========================================
const MyHistory = ({ currentUserId }) => {
    const [activeTab, setActiveTab] = useState('feedbacks'); 
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewingItem, setViewingItem] = useState(null);

    const getSafeDateString = (item) => {
        if (item.date) return item.date;
        if (item.createdAt) {
            if (typeof item.createdAt.toDate === 'function') {
                return new Date(item.createdAt.toDate()).toLocaleDateString('pt-BR');
            }
            try {
                return new Date(item.createdAt).toLocaleDateString('pt-BR');
            } catch (e) {
                return 'Data inválida';
            }
        }
        return 'Sem data';
    };

    useEffect(() => {
        setLoading(true);
        let currentCollection = '';
        let filterField = '';

        if (activeTab === 'feedbacks') {
            currentCollection = 'feedbacks';
            filterField = 'collaboratorId'; // ou 'colabId', dependendo de como você salva o feedback
        } else if (activeTab === 'metrics') {
            currentCollection = 'weekly_evaluations';
            filterField = 'colabId';
        }

        // Se tiver aba de auditorias depois, só adicionar o else if aqui!

        if (currentCollection) {
            // Importante: Filtra para buscar APENAS os dados deste colaborador!
            // Para garantir que o filtro funcione independente se a chave é colabId ou collaboratorId:
            // Usamos a mesma abordagem de buscar tudo do usuário e filtrar no JS para ser à prova de falhas,
            // ou se o banco estiver padronizado, usamos a query direto. Como não sei se você padronizou, 
            // vou buscar e filtrar pelo JS para garantir que não dê erro de index no Firebase.
            const q = query(collection(db, currentCollection)); 
            
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedData = [];
                snapshot.forEach((doc) => {
                    const docData = doc.data();
                    // Filtro super seguro: Se o ID do colaborador no doc for igual ao currentUserId
                    if (docData.colabId === currentUserId || docData.collaboratorId === currentUserId) {
                        fetchedData.push({ id: doc.id, ...docData });
                    }
                });
                
                fetchedData.sort((a, b) => {
                    const dateA = typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : 0;
                    const dateB = typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : 0;
                    return dateB - dateA;
                });
                
                setData(fetchedData);
                setLoading(false);
            });

            return () => unsubscribe();
        } else {
            setData([]);
            setLoading(false);
        }
    }, [activeTab, currentUserId]);

    const filteredData = data.filter(item => {
        const matchSearch = searchTerm === '' || 
            (item.type && item.type.toLowerCase().includes(searchTerm.toLowerCase()));
            
        const safeDate = getSafeDateString(item);
        const matchDate = dateFilter === '' || safeDate.includes(dateFilter);
            
        return matchSearch && matchDate;
    });

    return (
        <div className="flex-1 p-6 h-full overflow-y-auto flex flex-col">
            <header className="mb-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm shrink-0">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    <History className="w-6 h-6 text-red-600" />
                    Meu Histórico
                </h1>
                <p className="text-sm text-gray-500">Acompanhe seus lançamentos e avaliações recebidas.</p>
            </header>

            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 shrink-0 space-y-4">
                <div className="flex space-x-2 border-b border-gray-100 pb-4">
                    <button onClick={() => setActiveTab('feedbacks')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'feedbacks' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                        <MessageSquare className="w-4 h-4"/> Feedbacks
                    </button>
                    <button onClick={() => setActiveTab('metrics')} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${activeTab === 'metrics' ? 'bg-red-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}>
                        <TrendingUp className="w-4 h-4"/> Desempenho
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                        <input 
                            type="text" 
                            placeholder="Buscar por tipo de dado..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                        />
                    </div>
                    <div className="md:w-64 relative">
                        <Calendar className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                        <input 
                            type="text" 
                            placeholder="Filtrar data (ex: 13/04)"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex-1 flex flex-col overflow-hidden">
                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                        <Database className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-lg font-medium text-gray-500">Nenhum registro encontrado.</p>
                        <p className="text-sm">Você ainda não possui lançamentos nesta categoria.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto flex-1">
                        <table className="min-w-full divide-y divide-gray-200 text-sm whitespace-nowrap">
                            <thead className="bg-zinc-950 text-white sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3 text-left font-semibold">Data / Registro</th>
                                    <th className="px-6 py-3 text-left font-semibold">Resumo do Dado</th>
                                    <th className="px-6 py-3 text-right font-semibold">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredData.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 text-gray-500">
                                            {getSafeDateString(item)}
                                        </td>
                                        
                                        <td className="px-6 py-4">
                                            {activeTab === 'feedbacks' && (
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                                    item.type === 'Elogio' ? 'bg-emerald-100 text-emerald-700' : 
                                                    item.type === 'Ponto de Melhoria' ? 'bg-amber-100 text-amber-700' : 
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {item.type}
                                                </span>
                                            )}
                                            {activeTab === 'metrics' && (
                                                <span className="text-gray-600">
                                                    Finalizados: <strong className="text-gray-900">{item.Atendimentos_Finalizados || 0}</strong> | Pontuação: <strong className="text-gray-900">{item.pontuacao || 0} pts</strong>
                                                </span>
                                            )}
                                        </td>
                                        
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            <button onClick={() => setViewingItem(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1" title="Ver detalhes">
                                                <Eye className="w-4 h-4" /> <span className="text-xs font-bold">Lêr</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL DE VISUALIZAÇÃO SOMENTE LEITURA */}
            {viewingItem && (
                <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="p-4 bg-zinc-950 text-white flex justify-between items-center">
                            <h3 className="font-bold">Detalhes do Registro</h3>
                            <button onClick={() => setViewingItem(null)}><X className="w-5 h-5 text-gray-400 hover:text-white" /></button>
                        </div>
                        <div className="p-6 space-y-4 text-sm max-h-[60vh] overflow-y-auto">
                            {Object.entries(viewingItem).map(([key, value]) => {
                                // Esconde chaves de sistema e os IDs do usuário já que ele sabe que é dele
                                if (key === 'id' || key === 'createdAt' || key === 'colabId' || key === 'collaboratorId' || key === 'colabName') return null; 
                                
                                return (
                                    <div key={key} className="border-b border-gray-100 pb-2">
                                        <span className="block text-xs font-bold text-gray-400 uppercase">{translateKey(key)}</span>
                                        <span className="block text-gray-900 mt-1 whitespace-pre-wrap">{value?.toString() || 'Vazio'}</span>
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
import React, { useState, useEffect, useMemo } from 'react';
import {
    Clock, Target, RefreshCw, Star, Phone, MessageSquare,
    ShieldCheck, Rocket, User, Hourglass, Users, CheckCircle,
    TrendingUp, CalendarDays
} from 'lucide-react';
import { collection, onSnapshot, query, where, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

const formatDateBR = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}`;
    }
    return dateStr;
};

const formatChartDate = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('/');
    return parts.length === 3 ? `${parts[0]}/${parts[1]}` : dateString;
};

const TrendIndicator = ({ type, current, previous }) => {
    if (!current || !previous) return null;
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
    return <svg className={`w-4 h-4 mb-1.5 ${colorClass}`} viewBox="0 0 24 24"><path d={pathObj} /></svg>;
};

const DashboardCard = ({ title, value, subtitle, goalText, icon, trend }) => (
    <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200 flex flex-col justify-between relative overflow-hidden h-full">
        <div>
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{title}</h3>
                <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">{icon}</div>
            </div>
            <div className="flex items-end gap-2 mt-1">
                <div className="text-2xl lg:text-3xl font-black tracking-tight text-gray-900">{value}</div>
                {trend}
            </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-xs">
            <div className="text-gray-500 font-medium">{subtitle}</div>
            {goalText && <div className="text-gray-600 font-bold bg-gray-50 px-2 py-0.5 rounded border border-gray-100">{goalText}</div>}
        </div>
    </div>
);

const MyDashboard = ({ currentUserId, currentUser }) => {
    const [loading, setLoading] = useState(Boolean(currentUserId));
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

    useEffect(() => {
        if (!currentUserId) {
            return;
        }

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

        const qSunday = query(collection(db, "sunday_schedules"));
        const unsubSunday = onSnapshot(qSunday, (querySnapshot) => {
            let next = null;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            querySnapshot.forEach((docItem) => {
                const assignments = docItem.data().assignments || {};
                for (const [dateStr, colabs] of Object.entries(assignments)) {
                    if (colabs.some(c => c.id === currentUserId)) {
                        const shiftDate = new Date(dateStr + 'T00:00:00');
                        if (shiftDate >= today) {
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
            if (kpis.length > 0) { 
                setGlobalKpi(kpis[0]); 
                if (kpis.length > 1) setPrevGlobalKpi(kpis[1]); 
            }
        });

        const unsubColabs = onSnapshot(collection(db, "collaborators"), (snap) => {
            const map = {}; 
            snap.forEach(d => { map[d.id] = d.data(); }); 
            setColabsFull(map);
        });

        const unsubEvals = onSnapshot(collection(db, "weekly_evaluations"), (snap) => {
            const evals = []; 
            snap.forEach(d => evals.push({ id: d.id, ...d.data() }));
            evals.sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
            setAllEvals(evals); 
            setLoading(false);
        });

        const qReports = query(collection(db, "critical_reports"), where("creatorId", "==", currentUserId));
        const unsubReports = onSnapshot(qReports, (snap) => {
            let pending = 0; 
            let inProgress = 0; 
            let resolved = 0;
            snap.forEach(docItem => {
                const data = docItem.data();
                if (data.status === 'Pendente') pending++;
                if (data.status === 'Em Andamento') inProgress++;
                if (data.status === 'Resolvido') resolved++;
            });
            setReportCounts({ pending, inProgress, resolved });
        });

        const unsubFeedbacks = onSnapshot(collection(db, "feedbacks"), (snap) => {
            let unreadCount = 0;
            snap.forEach(docItem => {
                const data = docItem.data();
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

        return () => { 
            unsubKpi(); 
            unsubEvals(); 
            unsubGoals(); 
            unsubColabs(); 
            unsubReports(); 
            unsubFeedbacks(); 
            unsubAudits(); 
            unsubSchedule(); 
            unsubSunday(); 
        };
    }, [currentUserId]);

    const qaStats = useMemo(() => {
        const total = myAudits.length;
        const conformes = myAudits.filter(a => a.status === 'Conforme').length;
        const taxa = total > 0 ? ((conformes / total) * 100).toFixed(1) : "0.0";
        return { total, taxa };
    }, [myAudits]);

    const { myStats, chartData, shiftAvgPts } = useMemo(() => {
        const defaultStats = { totalPoints: 0, avgPoints: '0.0', avgTmaTel: '00:00:00', avgTmaHuggy: '00:00:00' };
        if (allEvals.length === 0) return { myStats: defaultStats, chartData: [], shiftAvgPts: 0 };

        const myEvals = allEvals.filter(e => e.colabId === currentUserId || e.collaboratorId === currentUserId);
        let sumPoints = 0;
        let sumTmaTel = 0;
        let sumTmaHuggy = 0;
        const formattedChartData = [];

        myEvals.forEach(e => {
            let pts = e.pontuacao ?? (Number(e.Atendimentos_Finalizados || 0) * 1 + Number(e.Ligacoes_Atendidas || 0) * 2 + Number(e.Atendimentos_Huggy || 0) * 1 + Number(e.Ligacoes_Perdidas || 0) * -5);
            const telDec = timeToDecimal(e.TMA_Telefonia); 
            const huggyDec = timeToDecimal(e.TMA_Huggy);
            sumPoints += pts; 
            sumTmaTel += telDec; 
            sumTmaHuggy += huggyDec;
            formattedChartData.push({ date: formatChartDate(e.date), pontos: pts, tmaTelDec: telDec, tmaHuggyDec: huggyDec });
        });

        const count = myEvals.length || 1;
        const latestDate = allEvals.reduce((max, e) => (e.date > max ? e.date : max), '');
        const currentWeekAll = allEvals.filter(e => e.date === latestDate);
        const myShift = currentUser?.shift || colabsFull[currentUserId]?.shift || 'Manhã';
        const isDayShift = myShift === 'Manhã' || myShift === 'Tarde';

        let shiftSum = 0; 
        let shiftCount = 0;
        currentWeekAll.forEach(e => {
            const cId = e.colabId || e.collaboratorId;
            const cShift = colabsFull[cId]?.shift || 'Manhã';
            if (isDayShift === (cShift === 'Manhã' || cShift === 'Tarde')) {
                shiftSum += e.pontuacao ?? 0; 
                shiftCount++;
            }
        });

        return {
            myStats: { 
                totalPoints: sumPoints, 
                avgPoints: (sumPoints / count).toFixed(1), 
                avgTmaTel: formatTime(sumTmaTel / count), 
                avgTmaHuggy: formatTime(sumTmaHuggy / count) 
            },
            chartData: formattedChartData,
            shiftAvgPts: shiftCount > 0 ? Math.round(shiftSum / shiftCount) : 0
        };
    }, [allEvals, currentUserId, currentUser, colabsFull]);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-50 h-full">
                <Hourglass className="w-8 h-8 text-red-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 h-full overflow-y-auto bg-gray-50">
            {/* Header de Boas-Vindas e Resumo Rápido */}
            <div className="mb-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <User className="w-6 h-6 text-red-600" /> Meu Desempenho
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Olá, <strong className="text-gray-800">{currentUser?.name || 'Colaborador'}</strong>. Acompanhe suas métricas individuais e tarefas.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3 w-full xl:w-auto">
                    <div className="flex items-center gap-3 bg-fuchsia-50 border border-fuchsia-200 px-4 py-2.5 rounded-xl shadow-xs">
                        <div className="p-2 bg-fuchsia-100 rounded-lg text-fuchsia-700">
                            <MessageSquare className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-fuchsia-700 uppercase tracking-wider block">Feedbacks Novos</span>
                            <span className="text-lg font-black text-fuchsia-900 leading-none">{unreadFeedbacks}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl shadow-xs">
                        <div className="p-2 bg-amber-100 rounded-lg text-amber-700">
                            <Clock className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Relatos Pendentes</span>
                            <span className="text-lg font-black text-amber-900 leading-none">{reportStats.pending}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl shadow-xs">
                        <div className="p-2 bg-emerald-100 rounded-lg text-emerald-700">
                            <CheckCircle className="w-4 h-4" />
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Relatos Concluídos</span>
                            <span className="text-lg font-black text-emerald-900 leading-none">{reportStats.resolved}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* CARDS DE ESCALA E PLANTÃO DO COLABORADOR */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`p-5 rounded-xl border flex items-center gap-4 shadow-sm transition-all ${
                    myTaskToday 
                    ? 'bg-zinc-950 text-white border-zinc-800' 
                    : 'bg-white border-gray-200 text-gray-800'
                }`}>
                    <div className={`p-3.5 rounded-xl ${myTaskToday ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        <CalendarDays className="w-6 h-6" />
                    </div>
                    <div>
                        <p className={`text-xs font-bold uppercase tracking-wider ${myTaskToday ? 'text-red-400' : 'text-gray-400'}`}>
                            Minha Tarefa Hoje (Escala Fixa)
                        </p>
                        <h2 className="text-xl font-black mt-0.5">
                            {myTaskToday ? `Fila de ${myTaskToday}` : "Sem escala para hoje"}
                        </h2>
                    </div>
                </div>

                <div className={`p-5 rounded-xl border flex items-center gap-4 shadow-sm transition-all ${
                    nextSundayShift 
                    ? 'bg-emerald-900/90 text-white border-emerald-800' 
                    : 'bg-white border-gray-200 text-gray-800'
                }`}>
                    <div className={`p-3.5 rounded-xl ${nextSundayShift ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className={`text-xs font-bold uppercase tracking-wider ${nextSundayShift ? 'text-emerald-300' : 'text-gray-400'}`}>
                            Próximo Plantão de Domingo
                        </p>
                        <h2 className="text-xl font-black mt-0.5">
                            {nextSundayShift ? `Dia ${formatDateBR(nextSundayShift)}` : "Nenhum plantão agendado"}
                        </h2>
                    </div>
                </div>
            </div>

            {/* MINHAS MÉDIAS INDIVIDUAIS */}
            <div className="mb-6">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-red-600" /> Minhas Médias e Indicadores de Qualidade
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <DashboardCard 
                        title="Pontuação Total" 
                        value={myStats.totalPoints} 
                        subtitle={<span>Média semanal: <strong>{myStats.avgPoints} pts</strong></span>} 
                        icon={<Star className="w-5 h-5 text-emerald-500" />} 
                    />
                    <DashboardCard 
                        title="Média do Meu Turno" 
                        value={shiftAvgPts} 
                        subtitle="Última semana (Equipe)" 
                        icon={<Users className="w-5 h-5 text-blue-500" />} 
                    />
                    <DashboardCard 
                        title="Média TMA Tel" 
                        value={myStats.avgTmaTel} 
                        subtitle="Tempo médio em linha" 
                        icon={<Phone className="w-5 h-5 text-rose-500" />} 
                    />
                    <DashboardCard 
                        title="Média TMA Chat" 
                        value={myStats.avgTmaHuggy} 
                        subtitle="Tempo médio Huggy" 
                        icon={<MessageSquare className="w-5 h-5 text-indigo-500" />} 
                    />
                    <DashboardCard 
                        title="Conformidade QA" 
                        value={`${qaStats.taxa}%`} 
                        subtitle={`Total: ${qaStats.total} auditorias`} 
                        icon={<ShieldCheck className="w-5 h-5 text-amber-500" />} 
                    />
                </div>
            </div>

            {/* KPIS GLOBAIS DO SETOR */}
            <div className="mb-6">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                    <Rocket className="w-4 h-4 text-purple-600" /> KPIs Globais de Referência do Setor
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <DashboardCard 
                        title="TMR Global" 
                        value={globalKpi.tmr || '00:00:00'} 
                        subtitle="Tempo Médio Resolução" 
                        goalText={`Meta: ≤ ${goals.tmr}`} 
                        icon={<Clock className="w-5 h-5 text-purple-500" />} 
                        trend={<TrendIndicator type="tmr" current={globalKpi.tmr} previous={prevGlobalKpi?.tmr} />} 
                    />
                    <DashboardCard 
                        title="FCR Global" 
                        value={`${globalKpi.fcr || 0}%`} 
                        subtitle="First Call Resolution" 
                        goalText={`Meta: ≥ ${goals.fcr}%`} 
                        icon={<Target className="w-5 h-5 text-rose-500" />} 
                        trend={<TrendIndicator type="fcr" current={globalKpi.fcr} previous={prevGlobalKpi?.fcr} />} 
                    />
                    <DashboardCard 
                        title="Reincidência" 
                        value={`${globalKpi.recurrence || 0}%`} 
                        subtitle="Taxa de Retorno" 
                        goalText={`Meta: ≤ ${goals.recurrence}%`} 
                        icon={<RefreshCw className="w-5 h-5 text-blue-500" />} 
                        trend={<TrendIndicator type="recurrence" current={globalKpi.recurrence} previous={prevGlobalKpi?.recurrence} />} 
                    />
                </div>
            </div>

            {/* GRÁFICOS DE EVOLUÇÃO TEMPORAL */}
            <div>
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-emerald-600" /> Minha Evolução nas Avaliações Semanais
                </h2>
                {chartData.length === 0 ? (
                    <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm text-center text-gray-400">
                        Nenhuma avaliação registrada ainda para desenhar o gráfico temporal.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-72 flex flex-col">
                            <h3 className="text-sm font-bold text-gray-800 mb-2 shrink-0">Produtividade (Pontos)</h3>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorPts" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                        <Area type="monotone" dataKey="pontos" stroke="#10b981" strokeWidth={2} fill="url(#colorPts)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-72 flex flex-col">
                            <h3 className="text-sm font-bold text-gray-800 mb-2 shrink-0">TMA Telefonia (Minutos)</h3>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorTel" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={formatTime} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} formatter={val => [formatTime(val), "TMA Tel"]} />
                                        <Area type="monotone" dataKey="tmaTelDec" stroke="#3b82f6" strokeWidth={2} fill="url(#colorTel)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm h-72 flex flex-col">
                            <h3 className="text-sm font-bold text-gray-800 mb-2 shrink-0">TMA Huggy (Minutos)</h3>
                            <div className="flex-1 min-h-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorHuggy" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF', fontSize: 11 }} tickFormatter={formatTime} />
                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none' }} formatter={val => [formatTime(val), "TMA Huggy"]} />
                                        <Area type="monotone" dataKey="tmaHuggyDec" stroke="#8b5cf6" strokeWidth={2} fill="url(#colorHuggy)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyDashboard;

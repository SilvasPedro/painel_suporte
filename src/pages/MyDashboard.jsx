import React, { useState, useEffect, useMemo } from 'react';
import {
    Clock, Target, RefreshCw, Star, Phone, MessageSquare,
    ShieldCheck, Rocket, User, Hourglass, Users, CheckCircle,
    CheckCircle2, TrendingUp, CalendarDays, Coffee, Calendar, 
    ChevronRight, LifeBuoy, Activity
} from 'lucide-react';
import { subscribeSharedCollection, subscribeSharedDocument } from '../services/dataCache';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { timeToDecimal, formatTime } from '../utils/timeCalculations';
import { calculatePerformanceScore } from '../utils/scoringCalculations';

const formatNextDateInfo = (dateStr, fallbackType = 'folga') => {
    if (!dateStr) {
        return {
            label: fallbackType === 'plantao' ? 'Nenhum agendado' : 'Nenhuma agendada',
            detail: fallbackType === 'plantao' ? 'Sem plantão registrado neste mês' : 'Sem folga registrada para este mês'
        };
    }

    const parts = dateStr.split('-');
    if (parts.length !== 3) {
        return { label: dateStr, detail: 'Data programada' };
    }

    const year = Number(parts[0]);
    const month = Number(parts[1]);
    const day = Number(parts[2]);
    const target = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const dayFormatted = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;
    const weekDays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const weekDay = weekDays[target.getDay()] || '';

    if (diffDays === 0) {
        return {
            label: `Hoje (${dayFormatted})`,
            detail: `${weekDay} • Dia de ${fallbackType === 'plantao' ? 'plantão ativo' : 'descanso programado'}!`,
            isToday: true
        };
    }
    if (diffDays === 1) {
        return {
            label: `Amanhã (${dayFormatted})`,
            detail: `${weekDay} • Próximo ${fallbackType === 'plantao' ? 'plantão' : 'descanso'}`,
            isTomorrow: true
        };
    }
    return {
        label: `Dia ${dayFormatted}`,
        detail: `${weekDay} • em ${diffDays} dias`,
        daysLeft: diffDays
    };
};

const parseDateObj = (dateStr) => {
    if (!dateStr || dateStr === 'Semana Atual' || dateStr === 'Sem data') return 0;
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
    }
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
    }
    return 0;
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
    <div className="bg-white rounded-2xl shadow-2xs p-5 border border-gray-200 hover:border-gray-300 transition-all flex flex-col justify-between relative overflow-hidden h-full">
        <div>
            <div className="flex justify-between items-start mb-2">
                <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{title}</h3>
                <div className="p-2 bg-gray-50 rounded-xl border border-gray-100">{icon}</div>
            </div>
            <div className="flex items-end gap-2 mt-1">
                <div className="text-2xl lg:text-3xl font-black tracking-tight text-gray-900">{value}</div>
                {trend}
            </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between items-center text-xs">
            <div className="text-gray-500 font-medium">{subtitle}</div>
            {goalText && <div className="text-gray-600 font-bold bg-gray-50 px-2 py-0.5 rounded-lg border border-gray-100 text-[11px]">{goalText}</div>}
        </div>
    </div>
);

const MyDashboard = ({ currentUserId, currentUser }) => {
    const currentUserName = currentUser?.name;
    const currentUserEmail = currentUser?.email;

    const [loading, setLoading] = useState(Boolean(currentUserId));
    const [globalKpi, setGlobalKpi] = useState({ tmr: '00:00:00', fcr: 0, recurrence: 0 });
    const [prevGlobalKpi, setPrevGlobalKpi] = useState(null);
    const [goals, setGoals] = useState({ tmr: '00:20:00', fcr: 80, recurrence: 20 });
    const [allEvals, setAllEvals] = useState([]);
    const [colabsFull, setColabsFull] = useState({});

    const [myTaskToday, setMyTaskToday] = useState(null);
    const [nextSundayShift, setNextSundayShift] = useState(null);
    const [nextDayOff, setNextDayOff] = useState(null);

    const [reportStats, setReportCounts] = useState({ pending: 0, inProgress: 0, resolved: 0 });
    const [unreadFeedbacks, setUnreadFeedbacks] = useState(0);
    const [myAudits, setMyAudits] = useState([]);

    useEffect(() => {
        if (!currentUserId) {
            return;
        }

        const unsubSchedule = subscribeSharedDocument("daily_schedules", "fixed_schedule", (docData) => {
            if (docData) {
                const assignments = docData.assignments || {};
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

        const unsubSunday = subscribeSharedCollection("sunday_schedules", (items) => {
            let next = null;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            items.forEach((docItem) => {
                const assignments = docItem.assignments || {};
                for (const [dateStr, colabs] of Object.entries(assignments)) {
                    if (Array.isArray(colabs) && colabs.some(c => 
                        c.id === currentUserId || 
                        c.uid === currentUserId || 
                        c.firestoreId === currentUserId ||
                        (currentUserName && c.name && c.name.trim().toLowerCase() === currentUserName.trim().toLowerCase())
                    )) {
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

        const unsubDayOff = subscribeSharedCollection("day_off_schedules", (items) => {
            let next = null;
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            items.forEach((docItem) => {
                const assignments = docItem.assignments || {};
                for (const [dateStr, colabs] of Object.entries(assignments)) {
                    if (Array.isArray(colabs) && colabs.some(c => 
                        c.id === currentUserId || 
                        c.uid === currentUserId || 
                        c.firestoreId === currentUserId ||
                        (currentUserName && c.name && c.name.trim().toLowerCase() === currentUserName.trim().toLowerCase()) ||
                        (currentUserEmail && c.email && c.email.trim().toLowerCase() === currentUserEmail.trim().toLowerCase())
                    )) {
                        const offDate = new Date(dateStr + 'T00:00:00');
                        if (offDate >= today) {
                            if (!next || offDate < new Date(next + 'T00:00:00')) {
                                next = dateStr;
                            }
                        }
                    }
                }
            });
            setNextDayOff(next);
        });

        const unsubGoals = subscribeSharedDocument("system_settings", "sector_goals", (docData) => {
            if (docData) setGoals(docData);
        });

        const unsubKpi = subscribeSharedCollection("sector_kpis", (items) => {
            const kpis = [...items];
            kpis.sort((a, b) => (b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime()) - (a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime()));
            if (kpis.length > 0) { 
                setGlobalKpi(kpis[0]); 
                if (kpis.length > 1) setPrevGlobalKpi(kpis[1]); 
            }
        });

        const unsubColabs = subscribeSharedCollection("collaborators", (items) => {
            const map = {}; 
            items.forEach(d => { 
                map[d.id] = d;
                if (d.firestoreId) map[d.firestoreId] = d;
                if (d.uid) map[d.uid] = d;
                if (d.name) map[d.name.trim().toLowerCase()] = d;
            }); 
            setColabsFull(map);
        });

        const unsubEvals = subscribeSharedCollection("weekly_evaluations", (items) => {
            const evals = [...items]; 
            evals.sort((a, b) => (a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime()) - (b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime()));
            setAllEvals(evals); 
            setLoading(false);
        });

        const unsubReports = subscribeSharedCollection("critical_reports", (items) => {
            let pending = 0; 
            let inProgress = 0; 
            let resolved = 0;
            items.filter(d => d.creatorId === currentUserId).forEach(data => {
                if (data.status === 'Pendente') pending++;
                if (data.status === 'Em Andamento') inProgress++;
                if (data.status === 'Resolvido') resolved++;
            });
            setReportCounts({ pending, inProgress, resolved });
        });

        const unsubFeedbacks = subscribeSharedCollection("feedbacks", (items) => {
            let unreadCount = 0;
            items.forEach(data => {
                if ((data.colabId === currentUserId || data.collaboratorId === currentUserId) && !data.read) {
                    unreadCount++;
                }
            });
            setUnreadFeedbacks(unreadCount);
        });

        const unsubAudits = subscribeSharedCollection("qa_audits", (items) => {
            const fetched = items.filter(d => d.colabId === currentUserId || d.collaboratorId === currentUserId);
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
            unsubDayOff();
        };
    }, [currentUserId, currentUserName, currentUserEmail]);

    const qaStats = useMemo(() => {
        const total = myAudits.length;
        const conformes = myAudits.filter(a => a.status === 'Conforme').length;
        const taxa = total > 0 ? ((conformes / total) * 100).toFixed(1) : "0.0";
        return { total, taxa };
    }, [myAudits]);

    const nextSundayInfo = useMemo(() => formatNextDateInfo(nextSundayShift, 'plantao'), [nextSundayShift]);
    const nextDayOffInfo = useMemo(() => formatNextDateInfo(nextDayOff, 'folga'), [nextDayOff]);

    const { myStats, chartData, shiftAvgPts } = useMemo(() => {
        const defaultStats = { totalPoints: 0, avgPoints: '0.0', avgTmaTel: '00:00:00', avgTmaHuggy: '00:00:00' };
        if (allEvals.length === 0) return { myStats: defaultStats, chartData: [], shiftAvgPts: 0 };

        const myEvals = allEvals.filter(e => e.colabId === currentUserId || e.collaboratorId === currentUserId);
        let sumPoints = 0;
        let sumTmaTel = 0;
        let sumTmaHuggy = 0;
        const formattedChartData = [];

        myEvals.forEach(e => {
            const pts = e.pontuacao ?? calculatePerformanceScore(e);
            const telDec = timeToDecimal(e.TMA_Telefonia); 
            const huggyDec = timeToDecimal(e.TMA_Huggy);
            sumPoints += pts; 
            sumTmaTel += telDec; 
            sumTmaHuggy += huggyDec;
            formattedChartData.push({ date: formatChartDate(e.date), pontos: pts, tmaTelDec: telDec, tmaHuggyDec: huggyDec });
        });

        const count = myEvals.length || 1;
        const latestDate = allEvals.reduce((max, e) => {
            if (!max) return e.date || '';
            const tE = parseDateObj(e.date);
            const tMax = parseDateObj(max);
            return tE > tMax ? e.date : max;
        }, '');
        const currentWeekAll = allEvals.filter(e => e.date === latestDate);
        const myShift = currentUser?.shift || colabsFull[currentUserId]?.shift || 'Manhã I';
        const isMyNight = String(myShift).toLowerCase().includes('noturn') || String(myShift).toLowerCase().includes('noit');

        let shiftSum = 0; 
        let shiftCount = 0;
        currentWeekAll.forEach(e => {
            const cId = e.colabId || e.collaboratorId;
            let cColab = colabsFull[cId];
            if (!cColab && e.colabName) cColab = colabsFull[e.colabName.trim().toLowerCase()];
            if (!cColab && e.name) cColab = colabsFull[e.name.trim().toLowerCase()];
            const cShift = cColab?.shift || 'Manhã I';
            const isPeerNight = String(cShift).toLowerCase().includes('noturn') || String(cShift).toLowerCase().includes('noit');

            // Manhã I, Manhã II e Tarde disputam a mesma média (horário de pico).
            // Noturno disputa sua própria média isolada.
            if (isMyNight === isPeerNight) {
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
            <div className="mb-6 bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                        <User className="w-6 h-6 text-red-600" /> Meu Desempenho
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Olá, <strong className="text-gray-800">{currentUser?.name || 'Colaborador'}</strong>. Acompanhe suas métricas individuais, tarefas e escalas.
                    </p>
                </div>

                {/* Cartões de Informações Principais do Topo */}
                <div className="flex flex-wrap gap-3 w-full xl:w-auto">
                    {/* Feedbacks Novos (Ícone no canto superior direito) */}
                    <div className={`flex justify-between items-start gap-4 px-4 py-3 rounded-2xl border min-w-[155px] transition-all ${
                        unreadFeedbacks > 0
                            ? 'bg-zinc-950 text-white border-zinc-800 shadow-sm'
                            : 'bg-white border-gray-200 text-gray-700 shadow-2xs'
                    }`}>
                        <div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${
                                unreadFeedbacks > 0 ? 'text-fuchsia-400' : 'text-gray-500'
                            }`}>
                                Feedbacks Novos
                            </span>
                            <span className={`text-2xl font-black leading-none ${
                                unreadFeedbacks > 0 ? 'text-white' : 'text-gray-900'
                            }`}>
                                {unreadFeedbacks}
                            </span>
                        </div>
                        <div className={`p-2 rounded-xl shrink-0 ${
                            unreadFeedbacks > 0
                                ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'
                                : 'bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100'
                        }`}>
                            <MessageSquare className="w-4 h-4" />
                        </div>
                    </div>

                    {/* Relatos Pendentes (Ícone no canto superior direito) */}
                    <div className={`flex justify-between items-start gap-4 px-4 py-3 rounded-2xl border min-w-[155px] transition-all ${
                        reportStats.pending > 0
                            ? 'bg-zinc-950 text-white border-zinc-800 shadow-sm'
                            : 'bg-white border-gray-200 text-gray-700 shadow-2xs'
                    }`}>
                        <div>
                            <span className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${
                                reportStats.pending > 0 ? 'text-amber-400' : 'text-gray-500'
                            }`}>
                                Relatos Pendentes
                            </span>
                            <span className={`text-2xl font-black leading-none ${
                                reportStats.pending > 0 ? 'text-white' : 'text-gray-900'
                            }`}>
                                {reportStats.pending}
                            </span>
                        </div>
                        <div className={`p-2 rounded-xl shrink-0 ${
                            reportStats.pending > 0
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-amber-50 text-amber-600 border border-amber-100'
                        }`}>
                            <Clock className="w-4 h-4" />
                        </div>
                    </div>

                    {/* Relatos Concluídos (Ícone no canto superior direito) */}
                    <div className="flex justify-between items-start gap-4 bg-white border border-gray-200 px-4 py-3 rounded-2xl shadow-2xs min-w-[155px]">
                        <div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                                Relatos Concluídos
                            </span>
                            <span className="text-2xl font-black text-emerald-600 leading-none">
                                {reportStats.resolved}
                            </span>
                        </div>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                        </div>
                    </div>
                </div>
            </div>

            {/* CARDS DE OPERAÇÃO: TAREFA HOJE, PLANTÃO E PRÓXIMA FOLGA NA MESMA LINHA */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 1. Minha Tarefa Hoje (Escala Fixa - Ícone no canto superior direito) */}
                <div className="bg-zinc-950 text-white p-5 rounded-2xl border border-zinc-800 shadow-sm flex flex-col justify-between hover:border-blue-500/50 transition-all group">
                    <div>
                        <div className="flex items-start justify-between mb-3">
                            <div className="space-y-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 block">
                                    Minha Tarefa Hoje
                                </span>
                                <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                                    myTaskToday 
                                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' 
                                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                }`}>
                                    {myTaskToday ? 'Escala Ativa' : 'Sem Escala'}
                                </span>
                            </div>
                            <div className={`p-2.5 rounded-xl border shrink-0 ${
                                myTaskToday 
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700'
                            }`}>
                                {myTaskToday === 'Telefonia' ? (
                                    <Phone className="w-5 h-5" />
                                ) : myTaskToday === 'Huggy' ? (
                                    <MessageSquare className="w-5 h-5" />
                                ) : myTaskToday === 'Apoio' ? (
                                    <LifeBuoy className="w-5 h-5" />
                                ) : (
                                    <CalendarDays className="w-5 h-5" />
                                )}
                            </div>
                        </div>
                        <div className="mt-1">
                            <h3 className="text-2xl font-black text-white tracking-tight">
                                {myTaskToday ? (myTaskToday.startsWith('Fila') ? myTaskToday : `Fila de ${myTaskToday}`) : "Sem escala para hoje"}
                            </h3>
                            <p className="text-xs text-zinc-400 mt-1">
                                {myTaskToday 
                                    ? (myTaskToday === 'Telefonia' ? 'Atendimento receptivo de chamadas de voz' : myTaskToday === 'Huggy' ? 'Atendimento via chat e multicanais' : 'Suporte e apoio operacional às filas')
                                    : 'Nenhum posto fixo alocado para o dia de hoje'}
                            </p>
                        </div>
                    </div>
                    <div className="pt-3 mt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                        <span>Escala Semanal Operacional</span>
                        <span className="text-blue-400 font-bold flex items-center gap-1">
                            {myTaskToday ? 'Ativo' : 'Livre'}
                        </span>
                    </div>
                </div>

                {/* 2. Próximo Plantão (Domingos - Ícone no canto superior direito) */}
                <div className="bg-zinc-950 text-white p-5 rounded-2xl border border-zinc-800 shadow-sm flex flex-col justify-between hover:border-amber-500/50 transition-all group">
                    <div>
                        <div className="flex items-start justify-between mb-3">
                            <div className="space-y-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
                                    Próximo Plantão
                                </span>
                                <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                                    nextSundayShift 
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                }`}>
                                    {nextSundayShift ? 'Domingo' : 'Disponível'}
                                </span>
                            </div>
                            <div className={`p-2.5 rounded-xl border shrink-0 ${
                                nextSundayShift 
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700'
                            }`}>
                                <Users className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-1">
                            <h3 className="text-2xl font-black text-white tracking-tight">
                                {nextSundayInfo.label}
                            </h3>
                            <p className="text-xs text-zinc-400 mt-1">
                                {nextSundayInfo.detail}
                            </p>
                        </div>
                    </div>
                    <div className="pt-3 mt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                        <span>Escalação de Domingo</span>
                        <span className="text-amber-400 font-bold flex items-center gap-1">
                            {nextSundayShift ? 'Escalado' : 'Sem plantão'}
                        </span>
                    </div>
                </div>

                {/* 3. Próxima Folga (Tela de Folgas - Ícone no canto superior direito) */}
                <div className="bg-zinc-950 text-white p-5 rounded-2xl border border-zinc-800 shadow-sm flex flex-col justify-between hover:border-emerald-500/50 transition-all group">
                    <div>
                        <div className="flex items-start justify-between mb-3">
                            <div className="space-y-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                                    Próxima Folga
                                </span>
                                <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                                    nextDayOff 
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                                        : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                }`}>
                                    {nextDayOff ? (nextDayOffInfo.isToday ? 'Hoje!' : nextDayOffInfo.isTomorrow ? 'Amanhã' : 'Descanso') : 'A Definir'}
                                </span>
                            </div>
                            <div className={`p-2.5 rounded-xl border shrink-0 ${
                                nextDayOff 
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                    : 'bg-zinc-800/80 text-zinc-400 border-zinc-700'
                            }`}>
                                <Coffee className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-1">
                            <h3 className="text-2xl font-black text-white tracking-tight">
                                {nextDayOffInfo.label}
                            </h3>
                            <p className="text-xs text-zinc-400 mt-1">
                                {nextDayOffInfo.detail}
                            </p>
                        </div>
                    </div>
                    <div className="pt-3 mt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                        <span>Grade Mensal de Folgas</span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                            {nextDayOff ? 'Folga programada' : 'Aguardando escala'}
                        </span>
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
                        icon={<Target className="w-5 h-5 text-emerald-500" />} 
                        trend={<TrendIndicator type="fcr" current={globalKpi.fcr} previous={prevGlobalKpi?.fcr} />} 
                    />
                    <DashboardCard 
                        title="Reincidência" 
                        value={`${globalKpi.recurrence || 0}%`} 
                        subtitle="Taxa de Retorno" 
                        goalText={`Meta: ≤ ${goals.recurrence}%`} 
                        icon={<Activity className="w-5 h-5 text-blue-500" />} 
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

import React, { useState, useEffect, useMemo } from 'react';
import {
    Rocket, Target, Activity, Star, Clock, CheckSquare, Phone, MessageCircle,
    Award, AlertTriangle, CheckCircle, Loader2, Users, ChevronRight,
    TrendingUp, TrendingDown, ArrowUpRight, BarChart3, LineChart as LineChartIcon,
    Info, X, ShieldCheck, CheckCircle2, AlertCircle
} from 'lucide-react';
import {
    AreaChart, Area, LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ReferenceLine, PieChart, Pie, Cell
} from 'recharts';
import { collection, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

// --- CONVERSÕES E UTILITÁRIOS DE TEMPO ---
const timeToDecimal = (timeStr) => {
    if (!timeStr || timeStr === '--' || timeStr === '00:00:00') return 0;
    const parts = String(timeStr).split(':');
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
    // Aceita YYYY-MM-DD ou DD/MM/YYYY
    if (dateStr.includes('-')) {
        const [, m, d] = dateStr.split('-');
        return `${d}/${m}`;
    }
    if (dateStr.includes('/')) {
        const [d, m] = dateStr.split('/');
        return `${d}/${m}`;
    }
    return dateStr;
};

const parseDateSort = (dateStr) => {
    if (!dateStr) return 0;
    if (dateStr.includes('-')) {
        const [y, m, d] = dateStr.split('-');
        return new Date(y, m - 1, d).getTime();
    }
    if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/');
        return new Date(y, m - 1, d).getTime();
    }
    return 0;
};

// --- COMPONENTE DE INDICADOR DE TENDÊNCIA ---
const TrendBadge = ({ type, val, goal }) => {
    if (val === undefined || goal === undefined || !val || !goal) return null;

    let isGood = true;
    if (type === 'tmr' || type === 'recurrence' || type === 'tma') {
        const v = type === 'tmr' || type === 'tma' ? timeToDecimal(val) : Number(val);
        const g = type === 'tmr' || type === 'tma' ? timeToDecimal(goal) : Number(goal);
        isGood = v <= g;
    } else {
        const v = Number(val);
        const g = Number(goal);
        isGood = v >= g;
    }

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
            isGood ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
        }`}>
            {isGood ? <TrendingUp className="w-3 h-3 text-emerald-600" /> : <TrendingDown className="w-3 h-3 text-rose-600" />}
            {isGood ? 'Na Meta' : 'Fora da Meta'}
        </span>
    );
};

const DashboardOverview = () => {
    // Modo de Visualização Principal
    const [viewMode, setViewMode] = useState('cockpit'); // 'cockpit', 'evolution', 'compliance', 'shifts'
    
    // Configurações do Gráfico de Evolução de KPIs & Monitoria
    const [selectedKpi, setSelectedKpi] = useState('tmr'); // 'tmr', 'fcr', 'recurrence', 'qa_rate', 'volume', 'tma_tel', 'tma_huggy', 'points'
    const [chartType, setChartType] = useState('area'); // 'area', 'line', 'bar'
    const [timeframe, setTimeframe] = useState('all'); // 'all', 'last30', 'last60'

    // Estados de Dados do Firebase
    const [latestKpi, setLatestKpi] = useState({ tmr: '00:00:00', fcr: 0, recurrence: 0, date: '' });
    const [sectorKpisList, setSectorKpisList] = useState([]);
    const [goals, setGoals] = useState({ tmr: '00:20:00', fcr: 80, recurrence: 20, qa: 85 });

    const [evalsList, setEvalsList] = useState([]);
    const [colabsFull, setColabsFull] = useState({});
    const [auditsList, setAuditsList] = useState([]);
    const [reportStats, setReportStats] = useState({ pending: 0, inProgress: 0, resolved: 0 });

    // Modal de Informações Detalhadas
    const [modalInfo, setModalInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Metas do Setor
        const unsubGoals = onSnapshot(doc(db, "system_settings", "sector_goals"), (docSnap) => {
            if (docSnap.exists()) {
                setGoals(prev => ({ ...prev, ...docSnap.data() }));
            }
        });

        // Histórico de KPIs do Setor
        const unsubKpi = onSnapshot(collection(db, "sector_kpis"), (snap) => {
            const kpis = [];
            snap.forEach(d => kpis.push({ id: d.id, ...d.data() }));
            kpis.sort((a, b) => parseDateSort(a.date) - parseDateSort(b.date));
            setSectorKpisList(kpis);

            if (kpis.length > 0) {
                // Último lançado
                setLatestKpi(kpis[kpis.length - 1]);
            }
            setLoading(false);
        });

        // Colaboradores
        const unsubColabs = onSnapshot(collection(db, "collaborators"), (snap) => {
            const map = {};
            snap.forEach(d => map[d.id] = { id: d.id, ...d.data() });
            setColabsFull(map);
        });

        // Avaliações Semanais
        const unsubEvals = onSnapshot(collection(db, "weekly_evaluations"), (snap) => {
            const evals = [];
            snap.forEach(d => evals.push({ id: d.id, ...d.data() }));
            evals.sort((a, b) => parseDateSort(a.date) - parseDateSort(b.date));
            setEvalsList(evals);
        });

        // Relatórios Críticos / Solicitações
        const unsubReports = onSnapshot(collection(db, "critical_reports"), (snap) => {
            let pending = 0; let inProgress = 0; let resolved = 0;
            snap.forEach(docSnap => {
                const data = docSnap.data();
                if (data.status === 'Pendente') pending++;
                else if (data.status === 'Em Andamento') inProgress++;
                else if (data.status === 'Resolvido') resolved++;
            });
            setReportStats({ pending, inProgress, resolved });
        });

        // Auditorias de Qualidade (QA)
        const unsubAudits = onSnapshot(collection(db, "qa_audits"), (snap) => {
            const fetched = [];
            snap.forEach(docSnap => fetched.push({ id: docSnap.id, ...docSnap.data() }));
            fetched.sort((a, b) => parseDateSort(a.date) - parseDateSort(b.date));
            setAuditsList(fetched);
        });

        return () => {
            unsubGoals();
            unsubKpi();
            unsubColabs();
            unsubEvals();
            unsubReports();
            unsubAudits();
        };
    }, []);

    // --- ESTATÍSTICAS DE QA / QUALIDADE ---
    const qaStats = useMemo(() => {
        let total = 0;
        let conformes = 0;

        auditsList.forEach(audit => {
            const colabInfo = colabsFull[audit.colabId];
            if (colabInfo && colabInfo.active !== false) {
                total++;
                if (audit.status === 'Conforme') conformes++;
            }
        });

        const taxaResult = total > 0 ? Number(((conformes / total) * 100).toFixed(1)) : 0;
        return { taxa: taxaResult, total, conformes, naoConformes: total - conformes };
    }, [auditsList, colabsFull]);

    // --- ESTATÍSTICAS CONSOLIDADAS DA EQUIPE ---
    const teamStats = useMemo(() => {
        const defaultStats = {
            avgVol: 0, avgTmaTel: '00:00:00', avgTmaHuggy: '00:00:00',
            maxTmaTel: { val: '00:00:00', name: '--' }, maxTmaHuggy: { val: '00:00:00', name: '--' },
            topDay: { name: '--', val: 0, evalCount: 0 }, topNight: { name: '--', val: 0, evalCount: 0 },
            avgPtsDay: 0, avgPtsNight: 0,
            lowestAvgVol: { val: 0, name: '--' },
            rankings: {
                topPointsDay: [],
                topPointsNight: [],
                maxTmaTel: [],
                maxTmaHuggy: [],
                lowestVol: []
            },
            shiftSummary: {
                day: { count: 0, sumPts: 0, sumVol: 0, avgPts: 0, avgVol: 0 },
                night: { count: 0, sumPts: 0, sumVol: 0, avgPts: 0, avgVol: 0 }
            }
        };

        if (evalsList.length === 0) return defaultStats;

        const colabPointsData = {};
        const accumulatedVol = {};
        const accumulatedTmaTel = {};
        const accumulatedTmaHuggy = {};

        evalsList.forEach(e => {
            const colabId = e.colabId || e.collaboratorId;
            const colabInfo = colabsFull[colabId];

            if (colabInfo && colabInfo.active !== false) {
                let pts = e.pontuacao;
                if (pts === undefined) {
                    pts = (Number(e.Atendimentos_Finalizados || 0) * 1) +
                        (Number(e.Ligacoes_Atendidas || 0) * 2) +
                        (Number(e.Atendimentos_Huggy || 0) * 1) +
                        (Number(e.Ligacoes_Perdidas || 0) * -5);
                }
                if (!colabPointsData[colabId]) colabPointsData[colabId] = { sum: 0, count: 0 };
                colabPointsData[colabId].sum += pts;
                colabPointsData[colabId].count += 1;
                
                if (!accumulatedVol[colabId]) accumulatedVol[colabId] = { sum: 0, count: 0 };
                accumulatedVol[colabId].sum += (Number(e.Atendimentos_Finalizados) || 0);
                accumulatedVol[colabId].count += 1;

                if (!accumulatedTmaTel[colabId]) accumulatedTmaTel[colabId] = { sum: 0, count: 0 };
                accumulatedTmaTel[colabId].sum += timeToDecimal(e.TMA_Telefonia);
                accumulatedTmaTel[colabId].count += 1;
                
                if (!accumulatedTmaHuggy[colabId]) accumulatedTmaHuggy[colabId] = { sum: 0, count: 0 };
                accumulatedTmaHuggy[colabId].sum += timeToDecimal(e.TMA_Huggy);
                accumulatedTmaHuggy[colabId].count += 1;
            }
        });

        // Rankings por Turno baseados na Média de Pontos por Avaliação (Equitativo para novos e antigos colaboradores)
        const topPointsDayList = [];
        const topPointsNightList = [];
        
        Object.entries(colabPointsData).forEach(([colabId, data]) => {
            const colabInfo = colabsFull[colabId];
            if (colabInfo && colabInfo.active !== false && data.count > 0) {
                const avgScore = Math.round(data.sum / data.count);
                const shift = String(colabInfo.shift || '').toLowerCase();
                const item = { 
                    id: colabId, 
                    name: colabInfo.name, 
                    val: avgScore,
                    evalCount: data.count,
                    totalPts: data.sum
                };
                if (shift.includes('manh') || shift.includes('tard') || shift === 'geral') {
                    topPointsDayList.push(item);
                } else if (shift.includes('noit')) {
                    topPointsNightList.push(item);
                }
            }
        });

        topPointsDayList.sort((a, b) => b.val - a.val);
        topPointsNightList.sort((a, b) => b.val - a.val);

        const topDay = topPointsDayList.length > 0 ? topPointsDayList[0] : { val: 0, name: '--', evalCount: 0 };
        const topNight = topPointsNightList.length > 0 ? topPointsNightList[0] : { val: 0, name: '--', evalCount: 0 };

        // TMA Telefonia
        const avgTmaTelList = [];
        Object.entries(accumulatedTmaTel).forEach(([colabId, data]) => {
            if (data.count > 0) {
                const avg = data.sum / data.count;
                avgTmaTelList.push({ id: colabId, name: colabsFull[colabId]?.name || '--', valDec: avg, val: formatTime(avg) });
            }
        });
        avgTmaTelList.sort((a, b) => b.valDec - a.valDec);
        const maxTmaTel = avgTmaTelList.length > 0 ? avgTmaTelList[0] : { val: '00:00:00', name: '--' };

        // TMA Chat
        const avgTmaHuggyList = [];
        Object.entries(accumulatedTmaHuggy).forEach(([colabId, data]) => {
            if (data.count > 0) {
                const avg = data.sum / data.count;
                avgTmaHuggyList.push({ id: colabId, name: colabsFull[colabId]?.name || '--', valDec: avg, val: formatTime(avg) });
            }
        });
        avgTmaHuggyList.sort((a, b) => b.valDec - a.valDec);
        const maxTmaHuggy = avgTmaHuggyList.length > 0 ? avgTmaHuggyList[0] : { val: '00:00:00', name: '--' };

        // Menor volume
        const avgVolList = [];
        Object.entries(accumulatedVol).forEach(([colabId, data]) => {
            if (data.count > 0) {
                const avg = data.sum / data.count;
                avgVolList.push({ id: colabId, name: colabsFull[colabId]?.name || '--', val: Math.round(avg) });
            }
        });
        avgVolList.sort((a, b) => a.val - b.val);
        const lowestAvgVol = avgVolList.length > 0 ? avgVolList[0] : { val: 0, name: '--' };

        // Médias da última semana
        const latestDate = evalsList.reduce((max, e) => (e.date > max ? e.date : max), '');
        const currentWeek = evalsList.filter(e => e.date === latestDate);

        let sumVol = 0, sumTmaTel = 0, sumTmaHuggy = 0;
        let sumPtsDay = 0, countDay = 0, sumVolDay = 0;
        let sumPtsNight = 0, countNight = 0, sumVolNight = 0;
        let activeCurrentWeekCount = 0;

        if (currentWeek.length > 0) {
            currentWeek.forEach(e => {
                const colabId = e.colabId || e.collaboratorId;
                const colabInfo = colabsFull[colabId];

                if (colabInfo && colabInfo.active !== false) {
                    activeCurrentWeekCount++;
                    const vol = Number(e.Atendimentos_Finalizados) || 0;
                    sumVol += vol;
                    sumTmaTel += timeToDecimal(e.TMA_Telefonia);
                    sumTmaHuggy += timeToDecimal(e.TMA_Huggy);

                    let currentPts = e.pontuacao;
                    if (currentPts === undefined) {
                        currentPts = (vol * 1) +
                            (Number(e.Ligacoes_Atendidas || 0) * 2) +
                            (Number(e.Atendimentos_Huggy || 0) * 1) +
                            (Number(e.Ligacoes_Perdidas || 0) * -5);
                    }

                    const shift = String(colabInfo.shift || '').toLowerCase();
                    if (shift.includes('manh') || shift.includes('tard') || shift === 'geral') {
                        sumPtsDay += currentPts;
                        sumVolDay += vol;
                        countDay++;
                    } else if (shift.includes('noit')) {
                        sumPtsNight += currentPts;
                        sumVolNight += vol;
                        countNight++;
                    }
                }
            });
        }

        const count = activeCurrentWeekCount || 1;

        return {
            avgVol: activeCurrentWeekCount > 0 ? Math.round(sumVol / count) : 0,
            avgTmaTel: formatTime(sumTmaTel / count),
            avgTmaHuggy: formatTime(sumTmaHuggy / count),
            maxTmaTel,
            maxTmaHuggy,
            lowestAvgVol,
            topDay: { val: topDay.val !== -Infinity ? topDay.val : 0, name: topDay.name, evalCount: topDay.evalCount || 0, totalPts: topDay.totalPts || 0 },
            topNight: { val: topNight.val !== -Infinity ? topNight.val : 0, name: topNight.name, evalCount: topNight.evalCount || 0, totalPts: topNight.totalPts || 0 },
            avgPtsDay: countDay > 0 ? Math.round(sumPtsDay / countDay) : 0,
            avgPtsNight: countNight > 0 ? Math.round(sumPtsNight / countNight) : 0,
            rankings: {
                topPointsDay: topPointsDayList,
                topPointsNight: topPointsNightList,
                maxTmaTel: avgTmaTelList,
                maxTmaHuggy: avgTmaHuggyList,
                lowestVol: avgVolList
            },
            shiftSummary: {
                day: {
                    count: countDay,
                    sumPts: sumPtsDay,
                    sumVol: sumVolDay,
                    avgPts: countDay > 0 ? Math.round(sumPtsDay / countDay) : 0,
                    avgVol: countDay > 0 ? Math.round(sumVolDay / countDay) : 0
                },
                night: {
                    count: countNight,
                    sumPts: sumPtsNight,
                    sumVol: sumVolNight,
                    avgPts: countNight > 0 ? Math.round(sumPtsNight / countNight) : 0,
                    avgVol: countNight > 0 ? Math.round(sumVolNight / countNight) : 0
                }
            }
        };
    }, [evalsList, colabsFull]);

    // --- TIMELINE DE DADOS CONSOLIDADOS PARA OS GRÁFICOS DE EVOLUÇÃO ---
    // Mantém estritamente os KPIs principais com lançamentos corretos: TMR, FCR, Reincidência e QA
    const evolutionTimeline = useMemo(() => {
        // Agrupa auditorias de QA por data
        const qaByDate = {};
        auditsList.forEach(a => {
            let d = a.date;
            if (!d && a.createdAt) {
                if (a.createdAt.toDate) {
                    d = a.createdAt.toDate().toISOString().split('T')[0];
                } else if (a.createdAt.seconds) {
                    d = new Date(a.createdAt.seconds * 1000).toISOString().split('T')[0];
                } else {
                    const dt = new Date(a.createdAt);
                    if (!isNaN(dt.getTime())) d = dt.toISOString().split('T')[0];
                }
            }
            if (!d) return;
            if (!qaByDate[d]) qaByDate[d] = { total: 0, conformes: 0 };
            qaByDate[d].total++;
            if (a.status === 'Conforme') qaByDate[d].conformes++;
        });

        // Timeline baseada nos lançamentos oficiais e corretos de KPIs do Setor
        const combined = [];
        const registeredDates = new Set();

        sectorKpisList.forEach(kpi => {
            const tmrDec = timeToDecimal(kpi.tmr);
            const dateLabel = formatDateBR(kpi.date);
            const rawDate = kpi.date;
            registeredDates.add(rawDate);

            // Busca auditoria de QA para a data correspondente
            const qaMatch = qaByDate[rawDate];
            const qaRate = (qaMatch && qaMatch.total > 0)
                ? Number(((qaMatch.conformes / qaMatch.total) * 100).toFixed(1))
                : qaStats.taxa;

            combined.push({
                id: kpi.id,
                date: dateLabel,
                fullDate: rawDate,
                timestamp: parseDateSort(rawDate),
                tmrDecimal: Number(tmrDec.toFixed(1)),
                tmrFormatted: kpi.tmr,
                fcr: Number(kpi.fcr || 0),
                recurrence: Number(kpi.recurrence || 0),
                qaRate: Number(qaRate)
            });
        });

        // Se houver datas com auditorias de QA não contempladas em sector_kpis, adiciona para completude da curva de QA
        Object.entries(qaByDate).forEach(([rawDate, qaData]) => {
            if (!registeredDates.has(rawDate)) {
                const dateLabel = formatDateBR(rawDate);
                const qaRate = qaData.total > 0 ? Number(((qaData.conformes / qaData.total) * 100).toFixed(1)) : 0;
                combined.push({
                    id: `qa-${rawDate}`,
                    date: dateLabel,
                    fullDate: rawDate,
                    timestamp: parseDateSort(rawDate),
                    tmrDecimal: timeToDecimal(latestKpi.tmr || '00:00:00'),
                    tmrFormatted: latestKpi.tmr || '00:00:00',
                    fcr: Number(latestKpi.fcr || 0),
                    recurrence: Number(latestKpi.recurrence || 0),
                    qaRate: Number(qaRate)
                });
            }
        });

        combined.sort((a, b) => a.timestamp - b.timestamp);

        // Aplica filtro de tempo
        if (timeframe === 'last30') return combined.slice(-5);
        if (timeframe === 'last60') return combined.slice(-10);
        return combined;
    }, [sectorKpisList, auditsList, qaStats, latestKpi, timeframe]);

    // Definição dos Metadados dos 4 KPIs Principais
    const currentKpiConfig = useMemo(() => {
        switch (selectedKpi) {
            case 'tmr':
                return {
                    label: 'TMR - Tempo Médio de Resposta (Setor)',
                    unit: 'minutos',
                    dataKey: 'tmrDecimal',
                    color: '#8b5cf6', // Roxo
                    goalValue: timeToDecimal(goals.tmr),
                    goalFormatted: `≤ ${goals.tmr}`,
                    isBetterLower: true,
                    currentVal: latestKpi.tmr || '00:00:00',
                    currentNum: timeToDecimal(latestKpi.tmr),
                    formatTooltip: (val) => `${formatTime(val)} (${val.toFixed(1)} min)`,
                    category: 'KPI Principal'
                };
            case 'fcr':
                return {
                    label: 'FCR - Resolução no Primeiro Contato',
                    unit: '%',
                    dataKey: 'fcr',
                    color: '#10b981', // Verde
                    goalValue: Number(goals.fcr),
                    goalFormatted: `≥ ${goals.fcr}%`,
                    isBetterLower: false,
                    currentVal: `${latestKpi.fcr}%`,
                    currentNum: Number(latestKpi.fcr),
                    formatTooltip: (val) => `${val}%`,
                    category: 'KPI Principal'
                };
            case 'recurrence':
                return {
                    label: 'Taxa de Reincidência de Atendimentos',
                    unit: '%',
                    dataKey: 'recurrence',
                    color: '#f43f5e', // Rosa / Vermelho
                    goalValue: Number(goals.recurrence),
                    goalFormatted: `≤ ${goals.recurrence}%`,
                    isBetterLower: true,
                    currentVal: `${latestKpi.recurrence}%`,
                    currentNum: Number(latestKpi.recurrence),
                    formatTooltip: (val) => `${val}%`,
                    category: 'KPI Principal'
                };
            case 'qa_rate':
                return {
                    label: 'Taxa de Conformidade QA (Monitoria de Qualidade)',
                    unit: '%',
                    dataKey: 'qaRate',
                    color: '#f59e0b', // Âmbar
                    goalValue: Number(goals.qa || 85),
                    goalFormatted: `≥ ${goals.qa || 85}%`,
                    isBetterLower: false,
                    currentVal: `${qaStats.taxa}%`,
                    currentNum: Number(qaStats.taxa),
                    formatTooltip: (val) => `${val}%`,
                    category: 'Monitoria QA'
                };
            default:
                return {
                    label: 'TMR - Tempo Médio de Resposta (Setor)',
                    unit: 'minutos',
                    dataKey: 'tmrDecimal',
                    color: '#8b5cf6',
                    goalValue: timeToDecimal(goals.tmr),
                    goalFormatted: `≤ ${goals.tmr}`,
                    isBetterLower: true,
                    currentVal: latestKpi.tmr || '00:00:00',
                    currentNum: timeToDecimal(latestKpi.tmr),
                    formatTooltip: (val) => `${formatTime(val)} (${val.toFixed(1)} min)`,
                    category: 'KPI Principal'
                };
        }
    }, [selectedKpi, goals, latestKpi, qaStats]);

    // Estatísticas resumidas da métrica no período selecionado (Mín, Máx, Média, Variação)
    const kpiSummaryStats = useMemo(() => {
        if (evolutionTimeline.length === 0) return { avg: 0, min: 0, max: 0, diff: 0 };
        const values = evolutionTimeline.map(i => Number(i[currentKpiConfig.dataKey]) || 0);
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = Number((sum / values.length).toFixed(1));
        const min = Math.min(...values);
        const max = Math.max(...values);
        const first = values[0] || 0;
        const last = values[values.length - 1] || 0;
        const diff = Number((last - first).toFixed(1));
        return { avg, min, max, diff, count: values.length };
    }, [evolutionTimeline, currentKpiConfig]);

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 h-full p-8">
                <Loader2 className="w-10 h-10 text-red-600 animate-spin mb-3" />
                <p className="text-sm font-medium text-gray-600">Carregando painel analítico de KPIs e monitorias...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 p-6 h-full overflow-y-auto bg-gray-50 flex flex-col space-y-6">
            
            {/* ========================================================= */}
            {/* CABEÇALHO DA DASHBOARD INFOGRÁFICA                        */}
            {/* ========================================================= */}
            <header className="bg-white p-6 rounded-xl border border-gray-200 shadow-xs flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shrink-0">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-red-50 text-red-600 rounded-xl border border-red-200">
                            <Rocket className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                                    Cockpit Geral de KPIs & Monitorias
                                </h1>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                                    <Activity className="w-3.5 h-3.5 text-red-600" /> Operação em Tempo Real
                                </span>
                            </div>
                            <p className="text-sm text-gray-500">
                                Monitoramento infográfico consolidado, metas de qualidade, conformidade e evolução histórica.
                            </p>
                        </div>
                    </div>
                </div>

                {/* MODOS DE VISUALIZAÇÃO ALTERNÁVEIS */}
                <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 shrink-0 self-start xl:self-auto">
                    <button 
                        onClick={() => setViewMode('cockpit')} 
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            viewMode === 'cockpit' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                        }`}
                        title="Visão Cockpit Executivo"
                    >
                        <BarChart3 className="w-3.5 h-3.5 text-red-600" />
                        <span>Cockpit Geral</span>
                    </button>
                    <button 
                        onClick={() => setViewMode('evolution')} 
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            viewMode === 'evolution' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                        }`}
                        title="Gráficos de Evolução Temporal com Seleção"
                    >
                        <LineChartIcon className="w-3.5 h-3.5 text-purple-600" />
                        <span>Evolução & Gráficos</span>
                    </button>
                    <button 
                        onClick={() => setViewMode('compliance')} 
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            viewMode === 'compliance' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                        }`}
                        title="Semáforo e Metas"
                    >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Semáforo de Metas</span>
                    </button>
                    <button 
                        onClick={() => setViewMode('shifts')} 
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            viewMode === 'shifts' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
                        }`}
                        title="Comparativo por Turno"
                    >
                        <Users className="w-3.5 h-3.5 text-blue-600" />
                        <span>Por Turnos</span>
                    </button>
                </div>
            </header>

            {/* ========================================================= */}
            {/* RIBBON DE SAÚDE OPERACIONAL / TICKETS CRÍTICOS            */}
            {/* ========================================================= */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
                <div className="p-4 rounded-xl border bg-white border-gray-200 shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider block text-amber-600">Demandas Pendentes</span>
                        <span className="text-2xl font-black text-gray-900 leading-tight mt-0.5 block">{reportStats.pending}</span>
                        <span className="text-[11px] text-gray-400">Aguardando triagem</span>
                    </div>
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
                        <Clock className="w-5 h-5" />
                    </div>
                </div>

                <div className="p-4 rounded-xl border bg-white border-gray-200 shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider block text-blue-600">Em Andamento</span>
                        <span className="text-2xl font-black text-gray-900 leading-tight mt-0.5 block">{reportStats.inProgress}</span>
                        <span className="text-[11px] text-gray-400">Em análise técnica</span>
                    </div>
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-200">
                        <Activity className="w-5 h-5" />
                    </div>
                </div>

                <div className="p-4 rounded-xl border bg-white border-gray-200 shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider block text-emerald-600">Demandas Resolvidas</span>
                        <span className="text-2xl font-black text-gray-900 leading-tight mt-0.5 block">{reportStats.resolved}</span>
                        <span className="text-[11px] text-gray-400">Chamados concluídos</span>
                    </div>
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200">
                        <CheckCircle className="w-5 h-5" />
                    </div>
                </div>

                <div className="p-4 rounded-xl border bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-white border-purple-200 shadow-2xs flex items-center justify-between">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider block text-purple-700">Índice QA Operação</span>
                        <span className="text-2xl font-black text-gray-900 leading-tight mt-0.5 block">{qaStats.taxa}%</span>
                        <span className="text-[11px] text-purple-600 font-bold">{qaStats.conformes} de {qaStats.total} conformes</span>
                    </div>
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-xl border border-purple-200">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* ========================================================= */}
            {/* CONTEÚDO PRINCIPAL DE ACORDO COM O MODO SELECIONADO       */}
            {/* ========================================================= */}

            {/* --------------------------------------------------------- */}
            {/* MODO 1: COCKPIT GERAL INFOGRÁFICO                         */}
            {/* --------------------------------------------------------- */}
            {viewMode === 'cockpit' && (
                <div className="space-y-6">
                    
                    {/* BLOCO INFOGRÁFICO DE KPIS DO SETOR */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                                <Rocket className="w-4 h-4 text-red-600" /> Indicadores Estratégicos Globais
                            </h2>
                            <button 
                                onClick={() => setViewMode('evolution')} 
                                className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                            >
                                Ver Gráficos de Evolução <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            
                            {/* TMR */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Clock className="w-4 h-4 text-purple-600" /> TMR Setor
                                        </span>
                                        <TrendBadge type="tmr" val={latestKpi.tmr} goal={goals.tmr} />
                                    </div>
                                    <div className="text-3xl font-black text-gray-900 tracking-tight mt-1">
                                        {latestKpi.tmr || '00:00:00'}
                                    </div>
                                </div>
                                <div className="pt-4 mt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                    <span>Meta Estipulada:</span>
                                    <span className="font-bold font-mono text-purple-700">≤ {goals.tmr}</span>
                                </div>
                            </div>

                            {/* FCR */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Target className="w-4 h-4 text-emerald-600" /> FCR (1º Contato)
                                        </span>
                                        <TrendBadge type="fcr" val={latestKpi.fcr} goal={goals.fcr} />
                                    </div>
                                    <div className="text-3xl font-black text-gray-900 tracking-tight mt-1">
                                        {latestKpi.fcr}%
                                    </div>
                                </div>
                                <div className="pt-4 mt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                    <span>Meta Estipulada:</span>
                                    <span className="font-bold font-mono text-emerald-700">≥ {goals.fcr}%</span>
                                </div>
                            </div>

                            {/* REINCIDÊNCIA */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Activity className="w-4 h-4 text-blue-600" /> Reincidência
                                        </span>
                                        <TrendBadge type="recurrence" val={latestKpi.recurrence} goal={goals.recurrence} />
                                    </div>
                                    <div className="text-3xl font-black text-gray-900 tracking-tight mt-1">
                                        {latestKpi.recurrence}%
                                    </div>
                                </div>
                                <div className="pt-4 mt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                    <span>Meta Estipulada:</span>
                                    <span className="font-bold font-mono text-blue-700">≤ {goals.recurrence}%</span>
                                </div>
                            </div>

                            {/* GAUGE DE QUALIDADE QA */}
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs hover:shadow-md transition-all flex flex-col items-center justify-between relative">
                                <div className="w-full flex justify-between items-start mb-1">
                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                        <Star className="w-4 h-4 text-amber-500" /> % QA Conforme
                                    </span>
                                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                        qaStats.taxa >= (goals.qa || 85) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                    }`}>
                                        {qaStats.taxa >= (goals.qa || 85) ? 'Excelente' : 'Atenção'}
                                    </span>
                                </div>

                                <div className="w-full h-24 flex items-center justify-center relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { value: Number(qaStats.taxa) },
                                                    { value: Math.max(0, 100 - Number(qaStats.taxa)) }
                                                ]}
                                                cx="50%"
                                                cy="80%"
                                                startAngle={180}
                                                endAngle={0}
                                                innerRadius={50}
                                                outerRadius={68}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                <Cell fill={qaStats.taxa >= (goals.qa || 85) ? "#10b981" : "#f59e0b"} />
                                                <Cell fill="#f3f4f6" />
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute bottom-2 flex flex-col items-center">
                                        <span className={`text-2xl font-black ${qaStats.taxa >= (goals.qa || 85) ? "text-emerald-600" : "text-amber-600"}`}>
                                            {qaStats.taxa}%
                                        </span>
                                    </div>
                                </div>

                                <div className="w-full pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                                    <span>Meta QA: ≥ {goals.qa || 85}%</span>
                                    <span className="text-[11px] text-gray-400">{qaStats.total} auditorias</span>
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* BLOCO PERFORMANCE OPERACIONAL DA EQUIPE */}
                    <div>
                        <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-3">
                            <Users className="w-4 h-4 text-indigo-600" /> Eficiência Média da Equipe
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs border-l-4 border-l-emerald-500">
                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                    <CheckSquare className="w-4 h-4 text-emerald-600" /> Média Finalizações
                                </span>
                                <div className="text-3xl font-black text-gray-900 tracking-tight">
                                    {teamStats.avgVol}
                                </div>
                                <span className="text-xs text-gray-400 mt-2 block font-medium">
                                    Atendimentos concluídos / analista
                                </span>
                            </div>

                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs border-l-4 border-l-blue-500">
                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                    <Phone className="w-4 h-4 text-blue-600" /> TMA Médio (Voz)
                                </span>
                                <div className="text-3xl font-black text-gray-900 tracking-tight font-mono">
                                    {teamStats.avgTmaTel}
                                </div>
                                <span className="text-xs text-gray-400 mt-2 block font-medium">
                                    Tempo médio em ligação telefônica
                                </span>
                            </div>

                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs border-l-4 border-l-purple-500">
                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                    <MessageCircle className="w-4 h-4 text-purple-600" /> TMA Médio (Chat)
                                </span>
                                <div className="text-3xl font-black text-gray-900 tracking-tight font-mono">
                                    {teamStats.avgTmaHuggy}
                                </div>
                                <span className="text-xs text-gray-400 mt-2 block font-medium">
                                    Tempo médio no atendimento Huggy
                                </span>
                            </div>

                            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs border-l-4 border-l-amber-500">
                                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                    <Star className="w-4 h-4 text-amber-500" /> Pontuação por Turno
                                </span>
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <div className="border-r border-gray-100 pr-2">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Dia</span>
                                        <span className="text-xl font-black text-gray-900">{teamStats.avgPtsDay} pts</span>
                                    </div>
                                    <div className="pl-2">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Noite</span>
                                        <span className="text-xl font-black text-gray-900">{teamStats.avgPtsNight} pts</span>
                                    </div>
                                </div>
                                <span className="text-[11px] text-gray-400 mt-2 block">
                                    Média da última semana apurada
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* BLOCO DESTAQUES & PONTOS DE ATENÇÃO */}
                    <div>
                        <h2 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-3">
                            <Award className="w-4 h-4 text-amber-500" /> Destaques Operacionais & Atenção
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            
                            {/* TOP PERFORMER DIA */}
                            <div 
                                id="card-leader-day"
                                onClick={() => setModalInfo({ title: 'Top Desempenho por Média (Manhã / Tarde)', data: teamStats.rankings.topPointsDay, formatVal: (v) => `${v} pts (média)` })}
                                className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900 text-white p-5 rounded-xl shadow-xs border border-emerald-500/30 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group"
                            >
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 flex items-center gap-1">
                                        <Award className="w-3.5 h-3.5 text-amber-300" /> Líder Geral (Dia)
                                    </span>
                                    <Info className="w-4 h-4 text-emerald-300 opacity-60 group-hover:opacity-100" />
                                </div>
                                <div className="my-2">
                                    <span className="text-lg font-black block truncate" title={teamStats.topDay.name}>
                                        {teamStats.topDay.name}
                                    </span>
                                    <div className="text-xs text-emerald-100 font-bold flex items-center gap-1 flex-wrap">
                                        <span>{teamStats.topDay.val} pts de média</span>
                                        {teamStats.topDay.evalCount > 0 && (
                                            <span className="text-[10px] text-emerald-200/90 font-normal">
                                                ({teamStats.topDay.evalCount} {teamStats.topDay.evalCount === 1 ? 'avaliação' : 'avaliações'})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className="text-[11px] text-emerald-200 flex items-center gap-1 mt-1">
                                    Ver ranking por média <ChevronRight className="w-3 h-3" />
                                </span>
                            </div>

                            {/* TOP PERFORMER NOITE */}
                            <div 
                                id="card-leader-night"
                                onClick={() => setModalInfo({ title: 'Top Desempenho por Média (Noite)', data: teamStats.rankings.topPointsNight, formatVal: (v) => `${v} pts (média)` })}
                                className="bg-gradient-to-br from-indigo-800 via-indigo-900 to-zinc-950 text-white p-5 rounded-xl shadow-xs border border-indigo-700/30 flex flex-col justify-between cursor-pointer hover:shadow-md transition-all group"
                            >
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200 flex items-center gap-1">
                                        <Award className="w-3.5 h-3.5 text-yellow-300" /> Líder Geral (Noite)
                                    </span>
                                    <Info className="w-4 h-4 text-indigo-300 opacity-60 group-hover:opacity-100" />
                                </div>
                                <div className="my-2">
                                    <span className="text-lg font-black block truncate" title={teamStats.topNight.name}>
                                        {teamStats.topNight.name}
                                    </span>
                                    <div className="text-xs text-indigo-100 font-bold flex items-center gap-1 flex-wrap">
                                        <span>{teamStats.topNight.val} pts de média</span>
                                        {teamStats.topNight.evalCount > 0 && (
                                            <span className="text-[10px] text-indigo-200/90 font-normal">
                                                ({teamStats.topNight.evalCount} {teamStats.topNight.evalCount === 1 ? 'avaliação' : 'avaliações'})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span className="text-[11px] text-indigo-200 flex items-center gap-1 mt-1">
                                    Ver ranking por média <ChevronRight className="w-3 h-3" />
                                </span>
                            </div>

                            {/* MAIOR TMA VOZ (ATENÇÃO) */}
                            <div 
                                onClick={() => setModalInfo({ title: 'Maiores TMAs em Telefonia', data: teamStats.rankings.maxTmaTel })}
                                className="bg-white p-5 rounded-xl border border-gray-200 border-l-4 border-l-rose-500 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                            >
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Maior TMA Voz
                                    </span>
                                    <Info className="w-4 h-4 text-gray-300 group-hover:text-gray-600" />
                                </div>
                                <div className="my-2">
                                    <span className="text-2xl font-black text-rose-600 font-mono">
                                        {teamStats.maxTmaTel.val}
                                    </span>
                                    <span className="text-xs text-gray-700 font-bold block truncate mt-0.5" title={teamStats.maxTmaTel.name}>
                                        {teamStats.maxTmaTel.name}
                                    </span>
                                </div>
                                <span className="text-[11px] text-rose-600 font-medium">Requer alinhamento de escopo</span>
                            </div>

                            {/* MENOR MÉDIA DE FINALIZAÇÕES (ATENÇÃO) */}
                            <div 
                                onClick={() => setModalInfo({ title: 'Menor Média de Finalizações', data: teamStats.rankings.lowestVol })}
                                className="bg-white p-5 rounded-xl border border-gray-200 border-l-4 border-l-amber-500 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                            >
                                <div className="flex justify-between items-start">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Menor Volume
                                    </span>
                                    <Info className="w-4 h-4 text-gray-300 group-hover:text-gray-600" />
                                </div>
                                <div className="my-2">
                                    <span className="text-2xl font-black text-amber-600 font-mono">
                                        {teamStats.lowestAvgVol.val} fin.
                                    </span>
                                    <span className="text-xs text-gray-700 font-bold block truncate mt-0.5" title={teamStats.lowestAvgVol.name}>
                                        {teamStats.lowestAvgVol.name}
                                    </span>
                                </div>
                                <span className="text-[11px] text-amber-600 font-medium">Oportunidade de capacitação</span>
                            </div>

                        </div>
                    </div>

                </div>
            )}

            {/* --------------------------------------------------------- */}
            {/* MODO 2: GRÁFICOS DE EVOLUÇÃO DE KPIS & MONITORIA          */}
            {/* --------------------------------------------------------- */}
            {viewMode === 'evolution' && (
                <div className="space-y-6">
                    
                    {/* BARRA DE CONTROLE DO GRÁFICO */}
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        <div>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Indicador Selecionado para Análise</span>
                            <div className="flex items-center gap-2 mt-1">
                                <h3 className="text-lg font-black text-gray-900">
                                    {currentKpiConfig.label}
                                </h3>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                                    {currentKpiConfig.category}
                                </span>
                            </div>
                        </div>

                        {/* TIPO DE GRÁFICO & PERÍODO */}
                        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                            {/* Filtro de Janela Temporal */}
                            <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
                                <button 
                                    onClick={() => setTimeframe('all')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                        timeframe === 'all' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                                    }`}
                                >
                                    Todo o Histórico
                                </button>
                                <button 
                                    onClick={() => setTimeframe('last60')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                        timeframe === 'last60' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                                    }`}
                                >
                                    Últimos Lançamentos
                                </button>
                                <button 
                                    onClick={() => setTimeframe('last30')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                        timeframe === 'last30' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                                    }`}
                                >
                                    Recentes (5)
                                </button>
                            </div>

                            {/* Tipo de Visualização Gráfica */}
                            <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
                                <button 
                                    onClick={() => setChartType('area')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                        chartType === 'area' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                                    }`}
                                    title="Gráfico de Área"
                                >
                                    Área Suave
                                </button>
                                <button 
                                    onClick={() => setChartType('line')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                        chartType === 'line' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                                    }`}
                                    title="Gráfico de Linha"
                                >
                                    Linhas
                                </button>
                                <button 
                                    onClick={() => setChartType('bar')}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                        chartType === 'bar' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'
                                    }`}
                                    title="Gráfico de Barras"
                                >
                                    Barras
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* SELETOR DE KPIS PRINCIPAIS (APENAS OS 4 COM LANÇAMENTOS CORRETOS) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <button 
                            id="kpi-filter-tmr"
                            onClick={() => setSelectedKpi('tmr')}
                            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                                selectedKpi === 'tmr' 
                                    ? 'bg-purple-50/90 border-purple-400 ring-2 ring-purple-500/20 shadow-xs' 
                                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-2xs'
                            }`}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" /> TMR Setor
                                </span>
                                <TrendBadge type="tmr" val={latestKpi.tmr} goal={goals.tmr} />
                            </div>
                            <span className="text-2xl font-black text-gray-900 block mt-1">{latestKpi.tmr || '00:00:00'}</span>
                            <span className="text-xs text-gray-400 mt-1 block">Meta do Setor: ≤ {goals.tmr}</span>
                        </button>

                        <button 
                            id="kpi-filter-fcr"
                            onClick={() => setSelectedKpi('fcr')}
                            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                                selectedKpi === 'fcr' 
                                    ? 'bg-emerald-50/90 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs' 
                                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-2xs'
                            }`}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Target className="w-3.5 h-3.5" /> FCR (1º Contato)
                                </span>
                                <TrendBadge type="fcr" val={latestKpi.fcr} goal={goals.fcr} />
                            </div>
                            <span className="text-2xl font-black text-gray-900 block mt-1">{latestKpi.fcr}%</span>
                            <span className="text-xs text-gray-400 mt-1 block">Meta do Setor: ≥ {goals.fcr}%</span>
                        </button>

                        <button 
                            id="kpi-filter-recurrence"
                            onClick={() => setSelectedKpi('recurrence')}
                            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                                selectedKpi === 'recurrence' 
                                    ? 'bg-rose-50/90 border-rose-400 ring-2 ring-rose-500/20 shadow-xs' 
                                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-2xs'
                            }`}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Activity className="w-3.5 h-3.5" /> Reincidência
                                </span>
                                <TrendBadge type="recurrence" val={latestKpi.recurrence} goal={goals.recurrence} />
                            </div>
                            <span className="text-2xl font-black text-gray-900 block mt-1">{latestKpi.recurrence}%</span>
                            <span className="text-xs text-gray-400 mt-1 block">Meta do Setor: ≤ {goals.recurrence}%</span>
                        </button>

                        <button 
                            id="kpi-filter-qa"
                            onClick={() => setSelectedKpi('qa_rate')}
                            className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                                selectedKpi === 'qa_rate' 
                                    ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-500/20 shadow-xs' 
                                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-2xs'
                            }`}
                        >
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Star className="w-3.5 h-3.5" /> % QA Monitoria
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                    qaStats.taxa >= (goals.qa || 85) ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                                }`}>
                                    {qaStats.taxa >= (goals.qa || 85) ? 'Na Meta' : 'Abaixo'}
                                </span>
                            </div>
                            <span className="text-2xl font-black text-gray-900 block mt-1">{qaStats.taxa}%</span>
                            <span className="text-xs text-gray-400 mt-1 block">Meta: ≥ {goals.qa || 85}% ({qaStats.total} aud.)</span>
                        </button>
                    </div>

                    {/* GRÁFICO PRINCIPAL COM RECHARTS */}
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-2xs">
                        
                        {/* RIBBON DE ESTATÍSTICAS DA MÉTRICA */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pb-5 mb-5 border-b border-gray-100">
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Valor Atual</span>
                                <span className="text-xl font-black text-gray-900 mt-0.5 block">{currentKpiConfig.currentVal}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Meta Definida</span>
                                <span className="text-xl font-black text-purple-700 mt-0.5 block">{currentKpiConfig.goalFormatted}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Média no Período</span>
                                <span className="text-xl font-black text-gray-900 mt-0.5 block">{kpiSummaryStats.avg} {currentKpiConfig.unit}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Melhor Registro</span>
                                <span className="text-xl font-black text-emerald-600 mt-0.5 block">
                                    {currentKpiConfig.isBetterLower ? kpiSummaryStats.min : kpiSummaryStats.max}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Lançamentos</span>
                                <span className="text-xl font-black text-gray-900 mt-0.5 block">{kpiSummaryStats.count} datas</span>
                            </div>
                        </div>

                        {/* ÁREA DO GRÁFICO */}
                        <div className="w-full h-80">
                            {evolutionTimeline.length === 0 ? (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                    <BarChart3 className="w-10 h-10 opacity-30 mb-2" />
                                    <p className="text-sm">Ainda não há dados suficientes para gerar a curva deste indicador.</p>
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    {chartType === 'area' ? (
                                        <AreaChart data={evolutionTimeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="kpiGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor={currentKpiConfig.color} stopOpacity={0.4}/>
                                                    <stop offset="95%" stopColor={currentKpiConfig.color} stopOpacity={0.0}/>
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                                            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: '#09090b', borderRadius: '12px', border: 'none', color: '#fff' }}
                                                labelStyle={{ color: '#a1a1aa', fontWeight: 'bold' }}
                                                formatter={(val) => [currentKpiConfig.formatTooltip(val), currentKpiConfig.label]}
                                            />
                                            {currentKpiConfig.goalValue > 0 && (
                                                <ReferenceLine 
                                                    y={currentKpiConfig.goalValue} 
                                                    stroke="#ef4444" 
                                                    strokeDasharray="4 4" 
                                                    label={{ value: `Meta (${currentKpiConfig.goalFormatted})`, fill: '#ef4444', fontSize: 11, position: 'top' }} 
                                                />
                                            )}
                                            <Area 
                                                type="monotone" 
                                                dataKey={currentKpiConfig.dataKey} 
                                                stroke={currentKpiConfig.color} 
                                                strokeWidth={3} 
                                                fillOpacity={1} 
                                                fill="url(#kpiGradient)" 
                                            />
                                        </AreaChart>
                                    ) : chartType === 'line' ? (
                                        <LineChart data={evolutionTimeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                                            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: '#09090b', borderRadius: '12px', border: 'none', color: '#fff' }}
                                                labelStyle={{ color: '#a1a1aa', fontWeight: 'bold' }}
                                                formatter={(val) => [currentKpiConfig.formatTooltip(val), currentKpiConfig.label]}
                                            />
                                            {currentKpiConfig.goalValue > 0 && (
                                                <ReferenceLine 
                                                    y={currentKpiConfig.goalValue} 
                                                    stroke="#ef4444" 
                                                    strokeDasharray="4 4" 
                                                    label={{ value: `Meta (${currentKpiConfig.goalFormatted})`, fill: '#ef4444', fontSize: 11, position: 'top' }} 
                                                />
                                            )}
                                            <Line 
                                                type="monotone" 
                                                dataKey={currentKpiConfig.dataKey} 
                                                stroke={currentKpiConfig.color} 
                                                strokeWidth={3} 
                                                dot={{ r: 4, fill: currentKpiConfig.color }}
                                                activeDot={{ r: 7 }}
                                            />
                                        </LineChart>
                                    ) : (
                                        <BarChart data={evolutionTimeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                                            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: '#09090b', borderRadius: '12px', border: 'none', color: '#fff' }}
                                                labelStyle={{ color: '#a1a1aa', fontWeight: 'bold' }}
                                                formatter={(val) => [currentKpiConfig.formatTooltip(val), currentKpiConfig.label]}
                                            />
                                            {currentKpiConfig.goalValue > 0 && (
                                                <ReferenceLine 
                                                    y={currentKpiConfig.goalValue} 
                                                    stroke="#ef4444" 
                                                    strokeDasharray="4 4" 
                                                />
                                            )}
                                            <Bar 
                                                dataKey={currentKpiConfig.dataKey} 
                                                fill={currentKpiConfig.color} 
                                                radius={[6, 6, 0, 0]} 
                                            />
                                        </BarChart>
                                    )}
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* TABELA DE LANÇAMENTOS DO INDICADOR SELECIONADO */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Registros Históricos ({evolutionTimeline.length})
                            </h4>
                            <span className="text-xs text-gray-400">
                                Ordenado cronologicamente
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-xs">
                                <thead className="bg-gray-50 text-gray-500 font-bold">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Data</th>
                                        <th className="px-4 py-3 text-right">Valor Registrado</th>
                                        <th className="px-4 py-3 text-right">Meta</th>
                                        <th className="px-4 py-3 text-center">Status de Conformidade</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {evolutionTimeline.map((item, idx) => {
                                        const rawVal = item[currentKpiConfig.dataKey];
                                        const isOk = currentKpiConfig.isBetterLower 
                                            ? rawVal <= currentKpiConfig.goalValue 
                                            : rawVal >= currentKpiConfig.goalValue;

                                        return (
                                            <tr key={idx} className="hover:bg-gray-50/80">
                                                <td className="px-4 py-3 font-medium text-gray-900">{item.fullDate || item.date}</td>
                                                <td className="px-4 py-3 text-right font-bold text-gray-900 font-mono">
                                                    {currentKpiConfig.formatTooltip(rawVal)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-500 font-mono">
                                                    {currentKpiConfig.goalFormatted}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                                        isOk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                    }`}>
                                                        {isOk ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <AlertCircle className="w-3 h-3 text-rose-600" />}
                                                        {isOk ? 'Em Conformidade' : 'Fora do Alvo'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            )}

            {/* --------------------------------------------------------- */}
            {/* MODO 3: SEMÁFORO DE METAS & CONFORMIDADE OPERACIONAL      */}
            {/* --------------------------------------------------------- */}
            {viewMode === 'compliance' && (
                <div className="space-y-6">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
                        <h3 className="text-base font-black text-gray-900">Matriz Semafórica de SLAs & Metas</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Visão de conformidade imediata para tomada de decisão gerencial.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* TMR Semáforo */}
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Tempo Médio de Resposta (TMR)</span>
                                    <h4 className="text-2xl font-black text-gray-900 mt-1">{latestKpi.tmr || '00:00:00'}</h4>
                                </div>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${
                                    timeToDecimal(latestKpi.tmr) <= timeToDecimal(goals.tmr) ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-rose-500 ring-4 ring-rose-100'
                                }`}>
                                    {timeToDecimal(latestKpi.tmr) <= timeToDecimal(goals.tmr) ? 'OK' : '!'}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-gray-600">
                                    <span>Meta Estipulada: ≤ {goals.tmr}</span>
                                    <span className="font-bold">
                                        {timeToDecimal(latestKpi.tmr) <= timeToDecimal(goals.tmr) ? 'Dentro do SLA' : 'SLA Violado'}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${
                                            timeToDecimal(latestKpi.tmr) <= timeToDecimal(goals.tmr) ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`} 
                                        style={{ width: `${Math.min(100, Math.round((timeToDecimal(latestKpi.tmr) / (timeToDecimal(goals.tmr) || 1)) * 100))}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* FCR Semáforo */}
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Resolução 1º Contato (FCR)</span>
                                    <h4 className="text-2xl font-black text-gray-900 mt-1">{latestKpi.fcr}%</h4>
                                </div>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${
                                    Number(latestKpi.fcr) >= Number(goals.fcr) ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-rose-500 ring-4 ring-rose-100'
                                }`}>
                                    {Number(latestKpi.fcr) >= Number(goals.fcr) ? 'OK' : '!'}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-gray-600">
                                    <span>Meta Estipulada: ≥ {goals.fcr}%</span>
                                    <span className="font-bold">
                                        {Number(latestKpi.fcr) >= Number(goals.fcr) ? 'Meta Superada' : 'Abaixo da Meta'}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${
                                            Number(latestKpi.fcr) >= Number(goals.fcr) ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`} 
                                        style={{ width: `${Math.min(100, Number(latestKpi.fcr))}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Reincidência Semáforo */}
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Taxa de Reincidência</span>
                                    <h4 className="text-2xl font-black text-gray-900 mt-1">{latestKpi.recurrence}%</h4>
                                </div>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${
                                    Number(latestKpi.recurrence) <= Number(goals.recurrence) ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-rose-500 ring-4 ring-rose-100'
                                }`}>
                                    {Number(latestKpi.recurrence) <= Number(goals.recurrence) ? 'OK' : '!'}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-gray-600">
                                    <span>Meta Estipulada: ≤ {goals.recurrence}%</span>
                                    <span className="font-bold">
                                        {Number(latestKpi.recurrence) <= Number(goals.recurrence) ? 'Controle Adequado' : 'Reincidência Crítica'}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${
                                            Number(latestKpi.recurrence) <= Number(goals.recurrence) ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`} 
                                        style={{ width: `${Math.min(100, (Number(latestKpi.recurrence) / (Number(goals.recurrence) || 1)) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* QA Monitoria Semáforo */}
                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">Conformidade Monitoria QA</span>
                                    <h4 className="text-2xl font-black text-gray-900 mt-1">{qaStats.taxa}%</h4>
                                </div>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-sm ${
                                    qaStats.taxa >= (goals.qa || 85) ? 'bg-emerald-500 ring-4 ring-emerald-100' : 'bg-amber-500 ring-4 ring-amber-100'
                                }`}>
                                    {qaStats.taxa >= (goals.qa || 85) ? 'OK' : '!'}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-gray-600">
                                    <span>Meta Estipulada: ≥ {goals.qa || 85}%</span>
                                    <span className="font-bold">
                                        {qaStats.taxa >= (goals.qa || 85) ? 'Conformidade Plena' : 'Necessita Treinamento'}
                                    </span>
                                </div>
                                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${
                                            qaStats.taxa >= (goals.qa || 85) ? 'bg-emerald-500' : 'bg-amber-500'
                                        }`} 
                                        style={{ width: `${Math.min(100, qaStats.taxa)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* --------------------------------------------------------- */}
            {/* MODO 4: COMPARATIVO POR TURNOS (SQUADS)                   */}
            {/* --------------------------------------------------------- */}
            {viewMode === 'shifts' && (
                <div className="space-y-6">
                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
                        <h3 className="text-base font-black text-gray-900">Comparativo Operacional entre Turnos</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Comportamento e distribuição de carga entre os períodos diurno (Manhã/Tarde) e noturno.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* TURNO MANHÃ / TARDE */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                            <div className="p-5 bg-gradient-to-r from-amber-500/10 to-orange-500/5 border-b border-amber-200/50 flex justify-between items-center">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Turno Diurno</span>
                                    <h4 className="text-lg font-black text-gray-900">Manhã & Tarde</h4>
                                </div>
                                <span className="px-3 py-1 bg-amber-100 text-amber-800 font-bold rounded-full text-xs">
                                    {teamStats.shiftSummary.day.count} colaboradores avaliados
                                </span>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Média de Pontos</span>
                                        <span className="text-2xl font-black text-amber-600 mt-1 block">{teamStats.shiftSummary.day.avgPts} pts</span>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Volume Finalizado</span>
                                        <span className="text-2xl font-black text-emerald-600 mt-1 block">{teamStats.shiftSummary.day.avgVol}</span>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-gray-100">
                                    <span className="text-xs font-bold text-gray-700 block mb-2">Destaque do Turno (Líder Geral):</span>
                                    <div className="flex items-center justify-between bg-amber-50/60 p-3 rounded-lg border border-amber-200/60">
                                        <div className="flex items-center gap-2">
                                            <Award className="w-4 h-4 text-amber-600" />
                                            <div>
                                                <span className="text-sm font-bold text-gray-900 block">{teamStats.topDay.name}</span>
                                                {teamStats.topDay.evalCount > 0 && (
                                                    <span className="text-[10px] text-amber-800/80">
                                                        {teamStats.topDay.evalCount} {teamStats.topDay.evalCount === 1 ? 'avaliação' : 'avaliações'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-extrabold text-amber-700 font-mono block">{teamStats.topDay.val} pts</span>
                                            <span className="text-[10px] text-gray-500 font-medium">(média)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* TURNO NOITE */}
                        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                            <div className="p-5 bg-gradient-to-r from-indigo-500/10 to-purple-500/5 border-b border-indigo-200/50 flex justify-between items-center">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">Turno Noturno</span>
                                    <h4 className="text-lg font-black text-gray-900">Noite</h4>
                                </div>
                                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 font-bold rounded-full text-xs">
                                    {teamStats.shiftSummary.night.count} colaboradores avaliados
                                </span>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Média de Pontos</span>
                                        <span className="text-2xl font-black text-indigo-600 mt-1 block">{teamStats.shiftSummary.night.avgPts} pts</span>
                                    </div>
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Volume Finalizado</span>
                                        <span className="text-2xl font-black text-emerald-600 mt-1 block">{teamStats.shiftSummary.night.avgVol}</span>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-gray-100">
                                    <span className="text-xs font-bold text-gray-700 block mb-2">Destaque do Turno (Líder Geral):</span>
                                    <div className="flex items-center justify-between bg-indigo-50/60 p-3 rounded-lg border border-indigo-200/60">
                                        <div className="flex items-center gap-2">
                                            <Award className="w-4 h-4 text-indigo-600" />
                                            <div>
                                                <span className="text-sm font-bold text-gray-900 block">{teamStats.topNight.name}</span>
                                                {teamStats.topNight.evalCount > 0 && (
                                                    <span className="text-[10px] text-indigo-800/80">
                                                        {teamStats.topNight.evalCount} {teamStats.topNight.evalCount === 1 ? 'avaliação' : 'avaliações'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-extrabold text-indigo-700 font-mono block">{teamStats.topNight.val} pts</span>
                                            <span className="text-[10px] text-gray-500 font-medium">(média)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL DE RANKINGS / DETALHAMENTO (INFO MODAL)             */}
            {/* ========================================================= */}
            {modalInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-xs">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-4 bg-zinc-950 text-white border-b border-zinc-800">
                            <h3 className="font-bold text-sm">{modalInfo.title}</h3>
                            <button 
                                onClick={() => setModalInfo(null)} 
                                className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto divide-y divide-gray-100">
                            {modalInfo.data && modalInfo.data.length > 0 ? (
                                modalInfo.data.map((item, idx) => (
                                    <div key={item.id || idx} className="flex justify-between items-center py-2.5 gap-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className={`font-bold w-6 text-center text-xs shrink-0 ${idx < 3 ? 'text-amber-500 font-black' : 'text-gray-400'}`}>
                                                {idx + 1}º
                                            </span>
                                            <div className="min-w-0">
                                                <span className="font-bold text-gray-800 text-sm block truncate">{item.name}</span>
                                                {item.evalCount !== undefined && (
                                                    <span className="text-[11px] text-gray-400 font-medium block">
                                                        {item.evalCount} {item.evalCount === 1 ? 'avaliação' : 'avaliações'} • Total: {item.totalPts} pts
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="font-bold text-gray-900 text-sm font-mono block">
                                                {modalInfo.formatVal ? modalInfo.formatVal(item.val) : item.val}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-gray-500 py-8 text-sm">
                                    Nenhum registro disponível para este recorte.
                                </div>
                            )}
                        </div>
                        <div className="p-3 bg-gray-50 border-t border-gray-100 flex justify-end">
                            <button 
                                onClick={() => setModalInfo(null)}
                                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold text-xs rounded-lg transition-colors cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default DashboardOverview;

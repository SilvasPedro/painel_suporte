import React, { useState, useEffect, useMemo } from 'react';
import {
    Rocket, Target, Activity, Star, Clock, CheckSquare, Phone, MessageCircle,
    Award, AlertTriangle, CheckCircle, Loader2, Users, ChevronRight,
    TrendingUp, TrendingDown, ArrowUpRight, BarChart3, LineChart as LineChartIcon,
    Info, X, ShieldCheck, CheckCircle2, AlertCircle, Headphones, FileCheck,
    Filter, RotateCcw, Calendar, Layers, Sparkles, ChevronDown, Check,
    Search, ArrowRight, Zap, RefreshCw
} from 'lucide-react';
import {
    AreaChart, Area, LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    ReferenceLine, PieChart, Pie, Cell
} from 'recharts';
import { subscribeSharedCollection, subscribeSharedDocument } from '../services/dataCache';
import { useTheme } from '../context/ThemeContext';
import { timeToDecimal, formatTime, formatDateBR, parseDateSort } from '../utils/timeCalculations';
import { calculatePerformanceScore } from '../utils/scoringCalculations';
import { StatCard, Tabs, Card, Badge } from '../components/ui';
import { BorderBeam } from '../components/magicui/BorderBeam';

// --- HELPERS DE IDENTIFICAÇÃO DE TURNOS OFICIAIS ---
const OFFICIAL_SHIFTS = ['Manhã I', 'Manhã II', 'Tarde', 'Noturno'];

const isNightShift = (shiftStr) => {
    if (!shiftStr) return false;
    const s = String(shiftStr).toLowerCase().trim();
    return s.includes('noturn') || s.includes('noit');
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
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition-colors ${
            isGood 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
        }`}>
            {isGood ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : <TrendingDown className="w-3 h-3 text-rose-500" />}
            {isGood ? 'Na Meta' : 'Fora da Meta'}
        </span>
    );
};

/**
 * DashboardOverview (v4.0.0 Hubdesk)
 * Cockpit Geral de KPIs, Monitorias e Inteligência Operacional.
 * Totalmente repaginado com filtragem interativa, tokens semânticos e acabamento executivo.
 */
const DashboardOverview = ({ onNavigate }) => {
    const { theme } = useTheme();

    // Navegação segura para abas (ex: relatórios críticos, auditorias)
    const handleNavigate = (tabId) => {
        if (typeof onNavigate === 'function') {
            onNavigate(tabId);
        } else if (typeof window !== 'undefined' && window.__hubdeskNavigate) {
            window.__hubdeskNavigate(tabId);
        }
    };

    // Modo de Visualização Principal
    const [viewMode, setViewMode] = useState('cockpit'); // 'cockpit', 'evolution', 'compliance', 'shifts'
    
    // Filtros Globais da Dashboard
    const [selectedShiftFilter, setSelectedShiftFilter] = useState('all'); // 'all', 'Manhã I', 'Manhã II', 'Tarde', 'Noturno'
    const [selectedPeriodFilter, setSelectedPeriodFilter] = useState('all'); // 'all', 'last30', 'last60', 'last90'
    const [searchTerm, setSearchTerm] = useState('');

    // Configurações do Gráfico de Evolução de KPIs & Monitoria
    const [selectedKpi, setSelectedKpi] = useState('tmr'); // 'tmr', 'fcr', 'recurrence', 'qa_rate', 'volume', 'avg_points'
    const [chartType, setChartType] = useState('area'); // 'area', 'line', 'bar'

    // Estados de Dados do Firebase
    const [latestKpi, setLatestKpi] = useState({ tmr: '00:00:00', fcr: 0, recurrence: 0, date: '' });
    const [sectorKpisList, setSectorKpisList] = useState([]);
    const [goals, setGoals] = useState({ tmr: '00:20:00', fcr: 80, recurrence: 20, qa: 85 });

    const [evalsList, setEvalsList] = useState([]);
    const [colabsFull, setColabsFull] = useState({});
    const [auditsList, setAuditsList] = useState([]);
    const [thirdPartyAudits, setThirdPartyAudits] = useState([]);
    const [reportStats, setReportStats] = useState({ pending: 0, inProgress: 0, resolved: 0 });

    // Modal de Informações Detalhadas de Ranking
    const [modalInfo, setModalInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Metas do Setor
        const unsubGoals = subscribeSharedDocument("system_settings", "sector_goals", (docData) => {
            if (docData) {
                setGoals(prev => ({ ...prev, ...docData }));
            }
        });

        // Histórico de KPIs do Setor
        const unsubKpi = subscribeSharedCollection("sector_kpis", (items) => {
            const kpis = [...items];
            kpis.sort((a, b) => parseDateSort(a.date) - parseDateSort(b.date));
            setSectorKpisList(kpis);

            if (kpis.length > 0) {
                setLatestKpi(kpis[kpis.length - 1]);
            }
            setLoading(false);
        });

        // Colaboradores
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

        // Avaliações Semanais
        const unsubEvals = subscribeSharedCollection("weekly_evaluations", (items) => {
            const evals = [...items];
            evals.sort((a, b) => parseDateSort(a.date) - parseDateSort(b.date));
            setEvalsList(evals);
        });

        // Relatórios Críticos / Demandas
        const unsubReports = subscribeSharedCollection("critical_reports", (items) => {
            let pending = 0; let inProgress = 0; let resolved = 0;
            items.forEach(data => {
                if (data.status === 'Pendente') pending++;
                else if (data.status === 'Em Andamento') inProgress++;
                else if (data.status === 'Resolvido') resolved++;
            });
            setReportStats({ pending, inProgress, resolved });
        });

        // Auditorias de Qualidade (QA Interno)
        const unsubAudits = subscribeSharedCollection("qa_audits", (items) => {
            const fetched = [...items];
            fetched.sort((a, b) => parseDateSort(a.date) - parseDateSort(b.date));
            setAuditsList(fetched);
        });

        // Auditorias da Terceirizada atual (ATSOC)
        const unsubThirdParty = subscribeSharedCollection("third_party_audits", (items) => {
            const fetched = [...items];
            fetched.sort((a, b) => parseDateSort(a.date) - parseDateSort(b.date));
            setThirdPartyAudits(fetched);
        }, { where: [['company', '==', 'ATSOC']] });

        return () => {
            unsubGoals();
            unsubKpi();
            unsubColabs();
            unsubEvals();
            unsubReports();
            unsubAudits();
            unsubThirdParty();
        };
    }, []);

    // --- REGRAS DE FILTRO POR DATA (PERÍODO) ---
    const filterByPeriod = (itemDateStr) => {
        if (selectedPeriodFilter === 'all' || !itemDateStr) return true;
        const itemTimestamp = parseDateSort(itemDateStr);
        if (!itemTimestamp) return true;

        const now = Date.now();
        const daysMap = {
            last30: 30 * 24 * 60 * 60 * 1000,
            last60: 60 * 24 * 60 * 60 * 1000,
            last90: 90 * 24 * 60 * 60 * 1000
        };

        const limitMs = daysMap[selectedPeriodFilter] || 0;
        return (now - itemTimestamp) <= limitMs;
    };

    // --- DADOS FILTRADOS EM TEMPO REAL ---
    const filteredSectorKpis = useMemo(() => {
        return sectorKpisList.filter(kpi => filterByPeriod(kpi.date));
    }, [sectorKpisList, selectedPeriodFilter]);

    const filteredEvalsList = useMemo(() => {
        return evalsList.filter(e => {
            const passPeriod = filterByPeriod(e.date);
            if (!passPeriod) return false;

            if (selectedShiftFilter !== 'all') {
                const colabId = e.colabId || e.collaboratorId;
                const colabInfo = colabsFull[colabId] || (e.colabName && colabsFull[e.colabName.trim().toLowerCase()]);
                const shift = colabInfo?.shift || e.shift || '';
                return shift === selectedShiftFilter;
            }

            return true;
        });
    }, [evalsList, selectedPeriodFilter, selectedShiftFilter, colabsFull]);

    const filteredAuditsList = useMemo(() => {
        return auditsList.filter(a => {
            const passPeriod = filterByPeriod(a.date || a.createdAt);
            if (!passPeriod) return false;

            if (selectedShiftFilter !== 'all') {
                const colabInfo = colabsFull[a.colabId];
                const shift = colabInfo?.shift || '';
                return shift === selectedShiftFilter;
            }

            return true;
        });
    }, [auditsList, selectedPeriodFilter, selectedShiftFilter, colabsFull]);

    const filteredThirdPartyAudits = useMemo(() => {
        return thirdPartyAudits.filter(a => filterByPeriod(a.date || a.createdAt));
    }, [thirdPartyAudits, selectedPeriodFilter]);

    // --- ESTATÍSTICAS DE QA / QUALIDADE INTERNO (COM FILTRO) ---
    const qaStats = useMemo(() => {
        let total = 0;
        let conformes = 0;

        filteredAuditsList.forEach(audit => {
            const colabInfo = colabsFull[audit.colabId];
            if (!colabInfo || colabInfo.active !== false) {
                total++;
                if (audit.status === 'Conforme') conformes++;
            }
        });

        const taxaResult = total > 0 ? Number(((conformes / total) * 100).toFixed(1)) : 0;
        return { taxa: taxaResult, total, conformes, naoConformes: total - conformes };
    }, [filteredAuditsList, colabsFull]);

    // --- ESTATÍSTICAS DA TERCEIRIZADA (COM FILTRO) ---
    const thirdPartyStats = useMemo(() => {
        const total = filteredThirdPartyAudits.length;
        if (total === 0) {
            return {
                total: 0,
                completedCount: 0,
                pendingCount: 0,
                fcr: 0,
                resolvedCount: 0,
                forwardedCount: 0,
                compliance: 0,
                conformeCount: 0,
                naoConformeCount: 0,
                qualityRate: 0,
                positiveCount: 0,
                neutralCount: 0,
                negativeCount: 0
            };
        }

        const completed = filteredThirdPartyAudits.filter(a => 
            a.procedures || a.outcome || a.clientName || a.operatorName
        );
        const completedCount = completed.length;
        const pendingCount = total - completedCount;

        const resolvedCount = completed.filter(a => a.outcome === 'Resolvido').length;
        const forwardedCount = completed.filter(a => a.outcome === 'Encaminhado').length;
        const fcr = completedCount > 0 ? Math.round((resolvedCount / completedCount) * 100) : 0;

        const conformeCount = completed.filter(a => a.procedures === 'Conforme').length;
        const naoConformeCount = completedCount - conformeCount;
        const compliance = completedCount > 0 ? Math.round((conformeCount / completedCount) * 100) : 0;

        const positiveCount = completed.filter(a => a.quality === 'Positiva').length;
        const neutralCount = completed.filter(a => a.quality === 'Neutra').length;
        const negativeCount = completed.filter(a => a.quality === 'Negativa').length;
        const totalRated = positiveCount + negativeCount;
        const qualityRate = totalRated > 0 ? Math.round((positiveCount / totalRated) * 100) : (completedCount > 0 ? 100 : 0);

        return {
            total,
            completedCount,
            pendingCount,
            fcr,
            resolvedCount,
            forwardedCount,
            compliance,
            conformeCount,
            naoConformeCount,
            qualityRate,
            positiveCount,
            neutralCount,
            negativeCount
        };
    }, [filteredThirdPartyAudits]);

    // --- ESTATÍSTICAS CONSOLIDADAS DA EQUIPE (DINÂMICAS POR TURNO E DATA) ---
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

        if (filteredEvalsList.length === 0) return defaultStats;

        const colabPointsData = {};
        const accumulatedVol = {};
        const accumulatedTmaTel = {};
        const accumulatedTmaHuggy = {};

        filteredEvalsList.forEach(e => {
            const colabId = e.colabId || e.collaboratorId;
            let colabInfo = colabsFull[colabId];
            if (!colabInfo && e.colabName) colabInfo = colabsFull[e.colabName.trim().toLowerCase()];
            if (!colabInfo && e.name) colabInfo = colabsFull[e.name.trim().toLowerCase()];

            if (colabInfo && colabInfo.active !== false) {
                const pts = e.pontuacao !== undefined ? e.pontuacao : calculatePerformanceScore(e);
                const resolvedId = colabInfo.id || colabId;
                if (!colabPointsData[resolvedId]) colabPointsData[resolvedId] = { sum: 0, count: 0, info: colabInfo };
                colabPointsData[resolvedId].sum += pts;
                colabPointsData[resolvedId].count += 1;
                colabPointsData[resolvedId].info = colabInfo;
                
                if (!accumulatedVol[resolvedId]) accumulatedVol[resolvedId] = { sum: 0, count: 0 };
                accumulatedVol[resolvedId].sum += (Number(e.Atendimentos_Finalizados) || 0);
                accumulatedVol[resolvedId].count += 1;

                if (!accumulatedTmaTel[resolvedId]) accumulatedTmaTel[resolvedId] = { sum: 0, count: 0 };
                accumulatedTmaTel[resolvedId].sum += timeToDecimal(e.TMA_Telefonia);
                accumulatedTmaTel[resolvedId].count += 1;
                
                if (!accumulatedTmaHuggy[resolvedId]) accumulatedTmaHuggy[resolvedId] = { sum: 0, count: 0 };
                accumulatedTmaHuggy[resolvedId].sum += timeToDecimal(e.TMA_Huggy);
                accumulatedTmaHuggy[resolvedId].count += 1;
            }
        });

        const topPointsDayList = [];
        const topPointsNightList = [];
        
        Object.entries(colabPointsData).forEach(([colabId, data]) => {
            const colabInfo = data.info || colabsFull[colabId];
            if (colabInfo && colabInfo.active !== false && data.count > 0) {
                const avgScore = Math.round(data.sum / data.count);
                const item = { 
                    id: colabInfo.id || colabId, 
                    name: colabInfo.name, 
                    shift: colabInfo.shift || 'Manhã I',
                    val: avgScore,
                    evalCount: data.count,
                    totalPts: data.sum
                };
                if (isNightShift(colabInfo.shift)) {
                    topPointsNightList.push(item);
                } else {
                    topPointsDayList.push(item);
                }
            }
        });

        topPointsDayList.sort((a, b) => b.val - a.val);
        topPointsNightList.sort((a, b) => b.val - a.val);

        const topDay = topPointsDayList.length > 0 ? topPointsDayList[0] : { val: 0, name: '--', evalCount: 0, shift: 'Manhã I' };
        const topNight = topPointsNightList.length > 0 ? topPointsNightList[0] : { val: 0, name: '--', evalCount: 0, shift: 'Noturno' };

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

        // Médias da última semana apurada
        const latestDate = filteredEvalsList.reduce((max, e) => {
            if (!max) return e.date || '';
            const tE = parseDateSort(e.date);
            const tMax = parseDateSort(max);
            return tE > tMax ? e.date : max;
        }, '');
        const currentWeek = filteredEvalsList.filter(e => e.date === latestDate);

        let sumVol = 0, sumTmaTel = 0, sumTmaHuggy = 0;
        let sumPtsDay = 0, countDay = 0, sumVolDay = 0;
        let sumPtsNight = 0, countNight = 0, sumVolNight = 0;
        let activeCurrentWeekCount = 0;

        if (currentWeek.length > 0) {
            currentWeek.forEach(e => {
                const colabId = e.colabId || e.collaboratorId;
                let colabInfo = colabsFull[colabId];
                if (!colabInfo && e.colabName) colabInfo = colabsFull[e.colabName.trim().toLowerCase()];
                if (!colabInfo && e.name) colabInfo = colabsFull[e.name.trim().toLowerCase()];

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

                    if (isNightShift(colabInfo.shift)) {
                        sumPtsNight += currentPts;
                        sumVolNight += vol;
                        countNight++;
                    } else {
                        sumPtsDay += currentPts;
                        sumVolDay += vol;
                        countDay++;
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
    }, [filteredEvalsList, colabsFull]);

    // --- TIMELINE DE DADOS CONSOLIDADOS PARA OS GRÁFICOS ---
    const evolutionTimeline = useMemo(() => {
        const qaByDate = {};
        filteredAuditsList.forEach(a => {
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

        // Avaliações de volume e pontos por data
        const evalsByDate = {};
        filteredEvalsList.forEach(e => {
            const d = e.date;
            if (!d) return;
            if (!evalsByDate[d]) evalsByDate[d] = { sumVol: 0, sumPts: 0, count: 0 };
            evalsByDate[d].sumVol += Number(e.Atendimentos_Finalizados) || 0;
            evalsByDate[d].sumPts += e.pontuacao !== undefined ? e.pontuacao : calculatePerformanceScore(e);
            evalsByDate[d].count++;
        });

        const combined = [];
        const registeredDates = new Set();

        filteredSectorKpis.forEach(kpi => {
            const tmrDec = timeToDecimal(kpi.tmr);
            const dateLabel = formatDateBR(kpi.date);
            const rawDate = kpi.date;
            registeredDates.add(rawDate);

            const qaMatch = qaByDate[rawDate];
            const qaRate = (qaMatch && qaMatch.total > 0)
                ? Number(((qaMatch.conformes / qaMatch.total) * 100).toFixed(1))
                : qaStats.taxa;

            const evalMatch = evalsByDate[rawDate];
            const avgVol = (evalMatch && evalMatch.count > 0) ? Math.round(evalMatch.sumVol / evalMatch.count) : teamStats.avgVol;
            const avgPts = (evalMatch && evalMatch.count > 0) ? Math.round(evalMatch.sumPts / evalMatch.count) : teamStats.avgPtsDay;

            combined.push({
                id: kpi.id,
                date: dateLabel,
                fullDate: rawDate,
                timestamp: parseDateSort(rawDate),
                tmrDecimal: Number(tmrDec.toFixed(1)),
                tmrFormatted: kpi.tmr,
                fcr: Number(kpi.fcr || 0),
                recurrence: Number(kpi.recurrence || 0),
                qaRate: Number(qaRate),
                volume: avgVol,
                avgPoints: avgPts
            });
        });

        // Adiciona datas com avaliações ou QA que não estavam em sector_kpis
        Object.entries(evalsByDate).forEach(([rawDate, evData]) => {
            if (!registeredDates.has(rawDate)) {
                const dateLabel = formatDateBR(rawDate);
                const qaMatch = qaByDate[rawDate];
                const qaRate = (qaMatch && qaMatch.total > 0) ? Number(((qaMatch.conformes / qaMatch.total) * 100).toFixed(1)) : qaStats.taxa;
                const avgVol = evData.count > 0 ? Math.round(evData.sumVol / evData.count) : 0;
                const avgPts = evData.count > 0 ? Math.round(evData.sumPts / evData.count) : 0;

                combined.push({
                    id: `ev-${rawDate}`,
                    date: dateLabel,
                    fullDate: rawDate,
                    timestamp: parseDateSort(rawDate),
                    tmrDecimal: timeToDecimal(latestKpi.tmr || '00:00:00'),
                    tmrFormatted: latestKpi.tmr || '00:00:00',
                    fcr: Number(latestKpi.fcr || 0),
                    recurrence: Number(latestKpi.recurrence || 0),
                    qaRate: Number(qaRate),
                    volume: avgVol,
                    avgPoints: avgPts
                });
            }
        });

        combined.sort((a, b) => a.timestamp - b.timestamp);
        return combined;
    }, [filteredSectorKpis, filteredAuditsList, filteredEvalsList, qaStats, latestKpi, teamStats]);

    // Definição dos Metadados do KPI Selecionado
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
                    category: 'KPI Estratégico'
                };
            case 'fcr':
                return {
                    label: 'FCR - Resolução no Primeiro Contato',
                    unit: '%',
                    dataKey: 'fcr',
                    color: '#10b981', // Verde esmeralda
                    goalValue: Number(goals.fcr),
                    goalFormatted: `≥ ${goals.fcr}%`,
                    isBetterLower: false,
                    currentVal: `${latestKpi.fcr}%`,
                    currentNum: Number(latestKpi.fcr),
                    formatTooltip: (val) => `${val}%`,
                    category: 'KPI Estratégico'
                };
            case 'recurrence':
                return {
                    label: 'Taxa de Reincidência de Atendimentos',
                    unit: '%',
                    dataKey: 'recurrence',
                    color: '#f43f5e', // Carmesim / Rose
                    goalValue: Number(goals.recurrence),
                    goalFormatted: `≤ ${goals.recurrence}%`,
                    isBetterLower: true,
                    currentVal: `${latestKpi.recurrence}%`,
                    currentNum: Number(latestKpi.recurrence),
                    formatTooltip: (val) => `${val}%`,
                    category: 'KPI Estratégico'
                };
            case 'qa_rate':
                return {
                    label: 'Taxa de Conformidade QA (Monitoria)',
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
            case 'volume':
                return {
                    label: 'Média de Atendimentos Finalizados',
                    unit: 'finalizações',
                    dataKey: 'volume',
                    color: '#0284c7', // Sky
                    goalValue: 50,
                    goalFormatted: '≥ 50 fin.',
                    isBetterLower: false,
                    currentVal: `${teamStats.avgVol} fin.`,
                    currentNum: teamStats.avgVol,
                    formatTooltip: (val) => `${val} atendimentos`,
                    category: 'Operacional'
                };
            case 'avg_points':
                return {
                    label: 'Pontuação Média da Equipe',
                    unit: 'pontos',
                    dataKey: 'avgPoints',
                    color: '#6366f1', // Indigo
                    goalValue: 120,
                    goalFormatted: '≥ 120 pts',
                    isBetterLower: false,
                    currentVal: `${teamStats.avgPtsDay} pts`,
                    currentNum: teamStats.avgPtsDay,
                    formatTooltip: (val) => `${val} pts`,
                    category: 'Desempenho'
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
                    category: 'KPI Estratégico'
                };
        }
    }, [selectedKpi, goals, latestKpi, qaStats, teamStats]);

    // Resumo Estatístico do Período no Gráfico
    const kpiSummaryStats = useMemo(() => {
        if (evolutionTimeline.length === 0) return { avg: 0, min: 0, max: 0, diff: 0, count: 0 };
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

    // Reset de Filtros
    const hasActiveFilters = selectedShiftFilter !== 'all' || selectedPeriodFilter !== 'all';
    const handleResetFilters = () => {
        setSelectedShiftFilter('all');
        setSelectedPeriodFilter('all');
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-canvas h-full p-8 text-primary-hub">
                <Loader2 className="w-10 h-10 text-rose-500 animate-spin mb-3" />
                <p className="text-sm font-medium text-secondary-hub">Carregando inteligência analítica de KPIs e monitorias...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-canvas text-primary-hub flex flex-col space-y-6 transition-colors">
            
            {/* ========================================================= */}
            {/* 1. CABEÇALHO NO FUNDO DA PÁGINA (PADRÃO V4.0.0)           */}
            {/* ========================================================= */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
                <div>
                    <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-rose-500 uppercase tracking-wider">
                        <Activity className="w-3.5 h-3.5" />
                        <span>Cockpit Executivo & Inteligência de Dados</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="font-brand text-2xl sm:text-3xl lg:text-4xl font-bold text-primary-hub tracking-tight">
                            Visão Geral de KPIs
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            v4.0 Hubdesk
                        </span>
                        {hasActiveFilters && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                <Filter className="w-3 h-3" /> Filtros Ativos
                            </span>
                        )}
                    </div>
                    <p className="text-xs sm:text-sm text-secondary-hub mt-1 leading-relaxed">
                        Monitoramento infográfico em tempo real: metas de qualidade, SLAs, desempenho de equipes e auditorias.
                    </p>
                </div>

                {/* MODOS DE VISUALIZAÇÃO ALTERNÁVEIS VIA TABS */}
                <div className="self-start lg:self-center">
                    <Tabs
                        tabs={[
                            { id: 'cockpit', label: 'Cockpit Geral', icon: BarChart3 },
                            { id: 'evolution', label: 'Evolução & Gráficos', icon: LineChartIcon },
                            { id: 'compliance', label: 'Semáforo de Metas', icon: ShieldCheck },
                            { id: 'shifts', label: 'Por Turnos', icon: Users },
                        ]}
                        activeTab={viewMode}
                        onChange={setViewMode}
                        id="cockpit-modes-tabs"
                    />
                </div>
            </header>

            {/* ========================================================= */}
            {/* 2. BARRA DE FILTRAGEM INTERATIVA (DINÂMICA EM TEMPO REAL) */}
            {/* ========================================================= */}
            <div className="bg-surface p-3.5 sm:p-4 rounded-2xl border border-subtle shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-rose-500" />
                        Filtrar Dados:
                    </span>

                    {/* Filtro de Turno */}
                    <div className="flex items-center gap-1 bg-canvas p-1 rounded-xl border border-subtle">
                        <button
                            type="button"
                            onClick={() => setSelectedShiftFilter('all')}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                selectedShiftFilter === 'all'
                                    ? 'bg-surface text-primary-hub shadow-xs border border-subtle'
                                    : 'text-muted-hub hover:text-primary-hub'
                            }`}
                        >
                            Todos Turnos
                        </button>
                        {OFFICIAL_SHIFTS.map((shift) => (
                            <button
                                key={shift}
                                type="button"
                                onClick={() => setSelectedShiftFilter(shift)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    selectedShiftFilter === shift
                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                        : 'text-muted-hub hover:text-primary-hub'
                                }`}
                            >
                                {shift}
                            </button>
                        ))}
                    </div>

                    {/* Filtro de Período Temporal */}
                    <div className="flex items-center gap-1 bg-canvas p-1 rounded-xl border border-subtle">
                        {[
                            { id: 'all', label: 'Todo Histórico' },
                            { id: 'last30', label: '30 Dias' },
                            { id: 'last60', label: '60 Dias' },
                            { id: 'last90', label: '90 Dias' },
                        ].map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setSelectedPeriodFilter(p.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                    selectedPeriodFilter === p.id
                                        ? 'bg-surface text-primary-hub shadow-xs border border-subtle'
                                        : 'text-muted-hub hover:text-primary-hub'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Reset e Indicadores */}
                <div className="flex items-center gap-2">
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="px-3 py-1.5 rounded-xl border border-subtle bg-canvas hover:bg-subtle text-secondary-hub hover:text-primary-hub text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Limpar Filtros</span>
                        </button>
                    )}
                    <span className="text-[11px] text-muted-hub font-medium hidden sm:inline">
                        {filteredEvalsList.length} avaliações apuradas
                    </span>
                </div>
            </div>

            {/* ========================================================= */}
            {/* 3. PRIMEIRA FILEIRA BENTO: DEMANDAS & ORDENS DE SERVIÇO   */}
            {/* ========================================================= */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
                {/* 1. Demandas Pendentes - Triagem */}
                <Card 
                    hover
                    onClick={() => handleNavigate('reports')}
                    className="relative overflow-hidden p-5 border-amber-500/30 hover:border-amber-500/60 shadow-xs flex flex-col justify-between group cursor-pointer bg-surface"
                >
                    <BorderBeam size={160} duration={8} colorFrom="#f59e0b" colorTo="#d97706" borderWidth={1.2} />
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-amber-500" />
                                Demandas Pendentes
                            </span>
                            <Badge variant="warning" size="sm">
                                Aguardando Triagem
                            </Badge>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="font-brand text-3xl font-black text-primary-hub tracking-tight tabular-nums">
                                {reportStats.pending}
                            </span>
                            <span className="text-xs text-secondary-hub font-medium">solicitações</span>
                        </div>
                    </div>
                    <div className="pt-3 mt-3 border-t border-subtle flex items-center justify-between text-xs font-bold text-amber-500">
                        <span>Acessar chamados</span>
                        <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                </Card>

                {/* 2. Demandas Em Andamento */}
                <Card 
                    className="p-5 border-sky-500/30 hover:border-sky-500/50 shadow-xs flex flex-col justify-between bg-surface"
                >
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                <Activity className="w-4 h-4 text-sky-500" />
                                Em Andamento
                            </span>
                            <Badge variant="info" size="sm">
                                Fila Ativa
                            </Badge>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="font-brand text-3xl font-black text-primary-hub tracking-tight tabular-nums">
                                {reportStats.inProgress}
                            </span>
                            <span className="text-xs text-secondary-hub font-medium">em análise</span>
                        </div>
                    </div>
                    <div className="pt-3 mt-3 border-t border-subtle text-[11px] text-muted-hub font-medium">
                        Em análise técnica da operação
                    </div>
                </Card>

                {/* 3. Demandas Resolvidas */}
                <Card 
                    className="p-5 border-emerald-500/30 hover:border-emerald-500/50 shadow-xs flex flex-col justify-between bg-surface"
                >
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                Resolvidas
                            </span>
                            <Badge variant="success" size="sm">
                                Concluídas
                            </Badge>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="font-brand text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">
                                {reportStats.resolved}
                            </span>
                            <span className="text-xs text-secondary-hub font-medium">finalizados</span>
                        </div>
                    </div>
                    <div className="pt-3 mt-3 border-t border-subtle text-[11px] text-muted-hub font-medium">
                        Histórico completo com parecer
                    </div>
                </Card>
            </div>

            {/* ========================================================= */}
            {/* 4. CONTEÚDO PRINCIPAL DE ACORDO COM A ABA ATIVA           */}
            {/* ========================================================= */}

            {/* --------------------------------------------------------- */}
            {/* ABA 1: COCKPIT GERAL EXECUTIVO                            */}
            {/* --------------------------------------------------------- */}
            {viewMode === 'cockpit' && (
                <div className="space-y-6">
                    
                    {/* INDICADORES ESTRATÉGICOS GLOBAIS */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xs font-black text-secondary-hub uppercase tracking-widest flex items-center gap-2">
                                <Rocket className="w-4 h-4 text-rose-500" /> Indicadores Estratégicos Globais
                            </h2>
                            <button 
                                onClick={() => setViewMode('evolution')} 
                                className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                            >
                                Ver Gráficos de Evolução <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* 4 CARDS ESTRATÉGICOS GLOBAIS */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <StatCard
                                title="TMR Setor"
                                value={latestKpi.tmr || '00:00:00'}
                                goal={`≤ ${goals.tmr}`}
                                icon={Clock}
                                status={timeToDecimal(latestKpi.tmr) <= timeToDecimal(goals.tmr) ? 'success' : 'danger'}
                                isGood={timeToDecimal(latestKpi.tmr) <= timeToDecimal(goals.tmr)}
                                trend={timeToDecimal(latestKpi.tmr) <= timeToDecimal(goals.tmr) ? 'up' : 'down'}
                                trendLabel={timeToDecimal(latestKpi.tmr) <= timeToDecimal(goals.tmr) ? 'Na Meta' : 'Fora da Meta'}
                                subtitle="Tempo Médio Resposta"
                                onClick={() => {
                                    setSelectedKpi('tmr');
                                    setViewMode('evolution');
                                }}
                            />

                            <StatCard
                                title="FCR (1º Contato)"
                                value={`${latestKpi.fcr || 0}%`}
                                goal={`≥ ${goals.fcr}%`}
                                icon={Target}
                                status={Number(latestKpi.fcr || 0) >= Number(goals.fcr) ? 'success' : 'danger'}
                                isGood={Number(latestKpi.fcr || 0) >= Number(goals.fcr)}
                                trend={Number(latestKpi.fcr || 0) >= Number(goals.fcr) ? 'up' : 'down'}
                                trendLabel={Number(latestKpi.fcr || 0) >= Number(goals.fcr) ? 'Na Meta' : 'Fora da Meta'}
                                subtitle="Resolução Imediata"
                                onClick={() => {
                                    setSelectedKpi('fcr');
                                    setViewMode('evolution');
                                }}
                            />

                            <StatCard
                                title="Reincidência"
                                value={`${latestKpi.recurrence || 0}%`}
                                goal={`≤ ${goals.recurrence}%`}
                                icon={Activity}
                                status={Number(latestKpi.recurrence || 0) <= Number(goals.recurrence) ? 'success' : 'danger'}
                                isGood={Number(latestKpi.recurrence || 0) <= Number(goals.recurrence)}
                                trend={Number(latestKpi.recurrence || 0) <= Number(goals.recurrence) ? 'up' : 'down'}
                                trendLabel={Number(latestKpi.recurrence || 0) <= Number(goals.recurrence) ? 'Na Meta' : 'Fora da Meta'}
                                subtitle="Retornos de Atendimento"
                                onClick={() => {
                                    setSelectedKpi('recurrence');
                                    setViewMode('evolution');
                                }}
                            />

                            <StatCard
                                title="Índice QA Operação"
                                value={`${qaStats.taxa}%`}
                                goal={`≥ ${goals.qa || 85}%`}
                                icon={Award}
                                status={qaStats.taxa >= (goals.qa || 85) ? 'success' : 'danger'}
                                isGood={qaStats.taxa >= (goals.qa || 85)}
                                trend={qaStats.taxa >= (goals.qa || 85) ? 'up' : 'down'}
                                trendLabel={qaStats.taxa >= (goals.qa || 85) ? 'Na Meta' : 'Abaixo da Meta'}
                                subtitle={`${qaStats.conformes} de ${qaStats.total} conformes`}
                                onClick={() => {
                                    setSelectedKpi('qa_rate');
                                    setViewMode('evolution');
                                }}
                            />
                        </div>
                    </div>

                    {/* INDICADORES DA OPERAÇÃO TERCEIRIZADA */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-xs font-black text-secondary-hub uppercase tracking-widest flex items-center gap-2">
                                <Headphones className="w-4 h-4 text-indigo-500" /> Indicadores da Terceirizada (Plantão Noturno)
                            </h2>
                            <button 
                                onClick={() => handleNavigate('third_party_audits')} 
                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                            >
                                Painel de Auditoria <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {/* FCR Terceirizada */}
                            <div className="bg-surface p-5 rounded-2xl border border-subtle shadow-xs hover:border-indigo-500/40 transition-all flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[11px] font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                            <Target className="w-4 h-4 text-indigo-500" />
                                            FCR Terceirizada
                                        </span>
                                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                                            thirdPartyStats.fcr >= 70 
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                        }`}>
                                            {thirdPartyStats.fcr >= 70 ? 'Resolução Alta' : 'Acompanhar'}
                                        </span>
                                    </div>
                                    <div className="text-2xl sm:text-3xl font-black text-primary-hub tracking-tight mt-1">
                                        {thirdPartyStats.fcr}%
                                    </div>
                                </div>
                                <div className="pt-3 mt-3 border-t border-subtle flex items-center justify-between text-xs text-secondary-hub">
                                    <span>Chamados Resolvidos:</span>
                                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                        {thirdPartyStats.resolvedCount} de {thirdPartyStats.completedCount}
                                    </span>
                                </div>
                            </div>

                            {/* Conformidade de Procedimentos */}
                            <div className="bg-surface p-5 rounded-2xl border border-subtle shadow-xs hover:border-teal-500/40 transition-all flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[11px] font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                            <ShieldCheck className="w-4 h-4 text-teal-500" />
                                            Conformidade de Procedimentos
                                        </span>
                                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                                            thirdPartyStats.compliance >= 80 
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                        }`}>
                                            {thirdPartyStats.compliance >= 80 ? 'Procedimento Correto' : 'Revisar Roteiro'}
                                        </span>
                                    </div>
                                    <div className="text-2xl sm:text-3xl font-black text-primary-hub tracking-tight mt-1">
                                        {thirdPartyStats.compliance}%
                                    </div>
                                </div>
                                <div className="pt-3 mt-3 border-t border-subtle flex items-center justify-between text-xs text-secondary-hub">
                                    <span>Conformes / Não Conformes:</span>
                                    <span className="font-bold text-teal-600 dark:text-teal-400">
                                        {thirdPartyStats.conformeCount} / {thirdPartyStats.naoConformeCount}
                                    </span>
                                </div>
                            </div>

                            {/* % de Qualidade da Terceirizada */}
                            <div className="bg-surface p-5 rounded-2xl border border-subtle shadow-xs hover:border-amber-500/40 transition-all flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[11px] font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                            <Star className="w-4 h-4 text-amber-500" />
                                            Qualidade do Atendimento
                                        </span>
                                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                                            thirdPartyStats.qualityRate >= 80 
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                        }`}>
                                            {thirdPartyStats.qualityRate >= 80 ? 'Aprovado' : 'Atenção'}
                                        </span>
                                    </div>
                                    <div className="text-2xl sm:text-3xl font-black text-primary-hub tracking-tight mt-1">
                                        {thirdPartyStats.qualityRate}%
                                    </div>
                                </div>
                                <div className="pt-3 mt-3 border-t border-subtle flex items-center justify-between text-xs text-secondary-hub">
                                    <span>Avaliações Positivas:</span>
                                    <span className="font-bold text-amber-600 dark:text-amber-400">
                                        {thirdPartyStats.positiveCount} de {thirdPartyStats.positiveCount + thirdPartyStats.negativeCount}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* EFICIÊNCIA MÉDIA DA EQUIPE */}
                    <div>
                        <h2 className="text-xs font-black text-secondary-hub uppercase tracking-widest flex items-center gap-2 mb-3">
                            <Users className="w-4 h-4 text-indigo-500" /> Eficiência Operacional da Equipe
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Média Finalizações */}
                            <div className="bg-surface p-5 rounded-2xl border border-subtle shadow-xs hover:border-emerald-500/40 transition-all flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[11px] font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                            <CheckSquare className="w-4 h-4 text-emerald-500" />
                                            Média Finalizações
                                        </span>
                                    </div>
                                    <div className="text-2xl sm:text-3xl font-black text-primary-hub tracking-tight mt-1">
                                        {teamStats.avgVol}
                                    </div>
                                </div>
                                <span className="text-xs text-muted-hub mt-3 pt-3 border-t border-subtle font-medium">
                                    Atendimentos concluídos / analista
                                </span>
                            </div>

                            {/* TMA Médio (Voz) */}
                            <div className="bg-surface p-5 rounded-2xl border border-subtle shadow-xs hover:border-sky-500/40 transition-all flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[11px] font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                            <Phone className="w-4 h-4 text-sky-500" />
                                            TMA Médio (Voz)
                                        </span>
                                    </div>
                                    <div className="text-2xl sm:text-3xl font-black text-primary-hub tracking-tight mt-1">
                                        {teamStats.avgTmaTel}
                                    </div>
                                </div>
                                <span className="text-xs text-muted-hub mt-3 pt-3 border-t border-subtle font-medium">
                                    Tempo médio em chamada telefônica
                                </span>
                            </div>

                            {/* TMA Médio (Chat) */}
                            <div className="bg-surface p-5 rounded-2xl border border-subtle shadow-xs hover:border-purple-500/40 transition-all flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[11px] font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                            <MessageCircle className="w-4 h-4 text-purple-500" />
                                            TMA Médio (Chat)
                                        </span>
                                    </div>
                                    <div className="text-2xl sm:text-3xl font-black text-primary-hub tracking-tight mt-1">
                                        {teamStats.avgTmaHuggy}
                                    </div>
                                </div>
                                <span className="text-xs text-muted-hub mt-3 pt-3 border-t border-subtle font-medium">
                                    Tempo médio no atendimento Huggy
                                </span>
                            </div>

                            {/* Pontuação por Turno */}
                            <div className="bg-surface p-5 rounded-2xl border border-subtle shadow-xs hover:border-amber-500/40 transition-all flex flex-col justify-between">
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[11px] font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                            <Star className="w-4 h-4 text-amber-500" />
                                            Média de Pontos por Turno
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <div className="border-r border-subtle pr-2">
                                            <span className="text-[10px] text-muted-hub font-bold uppercase block">Dia (Pico)</span>
                                            <span className="text-lg font-black text-amber-600 dark:text-amber-400">{teamStats.avgPtsDay} pts</span>
                                        </div>
                                        <div className="pl-2">
                                            <span className="text-[10px] text-muted-hub font-bold uppercase block">Noturno</span>
                                            <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">{teamStats.avgPtsNight} pts</span>
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[11px] text-muted-hub mt-3 pt-3 border-t border-subtle block">
                                    Média apurada da semana corrente
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* DESTAQUES OPERACIONAIS & PONTOS DE ATENÇÃO */}
                    <div>
                        <h2 className="text-xs font-black text-secondary-hub uppercase tracking-widest flex items-center gap-2 mb-3">
                            <Award className="w-4 h-4 text-amber-500" /> Destaques Operacionais & Atenção
                        </h2>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            
                            {/* TOP PERFORMER DIA */}
                            <div 
                                id="card-leader-day"
                                onClick={() => setModalInfo({ title: 'Top Desempenho por Média (Manhã I, II & Tarde - Pico)', data: teamStats.rankings.topPointsDay, formatVal: (v) => `${v} pts (média)` })}
                                className="bg-surface p-5 rounded-2xl border border-subtle shadow-sm flex flex-col justify-between cursor-pointer hover:border-emerald-500/50 transition-all active:scale-[0.98] group"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 block">
                                                <Award className="w-3.5 h-3.5 text-emerald-500" />
                                                Líder Geral (Dia)
                                            </span>
                                            <span className="text-[10px] text-muted-hub font-medium block">
                                                Manhã I, II & Tarde
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">
                                            Top Dia
                                        </span>
                                    </div>
                                    <div className="my-2">
                                        <span className="text-base font-black text-primary-hub block truncate" title={teamStats.topDay.name}>
                                            {teamStats.topDay.name}
                                        </span>
                                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 flex-wrap mt-0.5">
                                            <span>{teamStats.topDay.val} pts</span>
                                            {teamStats.topDay.evalCount > 0 && (
                                                <span className="text-[10px] text-muted-hub font-normal">
                                                    ({teamStats.topDay.evalCount} avaliações)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 pt-2 border-t border-subtle font-bold group-hover:underline">
                                    Ver ranking completo <ChevronRight className="w-3 h-3" />
                                </span>
                            </div>

                            {/* TOP PERFORMER NOITE */}
                            <div 
                                id="card-leader-night"
                                onClick={() => setModalInfo({ title: 'Top Desempenho por Média (Noturno)', data: teamStats.rankings.topPointsNight, formatVal: (v) => `${v} pts (média)` })}
                                className="bg-surface p-5 rounded-2xl border border-subtle shadow-sm flex flex-col justify-between cursor-pointer hover:border-indigo-500/50 transition-all active:scale-[0.98] group"
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 block">
                                                <Award className="w-3.5 h-3.5 text-indigo-500" />
                                                Líder Geral (Noite)
                                            </span>
                                            <span className="text-[10px] text-muted-hub font-medium block">
                                                Noturno (13:45 às 20h)
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/30">
                                            Top Noite
                                        </span>
                                    </div>
                                    <div className="my-2">
                                        <span className="text-base font-black text-primary-hub block truncate" title={teamStats.topNight.name}>
                                            {teamStats.topNight.name}
                                        </span>
                                        <div className="text-xs text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-1 flex-wrap mt-0.5">
                                            <span>{teamStats.topNight.val} pts</span>
                                            {teamStats.topNight.evalCount > 0 && (
                                                <span className="text-[10px] text-muted-hub font-normal">
                                                    ({teamStats.topNight.evalCount} avaliações)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1 pt-2 border-t border-subtle font-bold group-hover:underline">
                                    Ver ranking completo <ChevronRight className="w-3 h-3" />
                                </span>
                            </div>

                            {/* MAIOR TMA VOZ (ATENÇÃO) */}
                            <div 
                                onClick={() => setModalInfo({ title: 'Maiores TMAs em Telefonia', data: teamStats.rankings.maxTmaTel })}
                                className="bg-surface p-5 rounded-2xl border border-rose-500/30 shadow-xs hover:border-rose-500/60 transition-all flex flex-col justify-between cursor-pointer active:scale-[0.98]"
                            >
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                            Maior TMA Voz
                                        </span>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold border border-rose-500/30">
                                            Atenção
                                        </span>
                                    </div>
                                    <div className="my-2">
                                        <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                                            {teamStats.maxTmaTel.val}
                                        </span>
                                        <span className="text-xs text-primary-hub font-bold block truncate mt-0.5" title={teamStats.maxTmaTel.name}>
                                            {teamStats.maxTmaTel.name}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium pt-2 border-t border-subtle">
                                    Requer alinhamento de escopo
                                </span>
                            </div>

                            {/* MENOR MÉDIA DE FINALIZAÇÕES (ATENÇÃO) */}
                            <div 
                                onClick={() => setModalInfo({ title: 'Menor Média de Finalizações', data: teamStats.rankings.lowestVol })}
                                className="bg-surface p-5 rounded-2xl border border-amber-500/30 shadow-xs hover:border-amber-500/60 transition-all flex flex-col justify-between cursor-pointer active:scale-[0.98]"
                            >
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                            Menor Volume
                                        </span>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30">
                                            Atenção
                                        </span>
                                    </div>
                                    <div className="my-2">
                                        <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                                            {teamStats.lowestAvgVol.val} fin.
                                        </span>
                                        <span className="text-xs text-primary-hub font-bold block truncate mt-0.5" title={teamStats.lowestAvgVol.name}>
                                            {teamStats.lowestAvgVol.name}
                                        </span>
                                    </div>
                                </div>
                                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium pt-2 border-t border-subtle">
                                    Oportunidade de capacitação
                                </span>
                            </div>

                        </div>
                    </div>

                </div>
            )}

            {/* --------------------------------------------------------- */}
            {/* ABA 2: GRÁFICOS DE EVOLUÇÃO & ANALYTICS INTERATIVO        */}
            {/* --------------------------------------------------------- */}
            {viewMode === 'evolution' && (
                <div className="space-y-6">
                    
                    {/* BARRA DE CONTROLE DO GRÁFICO */}
                    <div className="bg-surface p-5 rounded-3xl border border-subtle shadow-xs flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                        <div>
                            <span className="text-xs font-bold text-muted-hub uppercase tracking-wider block">Indicador Selecionado para Análise</span>
                            <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                                <h3 className="text-lg font-bold text-primary-hub font-brand">
                                    {currentKpiConfig.label}
                                </h3>
                                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-subtle text-secondary-hub border border-subtle">
                                    {currentKpiConfig.category}
                                </span>
                            </div>
                        </div>

                        {/* CONTROLES: TIPO DE GRÁFICO */}
                        <div className="flex items-center bg-canvas p-1 rounded-xl border border-subtle">
                            {[
                                { id: 'area', label: 'Área Suave' },
                                { id: 'line', label: 'Linhas' },
                                { id: 'bar', label: 'Barras' },
                            ].map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => setChartType(c.id)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                        chartType === c.id
                                            ? 'bg-surface text-primary-hub shadow-xs border border-subtle'
                                            : 'text-muted-hub hover:text-primary-hub'
                                    }`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* SELETORES DE KPIS INTERATIVOS */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {[
                            { id: 'tmr', label: 'TMR Setor', val: latestKpi.tmr, goal: `≤ ${goals.tmr}`, icon: Clock, color: 'text-purple-500' },
                            { id: 'fcr', label: 'FCR (1º Cont.)', val: `${latestKpi.fcr}%`, goal: `≥ ${goals.fcr}%`, icon: Target, color: 'text-emerald-500' },
                            { id: 'recurrence', label: 'Reincidência', val: `${latestKpi.recurrence}%`, goal: `≤ ${goals.recurrence}%`, icon: Activity, color: 'text-rose-500' },
                            { id: 'qa_rate', label: '% QA Monitoria', val: `${qaStats.taxa}%`, goal: `≥ ${goals.qa || 85}%`, icon: Star, color: 'text-amber-500' },
                            { id: 'volume', label: 'Volume Médio', val: `${teamStats.avgVol} fin.`, goal: '≥ 50 fin.', icon: CheckSquare, color: 'text-sky-500' },
                            { id: 'avg_points', label: 'Pontuação Média', val: `${teamStats.avgPtsDay} pts`, goal: '≥ 120 pts', icon: Award, color: 'text-indigo-500' },
                        ].map((k) => {
                            const isSelected = selectedKpi === k.id;
                            const IconComponent = k.icon;
                            return (
                                <button
                                    key={k.id}
                                    type="button"
                                    onClick={() => setSelectedKpi(k.id)}
                                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                        isSelected
                                            ? 'bg-surface border-rose-500 ring-2 ring-rose-500/20 shadow-xs'
                                            : 'bg-surface border-subtle hover:bg-subtle text-secondary-hub'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className="text-[11px] font-bold uppercase tracking-wider truncate flex items-center gap-1.5">
                                            <IconComponent className={`w-3.5 h-3.5 ${k.color}`} />
                                            {k.label}
                                        </span>
                                    </div>
                                    <span className="text-xl font-bold text-primary-hub block tabular-nums">
                                        {k.val}
                                    </span>
                                    <span className="text-[10px] text-muted-hub mt-1 block">
                                        {k.goal}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* GRÁFICO PRINCIPAL COM RECHARTS */}
                    <div className="bg-surface p-5 sm:p-6 rounded-3xl border border-subtle shadow-xs space-y-5">
                        
                        {/* RIBBON DE ESTATÍSTICAS DA MÉTRICA */}
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pb-5 border-b border-subtle">
                            <div>
                                <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">Valor Atual</span>
                                <span className="text-xl font-black text-primary-hub mt-0.5 block">{currentKpiConfig.currentVal}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">Meta Definida</span>
                                <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5 block">{currentKpiConfig.goalFormatted}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">Média do Período</span>
                                <span className="text-xl font-black text-primary-hub mt-0.5 block">{kpiSummaryStats.avg} {currentKpiConfig.unit}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">Melhor Registro</span>
                                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                                    {currentKpiConfig.isBetterLower ? kpiSummaryStats.min : kpiSummaryStats.max}
                                </span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">Total de Amostras</span>
                                <span className="text-xl font-black text-primary-hub mt-0.5 block">{kpiSummaryStats.count} datas</span>
                            </div>
                        </div>

                        {/* ÁREA DO GRÁFICO */}
                        <div className="w-full h-80">
                            {evolutionTimeline.length === 0 ? (
                                <div className="w-full h-full flex flex-col items-center justify-center text-muted-hub">
                                    <BarChart3 className="w-10 h-10 opacity-30 mb-2" />
                                    <p className="text-sm">Ainda não há dados suficientes no recorte selecionado.</p>
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
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-subtle opacity-30" />
                                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-hub" />
                                            <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-hub" />
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: '#18181b', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px' }}
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
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-subtle opacity-30" />
                                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-hub" />
                                            <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-hub" />
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: '#18181b', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px' }}
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
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-subtle opacity-30" />
                                            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-hub" />
                                            <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-muted-hub" />
                                            <Tooltip 
                                                contentStyle={{ backgroundColor: '#18181b', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px' }}
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

                    {/* TABELA DE LANÇAMENTOS DO INDICADOR */}
                    <div className="bg-surface rounded-3xl border border-subtle shadow-xs overflow-hidden">
                        <div className="p-4 sm:p-5 border-b border-subtle flex justify-between items-center bg-canvas">
                            <h4 className="text-xs font-bold text-primary-hub uppercase tracking-wider">
                                Registros Históricos ({evolutionTimeline.length})
                            </h4>
                            <span className="text-xs text-muted-hub">
                                Ordenação cronológica
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-subtle text-xs">
                                <thead className="bg-canvas text-secondary-hub font-bold">
                                    <tr>
                                        <th className="px-5 py-3 text-left">Data</th>
                                        <th className="px-5 py-3 text-right">Valor Registrado</th>
                                        <th className="px-5 py-3 text-right">Meta Estabelecida</th>
                                        <th className="px-5 py-3 text-center">Status de Conformidade</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-subtle">
                                    {evolutionTimeline.map((item, idx) => {
                                        const rawVal = item[currentKpiConfig.dataKey];
                                        const isOk = currentKpiConfig.isBetterLower 
                                            ? rawVal <= currentKpiConfig.goalValue 
                                            : rawVal >= currentKpiConfig.goalValue;

                                        return (
                                            <tr key={idx} className="hover:bg-subtle/50 transition-colors">
                                                <td className="px-5 py-3.5 font-medium text-primary-hub">{item.fullDate || item.date}</td>
                                                <td className="px-5 py-3.5 text-right font-bold text-primary-hub font-mono">
                                                    {currentKpiConfig.formatTooltip(rawVal)}
                                                </td>
                                                <td className="px-5 py-3.5 text-right text-muted-hub font-mono">
                                                    {currentKpiConfig.goalFormatted}
                                                </td>
                                                <td className="px-5 py-3.5 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] border ${
                                                        isOk 
                                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                                                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                                    }`}>
                                                        {isOk ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <AlertCircle className="w-3 h-3 text-rose-500" />}
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
            {/* ABA 3: SEMÁFORO DE METAS & CONFORMIDADE OPERACIONAL      */}
            {/* --------------------------------------------------------- */}
            {viewMode === 'compliance' && (
                <div className="space-y-6">
                    <div className="bg-surface p-5 sm:p-6 rounded-3xl border border-subtle shadow-xs">
                        <h3 className="text-base font-bold text-primary-hub font-brand">Matriz Semafórica de SLAs & Metas</h3>
                        <p className="text-xs text-secondary-hub mt-0.5">
                            Visão panorâmica de aderência às metas corporativas para tomada de decisão imediata.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* TMR Semáforo */}
                        <div className="bg-surface p-5 rounded-3xl border border-subtle shadow-xs space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-bold text-muted-hub uppercase tracking-wider block">Tempo Médio de Resposta (TMR)</span>
                                    <h4 className="text-2xl font-black text-primary-hub mt-1">{latestKpi.tmr || '00:00:00'}</h4>
                                </div>
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-sm ${
                                    timeToDecimal(latestKpi.tmr) <= timeToDecimal(goals.tmr) ? 'bg-emerald-600' : 'bg-rose-600'
                                }`}>
                                    {timeToDecimal(latestKpi.tmr) <= timeToDecimal(goals.tmr) ? 'OK' : '!'}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-secondary-hub">
                                    <span>Meta Estipulada: ≤ {goals.tmr}</span>
                                    <span className="font-bold">
                                        {timeToDecimal(latestKpi.tmr) <= timeToDecimal(goals.tmr) ? 'Dentro do SLA' : 'SLA Violado'}
                                    </span>
                                </div>
                                <div className="w-full bg-canvas h-2.5 rounded-full overflow-hidden border border-subtle">
                                    <div 
                                        className={`h-full rounded-full transition-all ${
                                            timeToDecimal(latestKpi.tmr) <= timeToDecimal(goals.tmr) ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`} 
                                        style={{ width: `${Math.min(100, Math.round((timeToDecimal(latestKpi.tmr) / (timeToDecimal(goals.tmr) || 1)) * 100))}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* FCR Semáforo */}
                        <div className="bg-surface p-5 rounded-3xl border border-subtle shadow-xs space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-bold text-muted-hub uppercase tracking-wider block">Resolução 1º Contato (FCR)</span>
                                    <h4 className="text-2xl font-black text-primary-hub mt-1">{latestKpi.fcr}%</h4>
                                </div>
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-sm ${
                                    Number(latestKpi.fcr) >= Number(goals.fcr) ? 'bg-emerald-600' : 'bg-rose-600'
                                }`}>
                                    {Number(latestKpi.fcr) >= Number(goals.fcr) ? 'OK' : '!'}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-secondary-hub">
                                    <span>Meta Estipulada: ≥ {goals.fcr}%</span>
                                    <span className="font-bold">
                                        {Number(latestKpi.fcr) >= Number(goals.fcr) ? 'Meta Superada' : 'Abaixo da Meta'}
                                    </span>
                                </div>
                                <div className="w-full bg-canvas h-2.5 rounded-full overflow-hidden border border-subtle">
                                    <div 
                                        className={`h-full rounded-full transition-all ${
                                            Number(latestKpi.fcr) >= Number(goals.fcr) ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`} 
                                        style={{ width: `${Math.min(100, Number(latestKpi.fcr))}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Reincidência Semáforo */}
                        <div className="bg-surface p-5 rounded-3xl border border-subtle shadow-xs space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-bold text-muted-hub uppercase tracking-wider block">Taxa de Reincidência</span>
                                    <h4 className="text-2xl font-black text-primary-hub mt-1">{latestKpi.recurrence}%</h4>
                                </div>
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-sm ${
                                    Number(latestKpi.recurrence) <= Number(goals.recurrence) ? 'bg-emerald-600' : 'bg-rose-600'
                                }`}>
                                    {Number(latestKpi.recurrence) <= Number(goals.recurrence) ? 'OK' : '!'}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-secondary-hub">
                                    <span>Meta Estipulada: ≤ {goals.recurrence}%</span>
                                    <span className="font-bold">
                                        {Number(latestKpi.recurrence) <= Number(goals.recurrence) ? 'Controle Adequado' : 'Reincidência Crítica'}
                                    </span>
                                </div>
                                <div className="w-full bg-canvas h-2.5 rounded-full overflow-hidden border border-subtle">
                                    <div 
                                        className={`h-full rounded-full transition-all ${
                                            Number(latestKpi.recurrence) <= Number(goals.recurrence) ? 'bg-emerald-500' : 'bg-rose-500'
                                        }`} 
                                        style={{ width: `${Math.min(100, (Number(latestKpi.recurrence) / (Number(goals.recurrence) || 1)) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* QA Monitoria Semáforo */}
                        <div className="bg-surface p-5 rounded-3xl border border-subtle shadow-xs space-y-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <span className="text-xs font-bold text-muted-hub uppercase tracking-wider block">Conformidade Monitoria QA</span>
                                    <h4 className="text-2xl font-black text-primary-hub mt-1">{qaStats.taxa}%</h4>
                                </div>
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-sm ${
                                    qaStats.taxa >= (goals.qa || 85) ? 'bg-emerald-600' : 'bg-amber-600'
                                }`}>
                                    {qaStats.taxa >= (goals.qa || 85) ? 'OK' : '!'}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-xs text-secondary-hub">
                                    <span>Meta Estipulada: ≥ {goals.qa || 85}%</span>
                                    <span className="font-bold">
                                        {qaStats.taxa >= (goals.qa || 85) ? 'Conformidade Plena' : 'Necessita Atenção'}
                                    </span>
                                </div>
                                <div className="w-full bg-canvas h-2.5 rounded-full overflow-hidden border border-subtle">
                                    <div 
                                        className={`h-full rounded-full transition-all ${
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
            {/* ABA 4: COMPARATIVO POR TURNOS (SQUADS)                   */}
            {/* --------------------------------------------------------- */}
            {viewMode === 'shifts' && (
                <div className="space-y-6">
                    <div className="bg-surface p-5 sm:p-6 rounded-3xl border border-subtle shadow-xs">
                        <h3 className="text-base font-bold text-primary-hub font-brand">Comparativo Operacional entre Turnos</h3>
                        <p className="text-xs text-secondary-hub mt-0.5">
                            Comportamento e distribuição de carga entre o horário de pico diurno (Manhã I, II e Tarde) e o turno Noturno.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* TURNO MANHÃ I, II & TARDE */}
                        <div className="bg-surface rounded-3xl border border-subtle shadow-xs overflow-hidden">
                            <div className="p-5 bg-amber-500/10 border-b border-amber-500/20 flex justify-between items-center">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Horário de Pico (Diurno)</span>
                                    <h4 className="text-lg font-bold text-primary-hub">Manhã I, II & Tarde</h4>
                                </div>
                                <span className="px-3 py-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold rounded-full text-xs">
                                    {teamStats.shiftSummary.day.count} avaliados
                                </span>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-canvas p-4 rounded-2xl border border-subtle">
                                        <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">Média de Pontos</span>
                                        <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">{teamStats.shiftSummary.day.avgPts} pts</span>
                                    </div>
                                    <div className="bg-canvas p-4 rounded-2xl border border-subtle">
                                        <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">Volume Finalizado</span>
                                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{teamStats.shiftSummary.day.avgVol}</span>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-subtle">
                                    <span className="text-xs font-bold text-secondary-hub block mb-2">Destaque do Turno (Líder Geral):</span>
                                    <div className="flex items-center justify-between bg-canvas p-3 rounded-xl border border-subtle">
                                        <div className="flex items-center gap-2.5">
                                            <Award className="w-4 h-4 text-amber-500" />
                                            <div>
                                                <span className="text-sm font-bold text-primary-hub block">{teamStats.topDay.name}</span>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {teamStats.topDay.evalCount > 0 && (
                                                        <span className="text-[10px] text-muted-hub">
                                                            {teamStats.topDay.evalCount} {teamStats.topDay.evalCount === 1 ? 'avaliação' : 'avaliações'}
                                                        </span>
                                                    )}
                                                    {teamStats.topDay.shift && (
                                                        <span className="text-[10px] px-1.5 py-0.2 bg-subtle text-secondary-hub font-semibold rounded-md border border-subtle">
                                                            {teamStats.topDay.shift}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 block">{teamStats.topDay.val} pts</span>
                                            <span className="text-[10px] text-muted-hub font-medium">(média)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* TURNO NOTURNO */}
                        <div className="bg-surface rounded-3xl border border-subtle shadow-xs overflow-hidden">
                            <div className="p-5 bg-indigo-500/10 border-b border-indigo-500/20 flex justify-between items-center">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Turno Noturno</span>
                                    <h4 className="text-lg font-bold text-primary-hub">Noturno (13:45 às 20:00)</h4>
                                </div>
                                <span className="px-3 py-1 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-bold rounded-full text-xs">
                                    {teamStats.shiftSummary.night.count} avaliados
                                </span>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-canvas p-4 rounded-2xl border border-subtle">
                                        <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">Média de Pontos</span>
                                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block">{teamStats.shiftSummary.night.avgPts} pts</span>
                                    </div>
                                    <div className="bg-canvas p-4 rounded-2xl border border-subtle">
                                        <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">Volume Finalizado</span>
                                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{teamStats.shiftSummary.night.avgVol}</span>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-subtle">
                                    <span className="text-xs font-bold text-secondary-hub block mb-2">Destaque do Turno (Líder Geral):</span>
                                    <div className="flex items-center justify-between bg-canvas p-3 rounded-xl border border-subtle">
                                        <div className="flex items-center gap-2.5">
                                            <Award className="w-4 h-4 text-indigo-500" />
                                            <div>
                                                <span className="text-sm font-bold text-primary-hub block">{teamStats.topNight.name}</span>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {teamStats.topNight.evalCount > 0 && (
                                                        <span className="text-[10px] text-muted-hub">
                                                            {teamStats.topNight.evalCount} {teamStats.topNight.evalCount === 1 ? 'avaliação' : 'avaliações'}
                                                        </span>
                                                    )}
                                                    {teamStats.topNight.shift && (
                                                        <span className="text-[10px] px-1.5 py-0.2 bg-subtle text-secondary-hub font-semibold rounded-md border border-subtle">
                                                            {teamStats.topNight.shift}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 block">{teamStats.topNight.val} pts</span>
                                            <span className="text-[10px] text-muted-hub font-medium">(média)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* 5. MODAL DE RANKINGS & DETALHAMENTO COM BORDERBEAM        */}
            {/* ========================================================= */}
            {modalInfo && (
                <div className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-4 bg-zinc-950/75 backdrop-blur-md">
                    <div className="relative bg-surface rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-subtle text-primary-hub animate-in fade-in zoom-in-95 duration-200">
                        <BorderBeam size={220} duration={8} colorFrom="#f43f5e" colorTo="#e11d48" borderWidth={1.5} />
                        
                        <div className="flex items-center justify-between p-5 bg-surface text-primary-hub border-b border-subtle">
                            <div>
                                <h3 className="font-bold text-base font-brand">{modalInfo.title}</h3>
                                <p className="text-xs text-muted-hub">Classificação apurada no período ativo</p>
                            </div>
                            <button 
                                onClick={() => setModalInfo(null)} 
                                className="p-2 hover:bg-subtle text-muted-hub hover:text-primary-hub rounded-xl transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-5 overflow-y-auto divide-y divide-subtle bg-canvas space-y-1">
                            {modalInfo.data && modalInfo.data.length > 0 ? (
                                modalInfo.data.map((item, idx) => (
                                    <div key={item.id || idx} className="flex justify-between items-center py-3 gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <span className={`font-bold w-6 text-center text-xs shrink-0 ${idx < 3 ? 'text-amber-500 font-black' : 'text-muted-hub'}`}>
                                                {idx + 1}º
                                            </span>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-primary-hub text-sm block truncate">{item.name}</span>
                                                    {item.shift && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-subtle text-secondary-hub border border-subtle">
                                                            {item.shift}
                                                        </span>
                                                    )}
                                                </div>
                                                {item.evalCount !== undefined && (
                                                    <span className="text-[11px] text-muted-hub font-medium block">
                                                        {item.evalCount} {item.evalCount === 1 ? 'avaliação' : 'avaliações'} • Total: {item.totalPts} pts
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <span className="font-bold text-primary-hub text-sm block font-mono">
                                                {modalInfo.formatVal ? modalInfo.formatVal(item.val) : item.val}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-muted-hub py-8 text-sm">
                                    Nenhum registro disponível para este recorte.
                                </div>
                            )}
                        </div>

                        <div className="p-4 bg-surface border-t border-subtle flex justify-end">
                            <button 
                                onClick={() => setModalInfo(null)}
                                className="px-5 py-2 bg-canvas hover:bg-subtle text-secondary-hub border border-subtle font-bold text-xs rounded-xl transition-colors cursor-pointer"
                            >
                                Fechar Janela
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default DashboardOverview;

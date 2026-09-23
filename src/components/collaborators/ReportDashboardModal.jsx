import React, { useState, useEffect, useMemo } from 'react';
import { 
    X, Loader2, Calendar, Phone, PhoneMissed, CheckCircle, Clock, 
    Filter, FileText, MessageSquare, Award, ArrowUpRight, TrendingUp,
    Download, Printer, Sparkles, BarChart2, ShieldCheck, ChevronRight,
    Users, ThumbsUp, HelpCircle, Layers, RefreshCw, AlertCircle
} from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { 
    BarChart, Bar, LineChart, Line, AreaChart, Area, 
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

// --- UTILITÁRIOS DE CONVERSÃO E FORMATAÇÃO ---
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

const extractMonthFromDate = (dateStr) => {
    if (!dateStr || dateStr === 'Semana Atual' || dateStr === 'Sem data') return null;
    if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
    }
    if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[1]}/${parts[0]}`;
    }
    return null;
};

const timeToDecimal = (timeStr) => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length !== 3) return 0;
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    return (hours * 60) + minutes + (seconds / 60);
};

const formatTime = (decimalMinutes) => {
    if (!decimalMinutes && decimalMinutes !== 0) return "00:00:00";
    const totalSeconds = Math.round(decimalMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

const calcularPontuacao = (metrics) => {
    if (!metrics) return 0;
    const ptsFinalizados = (Number(metrics.finalizados) || Number(metrics.Atendimentos_Finalizados) || 0) * 1;
    const ptsLigacoes = (Number(metrics.ligAtendidas) || Number(metrics.Ligacoes_Atendidas) || 0) * 2;
    const ptsHuggy = (Number(metrics.huggyVol) || Number(metrics.Atendimentos_Huggy) || 0) * 1;
    const ptsPerdidas = (Number(metrics.ligPerdidas) || Number(metrics.Ligacoes_Perdidas) || 0) * -5;
    return ptsFinalizados + ptsLigacoes + ptsHuggy + ptsPerdidas;
};

export const ReportDashboardModal = ({ colab, onClose }) => {
    // Cálculo do mês vigente (ex: "09/2026")
    const currentMonthKey = useMemo(() => {
        const now = new Date();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        return `${mm}/${yyyy}`;
    }, []);

    // Cálculo do mês anterior (ex: "08/2026")
    const previousMonthKey = useMemo(() => {
        const now = new Date();
        now.setMonth(now.getMonth() - 1);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        return `${mm}/${yyyy}`;
    }, []);

    // Estados de Filtros e Seleção
    // Por padrão: Mês Vigente!
    const [periodType, setPeriodType] = useState('current'); // 'current' | 'previous' | 'custom_month' | 'last_3' | 'all'
    const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
    const [selectedWeek, setSelectedWeek] = useState('all'); // 'all' ou data específica 'DD/MM/YYYY'
    const [focusTab, setFocusTab] = useState('all'); // 'all' | 'telefonia' | 'huggy' | 'pontuacao' | 'qa'
    const [selectedWeekModal, setSelectedWeekModal] = useState(null);

    // Estados de Dados do Firestore
    const [weeklyEvals, setWeeklyEvals] = useState([]);
    const [audits, setAudits] = useState([]);
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(true);

    // Assinatura em tempo real dos dados do colaborador
    useEffect(() => {
        if (!colab?.id) return;

        // 1. Avaliações Semanais (weekly_evaluations)
        const qWeekly = query(
            collection(db, "weekly_evaluations"),
            where("colabId", "==", colab.id)
        );

        const unsubWeekly = onSnapshot(qWeekly, (snapshot) => {
            const list = [];
            snapshot.forEach((docSnap) => {
                const d = docSnap.data();
                const safeDate = d.date || 'Semana Atual';
                list.push({
                    id: docSnap.id,
                    date: safeDate,
                    month: extractMonthFromDate(safeDate) || (d.createdAt?.toDate ? extractMonthFromDate(d.createdAt.toDate().toLocaleDateString('pt-BR')) : null),
                    finalizados: Number(d.Atendimentos_Finalizados) || 0,
                    ligAtendidas: Number(d.Ligacoes_Atendidas) || 0,
                    ligPerdidas: Number(d.Ligacoes_Perdidas) || 0,
                    huggyVol: Number(d.Atendimentos_Huggy) || 0,
                    tmaTel: timeToDecimal(d.TMA_Telefonia),
                    tmaHuggy: timeToDecimal(d.TMA_Huggy),
                    tme: timeToDecimal(d.TME_Telefonia),
                    tmaTelRaw: d.TMA_Telefonia || "00:00:00",
                    tmaHuggyRaw: d.TMA_Huggy || "00:00:00",
                    tmeRaw: d.TME_Telefonia || "00:00:00",
                    pontuacao: d.pontuacao !== undefined ? Number(d.pontuacao) : calcularPontuacao(d),
                    createdAt: d.createdAt
                });
            });

            // Ordena cronologicamente crescente para evolução em gráficos
            list.sort((a, b) => {
                const timeA = a.date !== 'Semana Atual' ? parseDateObj(a.date) : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
                const timeB = b.date !== 'Semana Atual' ? parseDateObj(b.date) : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
                return timeA - timeB;
            });

            setWeeklyEvals(list);
            setLoading(false);
        });

        // 2. Auditorias QA (qa_audits)
        const qAudits = query(collection(db, "qa_audits"));
        const unsubAudits = onSnapshot(qAudits, (snap) => {
            const list = [];
            snap.forEach((d) => {
                const dt = d.data();
                if (dt.colabId === colab.id || dt.collaboratorId === colab.id) {
                    list.push({ id: d.id, ...dt });
                }
            });
            setAudits(list);
        });

        // 3. Feedbacks (feedbacks)
        const qFeedbacks = query(collection(db, "feedbacks"));
        const unsubFeedbacks = onSnapshot(qFeedbacks, (snap) => {
            const list = [];
            snap.forEach((d) => {
                const dt = d.data();
                if (dt.colabId === colab.id || dt.collaboratorId === colab.id) {
                    list.push({ id: d.id, ...dt });
                }
            });
            setFeedbacks(list);
        });

        return () => {
            unsubWeekly();
            unsubAudits();
            unsubFeedbacks();
        };
    }, [colab?.id]);

    // Lista de todos os meses disponíveis com dados
    const availableMonths = useMemo(() => {
        const set = new Set();
        // Inclui sempre o mês vigente para fácil acesso
        set.add(currentMonthKey);
        weeklyEvals.forEach(item => {
            if (item.month) set.add(item.month);
        });
        return Array.from(set).sort((a, b) => {
            const [m1, y1] = a.split('/');
            const [m2, y2] = b.split('/');
            return new Date(y2, m2 - 1, 1).getTime() - new Date(y1, m1 - 1, 1).getTime();
        });
    }, [weeklyEvals, currentMonthKey]);

    // Define o mês ativo baseado no periodType
    const activeTargetMonth = useMemo(() => {
        if (periodType === 'current') return currentMonthKey;
        if (periodType === 'previous') return previousMonthKey;
        if (periodType === 'custom_month') return selectedMonth;
        return null; // para 'all' ou 'last_3'
    }, [periodType, currentMonthKey, previousMonthKey, selectedMonth]);

    // Filtra os dados semanais conforme o período selecionado
    const periodFilteredEvals = useMemo(() => {
        if (periodType === 'current') {
            return weeklyEvals.filter(e => e.month === currentMonthKey);
        }
        if (periodType === 'previous') {
            return weeklyEvals.filter(e => e.month === previousMonthKey);
        }
        if (periodType === 'custom_month') {
            return weeklyEvals.filter(e => e.month === selectedMonth);
        }
        if (periodType === 'last_3') {
            const now = new Date();
            const threeMonthsAgo = new Date();
            threeMonthsAgo.setMonth(now.getMonth() - 3);
            const minTime = threeMonthsAgo.getTime();
            return weeklyEvals.filter(e => parseDateObj(e.date) >= minTime);
        }
        // 'all'
        return weeklyEvals;
    }, [weeklyEvals, periodType, currentMonthKey, previousMonthKey, selectedMonth]);

    // Lista de semanas/datas disponíveis no período selecionado
    const availableWeeksInPeriod = useMemo(() => {
        const weeks = new Set();
        periodFilteredEvals.forEach(item => {
            if (item.date && item.date !== 'Semana Atual' && item.date !== 'Sem data') {
                weeks.add(item.date);
            }
        });
        return Array.from(weeks).sort((a, b) => parseDateObj(b) - parseDateObj(a));
    }, [periodFilteredEvals]);

    // Se o filtro de semana estiver ativo, refina ainda mais
    const displayedEvals = useMemo(() => {
        if (selectedWeek === 'all') return periodFilteredEvals;
        return periodFilteredEvals.filter(e => e.date === selectedWeek);
    }, [periodFilteredEvals, selectedWeek]);

    // Consolidação Estatística / Totais e Médias do Período
    const metricsSummary = useMemo(() => {
        const count = displayedEvals.length;
        if (count === 0) {
            return {
                count: 0,
                totalFinalizados: 0,
                totalLigAtendidas: 0,
                totalLigPerdidas: 0,
                totalHuggy: 0,
                totalPontuacao: 0,
                avgFinalizados: 0,
                avgLigAtendidas: 0,
                avgLigPerdidas: 0,
                avgHuggy: 0,
                avgPontuacao: 0,
                taxaAtendimento: 0,
                avgTmaTel: 0,
                avgTmaHuggy: 0,
                avgTme: 0
            };
        }

        const totalFinalizados = displayedEvals.reduce((acc, curr) => acc + curr.finalizados, 0);
        const totalLigAtendidas = displayedEvals.reduce((acc, curr) => acc + curr.ligAtendidas, 0);
        const totalLigPerdidas = displayedEvals.reduce((acc, curr) => acc + curr.ligPerdidas, 0);
        const totalHuggy = displayedEvals.reduce((acc, curr) => acc + curr.huggyVol, 0);
        const totalPontuacao = displayedEvals.reduce((acc, curr) => acc + curr.pontuacao, 0);

        const totalTmaTel = displayedEvals.reduce((acc, curr) => acc + curr.tmaTel, 0);
        const totalTmaHuggy = displayedEvals.reduce((acc, curr) => acc + curr.tmaHuggy, 0);
        const totalTme = displayedEvals.reduce((acc, curr) => acc + curr.tme, 0);

        const totalChamadas = totalLigAtendidas + totalLigPerdidas;
        const taxaAtendimento = totalChamadas > 0 ? (totalLigAtendidas / totalChamadas) * 100 : 100;

        return {
            count,
            totalFinalizados,
            totalLigAtendidas,
            totalLigPerdidas,
            totalHuggy,
            totalPontuacao,
            avgFinalizados: Math.round(totalFinalizados / count),
            avgLigAtendidas: Math.round(totalLigAtendidas / count),
            avgLigPerdidas: Math.round(totalLigPerdidas / count),
            avgHuggy: Math.round(totalHuggy / count),
            avgPontuacao: Math.round(totalPontuacao / count),
            taxaAtendimento: Math.round(taxaAtendimento * 10) / 10,
            avgTmaTel: totalTmaTel / count,
            avgTmaHuggy: totalTmaHuggy / count,
            avgTme: totalTme / count
        };
    }, [displayedEvals]);

    // Auditorias QA no período
    const periodAudits = useMemo(() => {
        if (!activeTargetMonth && periodType === 'all') return audits;
        const target = activeTargetMonth;
        return audits.filter(a => {
            const m = extractMonthFromDate(a.date) || (a.createdAt?.toDate ? extractMonthFromDate(a.createdAt.toDate().toLocaleDateString('pt-BR')) : null);
            return m === target;
        });
    }, [audits, activeTargetMonth, periodType]);

    // Métricas de QA no período
    const qaMetrics = useMemo(() => {
        const total = periodAudits.length;
        if (total === 0) return { total: 0, conformes: 0, naoConformes: 0, taxaConformidade: 0 };
        const conformes = periodAudits.filter(a => a.status === 'Conforme').length;
        const naoConformes = total - conformes;
        const taxaConformidade = Math.round((conformes / total) * 100);
        return { total, conformes, naoConformes, taxaConformidade };
    }, [periodAudits]);

    // Feedbacks no período
    const periodFeedbacks = useMemo(() => {
        if (!activeTargetMonth && periodType === 'all') return feedbacks;
        const target = activeTargetMonth;
        return feedbacks.filter(f => {
            const m = extractMonthFromDate(f.date) || (f.createdAt?.toDate ? extractMonthFromDate(f.createdAt.toDate().toLocaleDateString('pt-BR')) : null);
            return m === target;
        });
    }, [feedbacks, activeTargetMonth, periodType]);

    // Formatação dos dados para o Recharts
    const chartData = useMemo(() => {
        return displayedEvals.map(item => ({
            name: item.date.replace('/2026', '').replace('/26', ''),
            fullDate: item.date,
            finalizados: item.finalizados,
            ligAtendidas: item.ligAtendidas,
            ligPerdidas: item.ligPerdidas,
            huggyVol: item.huggyVol,
            tmaTel: Math.round(item.tmaTel * 10) / 10,
            tmaHuggy: Math.round(item.tmaHuggy * 10) / 10,
            tme: Math.round(item.tme * 10) / 10,
            pontuacao: item.pontuacao
        }));
    }, [displayedEvals]);

    // Exportação do relatório em CSV
    const handleExportCSV = () => {
        if (displayedEvals.length === 0) return;
        const headers = ["Semana/Data", "Finalizados", "Lig. Atendidas", "Lig. Perdidas", "Chat Huggy", "TMA Telefonia", "TMA Huggy", "TME Telefonia", "Pontos"];
        const rows = displayedEvals.map(e => [
            `"${e.date}"`,
            e.finalizados,
            e.ligAtendidas,
            e.ligPerdidas,
            e.huggyVol,
            `"${formatTime(e.tmaTel)}"`,
            `"${formatTime(e.tmaHuggy)}"`,
            `"${formatTime(e.tme)}"`,
            e.pontuacao
        ]);

        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const safeName = colab.name.toLowerCase().replace(/\s+/g, '_');
        link.setAttribute("href", url);
        link.setAttribute("download", `relatorio_${safeName}_${periodType}_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center z-[75] backdrop-blur-xs">
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center gap-3 text-white shadow-2xl">
                    <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                    <p className="text-xs font-semibold text-zinc-300">Carregando relatório completo do colaborador...</p>
                </div>
            </div>
        );
    }

    return (
        <div 
            id="collaborator-report-dashboard-backdrop"
            className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center p-2 sm:p-4 z-[75] backdrop-blur-xs animate-in fade-in duration-150"
        >
            <div 
                id="collaborator-report-dashboard-modal"
                className="bg-gray-50 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden border border-gray-200"
            >
                {/* ======================================================== */}
                {/* CABEÇALHO DO RELATÓRIO INDIVIDUAL */}
                {/* ======================================================== */}
                <div className="p-4 sm:p-5 bg-zinc-950 flex flex-col md:flex-row justify-between items-start md:items-center text-white shrink-0 gap-4 border-b border-zinc-800">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-white font-extrabold text-base shadow-sm shrink-0 border border-red-500/40">
                            {colab.name ? colab.name.substring(0, 2).toUpperCase() : 'CO'}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base font-bold text-white tracking-tight">
                                    {colab.name}
                                </h2>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                                    {colab.role || 'Colaborador'}
                                </span>
                                {colab.active !== false ? (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        Ativo
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                                        Inativo
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>Relatório Individual &bull; Dashboard de Performance</span>
                                {colab.email && <span className="text-zinc-500 hidden sm:inline">&bull; {colab.email}</span>}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        <button
                            id="btn-report-export-csv"
                            type="button"
                            onClick={handleExportCSV}
                            title="Exportar dados deste relatório em CSV"
                            disabled={displayedEvals.length === 0}
                            className="px-3 py-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-zinc-200 border border-zinc-700/80 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                            <Download className="w-3.5 h-3.5 text-zinc-400" />
                            <span className="hidden sm:inline">Exportar CSV</span>
                        </button>

                        <button
                            id="btn-report-print"
                            type="button"
                            onClick={handlePrint}
                            title="Imprimir relatório"
                            className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/80 rounded-xl text-xs transition-colors cursor-pointer"
                        >
                            <Printer className="w-4 h-4" />
                        </button>

                        <button 
                            id="btn-report-close"
                            type="button"
                            onClick={onClose} 
                            className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0 ml-1"
                            title="Fechar modal"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ======================================================== */}
                {/* BARRA DE FILTROS AVANÇADOS: PERÍODO, MÊS E SEMANAS */}
                {/* ======================================================== */}
                <div id="report-filters-bar" className="bg-white px-4 sm:px-6 py-3 border-b border-gray-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shrink-0 shadow-2xs">
                    {/* Botões de Atalho de Período */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-red-600" />
                            Período:
                        </span>

                        <button
                            id="btn-period-current-month"
                            type="button"
                            onClick={() => {
                                setPeriodType('current');
                                setSelectedWeek('all');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                                periodType === 'current'
                                    ? 'bg-red-600 text-white shadow-2xs'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            <Sparkles className="w-3 h-3" />
                            Mês Vigente ({currentMonthKey})
                        </button>

                        <button
                            id="btn-period-previous-month"
                            type="button"
                            onClick={() => {
                                setPeriodType('previous');
                                setSelectedWeek('all');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                periodType === 'previous'
                                    ? 'bg-red-600 text-white shadow-2xs'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Mês Anterior ({previousMonthKey})
                        </button>

                        <button
                            id="btn-period-last-3-months"
                            type="button"
                            onClick={() => {
                                setPeriodType('last_3');
                                setSelectedWeek('all');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                periodType === 'last_3'
                                    ? 'bg-red-600 text-white shadow-2xs'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Últimos 3 Meses
                        </button>

                        <button
                            id="btn-period-all-history"
                            type="button"
                            onClick={() => {
                                setPeriodType('all');
                                setSelectedWeek('all');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                periodType === 'all'
                                    ? 'bg-red-600 text-white shadow-2xs'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Todo o Histórico
                        </button>
                    </div>

                    {/* Dropdowns Específicos: Mês Customizado & Semana de Avaliação */}
                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Seletor de Mês Específico */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 font-medium hidden lg:inline">Mês:</span>
                            <select
                                id="select-report-custom-month"
                                value={periodType === 'custom_month' ? selectedMonth : (periodType === 'current' ? currentMonthKey : (periodType === 'previous' ? previousMonthKey : ''))}
                                onChange={(e) => {
                                    if (e.target.value) {
                                        setPeriodType('custom_month');
                                        setSelectedMonth(e.target.value);
                                        setSelectedWeek('all');
                                    }
                                }}
                                className="px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
                            >
                                <option value="" disabled>Selecionar Mês...</option>
                                {availableMonths.map(m => (
                                    <option key={m} value={m}>
                                        Mês {m} {m === currentMonthKey ? ' (Vigente)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Seletor de Semana / Data Específica de Avaliação */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 font-medium hidden lg:inline">Semana:</span>
                            <select
                                id="select-report-week"
                                value={selectedWeek}
                                onChange={(e) => setSelectedWeek(e.target.value)}
                                disabled={availableWeeksInPeriod.length === 0}
                                className="px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 outline-none focus:ring-2 focus:ring-red-500 cursor-pointer disabled:opacity-50"
                            >
                                <option value="all">Todas as Semanas ({availableWeeksInPeriod.length})</option>
                                {availableWeeksInPeriod.map(w => (
                                    <option key={w} value={w}>
                                        Semana de {w}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* ======================================================== */}
                {/* ABAS DE FOCO DE DADOS (DADOS ESPECÍFICOS) */}
                {/* ======================================================== */}
                <div id="report-focus-tabs" className="bg-gray-100/70 px-4 sm:px-6 py-2 border-b border-gray-200 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
                    <div className="flex items-center gap-1">
                        <button
                            id="tab-focus-all"
                            type="button"
                            onClick={() => setFocusTab('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                focusTab === 'all'
                                    ? 'bg-white text-gray-900 shadow-2xs border border-gray-200'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                            }`}
                        >
                            <BarChart2 className="w-3.5 h-3.5 text-red-500" />
                            Visão Geral Completa
                        </button>

                        <button
                            id="tab-focus-telefonia"
                            type="button"
                            onClick={() => setFocusTab('telefonia')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                focusTab === 'telefonia'
                                    ? 'bg-white text-gray-900 shadow-2xs border border-gray-200'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                            }`}
                        >
                            <Phone className="w-3.5 h-3.5 text-blue-500" />
                            Telefonia (Voz)
                        </button>

                        <button
                            id="tab-focus-huggy"
                            type="button"
                            onClick={() => setFocusTab('huggy')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                focusTab === 'huggy'
                                    ? 'bg-white text-gray-900 shadow-2xs border border-gray-200'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                            }`}
                        >
                            <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
                            Huggy (Chat)
                        </button>

                        <button
                            id="tab-focus-pontuacao"
                            type="button"
                            onClick={() => setFocusTab('pontuacao')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                focusTab === 'pontuacao'
                                    ? 'bg-white text-gray-900 shadow-2xs border border-gray-200'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                            }`}
                        >
                            <Award className="w-3.5 h-3.5 text-amber-500" />
                            Produtividade & Pontos
                        </button>

                        <button
                            id="tab-focus-qa"
                            type="button"
                            onClick={() => setFocusTab('qa')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                                focusTab === 'qa'
                                    ? 'bg-white text-gray-900 shadow-2xs border border-gray-200'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
                            }`}
                        >
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            Qualidade QA ({qaMetrics.total})
                        </button>
                    </div>

                    <div className="text-[11px] text-gray-500 font-medium shrink-0 hidden sm:block">
                        Mostrando: <strong className="text-gray-800">{displayedEvals.length}</strong> semana(s) avaliada(s)
                    </div>
                </div>

                {/* ======================================================== */}
                {/* CORPO DO RELATÓRIO COM CARDS, GRÁFICOS E TABELAS */}
                {/* ======================================================== */}
                <div id="report-modal-body" className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
                    {/* Alerta de Mês Vigente sem lançamentos cadastrados */}
                    {periodType === 'current' && displayedEvals.length === 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-2xs">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                                    <AlertCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-bold text-amber-900">
                                        Mês Vigente ({currentMonthKey}) aguardando novas avaliações semanais
                                    </h4>
                                    <p className="text-[11px] text-amber-700 mt-0.5">
                                        Ainda não foram registrados lançamentos de métricas neste mês para {colab.name}. Você pode navegar facilmente para o mês anterior ou ver todo o histórico.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setPeriodType('previous');
                                    setSelectedWeek('all');
                                }}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer shadow-2xs"
                            >
                                Ver Mês Anterior ({previousMonthKey})
                            </button>
                        </div>
                    )}

                    {displayedEvals.length === 0 && periodType !== 'current' ? (
                        <div className="text-center py-20 flex flex-col items-center justify-center bg-white rounded-2xl border border-gray-200 p-8 shadow-2xs">
                            <FileText className="w-14 h-14 text-gray-300 mb-3" />
                            <h3 className="text-base font-bold text-gray-800">Nenhum dado encontrado para o filtro selecionado</h3>
                            <p className="text-xs text-gray-500 mt-1 max-w-md">
                                Não há avaliações semanais cadastradas com os parâmetros de data ou semana definidos.
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    setPeriodType('all');
                                    setSelectedWeek('all');
                                }}
                                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition-colors cursor-pointer"
                            >
                                Exibir Todo o Histórico
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* ======================================================== */}
                            {/* GRADE DE CARDS ESTATÍSTICOS COMPLETOS */}
                            {/* ======================================================== */}
                            <div id="report-primary-metric-cards" className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3">
                                {/* CARD 1: PONTUAÇÃO CONSOLIDADA */}
                                <div id="metric-card-pontuacao" className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Award className="w-3.5 h-3.5 text-amber-500" />
                                            {selectedWeek !== 'all' ? 'Pontos da Semana' : 'Pontuação Total'}
                                        </span>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                            metricsSummary.totalPontuacao >= 500 
                                                ? 'bg-emerald-100 text-emerald-700' 
                                                : (metricsSummary.totalPontuacao >= 250 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700')
                                        }`}>
                                            {selectedWeek !== 'all' ? 'Semana Focada' : `${metricsSummary.count} sem.`}
                                        </span>
                                    </div>
                                    <div className="text-2xl font-black text-gray-900 tracking-tight">
                                        {metricsSummary.totalPontuacao.toLocaleString('pt-BR')} <span className="text-xs font-bold text-gray-400">pts</span>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                                        <span>Média Semanal:</span>
                                        <strong className="text-gray-800">{metricsSummary.avgPontuacao} pts/sem</strong>
                                    </div>
                                </div>

                                {/* CARD 2: FINALIZADOS */}
                                <div id="metric-card-finalizados" className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                            Finalizados
                                        </span>
                                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                            +1 pt cada
                                        </span>
                                    </div>
                                    <div className="text-2xl font-black text-emerald-600 tracking-tight">
                                        {metricsSummary.totalFinalizados.toLocaleString('pt-BR')}
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                                        <span>Média Semanal:</span>
                                        <strong className="text-gray-800">{metricsSummary.avgFinalizados} atend.</strong>
                                    </div>
                                </div>

                                {/* CARD 3: TELEFONIA (ATENDIDAS VS PERDIDAS) */}
                                <div id="metric-card-telefonia" className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <Phone className="w-3.5 h-3.5 text-blue-500" />
                                            Voz (Atendidas / Perd.)
                                        </span>
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                            Taxa {metricsSummary.taxaAtendimento}%
                                        </span>
                                    </div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-black text-blue-600 tracking-tight">
                                            {metricsSummary.totalLigAtendidas}
                                        </span>
                                        <span className="text-xs font-bold text-gray-400">atend.</span>
                                        {metricsSummary.totalLigPerdidas > 0 && (
                                            <span className="text-xs font-bold text-red-600 ml-auto bg-red-50 px-1.5 py-0.5 rounded">
                                                -{metricsSummary.totalLigPerdidas} perd.
                                            </span>
                                        )}
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                                        <span>Média Ligações:</span>
                                        <strong className="text-gray-800">{metricsSummary.avgLigAtendidas}/sem</strong>
                                    </div>
                                </div>

                                {/* CARD 4: VOLUME HUGGY CHAT */}
                                <div id="metric-card-huggy" className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <MessageSquare className="w-3.5 h-3.5 text-purple-500" />
                                            Volume Huggy (Chat)
                                        </span>
                                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                                            +1 pt cada
                                        </span>
                                    </div>
                                    <div className="text-2xl font-black text-purple-600 tracking-tight">
                                        {metricsSummary.totalHuggy.toLocaleString('pt-BR')}
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                                        <span>Média Chat:</span>
                                        <strong className="text-gray-800">{metricsSummary.avgHuggy} conv./sem</strong>
                                    </div>
                                </div>
                            </div>

                            {/* LINHA SECUNDÁRIA DE CARDS: TEMPOS MÉDIOS E QUALIDADE */}
                            <div id="report-secondary-metric-cards" className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3">
                                <div id="metric-card-tma-tel" className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-blue-500" /> TMA Voz</span>
                                        <span className="text-gray-400 font-normal">Médio</span>
                                    </div>
                                    <div className="text-lg font-black text-blue-600 font-mono">
                                        {formatTime(metricsSummary.avgTmaTel)}
                                    </div>
                                </div>

                                <div id="metric-card-tma-huggy" className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-purple-500" /> TMA Huggy</span>
                                        <span className="text-gray-400 font-normal">Médio</span>
                                    </div>
                                    <div className="text-lg font-black text-purple-600 font-mono">
                                        {formatTime(metricsSummary.avgTmaHuggy)}
                                    </div>
                                </div>

                                <div id="metric-card-tme-tel" className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-gray-500" /> TME Telefonia</span>
                                        <span className="text-gray-400 font-normal">Espera</span>
                                    </div>
                                    <div className="text-lg font-black text-gray-800 font-mono">
                                        {formatTime(metricsSummary.avgTme)}
                                    </div>
                                </div>

                                <div id="metric-card-qa-conformidade" className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs">
                                    <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                        <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-500" /> Conformidade QA</span>
                                        <span className="text-gray-400 font-normal">{qaMetrics.total} audits</span>
                                    </div>
                                    <div className="text-lg font-black text-emerald-600">
                                        {qaMetrics.total > 0 ? `${qaMetrics.taxaConformidade}%` : '--'}
                                    </div>
                                </div>
                            </div>

                            {/* ======================================================== */}
                            {/* GRÁFICOS ANALÍTICOS DINÂMICOS CONFORME A ABA */}
                            {/* ======================================================== */}
                            {(focusTab === 'all' || focusTab === 'pontuacao') && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Gráfico 1: Produção Semanal */}
                                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                                    <BarChart2 className="w-4 h-4 text-red-600" />
                                                    Evolução de Produção por Semana
                                                </h3>
                                                <p className="text-[11px] text-gray-500 mt-0.5">
                                                    Comparativo de Finalizados, Voz Atendidas e Huggy
                                                </p>
                                            </div>
                                        </div>
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} dy={8} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} />
                                                    <Tooltip 
                                                        cursor={{fill: '#F9FAFB'}} 
                                                        contentStyle={{borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px'}} 
                                                    />
                                                    <Legend wrapperStyle={{fontSize: '11px', paddingTop: '10px'}} />
                                                    <Bar dataKey="finalizados" name="Finalizados" fill="#10b981" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="ligAtendidas" name="Voz Atendidas" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="huggyVol" name="Huggy (Chat)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Gráfico 2: Curva de Pontuação */}
                                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                                    <TrendingUp className="w-4 h-4 text-amber-500" />
                                                    Curva de Pontuação Semanal
                                                </h3>
                                                <p className="text-[11px] text-gray-500 mt-0.5">
                                                    Pontos acumulados conforme fórmula oficial
                                                </p>
                                            </div>
                                        </div>
                                        <div className="h-64">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} dy={8} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} />
                                                    <Tooltip 
                                                        contentStyle={{borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px'}} 
                                                        formatter={(val) => [`${val} pts`, 'Pontuação']}
                                                    />
                                                    <Area 
                                                        type="monotone" 
                                                        dataKey="pontuacao" 
                                                        stroke="#f59e0b" 
                                                        strokeWidth={2.5} 
                                                        fill="url(#colorPoints)" 
                                                        name="Pontos"
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(focusTab === 'all' || focusTab === 'telefonia' || focusTab === 'huggy') && (
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Gráfico 3: Telefonia Atendidas vs Perdidas */}
                                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                                    <Phone className="w-4 h-4 text-blue-500" />
                                                    Desempenho Telefonia (Atendidas vs Perdidas)
                                                </h3>
                                                <p className="text-[11px] text-gray-500 mt-0.5">
                                                    Detalhamento de volume de ligações recebidas
                                                </p>
                                            </div>
                                        </div>
                                        <div className="h-60">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} dy={8} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} />
                                                    <Tooltip contentStyle={{borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px'}} />
                                                    <Legend wrapperStyle={{fontSize: '11px', paddingTop: '10px'}} />
                                                    <Bar dataKey="ligAtendidas" name="Atendidas (+2 pts)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                                    <Bar dataKey="ligPerdidas" name="Perdidas (-5 pts)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Gráfico 4: Tempos Médios (TMA Telefonia vs TMA Huggy vs TME) */}
                                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                                    <Clock className="w-4 h-4 text-purple-500" />
                                                    Evolução dos Tempos Médios (TMA & TME)
                                                </h3>
                                                <p className="text-[11px] text-gray-500 mt-0.5">
                                                    Tempo Médio de Atendimento e Espera em minutos
                                                </p>
                                            </div>
                                        </div>
                                        <div className="h-60">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} dy={8} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 11}} tickFormatter={formatTime} />
                                                    <Tooltip 
                                                        contentStyle={{borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px'}} 
                                                        formatter={(value) => formatTime(value)} 
                                                    />
                                                    <Legend wrapperStyle={{fontSize: '11px', paddingTop: '10px'}} />
                                                    <Line type="monotone" dataKey="tmaTel" stroke="#3b82f6" strokeWidth={2.5} dot={{r: 4}} name="TMA Telefonia" />
                                                    <Line type="monotone" dataKey="tmaHuggy" stroke="#8b5cf6" strokeWidth={2.5} dot={{r: 4}} name="TMA Huggy" />
                                                    <Line type="monotone" dataKey="tme" stroke="#9ca3af" strokeWidth={2} strokeDasharray="4 4" dot={{r: 3}} name="TME Telefonia" />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ======================================================== */}
                            {/* TABELA DE EXTRATO DETALHADO SEMANA A SEMANA */}
                            {/* ======================================================== */}
                            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-2xs">
                                <div className="p-4 sm:p-5 border-b border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                            <Calendar className="w-4 h-4 text-red-600" />
                                            Extrato das Avaliações Semanais no Período
                                        </h3>
                                        <p className="text-[11px] text-gray-500 mt-0.5">
                                            Relação completa de todos os lançamentos que compõem este relatório
                                        </p>
                                    </div>
                                    <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2.5 py-1 rounded-lg border border-gray-200">
                                        Total: {displayedEvals.length} semanas
                                    </span>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-bold text-[10px] uppercase tracking-wider">
                                                <th className="py-3 px-4">Semana / Data</th>
                                                <th className="py-3 px-3 text-center">Finalizados</th>
                                                <th className="py-3 px-3 text-center">Lig. Atendidas</th>
                                                <th className="py-3 px-3 text-center">Lig. Perdidas</th>
                                                <th className="py-3 px-3 text-center">Chat Huggy</th>
                                                <th className="py-3 px-3 text-center">TMA Voz</th>
                                                <th className="py-3 px-3 text-center">TMA Chat</th>
                                                <th className="py-3 px-3 text-center">TME</th>
                                                <th className="py-3 px-4 text-right">Pontuação</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {displayedEvals.map((week, idx) => (
                                                <tr 
                                                    key={week.id || idx}
                                                    onClick={() => setSelectedWeekModal(week)}
                                                    className="hover:bg-red-50/40 transition-colors cursor-pointer group"
                                                >
                                                    <td className="py-3 px-4 font-bold text-gray-900 flex items-center gap-2">
                                                        <span className="w-2 h-2 rounded-full bg-red-500 group-hover:scale-125 transition-transform"></span>
                                                        {week.date}
                                                    </td>
                                                    <td className="py-3 px-3 text-center font-semibold text-emerald-700">
                                                        {week.finalizados}
                                                    </td>
                                                    <td className="py-3 px-3 text-center font-semibold text-blue-700">
                                                        {week.ligAtendidas}
                                                    </td>
                                                    <td className="py-3 px-3 text-center font-semibold text-red-600">
                                                        {week.ligPerdidas > 0 ? `-${week.ligPerdidas}` : '0'}
                                                    </td>
                                                    <td className="py-3 px-3 text-center font-semibold text-purple-700">
                                                        {week.huggyVol}
                                                    </td>
                                                    <td className="py-3 px-3 text-center font-mono text-gray-600">
                                                        {formatTime(week.tmaTel)}
                                                    </td>
                                                    <td className="py-3 px-3 text-center font-mono text-gray-600">
                                                        {formatTime(week.tmaHuggy)}
                                                    </td>
                                                    <td className="py-3 px-3 text-center font-mono text-gray-500">
                                                        {formatTime(week.tme)}
                                                    </td>
                                                    <td className="py-3 px-4 text-right font-black text-gray-900">
                                                        <span className="px-2 py-0.5 rounded-md bg-gray-100 group-hover:bg-amber-100 text-amber-900 border border-gray-200 transition-colors">
                                                            {week.pontuacao} pts
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-gray-50 font-bold border-t border-gray-200 text-gray-900">
                                                <td className="py-3 px-4 uppercase text-[10px] tracking-wider text-gray-600">
                                                    Média / Total Consolidado
                                                </td>
                                                <td className="py-3 px-3 text-center text-emerald-700">
                                                    {metricsSummary.totalFinalizados}
                                                </td>
                                                <td className="py-3 px-3 text-center text-blue-700">
                                                    {metricsSummary.totalLigAtendidas}
                                                </td>
                                                <td className="py-3 px-3 text-center text-red-600">
                                                    {metricsSummary.totalLigPerdidas}
                                                </td>
                                                <td className="py-3 px-3 text-center text-purple-700">
                                                    {metricsSummary.totalHuggy}
                                                </td>
                                                <td className="py-3 px-3 text-center font-mono text-gray-700">
                                                    {formatTime(metricsSummary.avgTmaTel)}
                                                </td>
                                                <td className="py-3 px-3 text-center font-mono text-gray-700">
                                                    {formatTime(metricsSummary.avgTmaHuggy)}
                                                </td>
                                                <td className="py-3 px-3 text-center font-mono text-gray-600">
                                                    {formatTime(metricsSummary.avgTme)}
                                                </td>
                                                <td className="py-3 px-4 text-right font-black text-amber-700">
                                                    {metricsSummary.totalPontuacao} pts
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* ======================================================== */}
                            {/* SEÇÃO INTEGRADA: AUDITORIAS QA & FEEDBACKS DO PERÍODO */}
                            {/* ======================================================== */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                                {/* Bloco QA Audits */}
                                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                <ShieldCheck className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-900">Monitoria de Qualidade (QA)</h4>
                                                <p className="text-[10px] text-gray-400">Auditorias vinculadas ao período</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                            {qaMetrics.taxaConformidade}% Conforme
                                        </span>
                                    </div>

                                    {periodAudits.length === 0 ? (
                                        <p className="text-xs text-gray-400 text-center py-6 italic">
                                            Nenhuma auditoria QA registrada neste período para este colaborador.
                                        </p>
                                    ) : (
                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                            {periodAudits.map((a, i) => (
                                                <div key={a.id || i} className="p-2.5 rounded-xl border border-gray-100 bg-gray-50/50 flex items-center justify-between text-xs">
                                                    <div>
                                                        <div className="font-bold text-gray-900 flex items-center gap-1.5">
                                                            <span>{a.processName || 'Processo Operacional'}</span>
                                                            <span className="text-[10px] text-gray-400 font-normal">({a.protocol || 'Sem protocolo'})</span>
                                                        </div>
                                                        <span className="text-[10px] text-gray-500">Data: {a.date || '--'} &bull; Auditor: {a.evaluatorName || 'QA'}</span>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                        a.status === 'Conforme' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                                                    }`}>
                                                        {a.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Bloco Feedbacks */}
                                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
                                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <ThumbsUp className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-900">Feedbacks da Liderança</h4>
                                                <p className="text-[10px] text-gray-400">Orientações e reconhecimentos</p>
                                            </div>
                                        </div>
                                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                            {periodFeedbacks.length} registros
                                        </span>
                                    </div>

                                    {periodFeedbacks.length === 0 ? (
                                        <p className="text-xs text-gray-400 text-center py-6 italic">
                                            Nenhum feedback registrado neste período para este colaborador.
                                        </p>
                                    ) : (
                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                            {periodFeedbacks.map((f, i) => (
                                                <div key={f.id || i} className="p-2.5 rounded-xl border border-gray-100 bg-gray-50/50 text-xs space-y-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-bold text-gray-900">
                                                            {f.type || 'Orientação'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">
                                                            {f.date || '--'}
                                                        </span>
                                                    </div>
                                                    <p className="text-gray-600 line-clamp-2 text-[11px]">
                                                        {f.comment || 'Sem comentário adicional.'}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ======================================================== */}
            {/* SUB-MODAL DE INSPEÇÃO DA SEMANA SELECIONADA */}
            {/* ======================================================== */}
            {selectedWeekModal && (
                <div 
                    id="selected-week-modal-backdrop"
                    onClick={() => setSelectedWeekModal(null)}
                    className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center p-4 z-[90] backdrop-blur-xs animate-in fade-in duration-150"
                >
                    <div 
                        id="selected-week-modal-content"
                        onClick={(e) => e.stopPropagation()}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 flex flex-col animate-in zoom-in-95 duration-150"
                    >
                        <div className="p-4 bg-zinc-950 text-white flex justify-between items-center border-b border-zinc-800 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <Calendar className="w-4 h-4 text-red-500" />
                                <h3 className="text-sm font-bold text-white">
                                    Detalhamento da Semana ({selectedWeekModal.date})
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedWeekModal(null)}
                                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Pontuação Semanal</span>
                                    <div className="text-2xl font-black text-amber-900">{selectedWeekModal.pontuacao} pts</div>
                                </div>
                                <div className="text-right text-[11px] text-amber-700">
                                    <div>+2 pts por lig. atendida</div>
                                    <div>+1 pt por finalizado e chat</div>
                                    <div>-5 pts por lig. perdida</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                    <span className="text-gray-500 block mb-0.5 text-[10px] uppercase font-bold">Atendimentos Finalizados</span>
                                    <span className="text-lg font-bold text-emerald-600">{selectedWeekModal.finalizados}</span>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                    <span className="text-gray-500 block mb-0.5 text-[10px] uppercase font-bold">Chat Huggy</span>
                                    <span className="text-lg font-bold text-purple-600">{selectedWeekModal.huggyVol}</span>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                    <span className="text-gray-500 block mb-0.5 text-[10px] uppercase font-bold">Ligações Atendidas</span>
                                    <span className="text-lg font-bold text-blue-600">{selectedWeekModal.ligAtendidas}</span>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                                    <span className="text-gray-500 block mb-0.5 text-[10px] uppercase font-bold">Ligações Perdidas</span>
                                    <span className="text-lg font-bold text-red-600">{selectedWeekModal.ligPerdidas}</span>
                                </div>
                            </div>

                            <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2 text-xs">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Tempos Médios Registrados</span>
                                <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
                                    <span className="text-gray-600">TMA Telefonia (Voz):</span>
                                    <span className="font-mono font-bold text-blue-600">{formatTime(selectedWeekModal.tmaTel)}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
                                    <span className="text-gray-600">TMA Huggy (Chat):</span>
                                    <span className="font-mono font-bold text-purple-600">{formatTime(selectedWeekModal.tmaHuggy)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">TME Telefonia (Espera):</span>
                                    <span className="font-mono font-bold text-gray-700">{formatTime(selectedWeekModal.tme)}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
                            <button
                                type="button"
                                onClick={() => setSelectedWeekModal(null)}
                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Fechar Detalhes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportDashboardModal;

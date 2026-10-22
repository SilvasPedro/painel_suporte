import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Rocket, Target, TrendingUp, TrendingDown, RefreshCw, Save, Edit3, Trash2,
    Calendar, Loader2, Clock, Activity, CheckCircle2, AlertTriangle, ShieldCheck,
    Filter, Download, Plus, ChevronDown, ChevronUp, X, Sparkles, BarChart2,
    Layers, ArrowUpDown, Check
} from 'lucide-react';
import {
    AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeSharedCollection, subscribeSharedDocument } from '../services/dataCache';
import { useNotification } from '../context/NotificationContext';
import { timeToDecimal, formatTime, formatDateBR } from '../utils/timeCalculations';

// Formata data ISO para exibição amigável com dia da semana (ex: "16/10/2026 (Sex)")
const formatDateWithWeekday = (dateStr) => {
    if (!dateStr) return '--';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const y = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        const d = Number(parts[2]);
        const date = new Date(y, m, d);
        const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const dayFormatted = `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`;
        const weekday = weekdays[date.getDay()] || '';
        return `${dayFormatted} (${weekday})`;
    }
    return dateStr;
};

// Formata YYYY-MM-DD para DD/MM no eixo dos gráficos
const formatChartDate = (dateString) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateString;
};

// Parse seguro de data sem problemas de fuso horário
const parseDateObj = (dateStr) => {
    if (!dateStr) return 0;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
    }
    return new Date(dateStr).getTime() || 0;
};

// Tooltip customizado Glassmorphism para os gráficos
const CustomChartTooltip = ({ active, payload, label, unit = '%', metricLabel = '', goalVal = null, isInverse = false }) => {
    if (!active || !payload || !payload.length) return null;
    const data = payload[0];
    const val = data.value;
    const formattedVal = unit === 'time' ? formatTime(val) : `${val}${unit}`;
    
    let isGoalMet = null;
    if (goalVal !== null) {
        isGoalMet = isInverse ? val <= goalVal : val >= goalVal;
    }

    return (
        <div className="bg-zinc-950/95 backdrop-blur-md text-white border border-zinc-800 p-3 rounded-xl shadow-2xl min-w-[170px] text-xs">
            <div className="flex items-center gap-1.5 text-zinc-400 font-bold border-b border-zinc-800 pb-1.5 mb-2">
                <Calendar className="w-3.5 h-3.5 text-red-500" />
                <span>Semana: {label}</span>
            </div>
            <div className="space-y-1">
                <div className="flex justify-between items-center gap-3">
                    <span className="text-zinc-300 font-medium">{metricLabel || data.name}:</span>
                    <strong className="text-white text-sm font-black">{formattedVal}</strong>
                </div>
                {goalVal !== null && (
                    <div className="pt-1.5 border-t border-zinc-900 flex justify-between items-center text-[10px]">
                        <span className="text-zinc-500">
                            Meta: {isInverse ? '≤' : '≥'} {unit === 'time' ? formatTime(goalVal) : `${goalVal}${unit}`}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] ${
                            isGoalMet 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                            {isGoalMet ? 'Na Meta' : 'Fora da Meta'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

// Tooltip multi-série para o gráfico consolidado
const ConsolidatedTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    return (
        <div className="bg-zinc-950/95 backdrop-blur-md text-white border border-zinc-800 p-3.5 rounded-xl shadow-2xl min-w-[210px] text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-zinc-400 font-bold border-b border-zinc-800 pb-1.5">
                <Calendar className="w-3.5 h-3.5 text-red-500" />
                <span>Semana de Referência: {label}</span>
            </div>
            <div className="space-y-1.5">
                {payload.map((entry, index) => {
                    const isTmr = entry.dataKey === 'tmrDecimal';
                    const displayVal = isTmr ? formatTime(entry.value) : `${entry.value}%`;
                    return (
                        <div key={index} className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                                <span className="text-zinc-300">{entry.name}:</span>
                            </div>
                            <strong className="text-white font-bold">{displayVal}</strong>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const SectorKPIs = () => {
    const { showToast } = useNotification();
    const formRef = useRef(null);

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [deleteModalItem, setDeleteModalItem] = useState(null);

    // Controle de expansão do formulário
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);

    // Estado do formulário de lançamento
    const [kpiForm, setKpiForm] = useState({ date: '', tmr: '', fcr: '', recurrence: '' });

    // Configuração de metas setoriais (carregada do Firebase com fallback)
    const [goals, setGoals] = useState({
        tmr: '00:20:00',
        fcr: 80,
        recurrence: 20,
        qa: 85
    });

    // Filtros e Visualizações
    const getCurrentMonth = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    };
    const [filterPeriod, setFilterPeriod] = useState('all'); // 'all', '30days', '90days', 'year', 'month'
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
    const [sortAsc, setSortAsc] = useState(false); // false = mais recente primeiro
    const [chartViewMode, setChartViewMode] = useState('cards'); // 'cards' ou 'consolidated'

    // Dados reais do banco
    const [rawKpis, setRawKpis] = useState([]);

    // --- CARREGAMENTO DE DADOS VIA CACHE COMPARTILHADO ---
    useEffect(() => {
        // Listener de Metas Setoriais
        const unsubGoals = subscribeSharedDocument("system_settings", "sector_goals", (docData) => {
            if (docData) {
                setGoals(prev => ({
                    ...prev,
                    tmr: docData.tmr || '00:20:00',
                    fcr: docData.fcr !== undefined ? Number(docData.fcr) : 80,
                    recurrence: docData.recurrence !== undefined ? Number(docData.recurrence) : 20,
                    qa: docData.qa !== undefined ? Number(docData.qa) : 85
                }));
            }
        });

        // Listener da coleção de KPIs
        const unsubKpis = subscribeSharedCollection("sector_kpis", (items) => {
            const fetched = items.map((dbData) => ({
                id: dbData.id,
                fullDate: dbData.date || '',
                date: formatChartDate(dbData.date),
                tmr: dbData.tmr || '00:00:00',
                tmrDecimal: timeToDecimal(dbData.tmr),
                fcr: Number(dbData.fcr) || 0,
                reincidencia: Number(dbData.recurrence) || 0,
                createdAt: dbData.createdAt
            }));
            setRawKpis(fetched);
            setLoading(false);
        });

        return () => {
            unsubGoals();
            unsubKpis();
        };
    }, []);

    // Lista filtrada e ordenada para a tabela
    const filteredKpis = useMemo(() => {
        let list = [...rawKpis];
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        if (filterPeriod === '30days') {
            const cutoff = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
            list = list.filter(item => parseDateObj(item.fullDate) >= cutoff.getTime());
        } else if (filterPeriod === '90days') {
            const cutoff = new Date(today.getTime() - (90 * 24 * 60 * 60 * 1000));
            list = list.filter(item => parseDateObj(item.fullDate) >= cutoff.getTime());
        } else if (filterPeriod === 'year') {
            const curYear = String(today.getFullYear());
            list = list.filter(item => item.fullDate && item.fullDate.startsWith(curYear));
        } else if (filterPeriod === 'month') {
            if (selectedMonth) {
                list = list.filter(item => item.fullDate && item.fullDate.startsWith(selectedMonth));
            }
        }

        // Ordenação da tabela
        list.sort((a, b) => {
            const timeA = parseDateObj(a.fullDate);
            const timeB = parseDateObj(b.fullDate);
            return sortAsc ? timeA - timeB : timeB - timeA;
        });

        return list;
    }, [rawKpis, filterPeriod, selectedMonth, sortAsc]);

    // Dados cronológicos para os gráficos (sempre da esquerda para a direita: mais antigo -> mais novo)
    const chartDataChronological = useMemo(() => {
        return [...filteredKpis].sort((a, b) => {
            const timeA = parseDateObj(a.fullDate);
            const timeB = parseDateObj(b.fullDate);
            return timeA - timeB;
        });
    }, [filteredKpis]);

    // Lançamento mais recente do banco de dados (para Cockpit do Topo)
    const latestKpi = useMemo(() => {
        if (rawKpis.length === 0) return null;
        const sorted = [...rawKpis].sort((a, b) => parseDateObj(b.fullDate) - parseDateObj(a.fullDate));
        return sorted[0];
    }, [rawKpis]);

    // Penúltimo lançamento (para cálculo de variação/tendência)
    const prevKpi = useMemo(() => {
        if (rawKpis.length < 2) return null;
        const sorted = [...rawKpis].sort((a, b) => parseDateObj(b.fullDate) - parseDateObj(a.fullDate));
        return sorted[1];
    }, [rawKpis]);

    // Estatísticas agregadas do período filtrado
    const periodStats = useMemo(() => {
        if (filteredKpis.length === 0) {
            return {
                fcrAvg: 0, fcrMin: 0, fcrMax: 0,
                tmrAvgDec: 0, tmrAvgFormatted: '00:00:00',
                recAvg: 0, recMin: 0, recMax: 0,
                goalsMetLatest: 0
            };
        }

        const count = filteredKpis.length;
        const fcrVals = filteredKpis.map(k => k.fcr);
        const recVals = filteredKpis.map(k => k.reincidencia);
        const tmrVals = filteredKpis.map(k => k.tmrDecimal);

        const fcrAvg = (fcrVals.reduce((a, b) => a + b, 0) / count).toFixed(1);
        const recAvg = (recVals.reduce((a, b) => a + b, 0) / count).toFixed(1);
        const tmrAvgDec = tmrVals.reduce((a, b) => a + b, 0) / count;

        let goalsMetLatest = 0;
        if (latestKpi) {
            if (latestKpi.tmrDecimal <= timeToDecimal(goals.tmr)) goalsMetLatest++;
            if (latestKpi.fcr >= goals.fcr) goalsMetLatest++;
            if (latestKpi.reincidencia <= goals.recurrence) goalsMetLatest++;
        }

        return {
            fcrAvg: Number(fcrAvg),
            fcrMin: Math.min(...fcrVals),
            fcrMax: Math.max(...fcrVals),
            tmrAvgDec,
            tmrAvgFormatted: formatTime(tmrAvgDec),
            recAvg: Number(recAvg),
            recMin: Math.min(...recVals),
            recMax: Math.max(...recVals),
            goalsMetLatest
        };
    }, [filteredKpis, latestKpi, goals]);

    // Formata o input de TMR automaticamente para HH:MM:SS
    const handleTmrInputChange = (val) => {
        const clean = val.replace(/[^0-9:]/g, '');
        setKpiForm(prev => ({ ...prev, tmr: clean }));
    };

    // Preenche a data de hoje no formulário
    const handleSetToday = () => {
        const today = new Date().toISOString().split('T')[0];
        setKpiForm(prev => ({ ...prev, date: today }));
    };

    // Abre modo de edição para um registro existente
    const handleStartEdit = (kpi) => {
        setEditingId(kpi.id);
        setKpiForm({
            date: kpi.fullDate,
            tmr: kpi.tmr,
            fcr: String(kpi.fcr),
            recurrence: String(kpi.reincidencia)
        });
        setIsFormOpen(true);
        if (formRef.current) {
            formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    // Cancela a edição
    const handleCancelEdit = () => {
        setEditingId(null);
        setKpiForm({ date: '', tmr: '', fcr: '', recurrence: '' });
    };

    // Salva ou Atualiza lançamento de KPI
    const handleSaveKPI = async (e) => {
        e.preventDefault();

        // Validação de formato de tempo
        const tmrDec = timeToDecimal(kpiForm.tmr);
        if (tmrDec === 0 && kpiForm.tmr !== '00:00:00') {
            showToast("Informe um TMR válido no formato HH:MM:SS ou MM:SS.", "warning");
            return;
        }

        setSaving(true);
        try {
            const payload = {
                date: kpiForm.date,
                tmr: kpiForm.tmr,
                fcr: Number(kpiForm.fcr),
                recurrence: Number(kpiForm.recurrence)
            };

            if (editingId) {
                await updateDoc(doc(db, "sector_kpis", editingId), {
                    ...payload,
                    updatedAt: new Date()
                });
                showToast("Lançamento de KPI atualizado com sucesso!", "success");
            } else {
                await addDoc(collection(db, "sector_kpis"), {
                    ...payload,
                    createdAt: new Date()
                });
                showToast("Novo lançamento de KPI registrado com sucesso!", "success");
            }

            handleCancelEdit();
            setIsFormOpen(false);
        } catch (error) {
            console.error(error);
            showToast("Erro ao salvar lançamento de KPI.", "error");
        } finally {
            setSaving(false);
        }
    };

    // Executa a exclusão de um registro
    const handleConfirmDelete = async () => {
        if (!deleteModalItem) return;
        setDeletingId(deleteModalItem.id);
        try {
            await deleteDoc(doc(db, "sector_kpis", deleteModalItem.id));
            showToast("Lançamento de KPI removido com sucesso.", "success");
            setDeleteModalItem(null);
            if (editingId === deleteModalItem.id) {
                handleCancelEdit();
            }
        } catch (error) {
            console.error(error);
            showToast("Erro ao excluir lançamento.", "error");
        } finally {
            setDeletingId(null);
        }
    };

    // Exportação dos dados filtrados para arquivo CSV
    const handleExportCSV = () => {
        if (!filteredKpis.length) {
            showToast("Nenhum registro no período para exportar.", "warning");
            return;
        }
        const headers = ["Data", "TMR (HH:MM:SS)", "TMR (Minutos Decimais)", "FCR (%)", "Reincidencia (%)", "Conformidade"];
        const rows = filteredKpis.map(item => {
            const tmrOk = item.tmrDecimal <= timeToDecimal(goals.tmr);
            const fcrOk = item.fcr >= goals.fcr;
            const recOk = item.reincidencia <= goals.recurrence;
            const countOk = [tmrOk, fcrOk, recOk].filter(Boolean).length;
            return [
                item.fullDate,
                item.tmr,
                item.tmrDecimal.toFixed(2),
                item.fcr.toFixed(1),
                item.reincidencia.toFixed(1),
                `${countOk}/3 Metas`
            ];
        });
        const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `kpis_setor_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast("Arquivo CSV gerado e baixado com sucesso!", "success");
    };

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 800);
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 h-full gap-3">
                <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    Sincronizando Gestão de KPIs do Setor...
                </span>
            </div>
        );
    }

    // Variáveis auxiliares de conformidade do último registro
    const isLatestTmrOk = latestKpi ? latestKpi.tmrDecimal <= timeToDecimal(goals.tmr) : true;
    const isLatestFcrOk = latestKpi ? latestKpi.fcr >= goals.fcr : true;
    const isLatestRecOk = latestKpi ? latestKpi.reincidencia <= goals.recurrence : true;

    return (
        <div className="flex-1 p-6 bg-gray-50 h-full overflow-y-auto space-y-6">
            
            {/* ========================================================================= */}
            {/* CABEÇALHO PRINCIPAL COM IDENTIDADE HUBDESK                                 */}
            {/* ========================================================================= */}
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-red-50 text-red-600 rounded-xl border border-red-200 shrink-0">
                        <Rocket className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                                Gestão Estratégica de KPIs do Setor
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-red-600" /> Metas Globais & SLAs
                            </span>
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">
                            Lançamentos semanais, acompanhamento histórico e conformidade em tempo real.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 w-full xl:w-auto flex-wrap">
                    <button
                        type="button"
                        onClick={() => {
                            if (isFormOpen && editingId) {
                                handleCancelEdit();
                            } else {
                                setIsFormOpen(!isFormOpen);
                            }
                        }}
                        className={`flex-1 xl:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-2xs cursor-pointer ${
                            isFormOpen
                                ? 'bg-zinc-800 text-white hover:bg-zinc-900'
                                : 'bg-red-600 text-white hover:bg-red-700'
                        }`}
                    >
                        {isFormOpen ? (
                            <>
                                <ChevronUp className="w-4 h-4" />
                                <span>Recolher Formulário</span>
                            </>
                        ) : (
                            <>
                                <Plus className="w-4 h-4" />
                                <span>Novo Lançamento</span>
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={handleExportCSV}
                        className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-bold text-xs transition-colors shadow-2xs cursor-pointer"
                        title="Exportar dados filtrados em formato CSV"
                    >
                        <Download className="w-4 h-4 text-gray-600" />
                        <span className="hidden sm:inline">Exportar CSV</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleRefresh}
                        className="p-2.5 bg-zinc-950 text-white rounded-xl hover:bg-zinc-900 transition-colors shadow-2xs cursor-pointer"
                        title="Atualizar dados em tela"
                    >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </header>

            {/* ========================================================================= */}
            {/* COCKPIT DE CARDS EXECUTIVOS NO TOPO (COR SÓLIDA E ÍCONES NO CANTO DIREITO) */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. TMR SETOR */}
                <div className="bg-zinc-950 text-white p-5 rounded-2xl border border-zinc-800 shadow-sm flex flex-col justify-between hover:border-purple-500/50 transition-all group">
                    <div>
                        <div className="flex items-start justify-between mb-3">
                            <div className="space-y-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400 block">
                                    TMR Setor
                                </span>
                                <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                                    isLatestTmrOk
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                        : 'bg-red-500/20 text-red-300 border-red-500/30'
                                }`}>
                                    {isLatestTmrOk ? 'Dentro da Meta' : 'Acima da Meta'}
                                </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/25 shrink-0">
                                <Clock className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-1">
                            <h3 className="text-3xl font-black text-white tracking-tight">
                                {latestKpi ? latestKpi.tmr : '00:00:00'}
                            </h3>
                            <p className="text-xs text-zinc-400 mt-1">
                                Tempo Médio de Resposta da operação
                            </p>
                        </div>
                    </div>
                    <div className="pt-3 mt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                        <span>Meta: <strong className="text-purple-300 font-bold">≤ {goals.tmr}</strong></span>
                        {prevKpi && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                                latestKpi.tmrDecimal <= prevKpi.tmrDecimal ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                                {latestKpi.tmrDecimal <= prevKpi.tmrDecimal ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                {Math.abs(latestKpi.tmrDecimal - prevKpi.tmrDecimal).toFixed(1)}m vs anterior
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. FCR (1º CONTATO) */}
                <div className="bg-zinc-950 text-white p-5 rounded-2xl border border-zinc-800 shadow-sm flex flex-col justify-between hover:border-emerald-500/50 transition-all group">
                    <div>
                        <div className="flex items-start justify-between mb-3">
                            <div className="space-y-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 block">
                                    FCR (1º Contato)
                                </span>
                                <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                                    isLatestFcrOk
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                }`}>
                                    {isLatestFcrOk ? 'Dentro da Meta' : 'Abaixo da Meta'}
                                </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 shrink-0">
                                <Target className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-1">
                            <h3 className="text-3xl font-black text-emerald-400 tracking-tight">
                                {latestKpi ? `${latestKpi.fcr}%` : '0.0%'}
                            </h3>
                            <p className="text-xs text-zinc-400 mt-1">
                                Resolução no primeiro contato
                            </p>
                        </div>
                    </div>
                    <div className="pt-3 mt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                        <span>Meta: <strong className="text-emerald-300 font-bold">≥ {goals.fcr}%</strong></span>
                        {prevKpi && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                                latestKpi.fcr >= prevKpi.fcr ? 'text-emerald-400' : 'text-amber-400'
                            }`}>
                                {latestKpi.fcr >= prevKpi.fcr ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {(latestKpi.fcr - prevKpi.fcr) > 0 ? `+${(latestKpi.fcr - prevKpi.fcr).toFixed(1)}%` : `${(latestKpi.fcr - prevKpi.fcr).toFixed(1)}%`}
                            </span>
                        )}
                    </div>
                </div>

                {/* 3. TAXA DE REINCIDÊNCIA */}
                <div className="bg-zinc-950 text-white p-5 rounded-2xl border border-zinc-800 shadow-sm flex flex-col justify-between hover:border-blue-500/50 transition-all group">
                    <div>
                        <div className="flex items-start justify-between mb-3">
                            <div className="space-y-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 block">
                                    Reincidência
                                </span>
                                <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                                    isLatestRecOk
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                        : 'bg-red-500/20 text-red-300 border-red-500/30'
                                }`}>
                                    {isLatestRecOk ? 'Dentro da Meta' : 'Acima da Meta'}
                                </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/25 shrink-0">
                                <Activity className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-1">
                            <h3 className="text-3xl font-black text-white tracking-tight">
                                {latestKpi ? `${latestKpi.reincidencia}%` : '0.0%'}
                            </h3>
                            <p className="text-xs text-zinc-400 mt-1">
                                Taxa de retorno de chamados
                            </p>
                        </div>
                    </div>
                    <div className="pt-3 mt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                        <span>Meta: <strong className="text-blue-300 font-bold">≤ {goals.recurrence}%</strong></span>
                        {prevKpi && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                                latestKpi.reincidencia <= prevKpi.reincidencia ? 'text-emerald-400' : 'text-red-400'
                            }`}>
                                {latestKpi.reincidencia <= prevKpi.reincidencia ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                {(latestKpi.reincidencia - prevKpi.reincidencia) > 0 ? `+${(latestKpi.reincidencia - prevKpi.reincidencia).toFixed(1)}%` : `${(latestKpi.reincidencia - prevKpi.reincidencia).toFixed(1)}%`}
                            </span>
                        )}
                    </div>
                </div>

                {/* 4. CONFORMIDADE GERAL DE METAS */}
                <div className="bg-zinc-950 text-white p-5 rounded-2xl border border-zinc-800 shadow-sm flex flex-col justify-between hover:border-red-500/50 transition-all group">
                    <div>
                        <div className="flex items-start justify-between mb-3">
                            <div className="space-y-1">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 block">
                                    Metas Atingidas
                                </span>
                                <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                                    periodStats.goalsMetLatest === 3
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                        : periodStats.goalsMetLatest === 2
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                        : 'bg-red-500/20 text-red-300 border-red-500/30'
                                }`}>
                                    {periodStats.goalsMetLatest === 3 ? '100% Eficiência' : `${Math.round((periodStats.goalsMetLatest / 3) * 100)}% de Metas`}
                                </span>
                            </div>
                            <div className="p-2.5 rounded-xl bg-red-500/15 text-red-400 border border-red-500/25 shrink-0">
                                <ShieldCheck className="w-5 h-5" />
                            </div>
                        </div>
                        <div className="mt-1">
                            <h3 className="text-3xl font-black text-white tracking-tight">
                                {periodStats.goalsMetLatest} <span className="text-xl font-normal text-zinc-500">/ 3</span>
                            </h3>
                            <p className="text-xs text-zinc-400 mt-1">
                                Indicadores dentro do SLA no último registro
                            </p>
                        </div>
                    </div>
                    <div className="pt-3 mt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                        <span>Última Referência:</span>
                        <strong className="text-zinc-200 font-bold">
                            {latestKpi ? formatDateBR(latestKpi.fullDate) : '--'}
                        </strong>
                    </div>
                </div>

            </div>

            {/* ========================================================================= */}
            {/* FORMULÁRIO COLAPSÁVEL DE LANÇAMENTO / EDIÇÃO                              */}
            {/* ========================================================================= */}
            {isFormOpen && (
                <div 
                    ref={formRef}
                    className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition-all duration-300 ease-in-out animate-in slide-in-from-top-4"
                >
                    <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className={`p-2 rounded-xl border ${
                                editingId 
                                    ? 'bg-amber-50 text-amber-600 border-amber-200' 
                                    : 'bg-red-50 text-red-600 border-red-200'
                            }`}>
                                {editingId ? <Edit3 className="w-5 h-5" /> : <Rocket className="w-5 h-5" />}
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-gray-900">
                                    {editingId ? 'Editando Lançamento de KPI' : 'Novo Lançamento Semanal de KPIs'}
                                </h2>
                                <p className="text-xs text-gray-500">
                                    {editingId 
                                        ? 'Atualize os valores e confirme as alterações no banco.' 
                                        : 'Registre os indicadores consolidados da semana de atendimento.'}
                                </p>
                            </div>
                        </div>

                        {editingId && (
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="text-xs font-bold text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                            >
                                Cancelar Edição
                            </button>
                        )}
                    </div>

                    <form onSubmit={handleSaveKPI} className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            
                            {/* Data de Referência */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                        Semana Referência *
                                    </label>
                                    <button 
                                        type="button" 
                                        onClick={handleSetToday}
                                        className="text-[10px] font-bold text-red-600 hover:text-red-700 hover:underline"
                                    >
                                        Hoje
                                    </button>
                                </div>
                                <input
                                    type="date"
                                    required
                                    value={kpiForm.date}
                                    onChange={(e) => setKpiForm({ ...kpiForm, date: e.target.value })}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:bg-white focus:ring-2 focus:ring-red-600 focus:border-transparent outline-none transition-all"
                                />
                                <span className="text-[10px] text-gray-400 block mt-1">Data final do fechamento semanal</span>
                            </div>

                            {/* TMR */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                        TMR Setorial *
                                    </label>
                                    <span className="text-[10px] font-mono text-purple-600 font-bold">Meta: ≤ {goals.tmr}</span>
                                </div>
                                <input
                                    type="text"
                                    required
                                    placeholder="00:20:00"
                                    value={kpiForm.tmr}
                                    onChange={(e) => handleTmrInputChange(e.target.value)}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:bg-white focus:ring-2 focus:ring-purple-600 focus:border-transparent outline-none transition-all"
                                />
                                <div className="flex justify-between items-center mt-1 text-[10px]">
                                    <span className="text-gray-400">Formato: HH:MM:SS</span>
                                    {kpiForm.tmr && (
                                        <span className={`font-bold ${
                                            timeToDecimal(kpiForm.tmr) <= timeToDecimal(goals.tmr)
                                                ? 'text-emerald-600'
                                                : 'text-red-500'
                                        }`}>
                                            {timeToDecimal(kpiForm.tmr) <= timeToDecimal(goals.tmr) ? 'Na meta' : 'Acima da meta'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* FCR */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                        FCR (%) *
                                    </label>
                                    <span className="text-[10px] font-mono text-emerald-600 font-bold">Meta: ≥ {goals.fcr}%</span>
                                </div>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    required
                                    placeholder="85.0"
                                    value={kpiForm.fcr}
                                    onChange={(e) => setKpiForm({ ...kpiForm, fcr: e.target.value })}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:bg-white focus:ring-2 focus:ring-emerald-600 focus:border-transparent outline-none transition-all"
                                />
                                <div className="flex justify-between items-center mt-1 text-[10px]">
                                    <span className="text-gray-400">Primeiro contato</span>
                                    {kpiForm.fcr !== '' && (
                                        <span className={`font-bold ${
                                            Number(kpiForm.fcr) >= goals.fcr ? 'text-emerald-600' : 'text-amber-500'
                                        }`}>
                                            {Number(kpiForm.fcr) >= goals.fcr ? 'Na meta' : 'Abaixo da meta'}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Reincidência */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                        Reincidência (%) *
                                    </label>
                                    <span className="text-[10px] font-mono text-blue-600 font-bold">Meta: ≤ {goals.recurrence}%</span>
                                </div>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    required
                                    placeholder="18.5"
                                    value={kpiForm.recurrence}
                                    onChange={(e) => setKpiForm({ ...kpiForm, recurrence: e.target.value })}
                                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-800 focus:bg-white focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all"
                                />
                                <div className="flex justify-between items-center mt-1 text-[10px]">
                                    <span className="text-gray-400">Retorno de chamados</span>
                                    {kpiForm.recurrence !== '' && (
                                        <span className={`font-bold ${
                                            Number(kpiForm.recurrence) <= goals.recurrence ? 'text-emerald-600' : 'text-red-500'
                                        }`}>
                                            {Number(kpiForm.recurrence) <= goals.recurrence ? 'Na meta' : 'Acima da meta'}
                                        </span>
                                    )}
                                </div>
                            </div>

                        </div>

                        <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                            <button
                                type="button"
                                onClick={() => {
                                    handleCancelEdit();
                                    setIsFormOpen(false);
                                }}
                                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-bold text-xs transition-colors"
                            >
                                Fechar
                            </button>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2.5 bg-zinc-950 hover:bg-black text-white font-bold text-xs rounded-xl shadow-2xs flex items-center gap-2 transition-all disabled:opacity-70 cursor-pointer"
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : editingId ? (
                                    <Check className="w-4 h-4 text-emerald-400" />
                                ) : (
                                    <Save className="w-4 h-4 text-red-500" />
                                )}
                                <span>{editingId ? 'Atualizar Registro' : 'Salvar Lançamento'}</span>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ========================================================================= */}
            {/* BARRA DE FILTROS OTIMIZADA & SELETOR DE VISUALIZAÇÃO                       */}
            {/* ========================================================================= */}
            <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                
                {/* Pílulas de Seleção Rápida de Período */}
                <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mr-2">
                        <Filter className="w-3.5 h-3.5 text-gray-400" /> Período:
                    </span>
                    <button
                        type="button"
                        onClick={() => setFilterPeriod('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            filterPeriod === 'all'
                                ? 'bg-zinc-950 text-white shadow-2xs'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Todo Histórico
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterPeriod('90days')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            filterPeriod === '90days'
                                ? 'bg-zinc-950 text-white shadow-2xs'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Últimos 90 Dias
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterPeriod('30days')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            filterPeriod === '30days'
                                ? 'bg-zinc-950 text-white shadow-2xs'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Últimos 30 Dias
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterPeriod('year')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            filterPeriod === 'year'
                                ? 'bg-zinc-950 text-white shadow-2xs'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Ano Vigente
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterPeriod('month')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            filterPeriod === 'month'
                                ? 'bg-zinc-950 text-white shadow-2xs'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Por Mês
                    </button>
                </div>

                {/* Seletores Auxiliares (Mês específico e Modo de Gráficos) */}
                <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
                    {filterPeriod === 'month' && (
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-2.5 py-1.5 rounded-xl">
                            <Calendar className="w-3.5 h-3.5 text-gray-500" />
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="bg-transparent text-xs font-bold text-gray-800 outline-none"
                            />
                        </div>
                    )}

                    {/* Alternador de Modo de Gráficos */}
                    <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 shrink-0">
                        <button
                            type="button"
                            onClick={() => setChartViewMode('cards')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                chartViewMode === 'cards'
                                    ? 'bg-white text-gray-900 shadow-2xs'
                                    : 'text-gray-500 hover:text-gray-900'
                            }`}
                            title="Visualizar em 3 cards individuais"
                        >
                            <BarChart2 className="w-3.5 h-3.5 text-red-600" />
                            <span>Cards Individuais</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setChartViewMode('consolidated')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                chartViewMode === 'consolidated'
                                    ? 'bg-white text-gray-900 shadow-2xs'
                                    : 'text-gray-500 hover:text-gray-900'
                            }`}
                            title="Visualizar em gráfico consolidado comparativo"
                        >
                            <Layers className="w-3.5 h-3.5 text-blue-600" />
                            <span>Consolidado</span>
                        </button>
                    </div>
                </div>

            </div>

            {/* ========================================================================= */}
            {/* SEÇÃO DE GRÁFICOS DINÂMICOS                                               */}
            {/* ========================================================================= */}
            {filteredKpis.length === 0 ? (
                <div className="bg-white p-12 rounded-2xl border border-dashed border-gray-300 text-center flex flex-col items-center justify-center gap-3">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-gray-400">
                        <AlertTriangle className="w-8 h-8 text-amber-500" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-gray-800">
                            Nenhum Lançamento Encontrado
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 max-w-sm">
                            Não encontramos registros de KPIs para o filtro selecionado. Tente alterar o período ou crie um novo lançamento semanal.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            setFilterPeriod('all');
                            setIsFormOpen(true);
                        }}
                        className="mt-2 px-4 py-2 bg-zinc-950 text-white rounded-xl text-xs font-bold hover:bg-black transition-colors"
                    >
                        Criar Novo Lançamento
                    </button>
                </div>
            ) : chartViewMode === 'cards' ? (
                /* VISÃO DE 3 CARDS INDIVIDUAIS COM ESTATÍSTICAS E LINHA DE META */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Gráfico 1: FCR */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col justify-between hover:border-emerald-300 transition-all">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <Target className="w-4 h-4 text-emerald-500" /> First Call Resolution (FCR)
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                                    Média: {periodStats.fcrAvg}%
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-3">
                                <span>Mín: <strong className="text-gray-700">{periodStats.fcrMin}%</strong></span>
                                <span>•</span>
                                <span>Máx: <strong className="text-gray-700">{periodStats.fcrMax}%</strong></span>
                                <span>•</span>
                                <span>Meta: <strong className="text-emerald-600">≥ {goals.fcr}%</strong></span>
                            </div>
                        </div>

                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartDataChronological} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorFcrGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={6} />
                                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <Tooltip content={<CustomChartTooltip unit="%" metricLabel="FCR" goalVal={goals.fcr} isInverse={false} />} />
                                    <ReferenceLine 
                                        y={goals.fcr} 
                                        stroke="#10b981" 
                                        strokeDasharray="4 4" 
                                        label={{ value: `Meta: ${goals.fcr}%`, fill: '#10b981', fontSize: 10, position: 'insideTopRight' }} 
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="fcr" 
                                        name="FCR" 
                                        stroke="#10b981" 
                                        strokeWidth={2.5} 
                                        fillOpacity={1} 
                                        fill="url(#colorFcrGrad)" 
                                        activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} 
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Gráfico 2: TMR */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col justify-between hover:border-purple-300 transition-all">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-purple-500" /> Tempo Médio de Resposta (TMR)
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 font-bold border border-purple-100">
                                    Média: {periodStats.tmrAvgFormatted}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-3">
                                <span>Meta: <strong className="text-purple-600">≤ {goals.tmr}</strong></span>
                                <span>•</span>
                                <span>Em minutos decimais</span>
                            </div>
                        </div>

                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartDataChronological} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorTmrGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35}/>
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={6} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <Tooltip content={<CustomChartTooltip unit="time" metricLabel="TMR" goalVal={timeToDecimal(goals.tmr)} isInverse={true} />} />
                                    <ReferenceLine 
                                        y={timeToDecimal(goals.tmr)} 
                                        stroke="#8b5cf6" 
                                        strokeDasharray="4 4" 
                                        label={{ value: `Meta: ${goals.tmr}`, fill: '#8b5cf6', fontSize: 10, position: 'insideTopRight' }} 
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="tmrDecimal" 
                                        name="TMR" 
                                        stroke="#8b5cf6" 
                                        strokeWidth={2.5} 
                                        fillOpacity={1} 
                                        fill="url(#colorTmrGrad)" 
                                        activeDot={{ r: 6, fill: '#8b5cf6', stroke: '#fff', strokeWidth: 2 }} 
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Gráfico 3: REINCIDÊNCIA */}
                    <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col justify-between hover:border-blue-300 transition-all">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <Activity className="w-4 h-4 text-blue-500" /> Taxa de Reincidência
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-100">
                                    Média: {periodStats.recAvg}%
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-3">
                                <span>Mín: <strong className="text-gray-700">{periodStats.recMin}%</strong></span>
                                <span>•</span>
                                <span>Máx: <strong className="text-gray-700">{periodStats.recMax}%</strong></span>
                                <span>•</span>
                                <span>Meta: <strong className="text-blue-600">≤ {goals.recurrence}%</strong></span>
                            </div>
                        </div>

                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartDataChronological} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorRecGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35}/>
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={6} />
                                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                                    <Tooltip content={<CustomChartTooltip unit="%" metricLabel="Reincidência" goalVal={goals.recurrence} isInverse={true} />} />
                                    <ReferenceLine 
                                        y={goals.recurrence} 
                                        stroke="#3b82f6" 
                                        strokeDasharray="4 4" 
                                        label={{ value: `Meta: ${goals.recurrence}%`, fill: '#3b82f6', fontSize: 10, position: 'insideTopRight' }} 
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="reincidencia" 
                                        name="Reincidência" 
                                        stroke="#3b82f6" 
                                        strokeWidth={2.5} 
                                        fillOpacity={1} 
                                        fill="url(#colorRecGrad)" 
                                        activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} 
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                </div>
            ) : (
                /* VISÃO CONSOLIDADA COMPARATIVA MULTI-SÉRIE */
                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-2xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                        <div>
                            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                                <Layers className="w-5 h-5 text-blue-600" /> Evolução Consolidada dos Indicadores
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Cruzamento temporal entre FCR (Resolução), Reincidência e TMR em linha do tempo.
                            </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs font-bold">
                            <span className="flex items-center gap-1.5 text-emerald-600">
                                <span className="w-3 h-3 rounded-full bg-emerald-500" /> FCR (%)
                            </span>
                            <span className="flex items-center gap-1.5 text-blue-600">
                                <span className="w-3 h-3 rounded-full bg-blue-500" /> Reincidência (%)
                            </span>
                            <span className="flex items-center gap-1.5 text-purple-600">
                                <span className="w-3 h-3 rounded-full bg-purple-500" /> TMR (Minutos)
                            </span>
                        </div>
                    </div>

                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartDataChronological} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
                                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                                <Tooltip content={<ConsolidatedTooltip goals={goals} />} />
                                <ReferenceLine 
                                    y={goals.fcr} 
                                    stroke="#10b981" 
                                    strokeDasharray="3 3" 
                                    label={{ value: `Meta FCR: ${goals.fcr}%`, fill: '#10b981', fontSize: 10, position: 'insideTopLeft' }} 
                                />
                                <ReferenceLine 
                                    y={goals.recurrence} 
                                    stroke="#3b82f6" 
                                    strokeDasharray="3 3" 
                                    label={{ value: `Meta Reinc.: ${goals.recurrence}%`, fill: '#3b82f6', fontSize: 10, position: 'insideBottomLeft' }} 
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="fcr" 
                                    name="FCR" 
                                    stroke="#10b981" 
                                    strokeWidth={3} 
                                    dot={{ r: 4, fill: '#10b981' }} 
                                    activeDot={{ r: 7 }} 
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="reincidencia" 
                                    name="Reincidência" 
                                    stroke="#3b82f6" 
                                    strokeWidth={3} 
                                    dot={{ r: 4, fill: '#3b82f6' }} 
                                    activeDot={{ r: 7 }} 
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="tmrDecimal" 
                                    name="TMR (Minutos)" 
                                    stroke="#8b5cf6" 
                                    strokeWidth={2.5} 
                                    strokeDasharray="5 5" 
                                    dot={{ r: 3, fill: '#8b5cf6' }} 
                                    activeDot={{ r: 6 }} 
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TABELA DE GESTÃO DE HISTÓRICO & AÇÕES CRUD                                */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
                
                <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-gray-50 rounded-xl border border-gray-200 text-gray-600">
                            <Clock className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-gray-900">
                                Histórico Detalhado de Fechamentos
                            </h3>
                            <p className="text-xs text-gray-500">
                                Mostrando {filteredKpis.length} registros cadastrados no período.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setSortAsc(!sortAsc)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-bold text-gray-600 transition-colors"
                        title="Inverter ordem de exibição das datas"
                    >
                        <ArrowUpDown className="w-3.5 h-3.5 text-gray-500" />
                        <span>{sortAsc ? 'Mais antigos primeiro' : 'Mais recentes primeiro'}</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                <th className="py-3 px-4">Semana Referência</th>
                                <th className="py-3 px-4">TMR Setorial</th>
                                <th className="py-3 px-4">FCR (%)</th>
                                <th className="py-3 px-4">Reincidência (%)</th>
                                <th className="py-3 px-4">Conformidade Metas</th>
                                <th className="py-3 px-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-xs">
                            {filteredKpis.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="py-8 text-center text-gray-400">
                                        Nenhum registro para exibir nesta listagem.
                                    </td>
                                </tr>
                            ) : (
                                filteredKpis.map((kpi, idx) => {
                                    const tmrOk = kpi.tmrDecimal <= timeToDecimal(goals.tmr);
                                    const fcrOk = kpi.fcr >= goals.fcr;
                                    const recOk = kpi.reincidencia <= goals.recurrence;
                                    const metasBatidas = [tmrOk, fcrOk, recOk].filter(Boolean).length;
                                    const isLatestRow = idx === 0 && !sortAsc;

                                    return (
                                        <tr 
                                            key={kpi.id} 
                                            className={`hover:bg-gray-50/70 transition-colors ${
                                                editingId === kpi.id ? 'bg-amber-50/50' : ''
                                            }`}
                                        >
                                            {/* Data de Referência */}
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-gray-900">
                                                        {formatDateWithWeekday(kpi.fullDate)}
                                                    </span>
                                                    {isLatestRow && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 border border-red-200">
                                                            Último
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* TMR */}
                                            <td className="py-3.5 px-4 font-mono">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-gray-800">{kpi.tmr}</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${
                                                        tmrOk 
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                            : 'bg-red-50 text-red-700 border-red-200'
                                                    }`}>
                                                        {tmrOk ? 'Meta OK' : 'Acima'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* FCR */}
                                            <td className="py-3.5 px-4 font-mono">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-gray-800">{kpi.fcr}%</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${
                                                        fcrOk 
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}>
                                                        {fcrOk ? 'Meta OK' : 'Abaixo'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Reincidência */}
                                            <td className="py-3.5 px-4 font-mono">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-gray-800">{kpi.reincidencia}%</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${
                                                        recOk 
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                            : 'bg-red-50 text-red-700 border-red-200'
                                                    }`}>
                                                        {recOk ? 'Meta OK' : 'Acima'}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Conformidade */}
                                            <td className="py-3.5 px-4">
                                                <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                                                    metasBatidas === 3
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : metasBatidas === 2
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                                }`}>
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    {metasBatidas} de 3 Metas Batidas
                                                </span>
                                            </td>

                                            {/* Ações */}
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleStartEdit(kpi)}
                                                        className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Editar este lançamento"
                                                    >
                                                        <Edit3 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeleteModalItem(kpi)}
                                                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                        title="Excluir este lançamento"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

            </div>

            {/* ========================================================================= */}
            {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE LANÇAMENTO                            */}
            {/* ========================================================================= */}
            {deleteModalItem && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
                    onClick={() => !deletingId && setDeleteModalItem(null)}
                >
                    <div 
                        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-black text-gray-900">
                                    Excluir Lançamento de KPI?
                                </h3>
                                <p className="text-xs text-gray-500">
                                    Semana: {formatDateWithWeekday(deleteModalItem.fullDate)}
                                </p>
                            </div>
                        </div>

                        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                            Tem certeza de que deseja remover este lançamento? Os dados de TMR (<strong className="text-gray-900">{deleteModalItem.tmr}</strong>), FCR (<strong className="text-gray-900">{deleteModalItem.fcr}%</strong>) e Reincidência (<strong className="text-gray-900">{deleteModalItem.reincidencia}%</strong>) serão excluídos permanentemente do histórico do setor.
                        </p>

                        <div className="flex justify-end gap-3">
                            <button
                                type="button"
                                disabled={Boolean(deletingId)}
                                onClick={() => setDeleteModalItem(null)}
                                className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-bold text-xs hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={Boolean(deletingId)}
                                onClick={handleConfirmDelete}
                                className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition-colors flex items-center gap-2 shadow-2xs"
                            >
                                {deletingId ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Excluindo...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        <span>Sim, Excluir</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default SectorKPIs;

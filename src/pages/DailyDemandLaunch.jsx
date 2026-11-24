import React, { useState, useEffect, useMemo, useDeferredValue } from 'react';
import ExcelIcon from '../components/common/ExcelIcon';
import { db } from '../services/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { subscribeSharedCollection } from '../services/dataCache';
import { 
    Save, Calendar, MessageSquare, Ticket, Clock, 
    Activity, AlertCircle, Plus, FileText, Edit2, Trash2, X, Filter,
    Download, TrendingDown, TrendingUp, Minus, Search, 
    CheckCircle2, ArrowUpDown, BarChart2,
    ChevronDown, Check
} from 'lucide-react';
import { 
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, AreaChart, Area
} from 'recharts';
import DailyDemandModal from '../components/DailyDemandModal';
import KpiHeroCard from '../components/dashboard/KpiHeroCard';

// Dias da semana auxiliares
const DAYS_OF_WEEK = [
    { id: 'all', label: 'Todos os Dias' },
    { id: '1', label: 'Segunda-feira', short: 'Seg' },
    { id: '2', label: 'Terça-feira', short: 'Ter' },
    { id: '3', label: 'Quarta-feira', short: 'Qua' },
    { id: '4', label: 'Quinta-feira', short: 'Qui' },
    { id: '5', label: 'Sexta-feira', short: 'Sex' },
    { id: '6', label: 'Sábado', short: 'Sáb' },
    { id: '0', label: 'Domingo', short: 'Dom' },
];

const PRESETS = [
    { id: 'current_month', label: 'Mês Atual' },
    { id: 'last_7', label: 'Últimos 7 Dias' },
    { id: 'last_15', label: 'Últimos 15 Dias' },
    { id: 'last_30', label: 'Últimos 30 Dias' },
    { id: 'previous_month', label: 'Mês Anterior' },
    { id: 'last_3_months', label: 'Últimos 3 Meses' },
    { id: 'year', label: 'Ano Atual' },
    { id: 'custom', label: 'Personalizado' },
    { id: 'all', label: 'Todo o Histórico' },
];

// Períodos de acesso rápido (os demais ficam no seletor "Mais períodos")
const QUICK_PRESETS = ['current_month', 'last_7', 'last_30', 'previous_month'];

const COLORS = {
    chamadosInicio: '#10b981', // Verde esmeralda
    chamadosFim: '#047857',    // Verde escuro
    chatsInicio: '#8b5cf6',    // Roxo vibrante
    chatsFim: '#4f46e5',       // Indigo escuro
    saldoPositivo: '#ef4444',  // Fila acumulou (vermelho)
    saldoNegativo: '#10b981',  // Fila diminuiu (verde favorável)
    saldoNeutro: '#71717a'     // Neutro (zinco)
};

// Helper para converter data YYYY-MM-DD em objeto Date local seguro (sem distorção de fuso horário UTC)
const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
};

// Data local (YYYY-MM-DD): toISOString() usa UTC e, após 21h no Brasil, devolveria o dia seguinte
const toLocalISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayLocalISO = () => toLocalISO(new Date());

// Helper para formatar data (DD/MM/YYYY)
const formatDisplayDate = (dateStr) => {
    if (!dateStr) return '--';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
};

// Helper para dia da semana curto
const getWeekdayShort = (dateStr) => {
    const d = parseLocalDate(dateStr);
    if (!d) return '';
    const dayIdx = d.getDay();
    return DAYS_OF_WEEK.find(w => w.id === String(dayIdx))?.short || '';
};

export default function DailyDemandLaunch() {
    // Modal de lançamento/edição: { date } quando aberto, null quando fechado
    const [modal, setModal] = useState(null);

    // Modal de Confirmação de Exclusão
    const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Data State
    const [historicalData, setHistoricalData] = useState([]);

    // Estados de Filtro
    const [periodPreset, setPeriodPreset] = useState('current_month');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [channelFilter, setChannelFilter] = useState('all'); // all | tickets | chats
    const [trendFilter, setTrendFilter] = useState('all'); // all | reduced | increased | stable
    const [dayOfWeekFilter, setDayOfWeekFilter] = useState('all'); // all | 0..6
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearch = useDeferredValue(searchQuery);
    const [sortBy, setSortBy] = useState('date_desc'); // date_desc | date_asc | tickets_desc | chats_desc | delta_asc | delta_desc

    // Modo de Visualização (Padrão: Gráficos)
    const [viewMode, setViewMode] = useState('charts'); // charts | table | all

    useEffect(() => {
        const unsubscribe = subscribeSharedCollection('dailyDemand', (items) => {
            const data = [...items];
            data.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            setHistoricalData(data);
        });

        return () => unsubscribe();
    }, []);

    // Abertura do modal (o formulário e seu estado vivem em DailyDemandModal)
    const handleOpenCreate = () => {
        const today = historicalData.find(d => d.date === todayLocalISO());
        const hasStart = today && (today.startTickets != null || today.startChats != null);
        const hasEnd = today && (today.endTickets != null || today.endChats != null);
        setModal({ date: todayLocalISO(), focus: hasStart && !hasEnd ? 'endTickets' : 'startTickets' });
    };
    const handleOpenEdit = (dataRecord) => setModal({ date: dataRecord.date });

    const confirmDelete = async () => {
        if (!deleteConfirmItem) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'dailyDemand', deleteConfirmItem.id));
            setDeleteConfirmItem(null);
        } catch (error) {
            console.error("Erro ao excluir registro:", error);
            alert("Erro ao excluir registro. Tente novamente.");
        } finally {
            setIsDeleting(false);
        }
    };

    // =========================================================================
    // FILTRAGEM MULTI-CRITÉRIO
    // =========================================================================
    const filteredData = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
        const currentMonthKey = `${currentYear}-${currentMonth}`;

        // Mês anterior
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevMonthKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}`;

        // Limite de 7, 15, 30 dias
        const d7 = new Date();
        d7.setDate(now.getDate() - 7);
        const d7Str = toLocalISO(d7);

        const d15 = new Date();
        d15.setDate(now.getDate() - 15);
        const d15Str = toLocalISO(d15);

        const d30 = new Date();
        d30.setDate(now.getDate() - 30);
        const d30Str = toLocalISO(d30);

        const d90 = new Date();
        d90.setDate(now.getDate() - 90);
        const d90Str = toLocalISO(d90);

        return historicalData.filter(item => {
            // 1. Filtro de Período Preset
            if (periodPreset === 'current_month') {
                if (!item.date.startsWith(currentMonthKey)) return false;
            } else if (periodPreset === 'previous_month') {
                if (!item.date.startsWith(prevMonthKey)) return false;
            } else if (periodPreset === 'last_7') {
                if (item.date < d7Str) return false;
            } else if (periodPreset === 'last_15') {
                if (item.date < d15Str) return false;
            } else if (periodPreset === 'last_30') {
                if (item.date < d30Str) return false;
            } else if (periodPreset === 'last_3_months') {
                if (item.date < d90Str) return false;
            } else if (periodPreset === 'year') {
                if (!item.date.startsWith(String(currentYear))) return false;
            } else if (periodPreset === 'custom') {
                if (customStartDate && item.date < customStartDate) return false;
                if (customEndDate && item.date > customEndDate) return false;
            }

            // 2. Filtro de Dia da Semana
            if (dayOfWeekFilter !== 'all') {
                const itemDate = parseLocalDate(item.date);
                if (itemDate && String(itemDate.getDay()) !== dayOfWeekFilter) {
                    return false;
                }
            }

            // 3. Filtro por Tendência / Saldo de Fila
            const sTickets = item.startTickets ?? 0;
            const eTickets = item.endTickets ?? 0;
            const sChats = item.startChats ?? 0;
            const eChats = item.endChats ?? 0;

            let deltaTotal = 0;
            if (channelFilter === 'tickets') {
                deltaTotal = eTickets - sTickets;
            } else if (channelFilter === 'chats') {
                deltaTotal = eChats - sChats;
            } else {
                deltaTotal = (eTickets + eChats) - (sTickets + sChats);
            }

            if (trendFilter === 'reduced' && deltaTotal >= 0) return false;
            if (trendFilter === 'increased' && deltaTotal <= 0) return false;
            if (trendFilter === 'stable' && deltaTotal !== 0) return false;

            // 4. Busca por texto / data ou notas
            if (deferredSearch.trim() !== '') {
                const queryLower = deferredSearch.toLowerCase().trim();
                const displayDate = formatDisplayDate(item.date).toLowerCase();
                const rawDate = item.date.toLowerCase();
                const notesText = (item.notes || '').toLowerCase();
                const weekday = getWeekdayShort(item.date).toLowerCase();

                const matches = displayDate.includes(queryLower) ||
                    rawDate.includes(queryLower) ||
                    notesText.includes(queryLower) ||
                    weekday.includes(queryLower);

                if (!matches) return false;
            }

            return true;
        });
    }, [historicalData, periodPreset, customStartDate, customEndDate, dayOfWeekFilter, channelFilter, trendFilter, deferredSearch]);

    // =========================================================================
    // ORDENAÇÃO DOS DADOS PARA TABELA
    // =========================================================================
    const sortedTableData = useMemo(() => {
        const list = [...filteredData];
        return list.sort((a, b) => {
            const sTotalA = (a.startTickets ?? 0) + (a.startChats ?? 0);
            const eTotalA = (a.endTickets ?? 0) + (a.endChats ?? 0);
            const deltaA = eTotalA - sTotalA;

            const sTotalB = (b.startTickets ?? 0) + (b.startChats ?? 0);
            const eTotalB = (b.endTickets ?? 0) + (b.endChats ?? 0);
            const deltaB = eTotalB - sTotalB;

            switch (sortBy) {
                case 'date_asc':
                    return a.date.localeCompare(b.date);
                case 'date_desc':
                    return b.date.localeCompare(a.date);
                case 'tickets_desc':
                    return (b.endTickets ?? 0) - (a.endTickets ?? 0);
                case 'chats_desc':
                    return (b.endChats ?? 0) - (a.endChats ?? 0);
                case 'delta_desc': // Maior aumento de fila
                    return deltaB - deltaA;
                case 'delta_asc': // Maior redução de fila
                    return deltaA - deltaB;
                default:
                    return b.date.localeCompare(a.date);
            }
        });
    }, [filteredData, sortBy]);

    // =========================================================================
    // MÉTRICAS E DADOS PARA GRÁFICOS
    // =========================================================================
    const { metrics, chartData, weekdayStats } = useMemo(() => {
        if (filteredData.length === 0) {
            return {
                metrics: {
                    avgStartTickets: 0,
                    avgStartChats: 0,
                    avgEndTickets: 0,
                    avgEndChats: 0,
                    totalStartTickets: 0,
                    totalEndTickets: 0,
                    totalStartChats: 0,
                    totalEndChats: 0,
                    netDeltaTickets: 0,
                    netDeltaChats: 0,
                    netDeltaTotal: 0,
                    resolutionRate: 0,
                    maxTicketsDay: null,
                    maxChatsDay: null,
                    count: 0
                },
                chartData: [],
                weekdayStats: []
            };
        }

        let sumStartTickets = 0, sumStartChats = 0;
        let sumEndTickets = 0, sumEndChats = 0;
        let countStart = 0, countEnd = 0;
        let reducedDaysCount = 0;

        let maxTicketsVal = -1;
        let maxTicketsDay = null;
        let maxChatsVal = -1;
        let maxChatsDay = null;

        // Agrupamento por dia da semana
        const weekdayMap = {
            1: { name: 'Seg', fullName: 'Segunda', startTickets: 0, endTickets: 0, startChats: 0, endChats: 0, count: 0 },
            2: { name: 'Ter', fullName: 'Terça', startTickets: 0, endTickets: 0, startChats: 0, endChats: 0, count: 0 },
            3: { name: 'Qua', fullName: 'Quarta', startTickets: 0, endTickets: 0, startChats: 0, endChats: 0, count: 0 },
            4: { name: 'Qui', fullName: 'Quinta', startTickets: 0, endTickets: 0, startChats: 0, endChats: 0, count: 0 },
            5: { name: 'Sex', fullName: 'Sexta', startTickets: 0, endTickets: 0, startChats: 0, endChats: 0, count: 0 },
            6: { name: 'Sáb', fullName: 'Sábado', startTickets: 0, endTickets: 0, startChats: 0, endChats: 0, count: 0 },
            0: { name: 'Dom', fullName: 'Domingo', startTickets: 0, endTickets: 0, startChats: 0, endChats: 0, count: 0 },
        };

        const ascData = [...filteredData].sort((a, b) => a.date.localeCompare(b.date));

        const cData = ascData.map(d => {
            const hasStart = d.startTickets !== null && d.startTickets !== undefined;
            const hasEnd = d.endTickets !== null && d.endTickets !== undefined;

            const st = d.startTickets ?? 0;
            const sc = d.startChats ?? 0;
            const et = d.endTickets ?? 0;
            const ec = d.endChats ?? 0;

            if (hasStart) {
                sumStartTickets += st;
                sumStartChats += sc;
                countStart++;
            }
            if (hasEnd) {
                sumEndTickets += et;
                sumEndChats += ec;
                countEnd++;
            }

            // Saldo do dia
            const deltaTickets = et - st;
            const deltaChats = ec - sc;
            const deltaTotal = (et + ec) - (st + sc);

            if (deltaTotal <= 0) {
                reducedDaysCount++;
            }

            // Recordes
            if (Math.max(st, et) > maxTicketsVal) {
                maxTicketsVal = Math.max(st, et);
                maxTicketsDay = { date: d.date, val: maxTicketsVal };
            }
            if (Math.max(sc, ec) > maxChatsVal) {
                maxChatsVal = Math.max(sc, ec);
                maxChatsDay = { date: d.date, val: maxChatsVal };
            }

            // Agrupa por dia da semana
            const localD = parseLocalDate(d.date);
            if (localD) {
                const w = localD.getDay();
                if (weekdayMap[w]) {
                    weekdayMap[w].startTickets += st;
                    weekdayMap[w].endTickets += et;
                    weekdayMap[w].startChats += sc;
                    weekdayMap[w].endChats += ec;
                    weekdayMap[w].count += 1;
                }
            }

            // Formatação amigável de data para o gráfico (DD/MM)
            const parts = d.date.split('-');
            const formattedDate = `${parts[2]}/${parts[1]}`;
            const weekday = getWeekdayShort(d.date);

            return {
                ...d,
                formattedDate: `${formattedDate} (${weekday})`,
                shortDate: formattedDate,
                weekday,
                deltaTickets,
                deltaChats,
                deltaTotal,
                totalStart: st + sc,
                totalEnd: et + ec,
            };
        });

        // Médias
        const avgStartTickets = countStart > 0 ? Math.round(sumStartTickets / countStart) : 0;
        const avgStartChats = countStart > 0 ? Math.round(sumStartChats / countStart) : 0;
        const avgEndTickets = countEnd > 0 ? Math.round(sumEndTickets / countEnd) : 0;
        const avgEndChats = countEnd > 0 ? Math.round(sumEndChats / countEnd) : 0;

        const netDeltaTickets = avgEndTickets - avgStartTickets;
        const netDeltaChats = avgEndChats - avgStartChats;
        const netDeltaTotal = (avgEndTickets + avgEndChats) - (avgStartTickets + avgStartChats);

        const resolutionRate = filteredData.length > 0
            ? Math.round((reducedDaysCount / filteredData.length) * 100)
            : 0;

        // Converte o weekdayMap para array ordenado Segunda -> Domingo
        const weekdayArray = [1, 2, 3, 4, 5, 6, 0].map(w => {
            const item = weekdayMap[w];
            const c = item.count > 0 ? item.count : 1;
            return {
                day: item.name,
                fullName: item.fullName,
                count: item.count,
                avgStartTickets: item.count > 0 ? Math.round(item.startTickets / c) : 0,
                avgEndTickets: item.count > 0 ? Math.round(item.endTickets / c) : 0,
                avgStartChats: item.count > 0 ? Math.round(item.startChats / c) : 0,
                avgEndChats: item.count > 0 ? Math.round(item.endChats / c) : 0,
            };
        });

        return {
            metrics: {
                avgStartTickets,
                avgStartChats,
                avgEndTickets,
                avgEndChats,
                totalStartTickets: sumStartTickets,
                totalEndTickets: sumEndTickets,
                totalStartChats: sumStartChats,
                totalEndChats: sumEndChats,
                netDeltaTickets,
                netDeltaChats,
                netDeltaTotal,
                resolutionRate,
                maxTicketsDay,
                maxChatsDay,
                count: filteredData.length
            },
            chartData: cData,
            weekdayStats: weekdayArray
        };
    }, [filteredData]);

    // =========================================================================
    // DIA DA SEMANA COM MAIOR / MENOR DEMANDA (respeita todos os filtros ativos)
    // Demanda do dia = fila no fechamento (chamados + chats, conforme o canal filtrado);
    // sem fechamento lançado, usa a fila de abertura.
    // =========================================================================
    const demandExtremes = useMemo(() => {
        const acc = {};
        filteredData.forEach(d => {
            const hasEnd = d.endTickets != null || d.endChats != null;
            const hasStart = d.startTickets != null || d.startChats != null;
            if (!hasEnd && !hasStart) return;
            const t = hasEnd ? (d.endTickets ?? 0) : (d.startTickets ?? 0);
            const c = hasEnd ? (d.endChats ?? 0) : (d.startChats ?? 0);
            const vol = channelFilter === 'tickets' ? t : channelFilter === 'chats' ? c : t + c;
            const localD = parseLocalDate(d.date);
            if (!localD) return;
            const w = localD.getDay();
            if (!acc[w]) acc[w] = { w, sum: 0, count: 0, peak: 0 };
            acc[w].sum += vol;
            acc[w].count += 1;
            acc[w].peak = Math.max(acc[w].peak, vol);
        });
        const list = Object.values(acc).map(x => ({ ...x, avg: x.sum / x.count }));
        if (list.length < 2) return { max: null, min: null, single: list[0] || null };
        const max = list.reduce((a, b) => (b.avg > a.avg ? b : a));
        const min = list.reduce((a, b) => (b.avg < a.avg ? b : a));
        return { max, min, single: null };
    }, [filteredData, channelFilter]);

    // =========================================================================
    // EXPORTAÇÃO CSV COMPLETA
    // =========================================================================
    const handleExportCSV = () => {
        if (sortedTableData.length === 0) return;

        const headers = [
            'Data',
            'Dia da Semana',
            'Chamados Inicio',
            'Chats Inicio',
            'Total Inicio',
            'Chamados Fim',
            'Chats Fim',
            'Total Fim',
            'Delta Chamados',
            'Delta Chats',
            'Saldo Total Fila',
            'Observacoes'
        ];

        const rows = sortedTableData.map(r => {
            const st = r.startTickets ?? '';
            const sc = r.startChats ?? '';
            const et = r.endTickets ?? '';
            const ec = r.endChats ?? '';

            const sTotal = (r.startTickets || 0) + (r.startChats || 0);
            const eTotal = (r.endTickets || 0) + (r.endChats || 0);

            const deltaT = (r.endTickets !== null && r.startTickets !== null) ? (r.endTickets - r.startTickets) : '';
            const deltaC = (r.endChats !== null && r.startChats !== null) ? (r.endChats - r.startChats) : '';
            const deltaTot = (r.endTickets !== null || r.endChats !== null) ? (eTotal - sTotal) : '';

            const localD = parseLocalDate(r.date);
            const weekdayName = localD ? DAYS_OF_WEEK.find(w => w.id === String(localD.getDay()))?.label || '' : '';
            const obsSafe = (r.notes || '').replace(/"/g, '""');

            return [
                formatDisplayDate(r.date),
                weekdayName,
                st,
                sc,
                sTotal,
                et,
                ec,
                eTotal,
                deltaT,
                deltaC,
                deltaTot,
                `"${obsSafe}"`
            ].join(';');
        });

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `demanda_diaria_${todayLocalISO()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Limpar todos os filtros para o padrão
    const handleResetFilters = () => {
        setPeriodPreset('current_month');
        setCustomStartDate('');
        setCustomEndDate('');
        setChannelFilter('all');
        setTrendFilter('all');
        setDayOfWeekFilter('all');
        setSearchQuery('');
        setSortBy('date_desc');
    };

    const hasActiveCustomFilters = periodPreset !== 'current_month' ||
        channelFilter !== 'all' ||
        trendFilter !== 'all' ||
        dayOfWeekFilter !== 'all' ||
        searchQuery.trim() !== '' ||
        sortBy !== 'date_desc';

    // Filtros avançados recolhíveis + resumo dos filtros ativos
    const [showFilters, setShowFilters] = useState(false);
    const dayLabel = DAYS_OF_WEEK.find(d => d.id === dayOfWeekFilter)?.label;
    const activeChips = [
        channelFilter !== 'all' && { key: 'canal', label: channelFilter === 'tickets' ? 'Chamados' : 'Chats', clear: () => setChannelFilter('all') },
        trendFilter !== 'all' && { key: 'trend', label: { reduced: 'Fila reduziu', increased: 'Fila aumentou', stable: 'Fila estável' }[trendFilter], clear: () => setTrendFilter('all') },
        dayOfWeekFilter !== 'all' && { key: 'dow', label: dayLabel, clear: () => setDayOfWeekFilter('all') },
        searchQuery.trim() !== '' && { key: 'q', label: `“${searchQuery.trim()}”`, clear: () => setSearchQuery('') },
        sortBy !== 'date_desc' && { key: 'sort', label: 'Ordem alterada', clear: () => setSortBy('date_desc') },
    ].filter(Boolean);
    const advancedFilterCount = activeChips.length;

    // Chip de fechamento do dia (hoje)
    const todayRecord = historicalData.find(d => d.date === todayLocalISO());
    const todayHasStart = todayRecord && (todayRecord.startTickets != null || todayRecord.startChats != null);
    const todayHasEnd = todayRecord && (todayRecord.endTickets != null || todayRecord.endChats != null);
    const todayChip = todayHasEnd
        ? (() => {
            const diff = ((todayRecord.endTickets ?? 0) + (todayRecord.endChats ?? 0)) - ((todayRecord.startTickets ?? 0) + (todayRecord.startChats ?? 0));
            return { label: `Hoje fechado · saldo ${diff > 0 ? `+${diff}` : diff}`, dot: 'bg-emerald-500', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' };
        })()
        : todayHasStart
            ? { label: 'Hoje aberto · falta lançar o fim do expediente', dot: 'bg-amber-500 animate-pulse', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' }
            : { label: 'Hoje sem lançamento · clique para registrar', dot: 'bg-rose-500 animate-pulse', cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30' };

    // Mini gráficos dos cards: últimos 14 dias do período
    const sparkOf = (key) => chartData.slice(-14).map(d => d[key] ?? 0);
    const deltaTag = (v, unit) => ({
        dir: v === 0 ? 'flat' : v > 0 ? 'up' : 'down',
        good: v <= 0,
        text: `${v > 0 ? '+' : ''}${v}${unit}`,
    });

    return (
        <div className="h-full overflow-y-auto w-full bg-canvas font-sans">
            <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6 pb-16">
                
                {/* CABEÇALHO PRINCIPAL COM AÇÕES RÁPIDAS */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-rose-500 uppercase tracking-wider">
                            <Activity className="w-3.5 h-3.5" />
                            <span>Módulo Operacional • Demanda e Fila Diária</span>
                        </div>
                        <h1 className="font-brand text-2xl sm:text-3xl font-bold text-primary-hub tracking-tight">
                            Demanda & Fila Diária
                        </h1>
                        <p className="text-sm text-secondary-hub mt-1">
                            Monitoramento operacional do fluxo de abertura, acúmulo e resolução de chamados e chats.
                        </p>
                        <button
                            type="button"
                            onClick={handleOpenCreate}
                            title="Abrir o lançamento de hoje"
                            className={`mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold transition-colors cursor-pointer ${todayChip.cls}`}
                        >
                            <span className={`w-2 h-2 rounded-full ${todayChip.dot}`} />
                            {todayChip.label}
                        </button>
                    </div>

                    <div className="flex items-center gap-2.5 w-full md:w-auto md:justify-end flex-wrap">
                        <button
                            id="btn-export-demand-csv"
                            type="button"
                            onClick={handleExportCSV}
                            disabled={sortedTableData.length === 0}
                            title="Exportar dados filtrados para CSV"
                            className="btn-excel px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            <ExcelIcon className="w-4 h-4" />
                            <span className="hidden sm:inline">Exportar CSV</span>
                        </button>

                        <button 
                            id="btn-new-demand-record"
                            type="button"
                            onClick={handleOpenCreate}
                            className="bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-rose-950/20 cursor-pointer active:scale-95"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Novo Lançamento</span>
                        </button>
                    </div>
                </header>
                    

                {/* ======================================================== */}
                {/* BARRA DE FILTROS AVANÇADOS */}
                {/* ======================================================== */}
                <div id="demand-filters-container" className="space-y-3">
                    {/* Linha principal: chips de período + modo de visualização + botão Filtros */}
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {QUICK_PRESETS.map(id => {
                                const preset = PRESETS.find(pr => pr.id === id);
                                return (
                                    <button
                                        key={id}
                                        type="button"
                                        onClick={() => setPeriodPreset(id)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer border ${
                                            periodPreset === id ? 'bg-primary-hub text-white dark:text-zinc-950 border-transparent shadow-xs' : 'bg-surface text-secondary-hub hover:text-primary-hub border-subtle'
                                        }`}
                                    >
                                        {preset.label}
                                    </button>
                                );
                            })}
                            <div className="relative">
                                <select
                                    value={QUICK_PRESETS.includes(periodPreset) ? '' : periodPreset}
                                    onChange={(e) => e.target.value && setPeriodPreset(e.target.value)}
                                    aria-label="Mais períodos"
                                    className={`appearance-none pl-3 pr-7 py-1.5 rounded-lg text-xs font-bold cursor-pointer border outline-none ${
                                        QUICK_PRESETS.includes(periodPreset) ? 'bg-surface text-secondary-hub border-subtle' : 'bg-primary-hub text-white dark:text-zinc-950 border-transparent'
                                    }`}
                                >
                                    <option value="" disabled>Mais períodos…</option>
                                    {PRESETS.filter(pr => !QUICK_PRESETS.includes(pr.id)).map(pr => (
                                        <option key={pr.id} value={pr.id} className="text-zinc-900">{pr.label}</option>
                                    ))}
                                </select>
                                <ChevronDown className="w-3 h-3 absolute right-2 top-2.5 pointer-events-none opacity-70" />
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                type="button"
                                onClick={() => setShowFilters(v => !v)}
                                aria-expanded={showFilters}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                                    showFilters || advancedFilterCount > 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' : 'bg-surface text-secondary-hub border-subtle hover:text-primary-hub'
                                }`}
                            >
                                <Filter className="w-3.5 h-3.5" />
                                Filtros
                                {advancedFilterCount > 0 && (
                                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center">{advancedFilterCount}</span>
                                )}
                                <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Seletor de Modo de Visualização */}
                            <div className="flex items-center gap-1 bg-subtle p-1 rounded-xl border border-subtle shrink-0">
                                {[
                                    { id: 'charts', label: 'Gráficos', Icon: BarChart2, tone: 'text-blue-500' },
                                    { id: 'table', label: 'Extrato', Icon: FileText, tone: 'text-emerald-500' },
                                    { id: 'all', label: 'Completo', Icon: Activity, tone: 'text-red-500' },
                                ].map((mode) => (
                                    <button
                                        key={mode.id}
                                        type="button"
                                        onClick={() => setViewMode(mode.id)}
                                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                                            viewMode === mode.id ? 'bg-surface text-primary-hub shadow-xs' : 'text-muted-hub hover:text-primary-hub'
                                        }`}
                                    >
                                        <mode.Icon className={`w-3.5 h-3.5 ${mode.tone}`} />
                                        <span>{mode.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Datas personalizadas (preset 'custom') */}
                    {periodPreset === 'custom' && (
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-3.5 flex flex-wrap items-center gap-3">
                            <span className="text-xs font-bold text-red-800 flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-red-600" />
                                Intervalo de Datas:
                            </span>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-zinc-500 font-medium">De:</span>
                                <input
                                    type="date"
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                    className="bg-white border border-zinc-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-secondary-hub outline-none focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-zinc-500 font-medium">Até:</span>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="bg-white border border-zinc-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-secondary-hub outline-none focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                            {(customStartDate || customEndDate) && (
                                <button
                                    type="button"
                                    onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                                    className="text-xs font-bold text-red-600 hover:text-red-700 underline cursor-pointer ml-auto"
                                >
                                    Limpar intervalo
                                </button>
                            )}
                        </div>
                    )}

                    {/* Painel de filtros avançados (recolhível) */}
                    {showFilters && (
                        <div className="bg-surface rounded-2xl border border-subtle shadow-xs p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
                        
                        {/* Filtro por Canal de Demanda */}
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-500 mb-1 flex items-center gap-1">
                                <Filter className="w-3 h-3 text-red-500" /> Canal:
                            </label>
                            <select
                                value={channelFilter}
                                onChange={(e) => setChannelFilter(e.target.value)}
                                className="w-full bg-subtle border border-subtle rounded-xl px-2.5 py-2 text-xs font-semibold text-primary-hub outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer"
                            >
                                <option value="all">Todos os Canais (Geral)</option>
                                <option value="tickets">Apenas Chamados (Voz/Tickets)</option>
                                <option value="chats">Apenas Chats (Huggy)</option>
                            </select>
                        </div>

                        {/* Filtro por Comportamento da Fila (Tendência / Saldo) */}
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-500 mb-1 flex items-center gap-1">
                                <TrendingDown className="w-3 h-3 text-emerald-500" /> Tendência da Fila:
                            </label>
                            <select
                                value={trendFilter}
                                onChange={(e) => setTrendFilter(e.target.value)}
                                className="w-full bg-subtle border border-subtle rounded-xl px-2.5 py-2 text-xs font-semibold text-primary-hub outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer"
                            >
                                <option value="all">Todas as Tendências</option>
                                <option value="reduced">Fila Reduziu (Fim &lt; Início)</option>
                                <option value="increased">Fila Aumentou (Fim &gt; Início)</option>
                                <option value="stable">Fila Estável (Fim = Início)</option>
                            </select>
                        </div>

                        {/* Filtro por Dia da Semana */}
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-500 mb-1 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-blue-500" /> Dia da Semana:
                            </label>
                            <select
                                value={dayOfWeekFilter}
                                onChange={(e) => setDayOfWeekFilter(e.target.value)}
                                className="w-full bg-subtle border border-subtle rounded-xl px-2.5 py-2 text-xs font-semibold text-primary-hub outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer"
                            >
                                {DAYS_OF_WEEK.map(d => (
                                    <option key={d.id} value={d.id}>{d.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Ordenação */}
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-500 mb-1 flex items-center gap-1">
                                <ArrowUpDown className="w-3 h-3 text-purple-500" /> Ordenar por:
                            </label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="w-full bg-subtle border border-subtle rounded-xl px-2.5 py-2 text-xs font-semibold text-primary-hub outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 cursor-pointer"
                            >
                                <option value="date_desc">Data (Mais Recentes Primeiro)</option>
                                <option value="date_asc">Data (Mais Antigos Primeiro)</option>
                                <option value="tickets_desc">Maior Fila de Chamados</option>
                                <option value="chats_desc">Maior Fila de Chats</option>
                                <option value="delta_asc">Maior Redução de Fila (Eficiência)</option>
                                <option value="delta_desc">Maior Aumento de Fila (Sobrecarga)</option>
                            </select>
                        </div>

                        {/* Busca Rápida */}
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-500 mb-1 flex items-center gap-1">
                                <Search className="w-3 h-3 text-zinc-500" /> Buscar:
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Ex: 22/09 ou observação..."
                                    className="w-full bg-subtle border border-subtle rounded-xl pl-8 pr-7 py-2 text-xs font-medium text-primary-hub placeholder:text-muted-hub outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                                />
                                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="text-zinc-400 hover:text-zinc-600 absolute right-2.5 top-2.5 cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                        </div>
                    )}

                    {/* Resumo: contagem + filtros ativos */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-hub">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span>
                                Exibindo <strong className="text-primary-hub font-bold">{filteredData.length}</strong> de <strong className="text-primary-hub font-bold">{historicalData.length}</strong> dias
                            </span>
                            {activeChips.map(chip => (
                                <button
                                    key={chip.key}
                                    type="button"
                                    onClick={chip.clear}
                                    title="Remover filtro"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[11px] font-bold cursor-pointer hover:bg-rose-500/20"
                                >
                                    {chip.label}
                                    <X className="w-3 h-3" />
                                </button>
                            ))}
                        </div>
                        {hasActiveCustomFilters && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" /> Limpar filtros
                            </button>
                        )}
                    </div>
                </div>

                {/* ======================================================== */}
                {/* GRADE DE CARDS ESTATÍSTICOS DE PERFORMANCE OPERACIONAL */}
                {/* ======================================================== */}
                <div id="demand-kpis-grid" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <KpiHeroCard
                        accent="emerald" label="Fila de chamados" icon={Ticket}
                        status={metrics.netDeltaTickets <= 0 ? 'ok' : 'bad'}
                        statusLabel={metrics.netDeltaTickets <= 0 ? 'Fila reduz no dia' : 'Fila acumula no dia'}
                        value={metrics.avgEndTickets} caption={`Média de fechamento · abertura média ${metrics.avgStartTickets}`}
                        spark={sparkOf('endTickets')}
                        footer={<span>Totais <strong className="font-bold text-zinc-200">{metrics.totalStartTickets}</strong> → <strong className="font-bold text-zinc-200">{metrics.totalEndTickets}</strong></span>}
                        delta={deltaTag(metrics.netDeltaTickets, '/dia')}
                    />
                    <KpiHeroCard
                        accent="purple" label="Fila de chats" icon={MessageSquare}
                        status={metrics.netDeltaChats <= 0 ? 'ok' : 'bad'}
                        statusLabel={metrics.netDeltaChats <= 0 ? 'Fila reduz no dia' : 'Fila acumula no dia'}
                        value={metrics.avgEndChats} caption={`Média de fechamento · abertura média ${metrics.avgStartChats}`}
                        spark={sparkOf('endChats')}
                        footer={<span>Totais <strong className="font-bold text-zinc-200">{metrics.totalStartChats}</strong> → <strong className="font-bold text-zinc-200">{metrics.totalEndChats}</strong></span>}
                        delta={deltaTag(metrics.netDeltaChats, '/dia')}
                    />
                    <KpiHeroCard
                        accent="blue" label="Saldo médio do dia" icon={Activity}
                        status={metrics.netDeltaTotal < 0 ? 'ok' : metrics.netDeltaTotal === 0 ? 'warn' : 'bad'}
                        statusLabel={metrics.netDeltaTotal < 0 ? 'Redução' : metrics.netDeltaTotal === 0 ? 'Equilíbrio' : 'Sobrecarga'}
                        value={metrics.netDeltaTotal > 0 ? `+${metrics.netDeltaTotal}` : metrics.netDeltaTotal}
                        caption="Chamados + chats: fim menos início"
                        spark={sparkOf('deltaTotal')}
                        footer={<span>Período <strong className="font-bold text-zinc-200">{metrics.count}</strong> dia(s)</span>}
                    />
                    <KpiHeroCard
                        accent="red" label="Resolução diária" icon={CheckCircle2}
                        status={metrics.resolutionRate >= 70 ? 'ok' : metrics.resolutionRate >= 40 ? 'warn' : 'bad'}
                        statusLabel={metrics.resolutionRate >= 70 ? 'Operação em dia' : metrics.resolutionRate >= 40 ? 'Atenção' : 'Crítico'}
                        value={metrics.resolutionRate} valueSuffix="%" caption="Dias em que a fila fechou menor ou igual"
                        progress={metrics.resolutionRate} progressLabel="dias com fim ≤ início"
                        footer={<span>Pico <strong className="font-bold text-zinc-200">{Math.max(metrics.maxTicketsDay?.val ?? 0, metrics.maxChatsDay?.val ?? 0)}</strong></span>}
                    />
                </div>

                {/* Dia da semana com maior e menor demanda (conforme filtros) */}
                <div id="demand-extremes-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { key: 'max', data: demandExtremes.max, accent: 'red', label: 'Dia com maior demanda', icon: TrendingUp, status: 'bad', statusLabel: 'Pico de demanda' },
                        { key: 'min', data: demandExtremes.min, accent: 'emerald', label: 'Dia com menor demanda', icon: TrendingDown, status: 'ok', statusLabel: 'Menor demanda' },
                    ].map(({ key, data, accent, label, icon, status, statusLabel }) => {
                        const dayName = data ? DAYS_OF_WEEK.find(w => w.id === String(data.w))?.label : null;
                        const periodLabel = PRESETS.find(p => p.id === periodPreset)?.label.toLowerCase();
                        return (
                            <KpiHeroCard
                                key={key}
                                compact
                                accent={accent} label={label} icon={icon}
                                status={data ? status : 'warn'}
                                statusLabel={data ? statusLabel : 'Dados insuficientes'}
                                value={dayName || '—'}
                                caption={data
                                    ? `Média de ${Math.round(data.avg)} ${channelFilter === 'tickets' ? 'chamados' : channelFilter === 'chats' ? 'chats' : 'atendimentos'} na fila de fechamento · ${periodLabel}`
                                    : demandExtremes.single
                                        ? 'Os filtros deixam apenas um dia da semana; remova o filtro de dia para comparar.'
                                        : 'Sem lançamentos para os filtros selecionados.'}
                                footer={data
                                    ? <span>Pico <strong className="font-bold text-zinc-200">{data.peak}</strong> · <strong className="font-bold text-zinc-200">{data.count}</strong> {data.count === 1 ? 'ocorrência' : 'ocorrências'}</span>
                                    : <span>Mínimo de 2 dias da semana com dados</span>}
                            />
                        );
                    })}
                </div>

                {/* ======================================================== */}
                {/* SEÇÃO DE GRÁFICOS ANALÍTICOS */}
                {/* ======================================================== */}
                {(viewMode === 'all' || viewMode === 'charts') && (
                    <div className="space-y-6">
                        {/* Linha 1 de Gráficos: Chamados vs Chats com visual refinado */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* GRÁFICO 1: EVOLUÇÃO DE FILA DE CHAMADOS (INÍCIO VS FIM) */}
                            <div className="bg-surface rounded-3xl shadow-xs border border-subtle p-5 sm:p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-primary-hub flex items-center gap-2">
                                            <Ticket className="w-4 h-4 text-emerald-600" />
                                            Evolução da Fila de Chamados (Início vs Fim)
                                        </h3>
                                        <p className="text-[11px] text-muted-hub mt-0.5">
                                            Comparativo diário de volume de chamados na abertura e encerramento.
                                        </p>
                                    </div>
                                    {metrics.maxTicketsDay && (
                                        <div className="text-right shrink-0">
                                            <span className="text-[10px] text-zinc-400 uppercase font-bold block">Pico do Período</span>
                                            <span className="text-xs font-black text-emerald-700 font-mono">
                                                {metrics.maxTicketsDay.val} chamados ({formatDisplayDate(metrics.maxTicketsDay.date)})
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="h-64 sm:h-72 w-full">
                                    {chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData} margin={{ top: 10, right: 15, bottom: 5, left: -20 }}>
                                                <defs>
                                                    <linearGradient id="colorTicketsInicio" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={COLORS.chamadosInicio} stopOpacity={0.25}/>
                                                        <stop offset="95%" stopColor={COLORS.chamadosInicio} stopOpacity={0.0}/>
                                                    </linearGradient>
                                                    <linearGradient id="colorTicketsFim" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={COLORS.chamadosFim} stopOpacity={0.25}/>
                                                        <stop offset="95%" stopColor={COLORS.chamadosFim} stopOpacity={0.0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                                                <XAxis dataKey="shortDate" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                                                <Tooltip 
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            const d = payload[0].payload;
                                                            return (
                                                                <div className="bg-zinc-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-zinc-800">
                                                                    <div className="font-bold text-zinc-200 border-b border-zinc-800 pb-1 flex items-center justify-between gap-3">
                                                                        <span>{formatDisplayDate(d.date)} ({d.weekday})</span>
                                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${d.deltaTickets <= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                                            {d.deltaTickets <= 0 ? 'Fila Reduziu' : 'Fila Subiu'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between gap-4 text-emerald-400">
                                                                        <span>Início do Dia:</span>
                                                                        <strong className="font-mono">{d.startTickets ?? '-'}</strong>
                                                                    </div>
                                                                    <div className="flex items-center justify-between gap-4 text-emerald-300">
                                                                        <span>Fim do Dia:</span>
                                                                        <strong className="font-mono">{d.endTickets ?? '-'}</strong>
                                                                    </div>
                                                                    <div className="flex items-center justify-between gap-4 text-zinc-300 pt-1 border-t border-zinc-800 text-[11px]">
                                                                        <span>Saldo do Dia:</span>
                                                                        <strong className={`font-mono ${d.deltaTickets <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                            {d.deltaTickets > 0 ? `+${d.deltaTickets}` : d.deltaTickets}
                                                                        </strong>
                                                                    </div>
                                                                    {d.notes && (
                                                                        <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800 italic">
                                                                            Obs: {d.notes}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} iconType="circle" />
                                                <Area type="monotone" dataKey="startTickets" name="Chamados (Início)" stroke={COLORS.chamadosInicio} strokeWidth={2.5} fillOpacity={1} fill="url(#colorTicketsInicio)" dot={{ r: 2.5 }} activeDot={{ r: 5 }} />
                                                <Area type="monotone" dataKey="endTickets" name="Chamados (Fim)" stroke={COLORS.chamadosFim} strokeWidth={2.5} fillOpacity={1} fill="url(#colorTicketsFim)" dot={{ r: 2.5 }} activeDot={{ r: 5 }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-zinc-400 text-xs">
                                            Nenhum dado encontrado para os filtros selecionados.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* GRÁFICO 2: EVOLUÇÃO DE FILA DE CHATS (INÍCIO VS FIM) */}
                            <div className="bg-surface rounded-3xl shadow-xs border border-subtle p-5 sm:p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-primary-hub flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4 text-purple-600" />
                                            Evolução da Fila de Chats (Início vs Fim)
                                        </h3>
                                        <p className="text-[11px] text-muted-hub mt-0.5">
                                            Comparativo diário de conversas ativas/em espera no chat na abertura e encerramento.
                                        </p>
                                    </div>
                                    {metrics.maxChatsDay && (
                                        <div className="text-right shrink-0">
                                            <span className="text-[10px] text-zinc-400 uppercase font-bold block">Pico do Período</span>
                                            <span className="text-xs font-black text-indigo-600 font-mono">
                                                {metrics.maxChatsDay.val} chats ({formatDisplayDate(metrics.maxChatsDay.date)})
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="h-64 sm:h-72 w-full">
                                    {chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData} margin={{ top: 10, right: 15, bottom: 5, left: -20 }}>
                                                <defs>
                                                    <linearGradient id="colorChatsInicio" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={COLORS.chatsInicio} stopOpacity={0.25}/>
                                                        <stop offset="95%" stopColor={COLORS.chatsInicio} stopOpacity={0.0}/>
                                                    </linearGradient>
                                                    <linearGradient id="colorChatsFim" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor={COLORS.chatsFim} stopOpacity={0.25}/>
                                                        <stop offset="95%" stopColor={COLORS.chatsFim} stopOpacity={0.0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                                                <XAxis dataKey="shortDate" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                                                <Tooltip 
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            const d = payload[0].payload;
                                                            return (
                                                                <div className="bg-zinc-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-zinc-800">
                                                                    <div className="font-bold text-zinc-200 border-b border-zinc-800 pb-1 flex items-center justify-between gap-3">
                                                                        <span>{formatDisplayDate(d.date)} ({d.weekday})</span>
                                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${d.deltaChats <= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                                                            {d.deltaChats <= 0 ? 'Fila Reduziu' : 'Fila Subiu'}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between gap-4 text-purple-400">
                                                                        <span>Início do Dia:</span>
                                                                        <strong className="font-mono">{d.startChats ?? '-'}</strong>
                                                                    </div>
                                                                    <div className="flex items-center justify-between gap-4 text-indigo-300">
                                                                        <span>Fim do Dia:</span>
                                                                        <strong className="font-mono">{d.endChats ?? '-'}</strong>
                                                                    </div>
                                                                    <div className="flex items-center justify-between gap-4 text-zinc-300 pt-1 border-t border-zinc-800 text-[11px]">
                                                                        <span>Saldo do Dia:</span>
                                                                        <strong className={`font-mono ${d.deltaChats <= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                            {d.deltaChats > 0 ? `+${d.deltaChats}` : d.deltaChats}
                                                                        </strong>
                                                                    </div>
                                                                    {d.notes && (
                                                                        <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800 italic">
                                                                            Obs: {d.notes}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} iconType="circle" />
                                                <Area type="monotone" dataKey="startChats" name="Chats (Início)" stroke={COLORS.chatsInicio} strokeWidth={2.5} fillOpacity={1} fill="url(#colorChatsInicio)" dot={{ r: 2.5 }} activeDot={{ r: 5 }} />
                                                <Area type="monotone" dataKey="endChats" name="Chats (Fim)" stroke={COLORS.chatsFim} strokeWidth={2.5} fillOpacity={1} fill="url(#colorChatsFim)" dot={{ r: 2.5 }} activeDot={{ r: 5 }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-zinc-400 text-xs">
                                            Nenhum dado encontrado para os filtros selecionados.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Linha 2 de Gráficos: Comparativo Início vs Fim e Média por Dia da Semana */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            
                            {/* GRÁFICO 3: COMPARATIVO EMPILHADO DE VOLUME TOTAL (2 COLUNAS) */}
                            <div className="bg-surface rounded-3xl shadow-xs border border-subtle p-5 sm:p-6 lg:col-span-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-primary-hub flex items-center gap-2">
                                            <BarChart2 className="w-4 h-4 text-zinc-600" />
                                            Comparativo Geral: Início vs Fim do Expediente
                                        </h3>
                                        <p className="text-[11px] text-muted-hub mt-0.5">
                                            Visualização lado a lado da demanda empilhada (Chamados + Chats) para identificar se a operação limpou a fila no dia.
                                        </p>
                                    </div>
                                </div>

                                <div className="h-64 sm:h-72 w-full">
                                    {chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData} margin={{ top: 10, right: 15, bottom: 5, left: -20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                                                <XAxis dataKey="shortDate" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                                                <Tooltip 
                                                    cursor={{ fill: '#f4f4f5' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            const d = payload[0].payload;
                                                            return (
                                                                <div className="bg-zinc-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-zinc-800">
                                                                    <div className="font-bold text-zinc-200 border-b border-zinc-800 pb-1">
                                                                        {formatDisplayDate(d.date)} ({d.weekday})
                                                                    </div>
                                                                    <div className="text-emerald-400 font-medium">
                                                                        Início: {d.startTickets ?? 0} tickets + {d.startChats ?? 0} chats = <strong>{d.totalStart}</strong>
                                                                    </div>
                                                                    <div className="text-indigo-400 font-medium">
                                                                        Fim: {d.endTickets ?? 0} tickets + {d.endChats ?? 0} chats = <strong>{d.totalEnd}</strong>
                                                                    </div>
                                                                    <div className="pt-1 border-t border-zinc-800 flex items-center justify-between text-[11px]">
                                                                        <span>Saldo do Dia:</span>
                                                                        <strong className={d.deltaTotal <= 0 ? 'text-emerald-400' : 'text-red-400'}>
                                                                            {d.deltaTotal > 0 ? `+${d.deltaTotal}` : d.deltaTotal} {d.deltaTotal <= 0 ? '(Redução)' : '(Acúmulo)'}
                                                                        </strong>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} iconType="circle" />
                                                <Bar dataKey="startTickets" name="Chamados (Início)" stackId="inicio" fill={COLORS.chamadosInicio} radius={[0, 0, 0, 0]} barSize={16} />
                                                <Bar dataKey="startChats" name="Chats (Início)" stackId="inicio" fill={COLORS.chatsInicio} radius={[3, 3, 0, 0]} barSize={16} />
                                                
                                                <Bar dataKey="endTickets" name="Chamados (Fim)" stackId="fim" fill={COLORS.chamadosFim} radius={[0, 0, 0, 0]} barSize={16} />
                                                <Bar dataKey="endChats" name="Chats (Fim)" stackId="fim" fill={COLORS.chatsFim} radius={[3, 3, 0, 0]} barSize={16} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-zinc-400 text-xs">
                                            Nenhum dado encontrado para os filtros selecionados.
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* GRÁFICO 4: COMPORTAMENTO MÉDIO POR DIA DA SEMANA */}
                            <div className="bg-surface rounded-3xl shadow-xs border border-subtle p-5 sm:p-6">
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-primary-hub flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-indigo-600" />
                                        Média por Dia da Semana
                                    </h3>
                                    <p className="text-[11px] text-muted-hub mt-0.5">
                                        Média histórica de fila para identificar gargalos operacionais (Seg a Dom).
                                    </p>
                                </div>

                                <div className="h-64 sm:h-72 w-full">
                                    {weekdayStats.some(w => w.count > 0) ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={weekdayStats} margin={{ top: 10, right: 10, bottom: 5, left: -25 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                                                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                                                <Tooltip 
                                                    cursor={{ fill: '#f4f4f5' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            const d = payload[0].payload;
                                                            return (
                                                                <div className="bg-zinc-900 text-white p-3 rounded-xl shadow-xl text-xs space-y-1 border border-zinc-800">
                                                                    <div className="font-bold text-zinc-200 border-b border-zinc-800 pb-1 flex items-center justify-between gap-2">
                                                                        <span>{d.fullName}</span>
                                                                        <span className="text-zinc-400 text-[10px]">({d.count} dias)</span>
                                                                    </div>
                                                                    <div className="text-emerald-400">
                                                                        Média Chamados: Início {d.avgStartTickets} &rarr; Fim {d.avgEndTickets}
                                                                    </div>
                                                                    <div className="text-purple-400">
                                                                        Média Chats: Início {d.avgStartChats} &rarr; Fim {d.avgEndChats}
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} iconType="circle" />
                                                <Bar dataKey="avgStartTickets" name="Cham. Início" fill={COLORS.chamadosInicio} radius={[2, 2, 0, 0]} />
                                                <Bar dataKey="avgEndTickets" name="Cham. Fim" fill={COLORS.chamadosFim} radius={[2, 2, 0, 0]} />
                                                <Bar dataKey="avgStartChats" name="Chat Início" fill={COLORS.chatsInicio} radius={[2, 2, 0, 0]} />
                                                <Bar dataKey="avgEndChats" name="Chat Fim" fill={COLORS.chatsFim} radius={[2, 2, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex items-center justify-center text-zinc-400 text-xs">
                                            Sem dados suficientes para cálculo semanal.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ======================================================== */}
                {/* TABELA DE REGISTROS DETALHADA */}
                {/* ======================================================== */}
                {(viewMode === 'all' || viewMode === 'table') && (
                    <div id="demand-table-container" className="bg-surface rounded-3xl shadow-xs border border-subtle overflow-hidden flex flex-col">
                        <div className="p-5 border-b border-subtle flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-surface">
                            <div>
                                <h2 className="text-sm sm:text-base font-bold text-primary-hub flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-red-600" />
                                    Extrato Detalhado de Registros Diários
                                </h2>
                                <p className="text-muted-hub text-xs mt-0.5">
                                    Visualização completa com comparativo de abertura, fechamento e saldo líquido operacional do dia.
                                </p>
                            </div>

                            <span className="text-xs text-muted-hub font-medium bg-subtle border border-subtle px-2.5 py-1 rounded-lg">
                                Total no filtro: <strong className="text-primary-hub">{sortedTableData.length}</strong> dia(s)
                            </span>
                        </div>

                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-surface text-muted-hub text-[11px] uppercase tracking-wider font-bold border-b border-subtle backdrop-blur-xs">
                                    <tr>
                                        <th className="p-3.5 pl-5">Data & Dia</th>
                                        <th className="p-3.5 text-center">
                                            <span className="flex items-center justify-center gap-1">
                                                <Clock className="w-3 h-3 text-emerald-400" />
                                                Início (Chamados)
                                            </span>
                                        </th>
                                        <th className="p-3.5 text-center">
                                            <span className="flex items-center justify-center gap-1">
                                                <Clock className="w-3 h-3 text-purple-400" />
                                                Início (Chats)
                                            </span>
                                        </th>
                                        <th className="p-3.5 text-center">
                                            <span className="flex items-center justify-center gap-1">
                                                <Clock className="w-3 h-3 text-emerald-500" />
                                                Fim (Chamados)
                                            </span>
                                        </th>
                                        <th className="p-3.5 text-center">
                                            <span className="flex items-center justify-center gap-1">
                                                <Clock className="w-3 h-3 text-indigo-400" />
                                                Fim (Chats)
                                            </span>
                                        </th>
                                        <th className="p-3.5 text-center">Saldo do Dia (Delta)</th>
                                        <th className="p-3.5">Observações</th>
                                        <th className="p-3.5 pr-5 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="text-xs text-secondary-hub divide-y divide-subtle font-medium">
                                    {sortedTableData.length > 0 ? sortedTableData.map((row) => {
                                        const sTickets = row.startTickets ?? null;
                                        const sChats = row.startChats ?? null;
                                        const eTickets = row.endTickets ?? null;
                                        const eChats = row.endChats ?? null;

                                        const sTotal = (sTickets || 0) + (sChats || 0);
                                        const eTotal = (eTickets || 0) + (eChats || 0);
                                        const hasBoth = (sTickets !== null || sChats !== null) && (eTickets !== null || eChats !== null);
                                        const deltaTotal = hasBoth ? (eTotal - sTotal) : null;

                                        const weekday = getWeekdayShort(row.date);

                                        return (
                                            <tr key={row.id} className={`group border-b border-subtle last:border-b-0 hover:bg-subtle/60 transition-colors ${row.date === todayLocalISO() ? 'bg-rose-500/5 shadow-[inset_3px_0_0_0_#f43f5e]' : ''}`}>
                                                <td className="p-3.5 pl-5">
                                                    <div className="font-bold text-primary-hub flex items-center gap-1.5">
                                                        <span>{formatDisplayDate(row.date)}</span>
                                                        <span className="text-[10px] font-semibold text-muted-hub bg-subtle px-1.5 py-0.5 rounded border border-subtle">
                                                            {weekday}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Início Chamados */}
                                                <td className="p-3.5 text-center font-mono font-bold text-secondary-hub">
                                                    {sTickets !== null ? sTickets : <span className="text-muted-hub opacity-50">--</span>}
                                                </td>

                                                {/* Início Chats */}
                                                <td className="p-3.5 text-center font-mono font-bold text-secondary-hub">
                                                    {sChats !== null ? sChats : <span className="text-muted-hub opacity-50">--</span>}
                                                </td>

                                                {/* Fim Chamados */}
                                                <td className="p-3.5 text-center font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/5">
                                                    {eTickets !== null ? (
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <span>{eTickets}</span>
                                                            {sTickets !== null && (
                                                                <span className={`text-[10px] font-bold ${eTickets <= sTickets ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                    ({eTickets - sTickets > 0 ? `+${eTickets - sTickets}` : eTickets - sTickets})
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-hub opacity-50">--</span>
                                                    )}
                                                </td>

                                                {/* Fim Chats */}
                                                <td className="p-3.5 text-center font-mono font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/5">
                                                    {eChats !== null ? (
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <span>{eChats}</span>
                                                            {sChats !== null && (
                                                                <span className={`text-[10px] font-bold ${eChats <= sChats ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                                    ({eChats - sChats > 0 ? `+${eChats - sChats}` : eChats - sChats})
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-hub opacity-50">--</span>
                                                    )}
                                                </td>

                                                {/* Saldo Líquido do Dia */}
                                                <td className="p-3.5 text-center">
                                                    {deltaTotal !== null ? (
                                                        <span className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded-lg ${
                                                            deltaTotal < 0 
                                                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' 
                                                                : (deltaTotal > 0 ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300' : 'bg-subtle text-secondary-hub')
                                                        }`}>
                                                            {deltaTotal < 0 ? <TrendingDown className="w-3 h-3" /> : (deltaTotal > 0 ? <TrendingUp className="w-3 h-3" /> : <Minus className="w-3 h-3" />)}
                                                            {deltaTotal > 0 ? `+${deltaTotal}` : deltaTotal}
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-hub opacity-50 font-mono">--</span>
                                                    )}
                                                </td>

                                                {/* Observações */}
                                                <td className="p-3.5 max-w-[220px]" title={row.notes || ''}>
                                                    {row.notes ? (
                                                        <span className="inline-flex items-center gap-1.5 max-w-full text-[11px] text-secondary-hub bg-subtle border border-subtle px-2 py-0.5 rounded-lg">
                                                            <MessageSquare className="w-3 h-3 shrink-0 text-amber-500" />
                                                            <span className="truncate">{row.notes}</span>
                                                        </span>
                                                    ) : (
                                                        <span className="text-muted-hub opacity-50">—</span>
                                                    )}
                                                </td>

                                                {/* Ações */}
                                                <td className="p-3.5 pr-5 text-right">
                                                    <div className="flex items-center justify-end gap-1.5 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity">
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleOpenEdit(row)} 
                                                            className="p-1.5 text-muted-hub hover:text-amber-600 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer"
                                                            title="Editar registro diário"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => setDeleteConfirmItem(row)} 
                                                            className="p-1.5 text-muted-hub hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                                            title="Excluir registro"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan="8" className="p-8 text-center">
                                                <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-muted-hub space-y-2">
                                                    <div className="w-10 h-10 rounded-full bg-subtle flex items-center justify-center text-muted-hub">
                                                        <Activity className="w-5 h-5" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-secondary-hub">Nenhum registro encontrado</h4>
                                                    <p className="text-xs text-muted-hub text-center">
                                                        Não há lançamentos de demanda para os filtros selecionados. Tente ajustar o período ou adicionar um novo registro.
                                                    </p>
                                                    {hasActiveCustomFilters && (
                                                        <button
                                                            type="button"
                                                            onClick={handleResetFilters}
                                                            className="mt-2 text-xs font-bold text-red-600 hover:underline cursor-pointer"
                                                        >
                                                            Restaurar filtros padrão
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ======================================================== */}
                {/* MODAL DE LANÇAMENTO / EDIÇÃO COM PRÉVIA EM TEMPO REAL */}
                {/* ======================================================== */}
                {modal && (
                    <DailyDemandModal
                        initialDate={modal.date}
                        initialFocus={modal.focus}
                        historicalData={historicalData}
                        onClose={() => setModal(null)}
                    />
                )}

                {/* ======================================================== */}
                {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
                {/* ======================================================== */}
                {deleteConfirmItem && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                        <div className="bg-surface rounded-3xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150 border border-subtle">
                            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-zinc-900">Excluir Registro?</h3>
                                <p className="text-xs text-zinc-500 mt-1">
                                    Deseja realmente remover os dados do dia <strong className="text-secondary-hub">{formatDisplayDate(deleteConfirmItem.date)}</strong>? Esta ação não poderá ser desfeita.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setDeleteConfirmItem(null)}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-secondary-hub font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmDelete}
                                    disabled={isDeleting}
                                    className="flex-1 text-white cursor-pointer flex items-center justify-center gap-1.5 btn-primary-std"
                                >
                                    {isDeleting ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Trash2 className="w-3.5 h-3.5" />}
                                    <span>Excluir</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

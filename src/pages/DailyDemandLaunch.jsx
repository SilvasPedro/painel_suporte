import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';
import { collection, doc, setDoc, getDocs, query, orderBy, deleteDoc } from 'firebase/firestore';
import { 
    Save, Calendar, MessageSquare, Ticket, Clock, 
    Activity, AlertCircle, Plus, FileText, Edit2, Trash2, X, Filter,
    Download, TrendingDown, TrendingUp, Minus, Search, 
    CheckCircle2, ArrowUpDown, BarChart2,
    CalendarRange, Check
} from 'lucide-react';
import { 
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, AreaChart, Area
} from 'recharts';

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
    // Modal & Form States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTickets, setStartTickets] = useState('');
    const [startChats, setStartChats] = useState('');
    const [endTickets, setEndTickets] = useState('');
    const [endChats, setEndChats] = useState('');
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

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
    const [sortBy, setSortBy] = useState('date_desc'); // date_desc | date_asc | tickets_desc | chats_desc | delta_asc | delta_desc

    // Modo de Visualização (Padrão: Gráficos)
    const [viewMode, setViewMode] = useState('charts'); // charts | table | all

    useEffect(() => {
        fetchHistoricalData();
    }, []);

    async function fetchHistoricalData() {
        try {
            const q = query(collection(db, 'dailyDemand'), orderBy('date', 'asc'));
            const snapshot = await getDocs(q);
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHistoricalData(data);
        } catch (error) {
            console.error('Erro ao buscar dados históricos:', error);
        }
    }

    // Abertura segura do modal de novo registro
    const handleOpenCreate = () => {
        const todayStr = new Date().toISOString().split('T')[0];
        setDate(todayStr);
        const existing = historicalData.find(d => d.date === todayStr);
        if (existing) {
            setIsEditing(true);
            setStartTickets(existing.startTickets ?? '');
            setStartChats(existing.startChats ?? '');
            setEndTickets(existing.endTickets ?? '');
            setEndChats(existing.endChats ?? '');
            setNotes(existing.notes ?? '');
        } else {
            setIsEditing(false);
            setStartTickets('');
            setStartChats('');
            setEndTickets('');
            setEndChats('');
            setNotes('');
        }
        setMessage({ text: '', type: '' });
        setIsModalOpen(true);
    };

    // Abertura segura para edição de um registro existente
    const handleOpenEdit = (dataRecord) => {
        setDate(dataRecord.date);
        setIsEditing(true);
        setStartTickets(dataRecord.startTickets ?? '');
        setStartChats(dataRecord.startChats ?? '');
        setEndTickets(dataRecord.endTickets ?? '');
        setEndChats(dataRecord.endChats ?? '');
        setNotes(dataRecord.notes ?? '');
        setMessage({ text: '', type: '' });
        setIsModalOpen(true);
    };

    // Ao mudar a data no formulário, sincroniza campos se já houver registro gravado
    const handleDateChange = (newDate) => {
        setDate(newDate);
        const existing = historicalData.find(d => d.date === newDate);
        if (existing) {
            setIsEditing(true);
            setStartTickets(existing.startTickets ?? '');
            setStartChats(existing.startChats ?? '');
            setEndTickets(existing.endTickets ?? '');
            setEndChats(existing.endChats ?? '');
            setNotes(existing.notes ?? '');
        } else {
            setIsEditing(false);
            setStartTickets('');
            setStartChats('');
            setEndTickets('');
            setEndChats('');
            setNotes('');
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();

        if (startTickets === '' && startChats === '' && endTickets === '' && endChats === '') {
            setMessage({ text: 'Erro: Preencha pelo menos um dos campos de chamados ou chats.', type: 'error' });
            return;
        }

        setIsSaving(true);
        setMessage({ text: '', type: '' });

        try {
            const docRef = doc(db, 'dailyDemand', date);
            const payload = {
                date,
                startTickets: startTickets !== '' ? Number(startTickets) : null,
                startChats: startChats !== '' ? Number(startChats) : null,
                endTickets: endTickets !== '' ? Number(endTickets) : null,
                endChats: endChats !== '' ? Number(endChats) : null,
                notes: notes.trim() !== '' ? notes.trim() : null,
                updatedAt: new Date().toISOString(),
            };

            await setDoc(docRef, payload, { merge: true });
            setMessage({ text: 'Registro diário salvo com sucesso!', type: 'success' });
            await fetchHistoricalData();

            setTimeout(() => {
                setMessage({ text: '', type: '' });
                setIsModalOpen(false);
            }, 1200);
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
            setMessage({ text: 'Erro ao salvar. Verifique a conexão com o banco.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    const confirmDelete = async () => {
        if (!deleteConfirmItem) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'dailyDemand', deleteConfirmItem.id));
            setDeleteConfirmItem(null);
            await fetchHistoricalData();
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
        const d7Str = d7.toISOString().split('T')[0];

        const d15 = new Date();
        d15.setDate(now.getDate() - 15);
        const d15Str = d15.toISOString().split('T')[0];

        const d30 = new Date();
        d30.setDate(now.getDate() - 30);
        const d30Str = d30.toISOString().split('T')[0];

        const d90 = new Date();
        d90.setDate(now.getDate() - 90);
        const d90Str = d90.toISOString().split('T')[0];

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
            if (searchQuery.trim() !== '') {
                const queryLower = searchQuery.toLowerCase().trim();
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
    }, [historicalData, periodPreset, customStartDate, customEndDate, dayOfWeekFilter, channelFilter, trendFilter, searchQuery]);

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
        link.setAttribute('download', `demanda_diaria_${new Date().toISOString().split('T')[0]}.csv`);
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

    return (
        <div className="h-full overflow-y-auto w-full bg-gray-50">
            <div className="p-4 sm:p-6 lg:p-8 w-full space-y-6 pb-16">
                
                {/* ======================================================== */}
                {/* CABEÇALHO PRINCIPAL COM AÇÕES RÁPIDAS */}
                {/* ======================================================== */}
                <div className="bg-white rounded-2xl shadow-xs border border-zinc-200/80 p-5 sm:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200/70 flex items-center justify-center text-red-600 shrink-0">
                                <Activity className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
                                    Demanda e Fila Diária
                                </h1>
                                <p className="text-zinc-500 text-xs sm:text-sm mt-0.5">
                                    Monitoramento operacional do fluxo de abertura, acúmulo e resolução de chamados e chats.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                        {/* Botão de Exportar CSV */}
                        <button
                            id="btn-export-demand-csv"
                            type="button"
                            onClick={handleExportCSV}
                            disabled={sortedTableData.length === 0}
                            title="Exportar dados filtrados para CSV"
                            className="px-3.5 py-2 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
                        >
                            <Download className="w-3.5 h-3.5 text-zinc-500" />
                            <span className="hidden sm:inline">Exportar CSV</span>
                        </button>

                        {/* Botão de Novo Registro */}
                        <button 
                            id="btn-new-demand-record"
                            type="button"
                            onClick={handleOpenCreate}
                            className="bg-red-600 hover:bg-red-700 active:bg-red-800 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Novo Lançamento</span>
                        </button>
                    </div>
                </div>

                {/* ======================================================== */}
                {/* BARRA DE FILTROS AVANÇADOS */}
                {/* ======================================================== */}
                <div id="demand-filters-container" className="bg-white rounded-2xl shadow-xs border border-zinc-200/80 p-4 sm:p-5 space-y-4">
                    
                    {/* Linha 1: Filtros de Período Preset (Segmented Controls) */}
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 border-b border-zinc-100 pb-3">
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 w-full scrollbar-none">
                            <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
                                <CalendarRange className="w-3.5 h-3.5 text-red-600" />
                                Período:
                            </span>

                            {PRESETS.map(preset => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => setPeriodPreset(preset.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                        periodPreset === preset.id
                                            ? 'bg-red-600 text-white shadow-2xs'
                                            : 'bg-zinc-100/80 text-zinc-600 hover:bg-zinc-200/70'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>

                        {/* Seletor de Modo de Visualização (1. Gráficos, 2. Extrato, 3. Completo) */}
                        <div className="flex items-center gap-1 bg-zinc-100/90 p-1 rounded-xl self-end lg:self-auto shrink-0">
                            <button
                                type="button"
                                onClick={() => setViewMode('charts')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                                    viewMode === 'charts' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'
                                }`}
                            >
                                <BarChart2 className="w-3.5 h-3.5 text-blue-500" />
                                <span>Gráficos</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('table')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                                    viewMode === 'table' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'
                                }`}
                            >
                                <FileText className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Extrato</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('all')}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                                    viewMode === 'all' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-500 hover:text-zinc-800'
                                }`}
                            >
                                <Activity className="w-3.5 h-3.5 text-red-500" />
                                <span>Completo</span>
                            </button>
                        </div>
                    </div>

                    {/* Linha 2: Datas Personalizadas se o preset 'custom' estiver ativo */}
                    {periodPreset === 'custom' && (
                        <div className="bg-red-50/50 border border-red-200/60 rounded-xl p-3 flex flex-wrap items-center gap-3">
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
                                    className="bg-white border border-zinc-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-zinc-800 outline-none focus:ring-2 focus:ring-red-500"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-zinc-500 font-medium">Até:</span>
                                <input
                                    type="date"
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                    className="bg-white border border-zinc-300 rounded-lg px-2.5 py-1 text-xs font-semibold text-zinc-800 outline-none focus:ring-2 focus:ring-red-500"
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

                    {/* Linha 3: Filtros Multicritério (Canal, Tendência, Dia da Semana, Busca e Ordenação) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-1">
                        
                        {/* Filtro por Canal de Demanda */}
                        <div>
                            <label className="block text-[11px] font-bold text-zinc-500 mb-1 flex items-center gap-1">
                                <Filter className="w-3 h-3 text-red-500" /> Canal:
                            </label>
                            <select
                                value={channelFilter}
                                onChange={(e) => setChannelFilter(e.target.value)}
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-zinc-800 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 cursor-pointer"
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
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-zinc-800 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 cursor-pointer"
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
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-zinc-800 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 cursor-pointer"
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
                                className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-2 text-xs font-semibold text-zinc-800 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 cursor-pointer"
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
                                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-8 pr-7 py-2 text-xs font-medium text-zinc-800 outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
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

                    {/* Barra inferior de status dos filtros */}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100 text-xs text-zinc-500">
                        <div>
                            Exibindo <strong className="text-zinc-900 font-bold">{filteredData.length}</strong> de <strong className="text-zinc-900 font-bold">{historicalData.length}</strong> dias registrados
                        </div>

                        {hasActiveCustomFilters && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="text-xs font-bold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" /> Limpar Filtros
                            </button>
                        )}
                    </div>
                </div>

                {/* ======================================================== */}
                {/* GRADE DE CARDS ESTATÍSTICOS DE PERFORMANCE OPERACIONAL */}
                {/* ======================================================== */}
                <div id="demand-kpis-grid" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    
                    {/* CARD 1: MÉDIA INÍCIO CHAMADOS */}
                    <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-2xs flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                <Ticket className="w-3 h-3 text-emerald-500" />
                                Chamados (Início)
                            </span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-zinc-900 font-mono tracking-tight">
                            {metrics.avgStartTickets}
                        </div>
                        <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
                            <span>Média de abertura</span>
                            <span className="font-bold text-zinc-700">tot: {metrics.totalStartTickets}</span>
                        </div>
                    </div>

                    {/* CARD 2: MÉDIA FIM CHAMADOS */}
                    <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-2xs flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                <Ticket className="w-3 h-3 text-emerald-700" />
                                Chamados (Fim)
                            </span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono tracking-tight">
                            {metrics.avgEndTickets}
                        </div>
                        <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
                            <span className="text-zinc-500">Variação diária:</span>
                            <span className={`font-bold flex items-center gap-0.5 ${metrics.netDeltaTickets <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {metrics.netDeltaTickets <= 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                {metrics.netDeltaTickets > 0 ? `+${metrics.netDeltaTickets}` : metrics.netDeltaTickets}
                            </span>
                        </div>
                    </div>

                    {/* CARD 3: MÉDIA INÍCIO CHATS */}
                    <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-2xs flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                <MessageSquare className="w-3 h-3 text-purple-500" />
                                Chats (Início)
                            </span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-zinc-900 font-mono tracking-tight">
                            {metrics.avgStartChats}
                        </div>
                        <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
                            <span>Média de abertura</span>
                            <span className="font-bold text-zinc-700">tot: {metrics.totalStartChats}</span>
                        </div>
                    </div>

                    {/* CARD 4: MÉDIA FIM CHATS */}
                    <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-2xs flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                <MessageSquare className="w-3 h-3 text-indigo-600" />
                                Chats (Fim)
                            </span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-indigo-600 font-mono tracking-tight">
                            {metrics.avgEndChats}
                        </div>
                        <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px]">
                            <span className="text-zinc-500">Variação diária:</span>
                            <span className={`font-bold flex items-center gap-0.5 ${metrics.netDeltaChats <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {metrics.netDeltaChats <= 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                                {metrics.netDeltaChats > 0 ? `+${metrics.netDeltaChats}` : metrics.netDeltaChats}
                            </span>
                        </div>
                    </div>

                    {/* CARD 5: SALDO LÍQUIDO MÉDIO DA FILA */}
                    <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-2xs flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                <Activity className="w-3 h-3 text-amber-500" />
                                Saldo Médio Dia
                            </span>
                        </div>
                        <div className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${metrics.netDeltaTotal <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {metrics.netDeltaTotal > 0 ? `+${metrics.netDeltaTotal}` : metrics.netDeltaTotal}
                        </div>
                        <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
                            <span>Fluxo diário:</span>
                            <span className="font-bold text-zinc-800">
                                {metrics.netDeltaTotal < 0 ? 'Redução' : (metrics.netDeltaTotal > 0 ? 'Sobrecarga' : 'Equilíbrio')}
                            </span>
                        </div>
                    </div>

                    {/* CARD 6: TAXA DE DIAS COM REDUÇÃO / EFICIÊNCIA */}
                    <div className="bg-white p-4 rounded-2xl border border-zinc-200/80 shadow-2xs flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                Resolução Diária
                            </span>
                        </div>
                        <div className="text-2xl sm:text-3xl font-black text-zinc-900 font-mono tracking-tight">
                            {metrics.resolutionRate}%
                        </div>
                        <div className="mt-2 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
                            <span>Dias c/ fila menor:</span>
                            <span className="font-bold text-emerald-600">Fim &le; Início</span>
                        </div>
                    </div>
                </div>

                {/* ======================================================== */}
                {/* SEÇÃO DE GRÁFICOS ANALÍTICOS */}
                {/* ======================================================== */}
                {(viewMode === 'all' || viewMode === 'charts') && (
                    <div className="space-y-6">
                        {/* Linha 1 de Gráficos: Chamados vs Chats com visual refinado */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            
                            {/* GRÁFICO 1: EVOLUÇÃO DE FILA DE CHAMADOS (INÍCIO VS FIM) */}
                            <div className="bg-white rounded-2xl shadow-xs border border-zinc-200/80 p-5 sm:p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                                            <Ticket className="w-4 h-4 text-emerald-600" />
                                            Evolução da Fila de Chamados (Início vs Fim)
                                        </h3>
                                        <p className="text-[11px] text-zinc-400 mt-0.5">
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
                            <div className="bg-white rounded-2xl shadow-xs border border-zinc-200/80 p-5 sm:p-6">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                                            <MessageSquare className="w-4 h-4 text-purple-600" />
                                            Evolução da Fila de Chats (Início vs Fim)
                                        </h3>
                                        <p className="text-[11px] text-zinc-400 mt-0.5">
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
                            <div className="bg-white rounded-2xl shadow-xs border border-zinc-200/80 p-5 sm:p-6 lg:col-span-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                                    <div>
                                        <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                                            <BarChart2 className="w-4 h-4 text-zinc-600" />
                                            Comparativo Geral: Início vs Fim do Expediente
                                        </h3>
                                        <p className="text-[11px] text-zinc-400 mt-0.5">
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
                            <div className="bg-white rounded-2xl shadow-xs border border-zinc-200/80 p-5 sm:p-6">
                                <div className="mb-4">
                                    <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-indigo-600" />
                                        Média por Dia da Semana
                                    </h3>
                                    <p className="text-[11px] text-zinc-400 mt-0.5">
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
                    <div id="demand-table-container" className="bg-white rounded-2xl shadow-xs border border-zinc-200/80 overflow-hidden flex flex-col">
                        <div className="p-4 sm:p-5 border-b border-zinc-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white">
                            <div>
                                <h2 className="text-sm sm:text-base font-bold text-zinc-900 flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-red-600" />
                                    Extrato Detalhado de Registros Diários
                                </h2>
                                <p className="text-zinc-500 text-xs mt-0.5">
                                    Visualização completa com comparativo de abertura, fechamento e saldo líquido operacional do dia.
                                </p>
                            </div>

                            <span className="text-xs text-zinc-500 font-medium bg-zinc-100 px-2.5 py-1 rounded-lg">
                                Total no filtro: <strong className="text-zinc-900">{sortedTableData.length}</strong> dia(s)
                            </span>
                        </div>

                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 z-10 bg-zinc-900 text-white text-[11px] uppercase tracking-wider font-bold">
                                    <tr>
                                        <th className="p-3.5 pl-5">Data & Dia</th>
                                        <th className="p-3.5 text-center bg-zinc-800/60">
                                            <span className="flex items-center justify-center gap-1">
                                                <Clock className="w-3 h-3 text-emerald-400" />
                                                Início (Chamados)
                                            </span>
                                        </th>
                                        <th className="p-3.5 text-center bg-zinc-800/60">
                                            <span className="flex items-center justify-center gap-1">
                                                <Clock className="w-3 h-3 text-purple-400" />
                                                Início (Chats)
                                            </span>
                                        </th>
                                        <th className="p-3.5 text-center bg-zinc-850">
                                            <span className="flex items-center justify-center gap-1">
                                                <Clock className="w-3 h-3 text-emerald-500" />
                                                Fim (Chamados)
                                            </span>
                                        </th>
                                        <th className="p-3.5 text-center bg-zinc-850">
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
                                <tbody className="text-xs text-zinc-700 divide-y divide-zinc-100 font-medium">
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
                                            <tr key={row.id} className="hover:bg-zinc-50/80 transition-colors">
                                                <td className="p-3.5 pl-5">
                                                    <div className="font-bold text-zinc-900 flex items-center gap-1.5">
                                                        <span>{formatDisplayDate(row.date)}</span>
                                                        <span className="text-[10px] font-semibold text-zinc-600 bg-zinc-100 px-1.5 py-0.5 rounded">
                                                            {weekday}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Início Chamados */}
                                                <td className="p-3.5 text-center font-mono font-bold text-zinc-800">
                                                    {sTickets !== null ? sTickets : <span className="text-zinc-300">--</span>}
                                                </td>

                                                {/* Início Chats */}
                                                <td className="p-3.5 text-center font-mono font-bold text-zinc-800">
                                                    {sChats !== null ? sChats : <span className="text-zinc-300">--</span>}
                                                </td>

                                                {/* Fim Chamados */}
                                                <td className="p-3.5 text-center font-mono font-bold text-emerald-700 bg-emerald-50/20">
                                                    {eTickets !== null ? (
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <span>{eTickets}</span>
                                                            {sTickets !== null && (
                                                                <span className={`text-[10px] font-bold ${eTickets <= sTickets ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                    ({eTickets - sTickets > 0 ? `+${eTickets - sTickets}` : eTickets - sTickets})
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-300">--</span>
                                                    )}
                                                </td>

                                                {/* Fim Chats */}
                                                <td className="p-3.5 text-center font-mono font-bold text-indigo-700 bg-indigo-50/20">
                                                    {eChats !== null ? (
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <span>{eChats}</span>
                                                            {sChats !== null && (
                                                                <span className={`text-[10px] font-bold ${eChats <= sChats ? 'text-emerald-600' : 'text-red-600'}`}>
                                                                    ({eChats - sChats > 0 ? `+${eChats - sChats}` : eChats - sChats})
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-zinc-300">--</span>
                                                    )}
                                                </td>

                                                {/* Saldo Líquido do Dia */}
                                                <td className="p-3.5 text-center">
                                                    {deltaTotal !== null ? (
                                                        <span className={`inline-flex items-center gap-1 font-mono font-bold text-xs px-2 py-0.5 rounded-lg ${
                                                            deltaTotal < 0 
                                                                ? 'bg-emerald-100/70 text-emerald-800' 
                                                                : (deltaTotal > 0 ? 'bg-red-100/70 text-red-800' : 'bg-zinc-100 text-zinc-700')
                                                        }`}>
                                                            {deltaTotal < 0 ? <TrendingDown className="w-3 h-3" /> : (deltaTotal > 0 ? <TrendingUp className="w-3 h-3" /> : <Minus className="w-3 h-3" />)}
                                                            {deltaTotal > 0 ? `+${deltaTotal}` : deltaTotal}
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-300 font-mono">--</span>
                                                    )}
                                                </td>

                                                {/* Observações */}
                                                <td className="p-3.5 text-zinc-600 max-w-[200px] truncate" title={row.notes || ''}>
                                                    {row.notes ? (
                                                        <span className="text-[11px] text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded">
                                                            {row.notes}
                                                        </span>
                                                    ) : (
                                                        <span className="text-zinc-300 text-[11px] italic">Sem obs</span>
                                                    )}
                                                </td>

                                                {/* Ações */}
                                                <td className="p-3.5 pr-5 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleOpenEdit(row)} 
                                                            className="p-1.5 text-zinc-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                                            title="Editar registro diário"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => setDeleteConfirmItem(row)} 
                                                            className="p-1.5 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
                                            <td colSpan="8" className="p-8 text-center bg-white">
                                                <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-zinc-500 space-y-2">
                                                    <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400">
                                                        <Activity className="w-5 h-5" />
                                                    </div>
                                                    <h4 className="text-sm font-bold text-zinc-800">Nenhum registro encontrado</h4>
                                                    <p className="text-xs text-zinc-500 text-center">
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
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-zinc-200">
                            
                            {/* Cabeçalho do Modal */}
                            <div className="p-5 border-b border-zinc-100 flex justify-between items-center bg-zinc-900 text-white">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
                                        <Activity className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold tracking-tight">
                                            {isEditing ? 'Editar Registro Diário' : 'Novo Registro de Demanda'}
                                        </h2>
                                        <span className="text-[11px] text-zinc-400 block">
                                            {formatDisplayDate(date)}
                                        </span>
                                    </div>
                                </div>
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)} 
                                    className="p-1 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <div className="p-5 sm:p-6 space-y-4">
                                {message.text && (
                                    <div className={`p-3 rounded-xl text-xs flex items-center gap-2 font-medium ${
                                        message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    }`}>
                                        {message.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
                                        <span>{message.text}</span>
                                    </div>
                                )}

                                <form onSubmit={handleSave} className="space-y-4">
                                    
                                    {/* Data de Referência */}
                                    <div>
                                        <label className="block text-xs font-bold text-zinc-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5 text-red-600" />
                                            Data de Referência
                                        </label>
                                        <input 
                                            type="date" 
                                            value={date}
                                            onChange={(e) => handleDateChange(e.target.value)}
                                            className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-zinc-800 font-semibold text-sm transition-all"
                                            required
                                        />
                                    </div>

                                    {/* Seção: Início do Expediente */}
                                    <div className="p-3.5 bg-emerald-50/40 rounded-xl border border-emerald-200/60 space-y-3">
                                        <h3 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-emerald-600" /> Início do Expediente (Abertura da Fila)
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[11px] text-zinc-600 mb-1 font-semibold">Chamados Pendentes</label>
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    value={startTickets} 
                                                    onChange={e => setStartTickets(e.target.value)} 
                                                    className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg outline-none focus:border-emerald-500 text-sm font-mono font-bold text-zinc-800" 
                                                    placeholder="0" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] text-zinc-600 mb-1 font-semibold">Chats na Fila</label>
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    value={startChats} 
                                                    onChange={e => setStartChats(e.target.value)} 
                                                    className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg outline-none focus:border-emerald-500 text-sm font-mono font-bold text-zinc-800" 
                                                    placeholder="0" 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Seção: Fim do Expediente */}
                                    <div className="p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-200/60 space-y-3">
                                        <h3 className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-indigo-600" /> Fim do Expediente (Encerramento da Fila)
                                        </h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[11px] text-zinc-600 mb-1 font-semibold">Chamados Pendentes</label>
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    value={endTickets} 
                                                    onChange={e => setEndTickets(e.target.value)} 
                                                    className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg outline-none focus:border-indigo-500 text-sm font-mono font-bold text-zinc-800" 
                                                    placeholder="0" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] text-zinc-600 mb-1 font-semibold">Chats na Fila</label>
                                                <input 
                                                    type="number" 
                                                    min="0" 
                                                    value={endChats} 
                                                    onChange={e => setEndChats(e.target.value)} 
                                                    className="w-full px-3 py-1.5 bg-white border border-zinc-200 rounded-lg outline-none focus:border-indigo-500 text-sm font-mono font-bold text-zinc-800" 
                                                    placeholder="0" 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Observações Opcionais */}
                                    <div>
                                        <label className="block text-[11px] font-bold text-zinc-600 uppercase tracking-wider mb-1">
                                            Observações do Dia (Opcional)
                                        </label>
                                        <input
                                            type="text"
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            placeholder="Ex: Queda de link externa, Feriado municipal, etc."
                                            className="w-full px-3 py-2 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-xs text-zinc-800"
                                            maxLength={150}
                                        />
                                    </div>

                                    {/* Prévia do Saldo Projetado */}
                                    {(startTickets !== '' || endTickets !== '' || startChats !== '' || endChats !== '') && (
                                        <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 flex items-center justify-between text-xs">
                                            <span className="text-zinc-600 font-medium">Saldo Projetado:</span>
                                            {(() => {
                                                const sTot = (Number(startTickets) || 0) + (Number(startChats) || 0);
                                                const eTot = (Number(endTickets) || 0) + (Number(endChats) || 0);
                                                const diff = eTot - sTot;
                                                return (
                                                    <span className={`font-mono font-bold ${diff <= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                                                        {diff > 0 ? `+${diff}` : diff} {diff <= 0 ? '(Fila Limpou)' : '(Fila Acumulou)'}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {/* Botão Salvar */}
                                    <button 
                                        type="submit" 
                                        disabled={isSaving}
                                        className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                                    >
                                        {isSaving ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        ) : (
                                            <Save className="w-4 h-4" />
                                        )}
                                        <span>{isSaving ? 'Salvando...' : (isEditing ? 'Atualizar Registro' : 'Salvar Registro')}</span>
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* ======================================================== */}
                {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
                {/* ======================================================== */}
                {deleteConfirmItem && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150 border border-zinc-200">
                            <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-zinc-900">Excluir Registro?</h3>
                                <p className="text-xs text-zinc-500 mt-1">
                                    Deseja realmente remover os dados do dia <strong className="text-zinc-800">{formatDisplayDate(deleteConfirmItem.date)}</strong>? Esta ação não poderá ser desfeita.
                                </p>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setDeleteConfirmItem(null)}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmDelete}
                                    disabled={isDeleting}
                                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
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

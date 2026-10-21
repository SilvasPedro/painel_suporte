import React, { useState, useEffect, useMemo } from 'react';
import { 
    Calendar, LayoutGrid, ChevronLeft, ChevronRight, Save, 
    Loader2, Users, GripVertical, X, Plus, Search, 
    Coffee, AlertCircle, CheckCircle2, Clock, Filter,
    Sparkles, ArrowRight, UserCheck, CalendarDays, ShieldAlert
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeSharedCollection, subscribeSharedDocument } from '../services/dataCache';
import { useNotification } from '../context/NotificationContext';

// Helper para obter dias do mês formatados em grade de calendário (com padding)
const getCalendarMatrix = (year, month) => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const days = [];
    
    // Dias de preenchimento do mês anterior para alinhar ao domingo (0)
    const startDayOfWeek = firstDayOfMonth.getDay();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
        const prevDate = new Date(year, month, -i);
        days.push({
            date: prevDate,
            dateString: formatDateString(prevDate),
            dayNumber: prevDate.getDate(),
            isCurrentMonth: false,
            dayOfWeek: prevDate.getDay()
        });
    }
    
    // Dias do mês atual
    for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
        const date = new Date(year, month, d);
        days.push({
            date,
            dateString: formatDateString(date),
            dayNumber: d,
            isCurrentMonth: true,
            dayOfWeek: date.getDay()
        });
    }
    
    // Dias de preenchimento do próximo mês para fechar linhas completas de 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
        const nextDate = new Date(year, month + 1, i);
        days.push({
            date: nextDate,
            dateString: formatDateString(nextDate),
            dayNumber: nextDate.getDate(),
            isCurrentMonth: false,
            dayOfWeek: nextDate.getDay()
        });
    }
    
    return days;
};

const formatDateString = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const SHIFT_COLORS = {
    'Manhã I': 'bg-blue-50 text-blue-700 border-blue-200',
    'Manhã II': 'bg-sky-50 text-sky-700 border-sky-200',
    'Tarde I': 'bg-purple-50 text-purple-700 border-purple-200',
    'Tarde II': 'bg-violet-50 text-violet-700 border-violet-200',
    'Noturno': 'bg-amber-50 text-amber-800 border-amber-200',
    'Madrugada': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'default': 'bg-gray-50 text-gray-700 border-gray-200'
};

const getShiftBadgeClass = (shift) => {
    if (!shift) return SHIFT_COLORS.default;
    return SHIFT_COLORS[shift] || SHIFT_COLORS.default;
};

// Formata Nome e Sobrenome para exibição clara de colaboradores homônimos
const formatFirstAndLastName = (fullName) => {
    if (!fullName || typeof fullName !== 'string') return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return parts[0] || '';

    const prepositions = ['de', 'da', 'do', 'dos', 'das', 'e'];
    if (parts.length >= 3 && prepositions.includes(parts[1].toLowerCase())) {
        return `${parts[0]} ${parts[1]} ${parts[2]}`;
    }
    return `${parts[0]} ${parts[1]}`;
};

export const DayOffSchedule = ({ readOnly = false }) => {
    const { showToast } = useNotification();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'cards'
    const [cardsGroupBy, setCardsGroupBy] = useState('days'); // 'days' | 'collaborators'
    
    const [collaborators, setCollaborators] = useState([]);
    const [schedule, setSchedule] = useState({});
    const [originalSchedule, setOriginalSchedule] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Drag & Drop
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverDate, setDragOverDate] = useState(null);
    
    // Filtros e busca
    const [searchColab, setSearchColab] = useState('');
    const [selectedShiftFilter, setSelectedShiftFilter] = useState('all');
    
    // Modal de seleção rápida por clique (acessibilidade / mobile)
    const [quickAddDate, setQuickAddDate] = useState(null);
    const [quickAddSearch, setQuickAddSearch] = useState('');

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const documentId = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    const calendarDays = useMemo(() => {
        return getCalendarMatrix(year, month);
    }, [year, month]);

    const isDirty = useMemo(() => {
        return JSON.stringify(schedule) !== JSON.stringify(originalSchedule);
    }, [schedule, originalSchedule]);

    // 1. Carrega colaboradores ativos via cache compartilhado
    useEffect(() => {
        const unsub = subscribeSharedCollection("collaborators", (items) => {
            const activeColabs = items
                .filter(c => c.active !== false && String(c.status || '').toLowerCase() !== 'inativo')
                .map(c => ({
                    id: c.id || c.firestoreId || c.uid,
                    name: c.name || c.email?.split('@')[0] || 'Colaborador',
                    shift: c.shift || 'Manhã I',
                    role: c.role || 'Operador',
                    photoURL: c.photoURL || c.photoUrl || null
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
            setCollaborators(activeColabs);
        });

        return () => unsub();
    }, []);

    // 2. Carrega escala de folgas do mês via Firestore
    useEffect(() => {
        let isMounted = true;
        const unsub = subscribeSharedDocument("day_off_schedules", documentId, (docData) => {
            if (!isMounted) return;
            if (docData && docData.assignments) {
                setSchedule(docData.assignments);
                setOriginalSchedule(docData.assignments);
            } else {
                setSchedule({});
                setOriginalSchedule({});
            }
            setLoading(false);
        });

        // Timeout de segurança preventiva contra loop infinito de carregamento
        const safetyTimer = setTimeout(() => {
            if (isMounted) setLoading(false);
        }, 1200);

        return () => {
            isMounted = false;
            clearTimeout(safetyTimer);
            unsub();
        };
    }, [documentId]);

    // Navegação de Meses
    const handlePrevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
    };

    const handleCurrentMonth = () => {
        setCurrentDate(new Date());
    };

    // Contagem de folgas por colaborador no mês corrente
    const colabOffCountMap = useMemo(() => {
        const counts = {};
        Object.values(schedule).forEach(list => {
            if (Array.isArray(list)) {
                list.forEach(c => {
                    counts[c.id] = (counts[c.id] || 0) + 1;
                });
            }
        });
        return counts;
    }, [schedule]);

    // Total de folgas marcadas no mês
    const totalOffsInMonth = useMemo(() => {
        let total = 0;
        Object.entries(schedule).forEach(([dateStr, list]) => {
            if (dateStr.startsWith(documentId) && Array.isArray(list)) {
                total += list.length;
            }
        });
        return total;
    }, [schedule, documentId]);

    // Colaboradores filtrados na barra lateral
    const filteredCollaborators = useMemo(() => {
        return collaborators.filter(c => {
            const matchesName = c.name.toLowerCase().includes(searchColab.toLowerCase());
            const matchesShift = selectedShiftFilter === 'all' || c.shift === selectedShiftFilter;
            return matchesName && matchesShift;
        });
    }, [collaborators, searchColab, selectedShiftFilter]);

    // --- SALVAR NO FIRESTORE ---
    const handleSave = async () => {
        if (readOnly) return;
        setSaving(true);
        try {
            await setDoc(doc(db, "day_off_schedules", documentId), {
                month: documentId,
                assignments: schedule,
                totalOffs: totalOffsInMonth,
                updatedAt: new Date()
            }, { merge: true });
            
            setOriginalSchedule(schedule);
            showToast("Escala de folgas salva com sucesso!", "success");
        } catch (err) {
            console.error("Erro ao salvar folgas:", err);
            showToast("Erro ao salvar escala de folgas.", "error");
        } finally {
            setSaving(false);
        }
    };

    // --- DRAG & DROP HANDLERS ---
    const handleDragStart = (e, colab, sourceDate) => {
        if (readOnly) return;
        setDraggedItem({ colab, sourceDate });
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", JSON.stringify({ colab, sourceDate }));
        setTimeout(() => {
            if (e.target) e.target.style.opacity = '0.4';
        }, 0);
    };

    const handleDragEnd = (e) => {
        if (readOnly) return;
        if (e.target) e.target.style.opacity = '1';
        setDraggedItem(null);
        setDragOverDate(null);
    };

    const handleDragOver = (e, dateString) => {
        if (readOnly) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragOverDate !== dateString) {
            setDragOverDate(dateString);
        }
    };

    const handleDragLeave = () => {
        if (readOnly) return;
        setDragOverDate(null);
    };

    const handleDrop = (e, targetDate) => {
        if (readOnly) return;
        e.preventDefault();
        setDragOverDate(null);

        if (!draggedItem) return;
        const { colab, sourceDate } = draggedItem;

        if (sourceDate === targetDate) return;

        setSchedule(prev => {
            const next = { ...prev };
            
            // Se veio de outro dia, remove da origem
            if (sourceDate && next[sourceDate]) {
                next[sourceDate] = next[sourceDate].filter(c => c.id !== colab.id);
            }

            // Adiciona no dia de destino se já não estiver
            if (!next[targetDate]) {
                next[targetDate] = [];
            }
            if (!next[targetDate].some(c => c.id === colab.id)) {
                next[targetDate] = [...next[targetDate], colab];
            }

            return next;
        });
    };

    // Adição rápida via clique (modal/dropdown)
    const handleAddColabToDate = (colab, targetDate) => {
        if (readOnly || !targetDate || !colab) return;
        setSchedule(prev => {
            const next = { ...prev };
            if (!next[targetDate]) next[targetDate] = [];
            if (!next[targetDate].some(c => c.id === colab.id)) {
                next[targetDate] = [...next[targetDate], colab];
            }
            return next;
        });
        setQuickAddDate(null);
    };

    // Remoção de folga
    const handleRemoveOff = (dateString, colabId) => {
        if (readOnly) return;
        setSchedule(prev => {
            const next = { ...prev };
            if (next[dateString]) {
                next[dateString] = next[dateString].filter(c => c.id !== colabId);
                if (next[dateString].length === 0) {
                    delete next[dateString];
                }
            }
            return next;
        });
    };

    const todayString = formatDateString(new Date());

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
            {/* BARRA SUPERIOR DE COMANDOS */}
            <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center shrink-0 shadow-xs">
                        <Coffee className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                                Escala de Folgas
                            </h1>
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                {MONTH_NAMES[month]} {year}
                            </span>
                            {totalOffsInMonth > 0 && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                                    {totalOffsInMonth} {totalOffsInMonth === 1 ? 'folga programada' : 'folgas programadas'}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 hidden sm:block">
                            Arraste os colaboradores ativos para os dias do mês ou clique em + para atribuir folgas
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Seletor de Modo de Visualização (Calendário x Cards) */}
                    <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setViewMode('calendar')}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                                viewMode === 'calendar'
                                    ? 'bg-white text-gray-900 shadow-xs font-black'
                                    : 'text-gray-500 hover:text-gray-900'
                            }`}
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Calendário</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('cards')}
                            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer ${
                                viewMode === 'cards'
                                    ? 'bg-white text-gray-900 shadow-xs font-black'
                                    : 'text-gray-500 hover:text-gray-900'
                            }`}
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span>Cards</span>
                        </button>
                    </div>

                    {/* Navegador de Mês */}
                    <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="p-1.5 hover:bg-white rounded-lg text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                            title="Mês Anterior"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={handleCurrentMonth}
                            className="px-2.5 py-1 text-xs font-bold text-gray-700 hover:text-gray-900 transition-colors cursor-pointer"
                        >
                            Hoje
                        </button>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="p-1.5 hover:bg-white rounded-lg text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                            title="Próximo Mês"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Botão de Salvar Alterações */}
                    {!readOnly && (
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !isDirty}
                            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
                                isDirty
                                    ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                            }`}
                        >
                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            <span>{saving ? 'Salvando...' : isDirty ? 'Salvar Folgas' : 'Salvo'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* CORPO PRINCIPAL COM SIDEBAR ARRASTÁVEL E CONTEÚDO */}
            <div className="flex-1 flex overflow-hidden">
                {/* 1. BARRA LATERAL: COLABORADORES ATIVOS (DRAGGABLE) */}
                {!readOnly && (
                    <aside className="w-64 sm:w-72 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-hidden shadow-xs z-10">
                        <div className="p-3.5 border-b border-gray-100 space-y-2.5 bg-gray-50/50">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-red-600" />
                                    Colaboradores Ativos ({collaborators.length})
                                </span>
                            </div>

                            {/* Campo de Busca */}
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchColab}
                                    onChange={(e) => setSearchColab(e.target.value)}
                                    placeholder="Buscar pelo nome..."
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500 font-medium"
                                />
                            </div>

                            {/* Filtro por Turno */}
                            <select
                                value={selectedShiftFilter}
                                onChange={(e) => setSelectedShiftFilter(e.target.value)}
                                className="w-full py-1 px-2 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 font-semibold focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer"
                            >
                                <option value="all">Todos os Turnos</option>
                                <option value="Manhã I">Manhã I</option>
                                <option value="Manhã II">Manhã II</option>
                                <option value="Tarde I">Tarde I</option>
                                <option value="Tarde II">Tarde II</option>
                                <option value="Noturno">Noturno</option>
                                <option value="Madrugada">Madrugada</option>
                            </select>
                        </div>

                        {/* Lista de Colaboradores Arrastáveis */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
                            {filteredCollaborators.length === 0 ? (
                                <div className="p-6 text-center text-xs text-gray-400">
                                    Nenhum colaborador encontrado
                                </div>
                            ) : (
                                filteredCollaborators.map(colab => {
                                    const offCount = colabOffCountMap[colab.id] || 0;
                                    return (
                                        <div
                                            key={colab.id}
                                            draggable={!readOnly}
                                            onDragStart={(e) => handleDragStart(e, colab, null)}
                                            onDragEnd={handleDragEnd}
                                            className="p-2 bg-white hover:bg-red-50/40 rounded-xl border border-gray-200 hover:border-red-300 shadow-2xs cursor-grab active:cursor-grabbing transition-all flex items-center justify-between gap-2 group select-none"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <GripVertical className="w-3.5 h-3.5 text-gray-300 group-hover:text-red-500 shrink-0" />
                                                <div className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-black text-xs flex items-center justify-center shrink-0 overflow-hidden border border-red-200">
                                                    {colab.photoURL ? (
                                                        <img src={colab.photoURL} alt={colab.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        colab.name.charAt(0).toUpperCase()
                                                    )}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-gray-800 truncate leading-tight group-hover:text-red-700">
                                                        {colab.name}
                                                    </p>
                                                    <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded border ${getShiftBadgeClass(colab.shift)}`}>
                                                        {colab.shift}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Badge de Folgas no Mês */}
                                            <span 
                                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full shrink-0 ${
                                                    offCount > 0 
                                                        ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                                                        : 'bg-gray-100 text-gray-500'
                                                }`}
                                                title={`${offCount} folga(s) agendada(s) em ${MONTH_NAMES[month]}`}
                                            >
                                                {offCount}d
                                            </span>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </aside>
                )}

                {/* 2. ÁREA DE VISUALIZAÇÃO: CALENDÁRIO OU CARDS */}
                <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50 flex flex-col">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12">
                            <Loader2 className="w-8 h-8 text-red-600 animate-spin mb-3" />
                            <span className="text-xs font-bold text-gray-500">Carregando escala de folgas...</span>
                        </div>
                    ) : viewMode === 'calendar' ? (
                        /* ======================================================== */
                        /* MODO 1: ESTILO CALENDÁRIO                                 */
                        /* ======================================================== */
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col flex-1">
                            {/* Cabeçalho dos Dias da Semana */}
                            <div className="grid grid-cols-7 bg-gray-50/80 border-b border-gray-200 text-center py-2.5 text-xs font-black uppercase tracking-wider text-gray-500 select-none">
                                {WEEK_DAYS.map((day, idx) => (
                                    <div key={day} className={idx === 0 || idx === 6 ? 'text-red-500' : ''}>
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Grade de Dias */}
                            <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-gray-100">
                                {calendarDays.map((cell) => {
                                    const assigned = schedule[cell.dateString] || [];
                                    const isToday = cell.dateString === todayString;
                                    const isDropTarget = dragOverDate === cell.dateString;

                                    return (
                                        <div
                                            key={cell.dateString}
                                            onDragOver={(e) => handleDragOver(e, cell.dateString)}
                                            onDragLeave={handleDragLeave}
                                            onDrop={(e) => handleDrop(e, cell.dateString)}
                                            className={`min-h-[110px] sm:min-h-[130px] p-1.5 sm:p-2 flex flex-col transition-all relative ${
                                                !cell.isCurrentMonth
                                                    ? 'bg-gray-50/40 text-gray-300'
                                                    : isToday
                                                        ? 'bg-red-50/20'
                                                        : 'bg-white'
                                            } ${
                                                isDropTarget
                                                    ? 'ring-2 ring-red-500 ring-inset bg-red-50/60 scale-[0.99]'
                                                    : ''
                                            }`}
                                        >
                                            {/* Cabeçalho do Dia */}
                                            <div className="flex items-center justify-between mb-1.5 select-none">
                                                <span
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black font-mono ${
                                                        isToday
                                                            ? 'bg-red-600 text-white shadow-xs'
                                                            : cell.isCurrentMonth
                                                                ? 'text-gray-800'
                                                                : 'text-gray-300'
                                                    }`}
                                                >
                                                    {cell.dayNumber}
                                                </span>

                                                <div className="flex items-center gap-1">
                                                    {assigned.length > 0 && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-red-100 text-red-700 border border-red-200">
                                                            {assigned.length} {assigned.length === 1 ? 'folga' : 'folgas'}
                                                        </span>
                                                    )}
                                                    {!readOnly && cell.isCurrentMonth && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setQuickAddDate(cell.dateString);
                                                                setQuickAddSearch('');
                                                            }}
                                                            className="w-5 h-5 rounded-md hover:bg-gray-200 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-colors cursor-pointer"
                                                            title="Adicionar colaborador nesta folga"
                                                        >
                                                            <Plus className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Lista de Colaboradores de Folga no Dia */}
                                            <div className="flex-1 space-y-1 overflow-y-auto max-h-[90px] sm:max-h-[110px] scrollbar-hide">
                                                {assigned.map((colab) => (
                                                    <div
                                                        key={colab.id}
                                                        draggable={!readOnly}
                                                        onDragStart={(e) => handleDragStart(e, colab, cell.dateString)}
                                                        onDragEnd={handleDragEnd}
                                                        className="px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-800 hover:border-red-300 hover:bg-red-50/50 flex items-center justify-between gap-1 shadow-2xs group text-[11px] cursor-grab active:cursor-grabbing transition-all select-none"
                                                    >
                                                        <div className="flex items-center gap-1.5 truncate">
                                                            <div className="w-4 h-4 rounded-full bg-red-100 text-red-600 font-bold text-[9px] flex items-center justify-center shrink-0">
                                                                {colab.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span 
                                                                className="font-bold truncate text-gray-900 group-hover:text-red-700"
                                                                title={colab.name}
                                                            >
                                                                {formatFirstAndLastName(colab.name)}
                                                            </span>
                                                        </div>

                                                        {!readOnly && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRemoveOff(cell.dateString, colab.id);
                                                                }}
                                                                className="text-gray-400 hover:text-red-600 rounded p-0.5 opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                                                                title={`Remover folga de ${colab.name}`}
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}

                                                {assigned.length === 0 && cell.isCurrentMonth && (
                                                    <div className="h-full flex items-center justify-center text-[10px] text-gray-300 font-medium select-none">
                                                        Sem folgas
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        /* ======================================================== */
                        /* MODO 2: ESTILO DE CARDS                                   */
                        /* ======================================================== */
                        <div className="space-y-4">
                            {/* Barra de Filtro de Cards */}
                            <div className="flex items-center justify-between flex-wrap gap-2 bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-gray-500">Agrupar cards por:</span>
                                    <div className="flex bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs font-bold">
                                        <button
                                            type="button"
                                            onClick={() => setCardsGroupBy('days')}
                                            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                                                cardsGroupBy === 'days'
                                                    ? 'bg-white text-gray-900 shadow-xs font-black'
                                                    : 'text-gray-500 hover:text-gray-900'
                                            }`}
                                        >
                                            Dias com Folga
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCardsGroupBy('collaborators')}
                                            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                                                cardsGroupBy === 'collaborators'
                                                    ? 'bg-white text-gray-900 shadow-xs font-black'
                                                    : 'text-gray-500 hover:text-gray-900'
                                            }`}
                                        >
                                            Por Colaborador
                                        </button>
                                    </div>
                                </div>

                                <div className="text-xs text-gray-500 font-medium">
                                    Total de <strong>{totalOffsInMonth}</strong> folgas programadas para {MONTH_NAMES[month]}
                                </div>
                            </div>

                            {/* Cards Agrupados por Dias */}
                            {cardsGroupBy === 'days' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                                    {calendarDays
                                        .filter(cell => cell.isCurrentMonth && (schedule[cell.dateString]?.length > 0 || cell.dateString === todayString))
                                        .map((cell) => {
                                            const assigned = schedule[cell.dateString] || [];
                                            const isToday = cell.dateString === todayString;
                                            const isDropTarget = dragOverDate === cell.dateString;

                                            return (
                                                <div
                                                    key={cell.dateString}
                                                    onDragOver={(e) => handleDragOver(e, cell.dateString)}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDrop(e, cell.dateString)}
                                                    className={`bg-white rounded-2xl border p-4 shadow-xs flex flex-col justify-between transition-all ${
                                                        isDropTarget
                                                            ? 'border-red-500 ring-2 ring-red-400/40 bg-red-50/30'
                                                            : isToday
                                                                ? 'border-red-300 ring-1 ring-red-200'
                                                                : 'border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div>
                                                        {/* Header do Card */}
                                                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-8 h-8 rounded-xl bg-gray-100 font-mono font-black text-sm text-gray-900 flex items-center justify-center border border-gray-200">
                                                                    {cell.dayNumber}
                                                                </span>
                                                                <div>
                                                                    <p className="text-xs font-black text-gray-900 capitalize">
                                                                        {cell.date.toLocaleDateString('pt-BR', { weekday: 'long' })}
                                                                    </p>
                                                                    <p className="text-[11px] text-gray-400 font-mono">
                                                                        {cell.dateString} {isToday && '• Hoje'}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                                                                {assigned.length} {assigned.length === 1 ? 'folga' : 'folgas'}
                                                            </span>
                                                        </div>

                                                        {/* Lista de Colaboradores no Card */}
                                                        <div className="pt-3 space-y-2">
                                                            {assigned.map((colab) => (
                                                                <div
                                                                    key={colab.id}
                                                                    draggable={!readOnly}
                                                                    onDragStart={(e) => handleDragStart(e, colab, cell.dateString)}
                                                                    onDragEnd={handleDragEnd}
                                                                    className="p-2 rounded-xl bg-gray-50 border border-gray-200 hover:border-red-300 hover:bg-red-50/30 flex items-center justify-between gap-2 transition-all cursor-grab active:cursor-grabbing group shadow-2xs"
                                                                >
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        <div className="w-6 h-6 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center shrink-0">
                                                                            {colab.name.charAt(0).toUpperCase()}
                                                                        </div>
                                                                        <div className="min-w-0">
                                                                            <p className="text-xs font-bold text-gray-800 truncate">
                                                                                {colab.name}
                                                                            </p>
                                                                            <span className={`text-[9px] font-semibold px-1 py-0.2 rounded border ${getShiftBadgeClass(colab.shift)}`}>
                                                                                {colab.shift}
                                                                            </span>
                                                                        </div>
                                                                    </div>

                                                                    {!readOnly && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveOff(cell.dateString, colab.id)}
                                                                            className="text-gray-400 hover:text-red-600 p-1 rounded-md opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                                                                            title={`Remover ${colab.name}`}
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}

                                                            {assigned.length === 0 && (
                                                                <div className="p-4 text-center text-xs text-gray-400 italic border border-dashed border-gray-200 rounded-xl">
                                                                    Arraste colaboradores aqui para marcar folga
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Rodapé do Card com Ação Rápida */}
                                                    {!readOnly && (
                                                        <div className="pt-3 mt-3 border-t border-gray-100">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setQuickAddDate(cell.dateString);
                                                                    setQuickAddSearch('');
                                                                }}
                                                                className="w-full py-1.5 text-xs font-bold text-gray-600 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-xl border border-gray-200 hover:border-red-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                                            >
                                                                <Plus className="w-3.5 h-3.5" />
                                                                <span>Adicionar Folga</span>
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                </div>
                            ) : (
                                /* Cards Agrupados por Colaborador */
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                                    {collaborators.map((colab) => {
                                        const myOffDates = [];
                                        Object.entries(schedule).forEach(([dateStr, list]) => {
                                            if (dateStr.startsWith(documentId) && Array.isArray(list) && list.some(c => c.id === colab.id)) {
                                                myOffDates.push(dateStr);
                                            }
                                        });
                                        myOffDates.sort();

                                        return (
                                            <div
                                                key={colab.id}
                                                className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-all"
                                            >
                                                <div>
                                                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 font-black text-sm flex items-center justify-center shrink-0 border border-red-200">
                                                                {colab.photoURL ? (
                                                                    <img src={colab.photoURL} alt={colab.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    colab.name.charAt(0).toUpperCase()
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-bold text-gray-900 truncate">
                                                                    {colab.name}
                                                                </p>
                                                                <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${getShiftBadgeClass(colab.shift)}`}>
                                                                    {colab.shift}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-200">
                                                            {myOffDates.length}d
                                                        </span>
                                                    </div>

                                                    <div className="pt-3">
                                                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                                            Dias de Folga ({MONTH_NAMES[month]})
                                                        </p>
                                                        {myOffDates.length === 0 ? (
                                                            <p className="text-xs text-gray-400 italic py-2">
                                                                Nenhuma folga agendada
                                                            </p>
                                                        ) : (
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {myOffDates.map(dStr => {
                                                                    const dayNum = dStr.split('-')[2];
                                                                    return (
                                                                        <span
                                                                            key={dStr}
                                                                            className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-gray-100 text-gray-800 border border-gray-200 flex items-center gap-1.5 shadow-2xs"
                                                                        >
                                                                            <span>Dia {dayNum}</span>
                                                                            {!readOnly && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleRemoveOff(dStr, colab.id)}
                                                                                    className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                                                                >
                                                                                    <X className="w-3 h-3" />
                                                                                </button>
                                                                            )}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* MODAL DE ADIÇÃO RÁPIDA POR CLIQUE (QUICK ADD) */}
            {quickAddDate && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-gray-200 flex flex-col max-h-[85vh]">
                        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                            <div>
                                <h3 className="text-sm font-black text-gray-900">
                                    Adicionar Folga
                                </h3>
                                <p className="text-xs text-gray-500 font-mono">
                                    Data selecionada: <strong>{quickAddDate}</strong>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setQuickAddDate(null)}
                                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="my-3">
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={quickAddSearch}
                                    onChange={(e) => setQuickAddSearch(e.target.value)}
                                    placeholder="Filtrar colaboradores..."
                                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-500"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                            {collaborators
                                .filter(c => c.name.toLowerCase().includes(quickAddSearch.toLowerCase()))
                                .map(colab => {
                                    const isAlreadyAssigned = (schedule[quickAddDate] || []).some(c => c.id === colab.id);
                                    return (
                                        <button
                                            key={colab.id}
                                            type="button"
                                            disabled={isAlreadyAssigned}
                                            onClick={() => handleAddColabToDate(colab, quickAddDate)}
                                            className={`w-full p-2 rounded-xl text-left flex items-center justify-between gap-2 transition-all ${
                                                isAlreadyAssigned
                                                    ? 'bg-gray-50 text-gray-400 cursor-not-allowed opacity-60'
                                                    : 'hover:bg-red-50/60 hover:text-red-700 cursor-pointer border border-transparent hover:border-red-200'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <div className="w-6 h-6 rounded-lg bg-red-100 text-red-700 font-bold text-xs flex items-center justify-center shrink-0">
                                                    {colab.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-xs font-bold text-gray-800 truncate">
                                                    {colab.name}
                                                </span>
                                            </div>

                                            <span className="text-[10px] text-gray-400">
                                                {isAlreadyAssigned ? 'Já escalado' : '+ Atribuir'}
                                            </span>
                                        </button>
                                    );
                                })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DayOffSchedule;

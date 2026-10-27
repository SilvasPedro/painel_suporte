import React, { useState, useEffect, useMemo } from 'react';
import { 
    CalendarDays, Calendar, Save, Loader2, Users, GripVertical, 
    X, Phone, MessageCircle, LifeBuoy, Search, ChevronLeft, 
    ChevronRight, ChevronDown, ChevronsUpDown, Minimize2, Plus, 
    AlertCircle, CheckCircle2, Sparkles, Filter
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeSharedCollection, subscribeSharedDocument } from '../services/dataCache';
import { useNotification } from '../context/NotificationContext';

// Dias da semana para Escala Diária
const DAYS_OF_WEEK = [
    { id: 'segunda', label: 'Segunda-feira', short: 'Seg' },
    { id: 'terca', label: 'Terça-feira', short: 'Ter' },
    { id: 'quarta', label: 'Quarta-feira', short: 'Qua' },
    { id: 'quinta', label: 'Quinta-feira', short: 'Qui' },
    { id: 'sexta', label: 'Sexta-feira', short: 'Sex' },
    { id: 'sabado', label: 'Sábado', short: 'Sáb' }
];

const ROLES = [
    { 
        key: 'telefonia', 
        label: 'Telefonia', 
        icon: <Phone className="w-3.5 h-3.5" />, 
        bg: 'bg-blue-50/70', 
        border: 'border-blue-200', 
        text: 'text-blue-800',
        badge: 'bg-blue-100 text-blue-700'
    },
    { 
        key: 'huggy', 
        label: 'Huggy / Chat', 
        icon: <MessageCircle className="w-3.5 h-3.5" />, 
        bg: 'bg-purple-50/70', 
        border: 'border-purple-200', 
        text: 'text-purple-800',
        badge: 'bg-purple-100 text-purple-700'
    },
    { 
        key: 'apoio', 
        label: 'Apoio Operacional', 
        icon: <LifeBuoy className="w-3.5 h-3.5" />, 
        bg: 'bg-emerald-50/70', 
        border: 'border-emerald-200', 
        text: 'text-emerald-800',
        badge: 'bg-emerald-100 text-emerald-700'
    }
];

const SHIFT_BADGES = {
    'Manhã I': 'bg-blue-50 text-blue-700 border-blue-200',
    'Manhã II': 'bg-sky-50 text-sky-700 border-sky-200',
    'Tarde I': 'bg-purple-50 text-purple-700 border-purple-200',
    'Tarde II': 'bg-violet-50 text-violet-700 border-violet-200',
    'Noturno': 'bg-amber-50 text-amber-800 border-amber-200',
    'Madrugada': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'default': 'bg-gray-50 text-gray-700 border-gray-200'
};

const getSundaysInMonth = (year, month) => {
    const sundays = [];
    const date = new Date(year, month, 1);
    while (date.getDay() !== 0) {
        date.setDate(date.getDate() + 1);
    }
    while (date.getMonth() === month) {
        sundays.push(new Date(date));
        date.setDate(date.getDate() + 7);
    }
    return sundays;
};

const formatDateString = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const OperationalSchedules = ({
    initialTab = 'diaria',
    readOnly = false
}) => {
    const { showToast } = useNotification();
    
    // Switch de Modalidade: 'diaria' | 'plantao'
    const [activeTab, setActiveTab] = useState(() => {
        return (initialTab === 'schedule' || initialTab === 'plantao') ? 'plantao' : 'diaria';
    });

    const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
    if (prevInitialTab !== initialTab) {
        setPrevInitialTab(initialTab);
        setActiveTab((initialTab === 'schedule' || initialTab === 'plantao') ? 'plantao' : 'diaria');
    }

    // Colaboradores ativos
    const [collaborators, setCollaborators] = useState([]);
    const [searchColab, setSearchColab] = useState('');
    const [shiftFilter, setShiftFilter] = useState('all');

    // Estado da Escala Diária (Documento fixo: "fixed_schedule")
    const [dailySchedule, setDailySchedule] = useState({});
    const [originalDailySchedule, setOriginalDailySchedule] = useState({});
    const [loadingDaily, setLoadingDaily] = useState(true);
    const [savingDaily, setSavingDaily] = useState(false);

    // Estado da Escala de Plantão (Documento mensal: "YYYY-MM")
    const [currentSundayDate, setCurrentSundayDate] = useState(new Date());
    const [sundaySchedule, setSundaySchedule] = useState({});
    const [originalSundaySchedule, setOriginalSundaySchedule] = useState({});
    const [loadingSunday, setLoadingSunday] = useState(true);
    const [savingSunday, setSavingSunday] = useState(false);

    // Drag & Drop
    const [draggedColab, setDraggedColab] = useState(null);
    const [dragSource, setDragSource] = useState(null); // { type: 'daily'|'plantao', dayId, roleKey, dateString }
    const [dropHighlight, setDropHighlight] = useState(null);

    // Controle de recolhimento das abas (Telefonia, Huggy/Chat, Apoio) na Escala Diária
    // Padrão: todas recolhidas destacando a quantidade de pessoas alocadas
    const [collapsedRoles, setCollapsedRoles] = useState(() => {
        const initial = {};
        DAYS_OF_WEEK.forEach(day => {
            ROLES.forEach(role => {
                initial[`${day.id}-${role.key}`] = true;
            });
        });
        return initial;
    });

    const toggleRoleCollapse = (dayId, roleKey) => {
        const key = `${dayId}-${roleKey}`;
        setCollapsedRoles(prev => ({
            ...prev,
            [key]: prev[key] === false ? true : false
        }));
    };

    const handleExpandAllRoles = () => {
        const next = {};
        DAYS_OF_WEEK.forEach(day => {
            ROLES.forEach(role => {
                next[`${day.id}-${role.key}`] = false;
            });
        });
        setCollapsedRoles(next);
    };

    const handleCollapseAllRoles = () => {
        const next = {};
        DAYS_OF_WEEK.forEach(day => {
            ROLES.forEach(role => {
                next[`${day.id}-${role.key}`] = true;
            });
        });
        setCollapsedRoles(next);
    };

    // Cálculos de data para Plantão
    const sundayYear = currentSundayDate.getFullYear();
    const sundayMonth = currentSundayDate.getMonth();
    const sundayDocumentId = `${sundayYear}-${String(sundayMonth + 1).padStart(2, '0')}`;
    const sundays = useMemo(() => getSundaysInMonth(sundayYear, sundayMonth), [sundayYear, sundayMonth]);

    // 1. Carrega Colaboradores Ativos
    useEffect(() => {
        const unsub = subscribeSharedCollection("collaborators", (items) => {
            const active = items
                .filter(c => c.active !== false && String(c.status || '').toLowerCase() !== 'inativo')
                .map(c => ({
                    id: c.id || c.firestoreId || c.uid,
                    name: c.name || c.email?.split('@')[0] || 'Colaborador',
                    shift: c.shift || 'Manhã I',
                    role: c.role || 'Operador',
                    photoURL: c.photoURL || c.photoUrl || null
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
            setCollaborators(active);
        });
        return () => unsub();
    }, []);

    // 2. Carrega Escala Diária
    useEffect(() => {
        let isMounted = true;
        const unsub = subscribeSharedDocument("daily_schedules", "fixed_schedule", (docData) => {
            if (!isMounted) return;
            if (docData && docData.assignments) {
                setDailySchedule(docData.assignments);
                setOriginalDailySchedule(docData.assignments);
            } else {
                setDailySchedule({});
                setOriginalDailySchedule({});
            }
            setLoadingDaily(false);
        });

        const timer = setTimeout(() => {
            if (isMounted) setLoadingDaily(false);
        }, 1200);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            unsub();
        };
    }, []);

    // 3. Carrega Escala de Plantão
    useEffect(() => {
        let isMounted = true;
        const unsub = subscribeSharedDocument("sunday_schedules", sundayDocumentId, (docData) => {
            if (!isMounted) return;
            if (docData && docData.assignments) {
                setSundaySchedule(docData.assignments);
                setOriginalSundaySchedule(docData.assignments);
            } else {
                setSundaySchedule({});
                setOriginalSundaySchedule({});
            }
            setLoadingSunday(false);
        });

        const timer = setTimeout(() => {
            if (isMounted) setLoadingSunday(false);
        }, 1200);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            unsub();
        };
    }, [sundayDocumentId]);

    // Filtro de Colaboradores na Barra Lateral
    const filteredColabs = useMemo(() => {
        return collaborators.filter(c => {
            const matchesName = c.name.toLowerCase().includes(searchColab.toLowerCase());
            const matchesShift = shiftFilter === 'all' || c.shift === shiftFilter;
            return matchesName && matchesShift;
        });
    }, [collaborators, searchColab, shiftFilter]);

    // Verificação de Alterações Pendentes (isDirty)
    const isDailyDirty = useMemo(() => {
        return JSON.stringify(dailySchedule) !== JSON.stringify(originalDailySchedule);
    }, [dailySchedule, originalDailySchedule]);

    const isSundayDirty = useMemo(() => {
        return JSON.stringify(sundaySchedule) !== JSON.stringify(originalSundaySchedule);
    }, [sundaySchedule, originalSundaySchedule]);

    // --- SALVAR ESCALA DIÁRIA ---
    const handleSaveDaily = async () => {
        if (readOnly) return;
        setSavingDaily(true);
        try {
            await setDoc(doc(db, "daily_schedules", "fixed_schedule"), {
                type: "fixed",
                assignments: dailySchedule,
                updatedAt: new Date()
            }, { merge: true });
            setOriginalDailySchedule(dailySchedule);
            showToast("Escala diária salva com sucesso!", "success");
        } catch (err) {
            console.error("Erro ao salvar escala diária:", err);
            showToast("Erro ao salvar escala diária.", "error");
        } finally {
            setSavingDaily(false);
        }
    };

    // --- SALVAR ESCALA DE PLANTÃO ---
    const handleSaveSunday = async () => {
        if (readOnly) return;
        setSavingSunday(true);
        try {
            await setDoc(doc(db, "sunday_schedules", sundayDocumentId), {
                month: sundayDocumentId,
                assignments: sundaySchedule,
                updatedAt: new Date()
            }, { merge: true });
            setOriginalSundaySchedule(sundaySchedule);
            showToast("Escala de plantão salva com sucesso!", "success");
        } catch (err) {
            console.error("Erro ao salvar plantão:", err);
            showToast("Erro ao salvar escala de plantão.", "error");
        } finally {
            setSavingSunday(false);
        }
    };

    // --- DRAG & DROP HANDLERS ---
    const handleDragStart = (e, colab, sourceInfo) => {
        if (readOnly) return;
        setDraggedColab(colab);
        setDragSource(sourceInfo);
        e.dataTransfer.effectAllowed = "move";
        setTimeout(() => {
            if (e.target) e.target.style.opacity = '0.4';
        }, 0);
    };

    const handleDragEnd = (e) => {
        if (readOnly) return;
        if (e.target) e.target.style.opacity = '1';
        setDraggedColab(null);
        setDragSource(null);
        setDropHighlight(null);
    };

    const handleDragOver = (e, highlightKey) => {
        if (readOnly) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dropHighlight !== highlightKey) {
            setDropHighlight(highlightKey);
        }
    };

    // Drop na Escala Diária
    const handleDropDaily = (e, targetDay, targetRole) => {
        if (readOnly) return;
        e.preventDefault();
        setDropHighlight(null);
        if (!draggedColab) return;

        setDailySchedule(prev => {
            const next = JSON.parse(JSON.stringify(prev));

            // Se arrastado de outra função ou outro dia, remove da origem
            if (dragSource && dragSource.type === 'daily' && dragSource.dayId && dragSource.roleKey) {
                if (next[dragSource.dayId] && next[dragSource.dayId][dragSource.roleKey]) {
                    next[dragSource.dayId][dragSource.roleKey] = next[dragSource.dayId][dragSource.roleKey].filter(c => c.id !== draggedColab.id);
                }
            }

            // Soltou na barra lateral para remover
            if (!targetDay || !targetRole) return next;

            // Inicializa estrutura
            if (!next[targetDay]) next[targetDay] = { telefonia: [], huggy: [], apoio: [] };
            if (!next[targetDay][targetRole]) next[targetDay][targetRole] = [];

            // Remove duplicata no mesmo dia se já estiver em outra função
            next[targetDay].telefonia = (next[targetDay].telefonia || []).filter(c => c.id !== draggedColab.id);
            next[targetDay].huggy = (next[targetDay].huggy || []).filter(c => c.id !== draggedColab.id);
            next[targetDay].apoio = (next[targetDay].apoio || []).filter(c => c.id !== draggedColab.id);

            // Adiciona na função de destino
            next[targetDay][targetRole].push(draggedColab);
            return next;
        });
    };

    // Drop na Escala de Plantão
    const handleDropSunday = (e, targetDate) => {
        if (readOnly) return;
        e.preventDefault();
        setDropHighlight(null);
        if (!draggedColab) return;

        setSundaySchedule(prev => {
            const next = { ...prev };

            // Se arrastado de outro domingo, remove da origem
            if (dragSource && dragSource.type === 'plantao' && dragSource.dateString) {
                if (next[dragSource.dateString]) {
                    next[dragSource.dateString] = next[dragSource.dateString].filter(c => c.id !== draggedColab.id);
                }
            }

            // Soltou na barra lateral para remover
            if (!targetDate) return next;

            if (!next[targetDate]) next[targetDate] = [];
            if (!next[targetDate].some(c => c.id === draggedColab.id)) {
                next[targetDate] = [...next[targetDate], draggedColab];
            }

            return next;
        });
    };

    // Remoção rápida de colaborador
    const handleRemoveDaily = (dayId, roleKey, colabId) => {
        if (readOnly) return;
        setDailySchedule(prev => {
            const next = JSON.parse(JSON.stringify(prev));
            if (next[dayId] && next[dayId][roleKey]) {
                next[dayId][roleKey] = next[dayId][roleKey].filter(c => c.id !== colabId);
            }
            return next;
        });
    };

    const handleRemoveSunday = (dateString, colabId) => {
        if (readOnly) return;
        setSundaySchedule(prev => {
            const next = { ...prev };
            if (next[dateString]) {
                next[dateString] = next[dateString].filter(c => c.id !== colabId);
            }
            return next;
        });
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-gray-50 overflow-hidden">
            {/* CABEÇALHO UNIFICADO COM SWITCH DE MODALIDADE */}
            <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-2xs z-20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center shrink-0 shadow-xs">
                        {activeTab === 'diaria' ? (
                            <CalendarDays className="w-5 h-5 text-blue-600" />
                        ) : (
                            <Calendar className="w-5 h-5 text-red-600" />
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                                {activeTab === 'diaria' ? 'Escala Diária Operacional' : 'Escala de Plantão (Domingos)'}
                            </h1>
                            <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                {activeTab === 'diaria' ? 'Horários Fixos Semanais' : `${MONTH_NAMES[sundayMonth]} ${sundayYear}`}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 hidden sm:block">
                            {activeTab === 'diaria'
                                ? 'Distribuição semanal dos postos de atendimento: Telefonia, Huggy e Apoio'
                                : 'Escalação dos plantonistas para os finais de semana e feriados'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Switch de Abas: Escala Diária vs Escala de Plantão */}
                    <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200 text-xs font-bold">
                        <button
                            type="button"
                            onClick={() => setActiveTab('diaria')}
                            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                                activeTab === 'diaria'
                                    ? 'bg-white text-gray-900 shadow-xs font-black'
                                    : 'text-gray-500 hover:text-gray-900'
                            }`}
                        >
                            <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                            <span>Escala Diária</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('plantao')}
                            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition-all cursor-pointer ${
                                activeTab === 'plantao'
                                    ? 'bg-white text-gray-900 shadow-xs font-black'
                                    : 'text-gray-500 hover:text-gray-900'
                            }`}
                        >
                            <Calendar className="w-3.5 h-3.5 text-amber-600" />
                            <span>Escala de Plantão</span>
                        </button>
                    </div>

                    {/* Controles Específicos para Escala de Plantão (Mês anterior / próximo) */}
                    {activeTab === 'plantao' && (
                        <div className="flex items-center gap-1.5">
                            <div className="flex items-center bg-gray-100 p-0.5 rounded-xl border border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => setCurrentSundayDate(new Date(sundayYear, sundayMonth - 1, 1))}
                                    className="p-1.5 hover:bg-white rounded-lg text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                                    title="Mês Anterior"
                                    aria-label="Mês Anterior"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <div className="relative flex items-center">
                                    <select
                                        value={`${sundayYear}-${sundayMonth}`}
                                        onChange={(e) => {
                                            const [y, m] = e.target.value.split('-').map(Number);
                                            setCurrentSundayDate(new Date(y, m, 1));
                                        }}
                                        aria-label="Mês e Ano Selecionados"
                                        className="appearance-none bg-transparent pl-3 pr-6 py-1 text-xs font-black text-gray-800 capitalize cursor-pointer focus:outline-none"
                                    >
                                        {[-1, 0, 1].flatMap((yearOffset) => {
                                            const targetYear = new Date().getFullYear() + yearOffset;
                                            return MONTH_NAMES.map((name, idx) => (
                                                <option key={`${targetYear}-${idx}`} value={`${targetYear}-${idx}`}>
                                                    {name} {targetYear}
                                                </option>
                                            ));
                                        })}
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-500 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setCurrentSundayDate(new Date(sundayYear, sundayMonth + 1, 1))}
                                    className="p-1.5 hover:bg-white rounded-lg text-gray-600 hover:text-gray-900 transition-colors cursor-pointer"
                                    title="Próximo Mês"
                                    aria-label="Próximo Mês"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Botão de Ação Separado: Retornar ao Mês Atual ("Hoje") */}
                            <button
                                type="button"
                                onClick={() => setCurrentSundayDate(new Date())}
                                className="px-2.5 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-white rounded-xl border border-gray-200 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                                title="Ir para o mês atual"
                                aria-label="Ir para o mês atual"
                            >
                                Hoje
                            </button>
                        </div>
                    )}

                    {/* Botão de Salvar Alterações */}
                    {!readOnly && (
                        activeTab === 'diaria' ? (
                            <button
                                type="button"
                                onClick={handleSaveDaily}
                                disabled={savingDaily || !isDailyDirty}
                                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
                                    isDailyDirty
                                        ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                }`}
                            >
                                {savingDaily ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                <span>{savingDaily ? 'Salvando...' : isDailyDirty ? 'Salvar Escala Diária' : 'Salvo'}</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSaveSunday}
                                disabled={savingSunday || !isSundayDirty}
                                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer ${
                                    isSundayDirty
                                        ? 'bg-red-600 hover:bg-red-700 text-white animate-pulse'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                }`}
                            >
                                {savingSunday ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                <span>{savingSunday ? 'Salvando...' : isSundayDirty ? 'Salvar Plantão' : 'Salvo'}</span>
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* CORPO PRINCIPAL COM SIDEBAR ARRASTÁVEL E QUADRO DE ESCALA */}
            <div className="flex-1 flex overflow-hidden">
                {/* 1. BARRA LATERAL DE EQUIPE ATIVA (DRAGGABLE) */}
                {!readOnly && (
                    <aside
                        onDragOver={(e) => handleDragOver(e, 'trash')}
                        onDrop={(e) => {
                            if (activeTab === 'diaria') handleDropDaily(e, null, null);
                            else handleDropSunday(e, null);
                        }}
                        className="w-64 sm:w-72 bg-white border-r border-gray-200 flex flex-col shrink-0 overflow-hidden shadow-xs z-10"
                    >
                        <div className="p-3.5 border-b border-gray-100 space-y-2.5 bg-gray-50/50">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-red-600" />
                                    Equipe Disponível ({collaborators.length})
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
                                value={shiftFilter}
                                onChange={(e) => setShiftFilter(e.target.value)}
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
                            {filteredColabs.length === 0 ? (
                                <div className="p-6 text-center text-xs text-gray-400">
                                    Nenhum colaborador encontrado
                                </div>
                            ) : (
                                filteredColabs.map(colab => (
                                    <div
                                        key={colab.id}
                                        draggable={!readOnly}
                                        onDragStart={(e) => handleDragStart(e, colab, { type: activeTab, colabId: colab.id })}
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
                                                <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.2 rounded border ${SHIFT_BADGES[colab.shift] || SHIFT_BADGES.default}`}>
                                                    {colab.shift}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="p-2 border-t border-gray-100 bg-gray-50/80 text-[11px] text-gray-400 text-center select-none">
                            💡 Arraste para o quadro ao lado ou solte aqui para remover
                        </div>
                    </aside>
                )}

                {/* 2. ÁREA DE QUADROS (KANBAN DA ESCALA ATIVA) */}
                <main className="flex-1 overflow-x-auto p-4 sm:p-6 bg-gray-50 flex flex-col">
                    {activeTab === 'diaria' ? (
                        /* ======================================================== */
                        /* MODALIDADE 1: ESCALA DIÁRIA (FIXA DE SEGUNDA A SÁBADO)   */
                        /* ======================================================== */
                        loadingDaily ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12">
                                <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
                                <span className="text-xs font-bold text-gray-500">Carregando escala diária...</span>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {/* BARRA DE ATALHOS: EXPANDIR TUDO / RECOLHER TUDO */}
                                <div className="flex items-center justify-between flex-wrap gap-2.5 mb-4 bg-white p-3 rounded-2xl border border-gray-200 shadow-2xs">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-500">Postos de Trabalho:</span>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {ROLES.map(r => (
                                                <span key={r.key} className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg flex items-center gap-1.5 ${r.badge} border border-current/10`}>
                                                    {r.icon} {r.label}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={handleExpandAllRoles}
                                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 hover:border-gray-300 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                                            title="Expandir todas as abas de Telefonia, Huggy e Apoio"
                                        >
                                            <ChevronsUpDown className="w-3.5 h-3.5 text-blue-600" />
                                            <span>Expandir Tudo</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCollapseAllRoles}
                                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 hover:border-gray-300 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
                                            title="Recolher todas as abas"
                                        >
                                            <Minimize2 className="w-3.5 h-3.5 text-gray-600" />
                                            <span>Recolher Tudo</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="flex gap-4 pb-4 items-start min-w-max">
                                    {DAYS_OF_WEEK.map((day) => {
                                        const dayData = dailySchedule[day.id] || { telefonia: [], huggy: [], apoio: [] };
                                        const totalOperatorsInDay = (dayData.telefonia?.length || 0) + (dayData.huggy?.length || 0) + (dayData.apoio?.length || 0);

                                        return (
                                            <div
                                                key={day.id}
                                                className="w-72 sm:w-80 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col shrink-0 overflow-hidden"
                                            >
                                                {/* Cabeçalho do Dia */}
                                                <div className="p-3.5 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
                                                    <div>
                                                        <h3 className="font-black text-sm text-gray-900 tracking-tight">
                                                            {day.label}
                                                        </h3>
                                                        <span className="text-[11px] text-gray-400 font-medium">
                                                            Postos operacionais fixos
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                                        {totalOperatorsInDay} {totalOperatorsInDay === 1 ? 'operador' : 'operadores'}
                                                    </span>
                                                </div>

                                                {/* Postos de Atendimento (Telefonia, Huggy, Apoio) */}
                                                <div className="p-3 space-y-3">
                                                    {ROLES.map(role => {
                                                        const assigned = dayData[role.key] || [];
                                                        const targetKey = `${day.id}-${role.key}`;
                                                        const isHighlighted = dropHighlight === targetKey;
                                                        const isCollapsed = collapsedRoles[targetKey] !== false;

                                                        return (
                                                            <div
                                                                key={role.key}
                                                                onDragOver={(e) => handleDragOver(e, targetKey)}
                                                                onDrop={(e) => handleDropDaily(e, day.id, role.key)}
                                                                className={`rounded-2xl border transition-all ${role.bg} ${role.border} ${
                                                                    isHighlighted ? 'ring-2 ring-blue-500 scale-[0.99] bg-white' : ''
                                                                } p-2.5 flex flex-col shadow-2xs`}
                                                            >
                                                                {/* Cabeçalho do Posto com Ação de Recolher/Expandir */}
                                                                <div
                                                                    onClick={() => toggleRoleCollapse(day.id, role.key)}
                                                                    className={`flex items-center justify-between cursor-pointer select-none group/role ${role.text}`}
                                                                    title={isCollapsed ? `Clique para expandir ${role.label}` : `Clique para recolher ${role.label}`}
                                                                >
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        <div className="p-1 rounded-lg bg-white/70 shadow-2xs group-hover/role:bg-white transition-colors">
                                                                            {role.icon}
                                                                        </div>
                                                                        <span className="text-xs font-black uppercase tracking-wider truncate">
                                                                            {role.label}
                                                                        </span>
                                                                    </div>

                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        {/* Destaque da quantidade de pessoas naquela tarefa */}
                                                                        <span className={`text-xs font-black px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1 shadow-2xs ${
                                                                            assigned.length > 0 
                                                                                ? `${role.badge} border border-current/20 scale-105` 
                                                                                : 'bg-white/80 text-gray-400 border border-gray-200'
                                                                        }`}>
                                                                            <span>{assigned.length}</span>
                                                                            <span className="text-[10px] font-bold opacity-80">
                                                                                {assigned.length === 1 ? 'operador' : 'operadores'}
                                                                            </span>
                                                                        </span>

                                                                        <div className="p-1 rounded-md text-gray-400 group-hover/role:text-gray-700 hover:bg-black/5 transition-colors">
                                                                            {isCollapsed ? (
                                                                                <ChevronRight className="w-3.5 h-3.5" />
                                                                            ) : (
                                                                                <ChevronDown className="w-3.5 h-3.5" />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Quando Recolhido: exibe resumo elegante e compacto */}
                                                                {isCollapsed ? (
                                                                    <div 
                                                                        onClick={() => toggleRoleCollapse(day.id, role.key)}
                                                                        className="mt-2 cursor-pointer"
                                                                    >
                                                                        {assigned.length > 0 ? (
                                                                            <div className="bg-white/85 rounded-xl p-2 border border-gray-200/70 hover:bg-white hover:border-gray-300 transition-all">
                                                                                <div className="flex items-center justify-between gap-1 text-[11px] text-gray-700">
                                                                                    <div className="flex items-center gap-1.5 truncate">
                                                                                        {/* Mini avatares */}
                                                                                        <div className="flex -space-x-1.5 shrink-0 overflow-hidden">
                                                                                            {assigned.slice(0, 4).map(c => (
                                                                                                <div 
                                                                                                    key={c.id} 
                                                                                                    className="w-5 h-5 rounded-full bg-gray-200 border border-white text-[9px] font-bold text-gray-700 flex items-center justify-center shrink-0"
                                                                                                    title={c.name}
                                                                                                >
                                                                                                    {c.name.charAt(0).toUpperCase()}
                                                                                                </div>
                                                                                            ))}
                                                                                            {assigned.length > 4 && (
                                                                                                <div className="w-5 h-5 rounded-full bg-gray-100 border border-white text-[8px] font-bold text-gray-500 flex items-center justify-center shrink-0">
                                                                                                    +{assigned.length - 4}
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                        <span className="truncate font-semibold text-gray-800 text-[11px]">
                                                                                            {assigned.map(c => c.name.split(' ')[0]).join(', ')}
                                                                                        </span>
                                                                                    </div>
                                                                                    <span className="text-[10px] text-gray-400 font-medium shrink-0 ml-1">
                                                                                        Expandir ▾
                                                                                    </span>
                                                                                </div>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="h-7 flex items-center justify-center border border-dashed border-gray-300/80 rounded-xl text-gray-400 text-[10px] font-medium bg-white/30 select-none">
                                                                                {readOnly ? 'Sem operadores' : 'Nenhum operador (solte aqui)'}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    /* Quando Expandido: Lista detalhada completa com drag e remoção */
                                                                    <div className="mt-2.5 space-y-1.5 min-h-[46px]">
                                                                        {assigned.length === 0 ? (
                                                                            <div className="h-11 flex items-center justify-center border border-dashed border-gray-300 rounded-xl text-gray-400 text-xs font-medium bg-white/40 select-none">
                                                                                {readOnly ? 'Sem operadores' : 'Arraste colaboradores aqui'}
                                                                            </div>
                                                                        ) : (
                                                                            assigned.map(colab => (
                                                                                <div
                                                                                    key={`${day.id}-${role.key}-${colab.id}`}
                                                                                    draggable={!readOnly}
                                                                                    onDragStart={(e) => handleDragStart(e, colab, { type: 'daily', dayId: day.id, roleKey: role.key })}
                                                                                    onDragEnd={handleDragEnd}
                                                                                    className="bg-white border border-gray-200 p-2 rounded-xl shadow-2xs flex items-center justify-between gap-2 transition-all group select-none hover:border-gray-300 cursor-grab active:cursor-grabbing"
                                                                                >
                                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                                        <div className="w-6 h-6 rounded-lg bg-gray-100 text-gray-700 font-bold text-xs flex items-center justify-center shrink-0">
                                                                                            {colab.name.charAt(0).toUpperCase()}
                                                                                        </div>
                                                                                        <div className="min-w-0">
                                                                                            <p className="text-xs font-bold text-gray-900 truncate">
                                                                                                {colab.name}
                                                                                            </p>
                                                                                            <span className="text-[10px] text-gray-400">
                                                                                                {colab.shift}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>

                                                                                    {!readOnly && (
                                                                                        <button
                                                                                            type="button"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                handleRemoveDaily(day.id, role.key, colab.id);
                                                                                            }}
                                                                                            className="text-gray-300 hover:text-red-600 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                                                                                            title={`Remover ${colab.name}`}
                                                                                        >
                                                                                            <X className="w-3.5 h-3.5" />
                                                                                        </button>
                                                                                    )}
                                                                                </div>
                                                                            ))
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )
                    ) : (
                        /* ======================================================== */
                        /* MODALIDADE 2: ESCALA DE PLANTÃO (DOMINGOS DO MÊS)        */
                        /* ======================================================== */
                        loadingSunday ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-12">
                                <Loader2 className="w-8 h-8 text-amber-600 animate-spin mb-3" />
                                <span className="text-xs font-bold text-gray-500">Carregando escala de plantão...</span>
                            </div>
                        ) : (
                            <div className="flex gap-4 pb-4 items-start min-w-max">
                                {sundays.map((sunday) => {
                                    const dateString = formatDateString(sunday);
                                    const assigned = sundaySchedule[dateString] || [];
                                    const formattedDay = sunday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                                    const isHighlighted = dropHighlight === dateString;

                                    return (
                                        <div
                                            key={dateString}
                                            onDragOver={(e) => handleDragOver(e, dateString)}
                                            onDrop={(e) => handleDropSunday(e, dateString)}
                                            className={`w-72 sm:w-80 bg-white rounded-2xl border shadow-sm flex flex-col shrink-0 overflow-hidden transition-all ${
                                                isHighlighted ? 'border-red-500 ring-2 ring-red-400/40 bg-red-50/20' : 'border-gray-200'
                                            }`}
                                        >
                                            {/* Cabeçalho do Domingo */}
                                            <div className="p-3.5 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-8 h-8 rounded-xl bg-red-100 text-red-700 font-black text-xs flex items-center justify-center border border-red-200 font-mono">
                                                        DOM
                                                    </span>
                                                    <div>
                                                        <h3 className="font-black text-sm text-gray-900 tracking-tight">
                                                            Domingo • {formattedDay}
                                                        </h3>
                                                        <span className="text-[11px] text-gray-400 font-mono">
                                                            {dateString}
                                                        </span>
                                                    </div>
                                                </div>

                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                                    assigned.length > 0
                                                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                                                        : 'bg-red-50 text-red-700 border-red-200 animate-pulse'
                                                }`}>
                                                    {assigned.length} {assigned.length === 1 ? 'plantonista' : 'plantonistas'}
                                                </span>
                                            </div>

                                            {/* Lista de Plantonistas */}
                                            <div className="p-3 space-y-2 min-h-[160px]">
                                                {assigned.length === 0 ? (
                                                    <div className="h-28 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl text-center p-3 select-none">
                                                        <AlertCircle className="w-5 h-5 text-gray-300 mb-1" />
                                                        <span className="text-xs font-bold text-gray-400">
                                                            {readOnly ? 'Sem plantonistas' : 'Nenhum plantonista escalado'}
                                                        </span>
                                                        {!readOnly && (
                                                            <span className="text-[10px] text-gray-400 mt-0.5">
                                                                Arraste colaboradores aqui
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    assigned.map(colab => (
                                                        <div
                                                            key={`${dateString}-${colab.id}`}
                                                            draggable={!readOnly}
                                                            onDragStart={(e) => handleDragStart(e, colab, { type: 'plantao', dateString })}
                                                            onDragEnd={handleDragEnd}
                                                            className="p-2.5 rounded-xl bg-white border border-gray-200 hover:border-red-300 hover:bg-red-50/20 shadow-2xs flex items-center justify-between gap-2 transition-all group select-none cursor-grab active:cursor-grabbing border-l-4 border-l-red-500"
                                                        >
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <div className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-black text-xs flex items-center justify-center shrink-0">
                                                                    {colab.name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-bold text-gray-900 truncate">
                                                                        {colab.name}
                                                                    </p>
                                                                    <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${SHIFT_BADGES[colab.shift] || SHIFT_BADGES.default}`}>
                                                                        {colab.shift}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {!readOnly && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveSunday(dateString, colab.id)}
                                                                    className="text-gray-300 hover:text-red-600 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                                                                    title={`Remover ${colab.name}`}
                                                                >
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </main>
            </div>
        </div>
    );
};

export default OperationalSchedules;

import React, { useState, useEffect, useMemo } from 'react';
import { 
    Database, Search, Calendar, Eye, Edit2, Trash2, X, Loader2, 
    MessageSquare, TrendingUp, Target, AlertTriangle, ShieldCheck, 
    ShieldAlert, CheckCircle2, MessageCircle, PhoneCall, PhoneMissed, 
    Clock, Award, Sparkles, User, Hash, FileText, Check, BarChart2,
    LayoutGrid, Table, List, Filter, ArrowUpDown, SlidersHorizontal,
    Users, ChevronLeft, ChevronRight, RotateCcw, CheckCircle, AlertCircle,
    CalendarRange, Layers, Flame, Tag, ThumbsUp, HelpCircle
} from 'lucide-react';
import { collection, onSnapshot, query, doc, deleteDoc, updateDoc } from 'firebase/firestore';
const collectionMap = {
    "feedbacks": "feedbacks",
    "metrics": "weekly_evaluations",
    "kpis": "sector_kpis",
    "audits": "qa_audits"
};
import { db } from '../services/firebase';
import { useNotification } from '../context/NotificationContext';
import { usePermissions } from '../context/PermissionsContext';

// --- CÁLCULO DE PONTUAÇÃO DO DESEMPENHO ---
const calculateScore = (item = {}) => {
    const finalizados = Number(item.Atendimentos_Finalizados) || 0;
    const ligAtendidas = Number(item.Ligacoes_Atendidas) || 0;
    const huggy = Number(item.Atendimentos_Huggy) || 0;
    const ligPerdidas = Number(item.Ligacoes_Perdidas) || 0;
    return (finalizados * 1) + (ligAtendidas * 2) + (huggy * 1) + (ligPerdidas * -5);
};

// --- DICIONÁRIO DE TRADUÇÃO (BANCO DE DADOS -> TELA) ---
const translateKey = (key) => {
    const dictionary = {
        createdBy: 'Criado por',
        collaboratorId: 'Colaborador',
        colabId: 'Colaborador',
        protocol: 'Protocolo',
        comment: 'Comentário',
        method: 'Meio / Canal',
        type: 'Tipo',
        date: 'Data Referência',
        fcr: 'FCR (%)',
        tmr: 'TMR',
        recurrence: 'Reincidência (%)',
        Atendimentos_Finalizados: 'Atendimentos Finalizados',
        Atendimentos_Huggy: 'Atendimentos Huggy',
        Ligacoes_Atendidas: 'Ligações Atendidas',
        Ligacoes_Perdidas: 'Ligações Perdidas',
        TMA_Telefonia: 'TMA Telefonia',
        TMA_Huggy: 'TMA Huggy',
        TME_Telefonia: 'TME Telefonia',
        evaluatorName: 'Avaliador',
        evaluatorId: 'ID Avaliador',
        notes: 'Observações do Auditor',
        status: 'Status'
    };
    return dictionary[key] || key;
};

const DataManager = () => {
    const { showToast } = useNotification();
    const { canEdit, activeRoleInfo, normalizedRole } = usePermissions();
    const isEditable = canEdit('datamanager');
    
    // Abas principais
    const [activeTab, setActiveTab] = useState('feedbacks'); 
    
    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [colabFilter, setColabFilter] = useState('all');
    const [statusTypeFilter, setStatusTypeFilter] = useState('all');
    const [periodFilter, setPeriodFilter] = useState('all');
    const [sortBy, setSortBy] = useState('date_desc');
    
    // Modo de visualização (table | cards | compact)
    const [viewMode, setViewMode] = useState('table');
    
    // Paginação
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [collaboratorsMap, setCollaboratorsMap] = useState({});
    const [collaboratorsInfo, setCollaboratorsInfo] = useState({});
    const [qaProcesses, setQaProcesses] = useState({});
    
    const [viewingItem, setViewingItem] = useState(null);
    const [editingItem, setEditingItem] = useState(null);
    const [deletingItem, setDeletingItem] = useState(null);

    const getSafeDateString = (item) => {
        if (item.date) {
            if (typeof item.date === 'string' && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [year, month, day] = item.date.split('-');
                return `${day}/${month}/${year}`;
            }
            return item.date;
        }
        if (item.createdAt) {
            if (typeof item.createdAt.toDate === 'function') {
                return new Date(item.createdAt.toDate()).toLocaleDateString('pt-BR');
            }
            try {
                return new Date(item.createdAt).toLocaleDateString('pt-BR');
            } catch {
                return 'Data inválida';
            }
        }
        return 'Sem data';
    };

    const getItemDateObj = (item) => {
        if (item.date && typeof item.date === 'string' && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y, m, d] = item.date.split('-').map(Number);
            return new Date(y, m - 1, d);
        }
        if (item.createdAt && typeof item.createdAt.toDate === 'function') {
            return item.createdAt.toDate();
        }
        if (item.createdAt) {
            const d = new Date(item.createdAt);
            if (!isNaN(d.getTime())) return d;
        }
        return null;
    };

    useEffect(() => {
        const unsubColabs = onSnapshot(collection(db, "collaborators"), (snapshot) => {
            const map = {};
            const infoMap = {};
            snapshot.forEach((doc) => {
                const d = doc.data();
                map[doc.id] = d.name;
                infoMap[doc.id] = { id: doc.id, ...d };
            });
            setCollaboratorsMap(map);
            setCollaboratorsInfo(infoMap);
        });
        
        const unsubQA = onSnapshot(collection(db, "qa_processes"), (snapshot) => {
            const map = {};
            snapshot.forEach((doc) => {
                map[doc.id] = doc.data();
            });
            setQaProcesses(map);
        });

        return () => {
            unsubColabs();
            unsubQA();
        };
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        const currentCollection = collectionMap[activeTab];
        const q = query(collection(db, currentCollection)); 
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedData = [];
            snapshot.forEach((doc) => {
                fetchedData.push({ id: doc.id, ...doc.data() });
            });
            
            fetchedData.sort((a, b) => {
                const getDateValue = (item) => {
                    if (item.date) {
                        if (typeof item.date === 'string' && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                            return new Date(item.date).getTime();
                        }
                    }
                    if (item.createdAt && typeof item.createdAt.toMillis === 'function') {
                        return item.createdAt.toMillis();
                    }
                    if (item.createdAt) {
                        return new Date(item.createdAt).getTime();
                    }
                    return 0;
                };
                return getDateValue(b) - getDateValue(a);
            });
            
            setData(fetchedData);
            setLoading(false);
        }, (error) => {
            showToast("Erro ao carregar dados: " + error.message, "error");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [activeTab, showToast]);

    // Reseta filtros secundários ao alternar de aba
    const handleTabChange = (newTab) => {
        setActiveTab(newTab);
        setStatusTypeFilter('all');
        setCurrentPage(1);
    };

    // Lista de colaboradores únicos para o filtro
    const uniqueCollaborators = useMemo(() => {
        const list = Object.entries(collaboratorsMap).map(([id, name]) => ({ id, name }));
        data.forEach(item => {
            const id = item.colabId || item.collaboratorId;
            if (id && !list.some(c => c.id === id)) {
                list.push({ id, name: item.colabName || id });
            }
        });
        return list.sort((a, b) => a.name.localeCompare(b.name));
    }, [collaboratorsMap, data]);

    // Opções contextuais de Status/Tipo por aba
    const statusTypeOptions = useMemo(() => {
        if (activeTab === 'feedbacks') {
            return [
                { value: 'all', label: 'Todos os Tipos' },
                { value: 'Elogio', label: 'Elogio' },
                { value: 'Ponto de Melhoria', label: 'Ponto de Melhoria' },
                { value: 'Orientação', label: 'Orientação' },
            ];
        }
        if (activeTab === 'audits') {
            return [
                { value: 'all', label: 'Todos os Status' },
                { value: 'Conforme', label: 'Conforme' },
                { value: 'Não Conforme', label: 'Não Conforme' }
            ];
        }
        if (activeTab === 'metrics') {
            return [
                { value: 'all', label: 'Todos os Desempenhos' },
                { value: 'has_finalizados', label: 'Com Atendimentos (>0)' },
                { value: 'has_calls', label: 'Com Ligações Atendidas' },
                { value: 'has_huggy', label: 'Com Atend. Huggy' },
                { value: 'has_missed', label: 'Com Ligações Perdidas' }
            ];
        }
        if (activeTab === 'kpis') {
            return [
                { value: 'all', label: 'Todas as Metas' },
                { value: 'fcr_good', label: 'FCR na Meta (≥ 80%)' },
                { value: 'fcr_bad', label: 'FCR Abaixo (< 80%)' },
                { value: 'rec_good', label: 'Reincidência na Meta (≤ 20%)' },
                { value: 'rec_bad', label: 'Reincidência Alta (> 20%)' }
            ];
        }
        return [];
    }, [activeTab]);

    // Aplicação dos filtros
    const filteredData = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        return data.filter(item => {
            const mappedName = collaboratorsMap[item.colabId || item.collaboratorId] || item.colabName || '';
            const colabId = item.colabId || item.collaboratorId;
            
            // 1. Busca textual
            if (searchTerm) {
                const queryStr = searchTerm.toLowerCase();
                const matchName = mappedName.toLowerCase().includes(queryStr);
                const matchType = item.type && item.type.toLowerCase().includes(queryStr);
                const matchProtocol = item.protocol && item.protocol.toLowerCase().includes(queryStr);
                const matchComment = item.comment && item.comment.toLowerCase().includes(queryStr);
                const matchMethod = item.method && item.method.toLowerCase().includes(queryStr);
                const matchEvaluator = item.evaluatorName && item.evaluatorName.toLowerCase().includes(queryStr);
                if (!matchName && !matchType && !matchProtocol && !matchComment && !matchMethod && !matchEvaluator) {
                    return false;
                }
            }

            // 2. Filtro de Colaborador (exceto na aba de KPIs globais)
            if (activeTab !== 'kpis' && colabFilter !== 'all') {
                if (colabId !== colabFilter) return false;
            }

            // 3. Filtro de Status / Tipo Contextual
            if (statusTypeFilter !== 'all') {
                if (activeTab === 'feedbacks') {
                    if (item.type !== statusTypeFilter) return false;
                } else if (activeTab === 'audits') {
                    if (item.status !== statusTypeFilter) return false;
                } else if (activeTab === 'metrics') {
                    if (statusTypeFilter === 'has_finalizados' && (Number(item.Atendimentos_Finalizados) || 0) <= 0) return false;
                    if (statusTypeFilter === 'has_calls' && (Number(item.Ligacoes_Atendidas) || 0) <= 0) return false;
                    if (statusTypeFilter === 'has_huggy' && (Number(item.Atendimentos_Huggy) || 0) <= 0) return false;
                    if (statusTypeFilter === 'has_missed' && (Number(item.Ligacoes_Perdidas) || 0) <= 0) return false;
                } else if (activeTab === 'kpis') {
                    const fcrNum = Number(item.fcr) || 0;
                    const recNum = Number(item.recurrence) || 0;
                    if (statusTypeFilter === 'fcr_good' && fcrNum < 80) return false;
                    if (statusTypeFilter === 'fcr_bad' && fcrNum >= 80) return false;
                    if (statusTypeFilter === 'rec_good' && recNum > 20) return false;
                    if (statusTypeFilter === 'rec_bad' && recNum <= 20) return false;
                }
            }

            // 4. Filtro de data textual
            if (dateFilter) {
                const safeDate = getSafeDateString(item);
                if (!safeDate.toLowerCase().includes(dateFilter.toLowerCase())) return false;
            }

            // 5. Filtro rápido de Período
            if (periodFilter !== 'all') {
                const d = getItemDateObj(item);
                if (!d) return false;
                const t = d.getTime();
                if (periodFilter === 'today') {
                    if (t < todayStart || t >= todayStart + 86400000) return false;
                } else if (periodFilter === '7days') {
                    if (t < now.getTime() - 7 * 86400000) return false;
                } else if (periodFilter === '30days') {
                    if (t < now.getTime() - 30 * 86400000) return false;
                } else if (periodFilter === 'this_month') {
                    if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
                }
            }

            return true;
        });
    }, [data, searchTerm, colabFilter, statusTypeFilter, dateFilter, periodFilter, activeTab, collaboratorsMap]);

    // Ordenação dos dados
    const sortedData = useMemo(() => {
        const list = [...filteredData];
        list.sort((a, b) => {
            const dateA = getItemDateObj(a)?.getTime() || 0;
            const dateB = getItemDateObj(b)?.getTime() || 0;
            const colabA = collaboratorsMap[a.colabId || a.collaboratorId] || a.colabName || '';
            const colabB = collaboratorsMap[b.colabId || b.collaboratorId] || b.colabName || '';

            if (sortBy === 'date_desc') return dateB - dateA;
            if (sortBy === 'date_asc') return dateA - dateB;
            if (sortBy === 'colab_asc') return colabA.localeCompare(colabB);
            if (sortBy === 'colab_desc') return colabB.localeCompare(colabA);
            if (sortBy === 'score_desc') {
                if (activeTab === 'metrics') return calculateScore(b) - calculateScore(a);
                if (activeTab === 'kpis') return (Number(b.fcr) || 0) - (Number(a.fcr) || 0);
                return dateB - dateA;
            }
            return dateB - dateA;
        });
        return list;
    }, [filteredData, sortBy, activeTab, collaboratorsMap]);

    // Resumo e Estatísticas Rápidas dos Dados Filtrados
    const statsSummary = useMemo(() => {
        const total = filteredData.length;
        if (activeTab === 'feedbacks') {
            const elogios = filteredData.filter(i => i.type === 'Elogio').length;
            const melhorias = filteredData.filter(i => i.type === 'Ponto de Melhoria').length;
            const orientacoes = filteredData.filter(i => i.type === 'Orientação').length;
            return { total, elogios, melhorias, orientacoes };
        }
        if (activeTab === 'metrics') {
            let totalFinalizados = 0;
            let totalHuggy = 0;
            let totalPontos = 0;
            filteredData.forEach(i => {
                totalFinalizados += Number(i.Atendimentos_Finalizados) || 0;
                totalHuggy += Number(i.Atendimentos_Huggy) || 0;
                totalPontos += calculateScore(i);
            });
            const avgPontos = total > 0 ? Math.round(totalPontos / total) : 0;
            return { total, totalFinalizados, totalHuggy, avgPontos };
        }
        if (activeTab === 'kpis') {
            let sumFcr = 0;
            let sumRec = 0;
            filteredData.forEach(i => {
                sumFcr += Number(i.fcr) || 0;
                sumRec += Number(i.recurrence) || 0;
            });
            const avgFcr = total > 0 ? (sumFcr / total).toFixed(1) : '0.0';
            const avgRec = total > 0 ? (sumRec / total).toFixed(1) : '0.0';
            return { total, avgFcr, avgRec };
        }
        if (activeTab === 'audits') {
            const conformes = filteredData.filter(i => i.status === 'Conforme').length;
            const nConformes = filteredData.filter(i => i.status === 'Não Conforme').length;
            const rate = total > 0 ? Math.round((conformes / total) * 100) : 0;
            return { total, conformes, nConformes, rate };
        }
        return { total };
    }, [filteredData, activeTab]);

    // Paginação
    const numericItemsPerPage = itemsPerPage === 'all' ? sortedData.length || 1 : Number(itemsPerPage);
    const totalPages = Math.ceil(sortedData.length / numericItemsPerPage) || 1;
    const safeCurrentPage = Math.min(currentPage, totalPages);
    
    const paginatedData = useMemo(() => {
        if (itemsPerPage === 'all') return sortedData;
        const start = (safeCurrentPage - 1) * numericItemsPerPage;
        return sortedData.slice(start, start + numericItemsPerPage);
    }, [sortedData, safeCurrentPage, numericItemsPerPage, itemsPerPage]);

    const hasActiveFilters = Boolean(
        searchTerm || 
        (colabFilter !== 'all' && activeTab !== 'kpis') || 
        statusTypeFilter !== 'all' || 
        dateFilter || 
        periodFilter !== 'all'
    );

    const handleResetFilters = () => {
        setSearchTerm('');
        setColabFilter('all');
        setStatusTypeFilter('all');
        setDateFilter('');
        setPeriodFilter('all');
        setCurrentPage(1);
    };

    const handleDelete = async () => {
        try {
            await deleteDoc(doc(db, collectionMap[activeTab], deletingItem.id));
            showToast("Registro apagado com sucesso!", "success");
            setDeletingItem(null);
        } catch (error) {
            showToast("Erro ao apagar: " + error.message, "error");
        }
    };

    const handleEditSave = async (updatedData) => {
        try {
            const docRef = doc(db, collectionMap[activeTab], editingItem.id);
            await updateDoc(docRef, updatedData);
            showToast("Registro atualizado com sucesso!", "success");
            setEditingItem(null);
        } catch (error) {
            showToast("Erro ao atualizar: " + error.message, "error");
        }
    };

    return (
        <div className="flex-1 p-4 sm:p-6 bg-gray-50 h-full overflow-y-auto flex flex-col space-y-4">
            {/* CABEÇALHO DA PÁGINA */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200/90 shadow-2xs shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center shrink-0">
                        <Database className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
                            Gerenciador de Dados
                        </h1>
                        <p className="text-xs sm:text-sm text-gray-500">Auditoria, visualização avançada, edição e exclusão de registros do sistema.</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between sm:justify-end">
                    {!isEditable ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs font-semibold">
                            <ShieldAlert className="w-4 h-4 text-amber-600" />
                            Modo Leitura ({activeRoleInfo?.label || normalizedRole})
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold">
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            Modo Editor Ativo
                        </div>
                    )}
                </div>
            </header>

            {/* PAINEL DE CONTROLE DE FILTROS E ABAS */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-2xs shrink-0 space-y-4">
                {/* LINHA 1: SELEÇÃO DE ABAS & SELETOR DE MODO DE VISUALIZAÇÃO */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                    {/* Abas */}
                    <div className="flex space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
                        <TabButton 
                            id="tab-feedbacks"
                            active={activeTab === 'feedbacks'} 
                            onClick={() => handleTabChange('feedbacks')} 
                            icon={<MessageSquare className="w-4 h-4"/>} 
                            text="Feedbacks" 
                        />
                        <TabButton 
                            id="tab-metrics"
                            active={activeTab === 'metrics'} 
                            onClick={() => handleTabChange('metrics')} 
                            icon={<TrendingUp className="w-4 h-4"/>} 
                            text="Desempenho" 
                        />
                        <TabButton 
                            id="tab-kpis"
                            active={activeTab === 'kpis'} 
                            onClick={() => handleTabChange('kpis')} 
                            icon={<Target className="w-4 h-4"/>} 
                            text="KPIs do Setor" 
                        />
                        <TabButton 
                            id="tab-audits"
                            active={activeTab === 'audits'} 
                            onClick={() => handleTabChange('audits')} 
                            icon={<ShieldCheck className="w-4 h-4"/>} 
                            text="Auditorias QA" 
                        />
                    </div>

                    {/* Modos de Visualização */}
                    <div className="flex items-center gap-1 bg-gray-100/80 p-1 rounded-xl self-start lg:self-auto border border-gray-200/60 shrink-0">
                        <button
                            id="view-mode-table"
                            onClick={() => setViewMode('table')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                viewMode === 'table'
                                    ? 'bg-white text-gray-900 shadow-2xs font-black'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                            title="Visualização em Tabela detalhada"
                        >
                            <Table className="w-3.5 h-3.5" />
                            <span>Tabela</span>
                        </button>
                        <button
                            id="view-mode-cards"
                            onClick={() => setViewMode('cards')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                viewMode === 'cards'
                                    ? 'bg-white text-gray-900 shadow-2xs font-black'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                            title="Visualização em Grade de Cards"
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span>Cards</span>
                        </button>
                        <button
                            id="view-mode-compact"
                            onClick={() => setViewMode('compact')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                viewMode === 'compact'
                                    ? 'bg-white text-gray-900 shadow-2xs font-black'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                            title="Visualização em Lista Compacta"
                        >
                            <List className="w-3.5 h-3.5" />
                            <span>Compacta</span>
                        </button>
                    </div>
                </div>

                {/* LINHA 2: BARRA PRINCIPAL DE FILTROS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                    {/* Campo de Busca Livre */}
                    <div className="lg:col-span-4 relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input 
                            id="search-input-datamanager"
                            type="text" 
                            placeholder={activeTab === 'kpis' ? "Buscar por valores ou data..." : "Buscar colaborador, tipo, protocolo..."}
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-2xs"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs p-1"
                                title="Limpar busca"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filtro de Colaborador (quando aplicável) */}
                    {activeTab !== 'kpis' && (
                        <div className="lg:col-span-3 relative">
                            <Users className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <select
                                id="filter-colab-select"
                                value={colabFilter}
                                onChange={(e) => { setColabFilter(e.target.value); setCurrentPage(1); }}
                                className="w-full pl-9 pr-7 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-2xs cursor-pointer appearance-none truncate"
                            >
                                <option value="all">Todos os Colaboradores</option>
                                {uniqueCollaborators.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Filtro Contextual de Status / Tipo */}
                    <div className={activeTab === 'kpis' ? "lg:col-span-4 relative" : "lg:col-span-3 relative"}>
                        <SlidersHorizontal className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select
                            id="filter-status-type-select"
                            value={statusTypeFilter}
                            onChange={(e) => { setStatusTypeFilter(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-9 pr-7 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-2xs cursor-pointer appearance-none truncate"
                        >
                            {statusTypeOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Ordenação */}
                    <div className={activeTab === 'kpis' ? "lg:col-span-4 relative" : "lg:col-span-2 relative"}>
                        <ArrowUpDown className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select
                            id="sort-select-datamanager"
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            className="w-full pl-9 pr-7 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-2xs cursor-pointer appearance-none truncate"
                            title="Ordenar registros"
                        >
                            <option value="date_desc">Mais Recentes</option>
                            <option value="date_asc">Mais Antigos</option>
                            {activeTab !== 'kpis' && <option value="colab_asc">Colaborador (A - Z)</option>}
                            {activeTab !== 'kpis' && <option value="colab_desc">Colaborador (Z - A)</option>}
                            {(activeTab === 'metrics' || activeTab === 'kpis') && <option value="score_desc">Maior Pontuação / FCR</option>}
                        </select>
                    </div>
                </div>

                {/* LINHA 3: FILTRO RÁPIDO DE PERÍODO & DATA TEXTUAL */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    {/* Botões de Período Rápido */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                            <CalendarRange className="w-3.5 h-3.5" /> Período:
                        </span>
                        {[
                            { key: 'all', label: 'Todos' },
                            { key: 'today', label: 'Hoje' },
                            { key: '7days', label: 'Últimos 7 dias' },
                            { key: '30days', label: 'Últimos 30 dias' },
                            { key: 'this_month', label: 'Este Mês' }
                        ].map(p => (
                            <button
                                key={p.key}
                                onClick={() => { setPeriodFilter(p.key); setCurrentPage(1); }}
                                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    periodFilter === p.key
                                        ? 'bg-red-600 text-white shadow-2xs'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Filtro Manual de Data */}
                    <div className="relative w-full sm:w-56">
                        <Calendar className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input 
                            id="date-filter-input"
                            type="text" 
                            placeholder="Data exata (ex: 13/04)"
                            value={dateFilter}
                            onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
                            className="w-full pl-8 pr-7 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                        />
                        {dateFilter && (
                            <button
                                onClick={() => { setDateFilter(''); setCurrentPage(1); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs p-1"
                                title="Limpar filtro de data"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                {/* LINHA 4: PÍLULAS DE FILTROS ATIVOS E RESUMO RÁPIDO */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
                    {/* Resumo dinâmico dos dados filtrados */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold text-gray-900 bg-gray-100 px-2.5 py-1 rounded-lg">
                            {statsSummary.total} {statsSummary.total === 1 ? 'registro encontrado' : 'registros encontrados'}
                        </span>

                        {activeTab === 'feedbacks' && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold">
                                    <ThumbsUp className="w-3 h-3" /> {statsSummary.elogios} Elogios
                                </span>
                                <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-semibold">
                                    <AlertTriangle className="w-3 h-3" /> {statsSummary.melhorias} Melhorias
                                </span>
                            </div>
                        )}

                        {activeTab === 'metrics' && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-600 font-medium">
                                    Finalizados: <strong className="text-gray-900">{statsSummary.totalFinalizados}</strong>
                                </span>
                                <span className="text-gray-400">•</span>
                                <span className="text-gray-600 font-medium">
                                    Huggy: <strong className="text-gray-900">{statsSummary.totalHuggy}</strong>
                                </span>
                                <span className="text-gray-400">•</span>
                                <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md font-semibold">
                                    Média: {statsSummary.avgPontos} pts
                                </span>
                            </div>
                        )}

                        {activeTab === 'kpis' && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold">
                                    FCR Médio: {statsSummary.avgFcr}%
                                </span>
                                <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-semibold">
                                    Reincidência Média: {statsSummary.avgRec}%
                                </span>
                            </div>
                        )}

                        {activeTab === 'audits' && (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-semibold">
                                    {statsSummary.conformes} Conformes
                                </span>
                                <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md font-semibold">
                                    {statsSummary.nConformes} Não Conformes
                                </span>
                                <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md font-bold">
                                    {statsSummary.rate}% Conformidade
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Botão de limpar filtros caso haja algum ativo */}
                    {hasActiveFilters && (
                        <button
                            id="clear-all-filters-btn"
                            onClick={handleResetFilters}
                            className="inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 font-bold bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Limpar filtros ativos
                        </button>
                    )}
                </div>
            </div>

            {/* ÁREA PRINCIPAL DE EXIBIÇÃO DE DADOS */}
            <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs flex-1 flex flex-col overflow-hidden">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-gray-400">
                        <Loader2 className="w-9 h-9 text-red-600 animate-spin mb-3" />
                        <p className="text-sm font-medium text-gray-500">Carregando registros da base de dados...</p>
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-12 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-3 text-gray-300">
                            <Database className="w-8 h-8" />
                        </div>
                        <p className="text-base font-bold text-gray-700">Nenhum registro encontrado</p>
                        <p className="text-xs text-gray-500 max-w-sm mt-1">
                            Não encontramos nenhum item para os filtros selecionados. Experimente alterar a busca ou limpar os filtros.
                        </p>
                        {hasActiveFilters && (
                            <button
                                onClick={handleResetFilters}
                                className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors cursor-pointer"
                            >
                                Redefinir todos os filtros
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* ==================================================== */}
                        {/* MODO 1: TABELA DETALHADA */}
                        {/* ==================================================== */}
                        {viewMode === 'table' && (
                            <div className="overflow-x-auto flex-1">
                                <table className="min-w-full divide-y divide-gray-200 text-sm whitespace-nowrap">
                                    <thead className="bg-zinc-950 text-white sticky top-0 z-10">
                                        <tr>
                                            <th 
                                                onClick={() => setSortBy(prev => prev === 'date_desc' ? 'date_asc' : 'date_desc')}
                                                className="px-5 py-3.5 text-left font-semibold cursor-pointer hover:bg-zinc-900 transition-colors select-none"
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    <span>Data / Registro</span>
                                                    <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
                                                </div>
                                            </th>
                                            {activeTab !== 'kpis' && (
                                                <th 
                                                    onClick={() => setSortBy(prev => prev === 'colab_asc' ? 'colab_desc' : 'colab_asc')}
                                                    className="px-5 py-3.5 text-left font-semibold cursor-pointer hover:bg-zinc-900 transition-colors select-none"
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <span>Colaborador</span>
                                                        <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
                                                    </div>
                                                </th>
                                            )}
                                            <th className="px-5 py-3.5 text-left font-semibold">Resumo do Dado</th>
                                            <th className="px-5 py-3.5 text-right font-semibold">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {paginatedData.map((item) => {
                                            const colabName = collaboratorsMap[item.colabId || item.collaboratorId] || item.colabName || 'Colaborador';
                                            const score = activeTab === 'metrics' ? calculateScore(item) : 0;
                                            
                                            return (
                                                <tr key={item.id} className="hover:bg-gray-50/80 transition-colors group">
                                                    <td className="px-5 py-3.5 text-gray-600 font-medium">
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                            <span>{getSafeDateString(item)}</span>
                                                        </div>
                                                    </td>
                                                    
                                                    {activeTab !== 'kpis' && (
                                                        <td className="px-5 py-3.5 font-bold text-gray-900 truncate max-w-[240px]">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-7 h-7 rounded-lg bg-red-100 text-red-700 font-black text-xs flex items-center justify-center shrink-0">
                                                                    {colabName.charAt(0).toUpperCase()}
                                                                </div>
                                                                <span className="truncate">{colabName}</span>
                                                            </div>
                                                        </td>
                                                    )}

                                                    <td className="px-5 py-3.5">
                                                        {activeTab === 'feedbacks' && (
                                                            <div className="flex items-center gap-2">
                                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                                                                    item.type === 'Elogio' ? 'bg-emerald-100 text-emerald-800' : 
                                                                    item.type === 'Ponto de Melhoria' ? 'bg-amber-100 text-amber-800' : 
                                                                    'bg-blue-100 text-blue-800'
                                                                }`}>
                                                                    {item.type}
                                                                </span>
                                                                {item.method && (
                                                                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                                                        {item.method}
                                                                    </span>
                                                                )}
                                                                {item.comment && (
                                                                    <span className="text-xs text-gray-500 max-w-[280px] truncate hidden md:inline-block">
                                                                        &quot;{item.comment}&quot;
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {activeTab === 'metrics' && (
                                                            <div className="flex items-center gap-3 text-xs">
                                                                <span className="text-gray-600">
                                                                    Finalizados: <strong className="text-gray-900">{item.Atendimentos_Finalizados || 0}</strong>
                                                                </span>
                                                                <span className="text-gray-400">•</span>
                                                                <span className="text-gray-600">
                                                                    Huggy: <strong className="text-gray-900">{item.Atendimentos_Huggy || 0}</strong>
                                                                </span>
                                                                <span className="text-gray-400">•</span>
                                                                <span className="text-gray-600">
                                                                    Voz: <strong className="text-gray-900">{item.Ligacoes_Atendidas || 0}</strong>
                                                                </span>
                                                                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md font-bold font-mono">
                                                                    {score} pts
                                                                </span>
                                                            </div>
                                                        )}

                                                        {activeTab === 'kpis' && (
                                                            <div className="flex items-center gap-3 text-xs">
                                                                <span className="inline-flex items-center gap-1">
                                                                    FCR: <strong className={Number(item.fcr) >= 80 ? "text-emerald-700 font-bold" : "text-amber-700 font-bold"}>{item.fcr}%</strong>
                                                                </span>
                                                                <span className="text-gray-400">•</span>
                                                                <span>
                                                                    TMR: <strong className="text-gray-900 font-mono font-bold">{item.tmr}</strong>
                                                                </span>
                                                                <span className="text-gray-400">•</span>
                                                                <span>
                                                                    Reincidência: <strong className={Number(item.recurrence) <= 20 ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>{item.recurrence}%</strong>
                                                                </span>
                                                            </div>
                                                        )}

                                                        {activeTab === 'audits' && (
                                                            <div className="flex items-center gap-2.5 text-xs">
                                                                <span className={`px-2 py-0.5 rounded-full font-bold ${
                                                                    item.status === 'Conforme' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                                }`}>
                                                                    {item.status}
                                                                </span>
                                                                <span className="text-gray-600">
                                                                    Protocolo: <strong className="text-gray-900 font-mono">{item.protocol || '--'}</strong>
                                                                </span>
                                                                {item.evaluatorName && (
                                                                    <span className="text-gray-400 hidden lg:inline">
                                                                        Auditor: {item.evaluatorName}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    
                                                    <td className="px-5 py-3.5 text-right">
                                                        <div className="flex justify-end items-center gap-1">
                                                            <button 
                                                                onClick={() => setViewingItem(item)} 
                                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer" 
                                                                title="Ver detalhes"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                            {isEditable && (
                                                                <>
                                                                    <button 
                                                                        onClick={() => setEditingItem(item)} 
                                                                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer" 
                                                                        title="Editar"
                                                                    >
                                                                        <Edit2 className="w-4 h-4" />
                                                                    </button>
                                                                    <button 
                                                                        onClick={() => setDeletingItem(item)} 
                                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer" 
                                                                        title="Excluir"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ==================================================== */}
                        {/* MODO 2: GRADE DE CARDS (BENTO STYLE) */}
                        {/* ==================================================== */}
                        {viewMode === 'cards' && (
                            <div className="p-4 sm:p-5 overflow-y-auto flex-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {paginatedData.map((item) => {
                                        const colabName = collaboratorsMap[item.colabId || item.collaboratorId] || item.colabName || 'Colaborador';
                                        const score = activeTab === 'metrics' ? calculateScore(item) : 0;

                                        return (
                                            <div 
                                                key={item.id}
                                                className="bg-white rounded-2xl border border-gray-200/90 hover:border-red-200 p-4 shadow-2xs hover:shadow-sm transition-all flex flex-col justify-between"
                                            >
                                                {/* Topo do Card */}
                                                <div>
                                                    <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-gray-100">
                                                        <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                            {getSafeDateString(item)}
                                                        </span>

                                                        {activeTab === 'feedbacks' && (
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                                item.type === 'Elogio' ? 'bg-emerald-100 text-emerald-800' : 
                                                                item.type === 'Ponto de Melhoria' ? 'bg-amber-100 text-amber-800' : 
                                                                'bg-blue-100 text-blue-800'
                                                            }`}>
                                                                {item.type}
                                                            </span>
                                                        )}

                                                        {activeTab === 'audits' && (
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                                item.status === 'Conforme' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                            }`}>
                                                                {item.status}
                                                            </span>
                                                        )}

                                                        {activeTab === 'metrics' && (
                                                            <span className="px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold text-xs font-mono">
                                                                {score} pts
                                                            </span>
                                                        )}

                                                        {activeTab === 'kpis' && (
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                                                Number(item.fcr) >= 80 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                                            }`}>
                                                                FCR {item.fcr}%
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Colaborador */}
                                                    {activeTab !== 'kpis' && (
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 font-black text-sm flex items-center justify-center shrink-0">
                                                                {colabName.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h4 className="font-bold text-sm text-gray-900 truncate leading-tight">
                                                                    {colabName}
                                                                </h4>
                                                                <p className="text-[11px] text-gray-400">Colaborador registrado</p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Conteúdo Contextual do Card */}
                                                    {activeTab === 'feedbacks' && (
                                                        <div className="space-y-2 mb-3">
                                                            {item.comment ? (
                                                                <p className="text-xs text-gray-600 line-clamp-3 bg-gray-50/80 p-2.5 rounded-xl border border-gray-100 italic">
                                                                    &quot;{item.comment}&quot;
                                                                </p>
                                                            ) : (
                                                                <p className="text-xs text-gray-400 italic">Sem comentário adicional.</p>
                                                            )}
                                                            <div className="flex items-center justify-between text-[11px] text-gray-500">
                                                                <span>Canal: <strong className="text-gray-800">{item.method || 'Geral'}</strong></span>
                                                                {item.protocol && <span>Protocolo: <strong className="font-mono text-gray-800">{item.protocol}</strong></span>}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {activeTab === 'metrics' && (
                                                        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                                                            <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                                                                <span className="text-[10px] text-gray-400 block">Finalizados</span>
                                                                <span className="text-sm font-black text-gray-900">{item.Atendimentos_Finalizados || 0}</span>
                                                            </div>
                                                            <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                                                                <span className="text-[10px] text-gray-400 block">Huggy</span>
                                                                <span className="text-sm font-black text-gray-900">{item.Atendimentos_Huggy || 0}</span>
                                                            </div>
                                                            <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                                                                <span className="text-[10px] text-gray-400 block">Voz</span>
                                                                <span className="text-sm font-black text-gray-900">{item.Ligacoes_Atendidas || 0}</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {activeTab === 'kpis' && (
                                                        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                                                            <div className="bg-emerald-50/60 p-2 rounded-xl border border-emerald-100">
                                                                <span className="text-[10px] text-emerald-600 block">FCR</span>
                                                                <span className="text-sm font-black text-emerald-900">{item.fcr}%</span>
                                                            </div>
                                                            <div className="bg-purple-50/60 p-2 rounded-xl border border-purple-100">
                                                                <span className="text-[10px] text-purple-600 block">TMR</span>
                                                                <span className="text-xs font-black text-purple-900 font-mono">{item.tmr}</span>
                                                            </div>
                                                            <div className="bg-rose-50/60 p-2 rounded-xl border border-rose-100">
                                                                <span className="text-[10px] text-rose-600 block">Reincidência</span>
                                                                <span className="text-sm font-black text-rose-900">{item.recurrence}%</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {activeTab === 'audits' && (
                                                        <div className="space-y-2 mb-3 text-xs bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-500">Protocolo:</span>
                                                                <span className="font-mono font-bold text-gray-900">{item.protocol || '--'}</span>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span className="text-gray-500">Auditor:</span>
                                                                <span className="font-semibold text-gray-800">{item.evaluatorName || 'Avaliador'}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Rodapé de Ações do Card */}
                                                <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                                                    <button
                                                        onClick={() => setViewingItem(item)}
                                                        className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                        <span>Ver Detalhes</span>
                                                    </button>
                                                    {isEditable && (
                                                        <>
                                                            <button
                                                                onClick={() => setEditingItem(item)}
                                                                className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl transition-colors cursor-pointer"
                                                                title="Editar registro"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setDeletingItem(item)}
                                                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl transition-colors cursor-pointer"
                                                                title="Excluir registro"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* ==================================================== */}
                        {/* MODO 3: LISTA COMPACTA (ALTA DENSIDADE) */}
                        {/* ==================================================== */}
                        {viewMode === 'compact' && (
                            <div className="overflow-y-auto flex-1 p-3 divide-y divide-gray-100">
                                {paginatedData.map((item) => {
                                    const colabName = collaboratorsMap[item.colabId || item.collaboratorId] || item.colabName || 'Colaborador';
                                    const score = activeTab === 'metrics' ? calculateScore(item) : 0;

                                    return (
                                        <div 
                                            key={item.id}
                                            className="py-2.5 px-3 hover:bg-gray-50/80 rounded-xl transition-colors flex items-center justify-between gap-3 text-xs"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="text-gray-400 font-mono text-[11px] shrink-0 w-20">
                                                    {getSafeDateString(item)}
                                                </span>

                                                {activeTab !== 'kpis' && (
                                                    <div className="flex items-center gap-2 shrink-0 max-w-[160px] truncate">
                                                        <div className="w-5 h-5 rounded-md bg-red-100 text-red-700 font-black text-[10px] flex items-center justify-center shrink-0">
                                                            {colabName.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="font-bold text-gray-900 truncate">{colabName}</span>
                                                    </div>
                                                )}

                                                {/* Resumo compacto */}
                                                <div className="truncate text-gray-600">
                                                    {activeTab === 'feedbacks' && (
                                                        <span className="flex items-center gap-2 truncate">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                item.type === 'Elogio' ? 'bg-emerald-100 text-emerald-800' : 
                                                                item.type === 'Ponto de Melhoria' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                                                            }`}>
                                                                {item.type}
                                                            </span>
                                                            {item.comment && <span className="truncate text-gray-500">&quot;{item.comment}&quot;</span>}
                                                        </span>
                                                    )}

                                                    {activeTab === 'metrics' && (
                                                        <span className="flex items-center gap-2">
                                                            <span>Fin: <strong>{item.Atendimentos_Finalizados || 0}</strong></span>
                                                            <span>Huggy: <strong>{item.Atendimentos_Huggy || 0}</strong></span>
                                                            <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-bold font-mono">
                                                                {score} pts
                                                            </span>
                                                        </span>
                                                    )}

                                                    {activeTab === 'kpis' && (
                                                        <span className="flex items-center gap-2">
                                                            <span>FCR: <strong>{item.fcr}%</strong></span>
                                                            <span>TMR: <strong>{item.tmr}</strong></span>
                                                            <span>Reinc.: <strong>{item.recurrence}%</strong></span>
                                                        </span>
                                                    )}

                                                    {activeTab === 'audits' && (
                                                        <span className="flex items-center gap-2">
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                                item.status === 'Conforme' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                            }`}>
                                                                {item.status}
                                                            </span>
                                                            <span>Prot: <strong className="font-mono">{item.protocol || '--'}</strong></span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Ações compactas */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button 
                                                    onClick={() => setViewingItem(item)} 
                                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded cursor-pointer"
                                                    title="Ver detalhes"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                                {isEditable && (
                                                    <>
                                                        <button 
                                                            onClick={() => setEditingItem(item)} 
                                                            className="p-1 text-amber-600 hover:bg-amber-50 rounded cursor-pointer"
                                                            title="Editar"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => setDeletingItem(item)} 
                                                            className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ==================================================== */}
                        {/* BARRA DE PAGINAÇÃO & CONTROLE DE DENSIDADE */}
                        {/* ==================================================== */}
                        <div className="p-3 sm:px-5 sm:py-3 bg-gray-50/90 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shrink-0">
                            {/* Registros por página e contagem */}
                            <div className="flex items-center gap-3 text-gray-500 w-full sm:w-auto justify-between sm:justify-start">
                                <span>
                                    Mostrando <strong className="text-gray-900">{sortedData.length === 0 ? 0 : (safeCurrentPage - 1) * numericItemsPerPage + 1}</strong> até <strong className="text-gray-900">{Math.min(safeCurrentPage * numericItemsPerPage, sortedData.length)}</strong> de <strong className="text-gray-900">{sortedData.length}</strong>
                                </span>

                                <div className="flex items-center gap-1.5">
                                    <span className="text-[11px] text-gray-400">Por pág:</span>
                                    <select
                                        id="items-per-page-select"
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(e.target.value === 'all' ? 'all' : Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                        className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-800 focus:outline-hidden focus:ring-1 focus:ring-red-500"
                                    >
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value="all">Todos</option>
                                    </select>
                                </div>
                            </div>

                            {/* Controles de Navegação */}
                            {itemsPerPage !== 'all' && totalPages > 1 && (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        id="pagination-prev-btn"
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={safeCurrentPage === 1}
                                        className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                                        title="Página anterior"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>

                                    <span className="px-2 font-bold text-gray-700">
                                        Pág. {safeCurrentPage} de {totalPages}
                                    </span>

                                    <button
                                        id="pagination-next-btn"
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={safeCurrentPage === totalPages}
                                        className="p-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                                        title="Próxima página"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* MODAIS (MANTIDOS 100% INTACTOS) */}
            {viewingItem && (
                <ViewModal 
                    activeTab={activeTab} 
                    collaboratorsMap={collaboratorsMap} 
                    collaboratorsInfo={collaboratorsInfo}
                    qaProcesses={qaProcesses} 
                    item={viewingItem} 
                    getSafeDateString={getSafeDateString}
                    onClose={() => setViewingItem(null)} 
                />
            )}
            {deletingItem && <DeleteModal onClose={() => setDeletingItem(null)} onConfirm={handleDelete} />}
            {editingItem && (
                <EditModal 
                    activeTab={activeTab} 
                    collaboratorsMap={collaboratorsMap}
                    collaboratorsInfo={collaboratorsInfo}
                    qaProcesses={qaProcesses}
                    item={editingItem} 
                    onClose={() => setEditingItem(null)} 
                    onSave={handleEditSave} 
                />
            )}
        </div>
    );
};

const TabButton = ({ active, onClick, icon, text, id }) => (
    <button 
        id={id}
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
            active ? 'bg-red-600 text-white shadow-2xs' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`}
    >
        {icon}
        {text}
    </button>
);

// ==========================================
// MODAL DE VISUALIZAÇÃO DE DETALHES
// ==========================================
const ViewModal = ({ activeTab, item, collaboratorsMap, collaboratorsInfo, qaProcesses, getSafeDateString, onClose }) => {
    const colabId = item.colabId || item.collaboratorId;
    const colabName = (collaboratorsMap && collaboratorsMap[colabId]) || item.colabName || 'Colaborador';
    const colabData = (collaboratorsInfo && collaboratorsInfo[colabId]) || {};
    const dateFormatted = getSafeDateString(item);
    const scoreTotal = item.pontuacao !== undefined ? Number(item.pontuacao) : calculateScore(item);

    // Campos ignorados da iteração padrão de extras
    const standardFields = [
        'id', 'createdAt', 'updatedAt', 'colabId', 'collaboratorId', 'colabName', 
        'read', 'evaluatorId', 'checklistResults', 'processId', 'date', 'pontuacao',
        'Atendimentos_Finalizados', 'Atendimentos_Huggy', 'Ligacoes_Atendidas', 'Ligacoes_Perdidas',
        'TMA_Telefonia', 'TME_Telefonia', 'TMA_Huggy', 'type', 'method', 'protocol', 
        'comment', 'createdBy', 'fcr', 'tmr', 'recurrence', 'status', 'evaluatorName', 'notes'
    ];

    const extraEntries = Object.entries(item)
        .filter(([key]) => !standardFields.includes(key))
        .sort(([a], [b]) => a.localeCompare(b));

    const getModalTitle = () => {
        switch (activeTab) {
            case 'metrics': return 'Avaliação de Desempenho';
            case 'feedbacks': return 'Detalhes do Feedback';
            case 'kpis': return 'Indicadores do Setor (KPIs)';
            case 'audits': return 'Auditoria de Qualidade (QA)';
            default: return 'Detalhes do Registro';
        }
    };

    return (
        <div className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-4 z-[80] backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${activeTab === 'metrics' || activeTab === 'audits' ? 'max-w-2xl' : 'max-w-xl'} overflow-hidden flex flex-col max-h-[92vh] border border-gray-100`}>
                
                {/* CABEÇALHO DO MODAL */}
                <div className="p-4 bg-zinc-950 text-white flex justify-between items-center shrink-0 border-b border-zinc-800">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-500 border border-red-500/30 flex items-center justify-center">
                            {activeTab === 'metrics' && <TrendingUp className="w-4 h-4" />}
                            {activeTab === 'feedbacks' && <MessageSquare className="w-4 h-4" />}
                            {activeTab === 'kpis' && <Target className="w-4 h-4" />}
                            {activeTab === 'audits' && <ShieldCheck className="w-4 h-4" />}
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-white tracking-tight">{getModalTitle()}</h3>
                            <p className="text-[11px] text-zinc-400">Dados cadastrados no sistema Hubdesk</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* CORPO DO MODAL */}
                <div className="p-6 space-y-6 text-sm overflow-y-auto flex-1 bg-gray-50/50">

                    {/* ========================================================= */}
                    {/* VISUALIZAÇÃO DEDICADA: DESEMPENHO (METRICS) */}
                    {/* ========================================================= */}
                    {activeTab === 'metrics' && (
                        <div className="space-y-6">
                            {/* HERO CARD DO COLABORADOR */}
                            <div className="bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 p-4 sm:p-5 text-white rounded-2xl shadow-sm border border-zinc-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center text-white text-lg font-black shadow-inner shrink-0">
                                        {colabName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h4 className="text-base sm:text-lg font-bold text-white tracking-tight leading-tight">{colabName}</h4>
                                            {colabData.role && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-700/80 text-zinc-300 font-medium border border-zinc-600">
                                                    {colabData.role}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2.5 text-xs text-zinc-400 mt-1">
                                            <span className="flex items-center gap-1">
                                                <Calendar className="w-3.5 h-3.5 text-red-400" />
                                                Ref: <strong className="text-zinc-200">{dateFormatted}</strong>
                                            </span>
                                            {colabData.shift && (
                                                <span>• Turno: <strong className="text-zinc-200">{colabData.shift}</strong></span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* SCORE BADGE */}
                                <div className="bg-zinc-800/90 border border-zinc-700/80 rounded-xl px-4 py-2.5 flex items-center gap-3 shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
                                    <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                                        <Award className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">Pontuação Geral</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-black text-white">{scoreTotal}</span>
                                            <span className="text-xs font-semibold text-amber-400">pts</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SEÇÃO 1: VOLUME & PRODUTIVIDADE */}
                            <div>
                                <div className="flex items-center justify-between mb-2.5">
                                    <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                                        <BarChart2 className="w-4 h-4 text-blue-600" />
                                        Volume de Atendimentos
                                    </h5>
                                    <span className="text-[11px] text-gray-400">Chamadas e conversas computadas</span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {/* Finalizados */}
                                    <div className="bg-white p-3.5 rounded-xl border border-blue-100/90 shadow-xs relative overflow-hidden">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold text-gray-600">Finalizados</span>
                                            <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                        <div className="text-2xl font-black text-gray-900 tracking-tight">
                                            {item.Atendimentos_Finalizados ?? 0}
                                        </div>
                                        <div className="mt-1.5 text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded w-fit">
                                            +1 pt / chamado
                                        </div>
                                    </div>

                                    {/* Huggy */}
                                    <div className="bg-white p-3.5 rounded-xl border border-purple-100/90 shadow-xs relative overflow-hidden">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold text-gray-600">Huggy (Chat)</span>
                                            <div className="w-6 h-6 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center">
                                                <MessageCircle className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                        <div className="text-2xl font-black text-gray-900 tracking-tight">
                                            {item.Atendimentos_Huggy ?? 0}
                                        </div>
                                        <div className="mt-1.5 text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded w-fit">
                                            +1 pt / chat
                                        </div>
                                    </div>

                                    {/* Atendidas */}
                                    <div className="bg-white p-3.5 rounded-xl border border-emerald-100/90 shadow-xs relative overflow-hidden">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold text-gray-600">Atendidas</span>
                                            <div className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                <PhoneCall className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                        <div className="text-2xl font-black text-gray-900 tracking-tight">
                                            {item.Ligacoes_Atendidas ?? 0}
                                        </div>
                                        <div className="mt-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded w-fit">
                                            +2 pts / ligação
                                        </div>
                                    </div>

                                    {/* Perdidas */}
                                    <div className="bg-white p-3.5 rounded-xl border border-red-100/90 shadow-xs relative overflow-hidden">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold text-gray-600">Perdidas</span>
                                            <div className="w-6 h-6 rounded-md bg-red-50 text-red-600 flex items-center justify-center">
                                                <PhoneMissed className="w-3.5 h-3.5" />
                                            </div>
                                        </div>
                                        <div className="text-2xl font-black text-red-600 tracking-tight">
                                            {item.Ligacoes_Perdidas ?? 0}
                                        </div>
                                        <div className="mt-1.5 text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded w-fit">
                                            -5 pts penalidade
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SEÇÃO 2: MÉTRICAS DE TEMPO */}
                            <div>
                                <div className="flex items-center justify-between mb-2.5">
                                    <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                                        <Clock className="w-4 h-4 text-amber-600" />
                                        Métricas de Tempo (SLA)
                                    </h5>
                                    <span className="text-[11px] text-gray-400">Padrão HH:MM:SS</span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {/* TMA Telefonia */}
                                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">TMA Telefonia</span>
                                            <span className="text-base font-mono font-bold text-gray-900">{item.TMA_Telefonia || '00:00:00'}</span>
                                        </div>
                                    </div>

                                    {/* TME Telefonia */}
                                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600 shrink-0">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">TME Telefonia</span>
                                            <span className="text-base font-mono font-bold text-gray-900">{item.TME_Telefonia || '00:00:00'}</span>
                                        </div>
                                    </div>

                                    {/* TMA Huggy */}
                                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-xs flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-lg bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 shrink-0">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">TMA Huggy</span>
                                            <span className="text-base font-mono font-bold text-gray-900">{item.TMA_Huggy || '00:00:00'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SEÇÃO 3: CÁLCULO DA PONTUAÇÃO */}
                            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-gray-700">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    Composição Detalhada do Cálculo
                                </div>
                                <div className="text-xs text-gray-600 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                                    <span>({item.Atendimentos_Finalizados || 0} × 1)</span>
                                    <span>+</span>
                                    <span>({item.Atendimentos_Huggy || 0} × 1)</span>
                                    <span>+</span>
                                    <span>({item.Ligacoes_Atendidas || 0} × 2)</span>
                                    <span>-</span>
                                    <span>({item.Ligacoes_Perdidas || 0} × 5)</span>
                                    <span>=</span>
                                    <span className="font-bold text-gray-900 text-sm bg-white px-2 py-0.5 rounded border border-gray-200">
                                        {scoreTotal} pontos
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* VISUALIZAÇÃO DEDICADA: FEEDBACKS */}
                    {/* ========================================================= */}
                    {activeTab === 'feedbacks' && (
                        <div className="space-y-4">
                            {/* CABEÇALHO DO FEEDBACK */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                                        {colabName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Colaborador Avaliado</span>
                                        <h4 className="text-base font-bold text-gray-900">{colabName}</h4>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Data do Feedback</span>
                                    <span className="text-sm font-semibold text-gray-900 flex items-center gap-1 justify-end">
                                        <Calendar className="w-3.5 h-3.5 text-red-500" />
                                        {dateFormatted}
                                    </span>
                                </div>
                            </div>

                            {/* TIPO E CANAL */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Classificação</span>
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                        item.type === 'Elogio' ? 'bg-emerald-100 text-emerald-800' :
                                        item.type === 'Ponto de Melhoria' ? 'bg-amber-100 text-amber-800' :
                                        item.type === 'Reclamação' ? 'bg-red-100 text-red-800' :
                                        item.type === 'Sugestão' ? 'bg-blue-100 text-blue-800' :
                                        'bg-purple-100 text-purple-800'
                                    }`}>
                                        {item.type || 'Não informado'}
                                    </span>
                                </div>

                                <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Meio / Canal</span>
                                    <span className="text-sm font-bold text-gray-800">{item.method || 'Geral'}</span>
                                </div>

                                <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-xs">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Protocolo</span>
                                    <span className="text-sm font-mono font-bold text-gray-800">{item.protocol || '--'}</span>
                                </div>
                            </div>

                            {/* COMENTÁRIO */}
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                                <span className="text-xs font-bold text-gray-600 uppercase flex items-center gap-1.5 mb-2">
                                    <MessageSquare className="w-4 h-4 text-red-500" />
                                    Comentário do Feedback
                                </span>
                                <div className="p-3.5 bg-gray-50 rounded-lg border border-gray-100 text-gray-800 text-sm whitespace-pre-wrap leading-relaxed">
                                    {item.comment || 'Nenhum comentário registrado.'}
                                </div>
                            </div>

                            {item.createdBy && (
                                <div className="text-xs text-gray-400 text-right">
                                    Registrado por: <strong className="text-gray-600">{item.createdBy}</strong>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* VISUALIZAÇÃO DEDICADA: KPIS */}
                    {/* ========================================================= */}
                    {activeTab === 'kpis' && (
                        <div className="space-y-4">
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Indicadores do Setor</span>
                                    <h4 className="text-base font-bold text-gray-900">Período de Referência</h4>
                                </div>
                                <span className="text-sm font-bold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                                    <Calendar className="w-4 h-4 text-red-500" />
                                    {dateFormatted}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-xs">
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase block mb-1">FCR (Resolução 1º Contato)</span>
                                    <span className="text-2xl font-black text-gray-900">{item.fcr ?? 0}%</span>
                                    <p className="text-[10px] text-gray-400 mt-1">Meta setorial de qualidade</p>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-xs">
                                    <span className="text-[10px] font-bold text-blue-600 uppercase block mb-1">TMR (Tempo Médio Resposta)</span>
                                    <span className="text-2xl font-black text-gray-900">{item.tmr || '00:00'}</span>
                                    <p className="text-[10px] text-gray-400 mt-1">Tempo de primeira resposta</p>
                                </div>

                                <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-xs">
                                    <span className="text-[10px] font-bold text-amber-600 uppercase block mb-1">Reincidência</span>
                                    <span className="text-2xl font-black text-gray-900">{item.recurrence ?? 0}%</span>
                                    <p className="text-[10px] text-gray-400 mt-1">Taxa de chamados repetidos</p>
                                </div>
                            </div>

                            {item.createdBy && (
                                <div className="text-xs text-gray-400 text-right">
                                    Registrado por: <strong className="text-gray-600">{item.createdBy}</strong>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* VISUALIZAÇÃO DEDICADA: AUDITORIAS QA */}
                    {/* ========================================================= */}
                    {activeTab === 'audits' && (
                        <div className="space-y-4">
                            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                                        {colabName.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase block">Colaborador Auditado</span>
                                        <h4 className="text-base font-bold text-gray-900">{colabName}</h4>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Status da Auditoria</span>
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                        item.status === 'Conforme' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                                    }`}>
                                        {item.status === 'Conforme' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                                        {item.status || 'Pendente'}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Protocolo</span>
                                    <span className="text-sm font-mono font-bold text-gray-900">{item.protocol || '--'}</span>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Data Auditoria</span>
                                    <span className="text-sm font-bold text-gray-900">{dateFormatted}</span>
                                </div>
                                <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Avaliador</span>
                                    <span className="text-sm font-bold text-gray-900">{item.evaluatorName || 'Sistema'}</span>
                                </div>
                            </div>

                            {item.notes && (
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                                    <span className="text-xs font-bold text-gray-600 uppercase block mb-1.5">Observações do Auditor</span>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{item.notes}</p>
                                </div>
                            )}

                            {/* CHECKLIST DA AUDITORIA */}
                            {item.checklistResults && Object.keys(item.checklistResults).length > 0 && (
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                                    <h5 className="text-xs font-bold text-gray-700 uppercase flex items-center gap-2 mb-3">
                                        <ShieldCheck className="w-4 h-4 text-red-500" /> Checklist da Avaliação
                                    </h5>
                                    <div className="space-y-2.5">
                                        {Object.entries(item.checklistResults).map(([idx, status]) => {
                                            const process = qaProcesses && item.processId ? qaProcesses[item.processId] : null;
                                            const question = process?.checklist?.[idx] || `Item de verificação ${Number(idx) + 1}`;
                                            let statusColor = "text-gray-600 bg-gray-100 border-gray-200";
                                            if (status === 'Passou') statusColor = "text-emerald-700 bg-emerald-50 border-emerald-200";
                                            if (status === 'Falhou') statusColor = "text-red-700 bg-red-50 border-red-200";
                                            return (
                                                <div key={idx} className="flex justify-between items-start gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200/80">
                                                    <span className="text-sm text-gray-700 font-medium leading-snug">{question}</span>
                                                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 border ${statusColor}`}>
                                                        {status}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ========================================================= */}
                    {/* INFORMAÇÕES ADICIONAIS (SE HOUVER CAMPOS EXTRAS) */}
                    {/* ========================================================= */}
                    {extraEntries.length > 0 && (
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-400 block mb-3">Outros Dados Cadastrados</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {extraEntries.map(([key, value]) => {
                                    let displayVal = value;
                                    if (value && typeof value === 'object') {
                                        if (typeof value.toDate === 'function') {
                                            displayVal = value.toDate().toLocaleString('pt-BR');
                                        } else {
                                            displayVal = JSON.stringify(value);
                                        }
                                    }
                                    return (
                                        <div key={key} className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase">{translateKey(key)}</span>
                                            <span className="block text-gray-800 font-medium text-xs mt-0.5">{displayVal?.toString() || 'Vazio'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* RODAPÉ DO MODAL */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end shrink-0">
                    <button 
                        onClick={onClose} 
                        className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-black transition-colors shadow-sm"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

const DeleteModal = ({ onClose, onConfirm }) => (
    <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Apagar Registro?</h3>
            <p className="text-gray-500 text-sm mb-6">Esta ação não pode ser desfeita. O dado será removido permanentemente dos relatórios e gráficos.</p>
            <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">Cancelar</button>
                <button onClick={onConfirm} className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium">Sim, Apagar</button>
            </div>
        </div>
    </div>
);

// ==========================================
// MODAL DE EDIÇÃO DE DADOS (ESTILIZADO & ORDENADO)
// ==========================================
const EditModal = ({ activeTab, item, collaboratorsMap, collaboratorsInfo, qaProcesses, onClose, onSave }) => {
    const [formData, setFormData] = useState({ ...item });
    const colabId = formData.colabId || formData.collaboratorId;
    const colabName = (collaboratorsMap && collaboratorsMap[colabId]) || formData.colabName || 'Colaborador';
    const colabData = (collaboratorsInfo && collaboratorsInfo[colabId]) || {};

    const handleChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const liveScore = calculateScore(formData);

    const handleSubmit = (e) => {
        e.preventDefault();
        const dataToUpdate = { ...formData };
        delete dataToUpdate.id;
        delete dataToUpdate.createdAt;

        // Se for Desempenho (metrics), garante os tipos numéricos e atualiza a pontuação calculada
        if (activeTab === 'metrics') {
            dataToUpdate.Atendimentos_Finalizados = Number(formData.Atendimentos_Finalizados) || 0;
            dataToUpdate.Atendimentos_Huggy = Number(formData.Atendimentos_Huggy) || 0;
            dataToUpdate.Ligacoes_Atendidas = Number(formData.Ligacoes_Atendidas) || 0;
            dataToUpdate.Ligacoes_Perdidas = Number(formData.Ligacoes_Perdidas) || 0;
            dataToUpdate.pontuacao = liveScore;
        }

        onSave(dataToUpdate);
    };

    const getEditTitle = () => {
        switch (activeTab) {
            case 'metrics': return 'Editar Avaliação de Desempenho';
            case 'feedbacks': return 'Editar Registro de Feedback';
            case 'kpis': return 'Editar Indicadores (KPIs)';
            case 'audits': return 'Editar Auditoria de Qualidade';
            default: return 'Editar Registro';
        }
    };

    return (
        <div className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-4 z-[80] backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`bg-white rounded-2xl shadow-2xl w-full ${activeTab === 'metrics' || activeTab === 'audits' ? 'max-w-2xl' : 'max-w-xl'} overflow-hidden flex flex-col max-h-[92vh] border border-gray-100`}>
                
                {/* CABEÇALHO DO MODAL DE EDIÇÃO */}
                <div className="p-4 bg-zinc-950 text-white flex justify-between items-center shrink-0 border-b border-zinc-800">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                            <Edit2 className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-white tracking-tight">{getEditTitle()}</h3>
                            <p className="text-[11px] text-zinc-400">Altere os campos com precisão e consistência</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* FORMULÁRIO COM ORDEM FIXA E ESTRUTURADA */}
                <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
                    <form id="editForm" onSubmit={handleSubmit} className="space-y-5">

                        {/* ========================================================= */}
                        {/* FORMULÁRIO: DESEMPENHO (METRICS) */}
                        {/* ========================================================= */}
                        {activeTab === 'metrics' && (
                            <div className="space-y-5">
                                {/* BANNER FIXO DO COLABORADOR */}
                                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white font-bold text-base shrink-0">
                                            {colabName.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold text-gray-400 uppercase">Colaborador</span>
                                                {colabData.role && (
                                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 text-gray-600 font-medium">
                                                        {colabData.role}
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="text-base font-bold text-gray-900">{colabName}</h4>
                                        </div>
                                    </div>

                                    <div className="w-full sm:w-auto">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Data de Referência</label>
                                        <input 
                                            type="date"
                                            value={formData.date || ''}
                                            onChange={(e) => handleChange('date', e.target.value)}
                                            className="w-full sm:w-auto px-3 py-1.5 text-xs font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none bg-white"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* SEÇÃO 1: VOLUME DE ATENDIMENTOS (ORDEM FIXA) */}
                                <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <h5 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                                            <BarChart2 className="w-4 h-4 text-blue-600" />
                                            Volume de Atendimentos
                                        </h5>
                                        <span className="text-[11px] text-gray-400">Insira valores numéricos inteiros</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {/* Finalizados */}
                                        <div className="bg-white p-3.5 rounded-xl border border-blue-100 shadow-xs">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-xs font-bold text-gray-700">Atendimentos Finalizados</label>
                                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">+1 pt</span>
                                            </div>
                                            <input 
                                                type="number"
                                                min="0"
                                                value={formData.Atendimentos_Finalizados ?? ''}
                                                onChange={(e) => handleChange('Atendimentos_Finalizados', e.target.value === '' ? '' : Number(e.target.value))}
                                                className="w-full p-2 text-base font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="0"
                                            />
                                        </div>

                                        {/* Huggy */}
                                        <div className="bg-white p-3.5 rounded-xl border border-purple-100 shadow-xs">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-xs font-bold text-gray-700">Atendimentos Huggy (Chat)</label>
                                                <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded">+1 pt</span>
                                            </div>
                                            <input 
                                                type="number"
                                                min="0"
                                                value={formData.Atendimentos_Huggy ?? ''}
                                                onChange={(e) => handleChange('Atendimentos_Huggy', e.target.value === '' ? '' : Number(e.target.value))}
                                                className="w-full p-2 text-base font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                                placeholder="0"
                                            />
                                        </div>

                                        {/* Ligações Atendidas */}
                                        <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-xs">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-xs font-bold text-gray-700">Ligações Atendidas</label>
                                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">+2 pts</span>
                                            </div>
                                            <input 
                                                type="number"
                                                min="0"
                                                value={formData.Ligacoes_Atendidas ?? ''}
                                                onChange={(e) => handleChange('Ligacoes_Atendidas', e.target.value === '' ? '' : Number(e.target.value))}
                                                className="w-full p-2 text-base font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                                                placeholder="0"
                                            />
                                        </div>

                                        {/* Ligações Perdidas */}
                                        <div className="bg-white p-3.5 rounded-xl border border-red-100 shadow-xs">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className="text-xs font-bold text-gray-700">Ligações Perdidas</label>
                                                <span className="text-[10px] font-bold text-red-700 bg-red-50 px-1.5 py-0.5 rounded">-5 pts penalidade</span>
                                            </div>
                                            <input 
                                                type="number"
                                                min="0"
                                                value={formData.Ligacoes_Perdidas ?? ''}
                                                onChange={(e) => handleChange('Ligacoes_Perdidas', e.target.value === '' ? '' : Number(e.target.value))}
                                                className="w-full p-2 text-base font-bold border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 outline-none"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* SEÇÃO 2: MÉTRICAS DE TEMPO (ORDEM FIXA) */}
                                <div>
                                    <div className="flex items-center justify-between mb-2.5">
                                        <h5 className="text-xs font-bold uppercase tracking-wider text-gray-600 flex items-center gap-1.5">
                                            <Clock className="w-4 h-4 text-amber-600" />
                                            Tempos Médios (TMA / TME)
                                        </h5>
                                        <span className="text-[11px] text-gray-400">Formato HH:MM:SS</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">TMA Telefonia</label>
                                            <input 
                                                type="text"
                                                value={formData.TMA_Telefonia || ''}
                                                onChange={(e) => handleChange('TMA_Telefonia', e.target.value)}
                                                placeholder="00:00:00"
                                                className="w-full p-2 font-mono font-bold text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                                            />
                                        </div>

                                        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">TME Telefonia</label>
                                            <input 
                                                type="text"
                                                value={formData.TME_Telefonia || ''}
                                                onChange={(e) => handleChange('TME_Telefonia', e.target.value)}
                                                placeholder="00:00:00"
                                                className="w-full p-2 font-mono font-bold text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none"
                                            />
                                        </div>

                                        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">TMA Huggy</label>
                                            <input 
                                                type="text"
                                                value={formData.TMA_Huggy || ''}
                                                onChange={(e) => handleChange('TMA_Huggy', e.target.value)}
                                                placeholder="00:00:00"
                                                className="w-full p-2 font-mono font-bold text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* PRÉVIA DINÂMICA DA PONTUAÇÃO EM TEMPO REAL */}
                                <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                                            <Sparkles className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="text-xs font-bold text-amber-900 block">Pontuação Recalculada em Tempo Real</span>
                                            <p className="text-[11px] text-amber-700">A pontuação será gravada automaticamente com base nos valores editados.</p>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <div className="flex items-baseline gap-1 justify-end">
                                            <span className="text-2xl font-black text-amber-900">{liveScore}</span>
                                            <span className="text-xs font-bold text-amber-700">pts</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========================================================= */}
                        {/* FORMULÁRIO: FEEDBACKS */}
                        {/* ========================================================= */}
                        {activeTab === 'feedbacks' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data Referência</label>
                                        <input 
                                            type="date"
                                            value={formData.date || ''}
                                            onChange={(e) => handleChange('date', e.target.value)}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Tipo de Feedback</label>
                                        <select 
                                            value={formData.type || 'Elogio'} 
                                            onChange={(e) => handleChange('type', e.target.value)}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm"
                                        >
                                            <option value="Elogio">Elogio</option>
                                            <option value="Ponto de Melhoria">Ponto de Melhoria</option>
                                            <option value="Reclamação">Reclamação</option>
                                            <option value="Sugestão">Sugestão</option>
                                            <option value="Dúvida">Dúvida</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Meio / Canal</label>
                                        <select 
                                            value={formData.method || 'Chat'} 
                                            onChange={(e) => handleChange('method', e.target.value)}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm"
                                        >
                                            <option value="Chat">Chat</option>
                                            <option value="Telefone">Telefone</option>
                                            <option value="WhatsApp">WhatsApp</option>
                                            <option value="E-mail">E-mail</option>
                                            <option value="Presencial">Presencial</option>
                                            <option value="Videoconferência">Videoconferência</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Protocolo</label>
                                        <input 
                                            type="text"
                                            value={formData.protocol || ''}
                                            onChange={(e) => handleChange('protocol', e.target.value)}
                                            placeholder="Ex: 2026-09871"
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Comentário Detalhado</label>
                                    <textarea 
                                        rows="4"
                                        value={formData.comment || ''} 
                                        onChange={(e) => handleChange('comment', e.target.value)}
                                        className="w-full p-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm leading-relaxed"
                                        placeholder="Descreva o feedback..."
                                    />
                                </div>
                            </div>
                        )}

                        {/* ========================================================= */}
                        {/* FORMULÁRIO: KPIS */}
                        {/* ========================================================= */}
                        {activeTab === 'kpis' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Mês / Data de Referência</label>
                                    <input 
                                        type="date"
                                        value={formData.date || ''}
                                        onChange={(e) => handleChange('date', e.target.value)}
                                        className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm"
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">FCR (%)</label>
                                        <input 
                                            type="number"
                                            step="0.1"
                                            value={formData.fcr ?? ''}
                                            onChange={(e) => handleChange('fcr', e.target.value === '' ? '' : Number(e.target.value))}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-bold"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">TMR</label>
                                        <input 
                                            type="text"
                                            value={formData.tmr || ''}
                                            onChange={(e) => handleChange('tmr', e.target.value)}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-bold"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Reincidência (%)</label>
                                        <input 
                                            type="number"
                                            step="0.1"
                                            value={formData.recurrence ?? ''}
                                            onChange={(e) => handleChange('recurrence', e.target.value === '' ? '' : Number(e.target.value))}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-bold"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ========================================================= */}
                        {/* FORMULÁRIO: AUDITORIAS QA */}
                        {/* ========================================================= */}
                        {activeTab === 'audits' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Data da Auditoria</label>
                                        <input 
                                            type="date"
                                            value={formData.date || ''}
                                            onChange={(e) => handleChange('date', e.target.value)}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Status Geral</label>
                                        <select 
                                            value={formData.status || 'Conforme'} 
                                            onChange={(e) => handleChange('status', e.target.value)}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-bold"
                                        >
                                            <option value="Conforme">Conforme</option>
                                            <option value="Não Conforme">Não Conforme</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Protocolo</label>
                                        <input 
                                            type="text"
                                            value={formData.protocol || ''}
                                            onChange={(e) => handleChange('protocol', e.target.value)}
                                            className="w-full p-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-mono"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Observações do Auditor</label>
                                    <textarea 
                                        rows="4"
                                        value={formData.notes || ''} 
                                        onChange={(e) => handleChange('notes', e.target.value)}
                                        className="w-full p-3 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm"
                                    />
                                </div>

                                {/* CHECKLIST DA AUDITORIA */}
                                {formData.checklistResults && Object.keys(formData.checklistResults).length > 0 && (
                                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
                                        <h5 className="text-xs font-bold text-gray-700 uppercase flex items-center gap-2 mb-3">
                                            <ShieldCheck className="w-4 h-4 text-red-500" /> Checklist da Avaliação
                                        </h5>
                                        <div className="space-y-2.5">
                                            {Object.entries(formData.checklistResults).map(([idx, status]) => {
                                                const process = qaProcesses && formData.processId ? qaProcesses[formData.processId] : null;
                                                const question = process?.checklist?.[idx] || `Item de verificação ${Number(idx) + 1}`;
                                                return (
                                                    <div key={idx} className="flex justify-between items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
                                                        <span className="text-xs text-gray-700 font-medium leading-snug">{question}</span>
                                                        <select
                                                            value={status}
                                                            onChange={(e) => {
                                                                const updated = { ...formData.checklistResults, [idx]: e.target.value };
                                                                handleChange('checklistResults', updated);
                                                            }}
                                                            className="p-1.5 text-xs font-bold rounded-lg border border-gray-300 bg-white focus:ring-2 focus:ring-red-600 outline-none"
                                                        >
                                                            <option value="Passou">Passou</option>
                                                            <option value="Falhou">Falhou</option>
                                                        </select>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                </div>
                
                {/* RODAPÉ DO FORMULÁRIO */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end shrink-0">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-white font-medium transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        form="editForm" 
                        className="px-6 py-2.5 bg-amber-500 text-white rounded-xl hover:bg-amber-600 font-bold transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
                    >
                        <Check className="w-4 h-4" />
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DataManager;
import React, { useState, useEffect, useMemo } from 'react';
import {
    History, MessageSquare, TrendingUp, FileText, ShieldCheck,
    Search, Filter, Database, Hourglass, Eye, X, CalendarDays,
    Star, User, Clock, AlertTriangle, CheckCircle2, Phone, ThumbsUp, 
    Minus, ThumbsDown, LayoutGrid, Table, Download, RotateCcw,
    Layers, Check, Sparkles, XCircle, MinusCircle, Award, CheckCheck,
    Calendar, ArrowUpDown
} from 'lucide-react';
import { collection, onSnapshot, query, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useNotification } from '../context/NotificationContext';
import AuditDetailModal from '../components/history/AuditDetailModal';
import FeedbackDetailModal from '../components/history/FeedbackDetailModal';
import WeeklyMetricDetailModal from '../components/history/WeeklyMetricDetailModal';
import MonthlyEvaluationDetailModal from '../components/history/MonthlyEvaluationDetailModal';

const parseDateObj = (dateStr) => {
    if (!dateStr) return 0;
    if (typeof dateStr === 'object' && dateStr.toMillis) return dateStr.toMillis();
    if (typeof dateStr === 'object' && dateStr.getTime) return dateStr.getTime();
    if (typeof dateStr === 'string') {
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
            }
        }
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts.length === 3) {
                return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
            }
        }
    }
    const parsed = new Date(dateStr).getTime();
    return isNaN(parsed) ? 0 : parsed;
};

const formatMonth = (yyyyMm) => {
    if (!yyyyMm) return '--';
    const parts = yyyyMm.split('-');
    if (parts.length === 2) {
        return `${parts[1]}/${parts[0]}`;
    }
    return yyyyMm;
};

const getClassificationBadge = (classification) => {
    switch (classification) {
        case 'Positiva': 
            return (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 w-max shadow-2xs">
                    <ThumbsUp className="w-3 h-3 text-emerald-600"/> Positiva
                </span>
            );
        case 'Neutra': 
            return (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 w-max shadow-2xs">
                    <Minus className="w-3 h-3 text-amber-600"/> Neutra
                </span>
            );
        case 'Negativa': 
            return (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 w-max shadow-2xs">
                    <ThumbsDown className="w-3 h-3 text-rose-600"/> Negativa
                </span>
            );
        default: 
            return (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200 flex items-center gap-1 w-max">
                    <Minus className="w-3 h-3 text-gray-500"/> {classification || 'N/A'}
                </span>
            );
    }
};

const MyHistory = ({ currentUserId }) => {
    const { showToast } = useNotification();
    const [activeTab, setActiveTab] = useState('feedbacks');
    
    // Filtros e Visualização
    const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
    const [searchTerm, setSearchTerm] = useState('');
    const [periodFilter, setPeriodFilter] = useState('all'); // 'all' | '7d' | '30d' | 'this_month' | 'last_month'
    const [dateFilter, setDateFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [processFilter, setProcessFilter] = useState('all');
    const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'oldest' | 'score_high' | 'score_low'

    // Dados e Modais
    const [data, setData] = useState([]);
    const [qaProcesses, setQaProcesses] = useState({});
    const [loading, setLoading] = useState(Boolean(currentUserId));
    const [viewingItem, setViewingItem] = useState(null);

    const handleTabChange = (tab) => {
        if (tab !== activeTab) {
            setActiveTab(tab);
            setLoading(true);
            setStatusFilter('all');
            setProcessFilter('all');
            setSearchTerm('');
            setDateFilter('');
            setPeriodFilter('all');
        }
    };

    const getSafeDateString = item => {
        if (item.date) {
            if (typeof item.date === 'string' && item.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                const [y, m, d] = item.date.split('-');
                return `${d}/${m}/${y}`;
            }
            return item.date;
        }
        return item.createdAt ? (typeof item.createdAt.toDate === 'function' ? item.createdAt.toDate().toLocaleDateString('pt-BR') : new Date(item.createdAt).toLocaleDateString('pt-BR')) : 'Sem data';
    };

    useEffect(() => {
        const unsubQA = onSnapshot(collection(db, "qa_processes"), snap => {
            const map = {};
            snap.forEach(d => { map[d.id] = { id: d.id, ...d.data() }; });
            setQaProcesses(map);
        });

        if (!currentUserId) {
            return () => unsubQA();
        }

        let col = '';
        if (activeTab === 'feedbacks') col = 'feedbacks';
        else if (activeTab === 'metrics') col = 'weekly_evaluations';
        else if (activeTab === 'audits') col = 'qa_audits';
        else if (activeTab === 'monthly') col = 'monthly_evaluations';

        const q = query(collection(db, col));

        const unsub = onSnapshot(q, snap => {
            const res = [];
            snap.forEach(d => {
                const dt = d.data();
                if (dt.colabId === currentUserId || dt.collaboratorId === currentUserId) {
                    res.push({ id: d.id, ...dt });
                }
            });

            res.sort((a, b) => {
                const timeA = a.date ? parseDateObj(a.date) : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
                const timeB = b.date ? parseDateObj(b.date) : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
                return timeB - timeA;
            });

            setData(res);
            setLoading(false);
        });

        return () => { 
            unsubQA(); 
            unsub(); 
        };
    }, [activeTab, currentUserId]);

    const handleMarkAsRead = async (id) => {
        try {
            await updateDoc(doc(db, "feedbacks", id), { read: true });
            showToast("Feedback marcado como lido!", "success");
            // Atualiza localmente
            setData(prev => prev.map(item => item.id === id ? { ...item, read: true } : item));
            if (viewingItem && viewingItem.id === id) {
                setViewingItem(prev => ({ ...prev, read: true }));
            }
        } catch {
            showToast("Erro ao atualizar status.", "error");
        }
    };

    const handleViewItem = (item) => {
        setViewingItem(item);
        if (activeTab === 'feedbacks' && !item.read) {
            handleMarkAsRead(item.id);
        }
    };

    // Opções de Meses e Datas disponíveis nos registros carregados
    const filterOptions = useMemo(() => {
        const months = new Set();
        const dates = new Set();
        data.forEach(item => {
            const safeDate = getSafeDateString(item);
            if (safeDate && safeDate !== 'Sem data') {
                dates.add(safeDate);
                const parts = safeDate.split('/');
                if (parts.length === 3) months.add(`${parts[1]}/${parts[2]}`);
            }
            if (item.referenceMonth) {
                months.add(formatMonth(item.referenceMonth));
            }
        });
        return {
            months: Array.from(months).sort((a, b) => b.localeCompare(a)),
            dates: Array.from(dates).sort((a, b) => parseDateObj(b) - parseDateObj(a))
        };
    }, [data]);

    // Lista de processos presentes nas auditorias para filtro
    const availableProcesses = useMemo(() => {
        if (activeTab !== 'audits') return [];
        const procMap = new Map();
        data.forEach(item => {
            const pId = item.processId;
            const pName = item.processName || qaProcesses[pId]?.name || 'Procedimento Padrão';
            if (pId && !procMap.has(pId)) {
                procMap.set(pId, pName);
            }
        });
        return Array.from(procMap.entries()).map(([id, name]) => ({ id, name }));
    }, [data, activeTab, qaProcesses]);

    // CÁLCULO DAS ESTATÍSTICAS DO TOPO CONTEXTUAIS POR ABA
    const summaryStats = useMemo(() => {
        if (activeTab === 'feedbacks') {
            const total = data.length;
            const praises = data.filter(i => i.type === 'Elogio').length;
            const improvements = data.filter(i => i.type === 'Ponto de Melhoria').length;
            const unread = data.filter(i => !i.read).length;
            return [
                { label: 'Total de Feedbacks', value: total, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Elogios Recebidos', value: praises, icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Pontos de Melhoria', value: improvements, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Não Lidos', value: unread, icon: Clock, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50' }
            ];
        }

        if (activeTab === 'metrics') {
            const total = data.length;
            let totalScore = 0;
            let maxScore = 0;
            let totalCalls = 0;
            data.forEach(i => {
                const score = Number(i.pontuacao !== undefined ? i.pontuacao : (Number(i.Atendimentos_Finalizados || 0) + Number(i.Ligacoes_Atendidas || 0) * 2 + Number(i.Atendimentos_Huggy || 0) - Number(i.Ligacoes_Perdidas || 0) * 5));
                totalScore += score;
                if (score > maxScore) maxScore = score;
                totalCalls += Number(i.Ligacoes_Atendidas || 0);
            });
            const avgScore = total > 0 ? Math.round(totalScore / total) : 0;
            return [
                { label: 'Avaliações Semanais', value: total, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Média de Pontuação', value: `${avgScore} pts`, icon: Sparkles, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Maior Pontuação', value: `${maxScore} pts`, icon: Award, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Ligações Atendidas', value: totalCalls, icon: Phone, color: 'text-indigo-600', bg: 'bg-indigo-50' }
            ];
        }

        if (activeTab === 'monthly') {
            const total = data.length;
            const positives = data.filter(i => i.classification === 'Positiva').length;
            const neutrals = data.filter(i => i.classification === 'Neutra').length;
            const negatives = data.filter(i => i.classification === 'Negativa').length;
            return [
                { label: 'Avaliações 1:1', value: total, icon: CalendarDays, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Classificação Positiva', value: positives, icon: ThumbsUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Classificação Neutra', value: neutrals, icon: Minus, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Em Desenvolvimento', value: negatives, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' }
            ];
        }

        if (activeTab === 'audits') {
            const total = data.length;
            const conformes = data.filter(i => i.status === 'Conforme').length;
            const naoConformes = data.filter(i => i.status !== 'Conforme').length;
            const taxa = total > 0 ? Math.round((conformes / total) * 100) : 100;
            return [
                { label: 'Auditorias Recebidas', value: total, icon: ShieldCheck, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Conformes (Aprovadas)', value: conformes, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Não Conformes', value: naoConformes, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                { label: 'Taxa de Conformidade', value: `${taxa}%`, icon: Sparkles, color: taxa >= 80 ? 'text-emerald-600' : 'text-amber-600', bg: taxa >= 80 ? 'bg-emerald-50' : 'bg-amber-50' }
            ];
        }

        return [];
    }, [data, activeTab]);

    // FILTRAGEM E ORDENAÇÃO AVANÇADA
    const filteredData = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const sevenDaysAgo = startOfToday - (7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = startOfToday - (30 * 24 * 60 * 60 * 1000);
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
        const endOfLastMonth = startOfThisMonth - 1;

        return data.filter(item => {
            // 1. Busca por texto
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const matchType = (item.type || '').toLowerCase().includes(term);
                const matchComment = (item.comment || '').toLowerCase().includes(term);
                const matchNotes = (item.notes || '').toLowerCase().includes(term);
                const matchProtocol = String(item.protocol || '').toLowerCase().includes(term);
                const matchEvaluator = (item.evaluatorName || item.createdBy || '').toLowerCase().includes(term);
                const matchProcess = (item.processName || qaProcesses[item.processId]?.name || '').toLowerCase().includes(term);
                const matchChannel = (item.channel || item.method || '').toLowerCase().includes(term);

                if (!matchType && !matchComment && !matchNotes && !matchProtocol && !matchEvaluator && !matchProcess && !matchChannel) {
                    return false;
                }
            }

            // 2. Filtro de Período Rápido
            const itemTime = item.date ? parseDateObj(item.date) : (item.createdAt?.toMillis ? item.createdAt.toMillis() : 0);
            if (periodFilter === '7d' && itemTime < sevenDaysAgo) return false;
            if (periodFilter === '30d' && itemTime < thirtyDaysAgo) return false;
            if (periodFilter === 'this_month' && itemTime < startOfThisMonth) return false;
            if (periodFilter === 'last_month' && (itemTime < startOfLastMonth || itemTime > endOfLastMonth)) return false;

            // 3. Filtro de Data Específica / Mês
            if (dateFilter) {
                const safeDate = getSafeDateString(item);
                const matchMonth = item.referenceMonth && formatMonth(item.referenceMonth).includes(dateFilter);
                if (!safeDate.includes(dateFilter) && !matchMonth) {
                    return false;
                }
            }

            // 4. Filtro de Status Contextual por Aba
            if (statusFilter !== 'all') {
                if (activeTab === 'feedbacks') {
                    if (statusFilter === 'unread' && item.read) return false;
                    if (statusFilter === 'read' && !item.read) return false;
                    if (statusFilter !== 'unread' && statusFilter !== 'read' && item.type !== statusFilter) return false;
                } else if (activeTab === 'audits') {
                    if (item.status !== statusFilter) return false;
                } else if (activeTab === 'monthly') {
                    if (item.classification !== statusFilter) return false;
                } else if (activeTab === 'metrics') {
                    const score = Number(item.pontuacao !== undefined ? item.pontuacao : (Number(item.Atendimentos_Finalizados || 0) + Number(item.Ligacoes_Atendidas || 0) * 2 + Number(item.Atendimentos_Huggy || 0) - Number(item.Ligacoes_Perdidas || 0) * 5));
                    if (statusFilter === 'high' && score < 100) return false;
                    if (statusFilter === 'medium' && (score < 50 || score >= 100)) return false;
                    if (statusFilter === 'low' && score >= 50) return false;
                }
            }

            // 5. Filtro de Processo QA (Auditorias)
            if (activeTab === 'audits' && processFilter !== 'all') {
                if (item.processId !== processFilter) return false;
            }

            return true;
        }).sort((a, b) => {
            const timeA = a.date ? parseDateObj(a.date) : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
            const timeB = b.date ? parseDateObj(b.date) : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);

            if (sortBy === 'recent') return timeB - timeA;
            if (sortBy === 'oldest') return timeA - timeB;

            if (sortBy === 'score_high') {
                const scoreA = Number(a.pontuacao || a.score || (a.status === 'Conforme' ? 100 : 0));
                const scoreB = Number(b.pontuacao || b.score || (b.status === 'Conforme' ? 100 : 0));
                return scoreB - scoreA;
            }
            if (sortBy === 'score_low') {
                const scoreA = Number(a.pontuacao || a.score || (a.status === 'Conforme' ? 100 : 0));
                const scoreB = Number(b.pontuacao || b.score || (b.status === 'Conforme' ? 100 : 0));
                return scoreA - scoreB;
            }

            return timeB - timeA;
        });
    }, [data, searchTerm, periodFilter, dateFilter, statusFilter, processFilter, sortBy, activeTab, qaProcesses]);

    const hasActiveFilters = searchTerm !== '' || periodFilter !== 'all' || dateFilter !== '' || statusFilter !== 'all' || processFilter !== 'all' || sortBy !== 'recent';

    const handleResetFilters = () => {
        setSearchTerm('');
        setPeriodFilter('all');
        setDateFilter('');
        setStatusFilter('all');
        setProcessFilter('all');
        setSortBy('recent');
    };

    // Exportação em formato CSV
    const handleExportCsv = () => {
        if (filteredData.length === 0) {
            showToast("Nenhum dado para exportar.", "info");
            return;
        }

        let headers = [];
        let rows = [];

        if (activeTab === 'feedbacks') {
            headers = ['Data', 'Tipo', 'Canal', 'Protocolo', 'Avaliador', 'Mensagem', 'Lido'];
            rows = filteredData.map(i => [
                getSafeDateString(i),
                i.type || '',
                i.method || '',
                i.protocol || '',
                i.createdBy || '',
                `"${(i.comment || '').replace(/"/g, '""')}"`,
                i.read ? 'Sim' : 'Não'
            ]);
        } else if (activeTab === 'audits') {
            headers = ['Data', 'Protocolo', 'Processo', 'Status', 'Score (%)', 'Canal', 'Auditor', 'Observações'];
            rows = filteredData.map(i => [
                getSafeDateString(i),
                i.protocol || '',
                `"${(i.processName || qaProcesses[i.processId]?.name || '').replace(/"/g, '""')}"`,
                i.status || '',
                i.score !== undefined ? `${i.score}%` : (i.status === 'Conforme' ? '100%' : '0%'),
                i.channel || '',
                i.evaluatorName || '',
                `"${(i.notes || '').replace(/"/g, '""')}"`
            ]);
        } else if (activeTab === 'metrics') {
            headers = ['Data Referência', 'Pontuação', 'Ligações Atendidas', 'Ligações Perdidas', 'TME Telefonia', 'TMA Telefonia', 'Atendimentos Huggy', 'Finalizados', 'TMA Huggy'];
            rows = filteredData.map(i => [
                getSafeDateString(i),
                i.pontuacao || 0,
                i.Ligacoes_Atendidas || 0,
                i.Ligacoes_Perdidas || 0,
                i.TME_Telefonia || '',
                i.TMA_Telefonia || '',
                i.Atendimentos_Huggy || 0,
                i.Atendimentos_Finalizados || 0,
                i.TMA_Huggy || ''
            ]);
        } else if (activeTab === 'monthly') {
            headers = ['Mês Referência', 'Classificação', 'Avaliador', 'Desempenho (Nota)', 'Qualidade (Nota)', 'Comportamento (Nota)', 'Assiduidade (Nota)', 'Considerações Finais'];
            rows = filteredData.map(i => [
                formatMonth(i.referenceMonth),
                i.classification || '',
                i.evaluatorName || '',
                i.performanceScore || '',
                i.qualityScore || '',
                i.behaviorScore || '',
                i.punctualityScore || '',
                `"${(i.generalComments || '').replace(/"/g, '""')}"`
            ]);
        }

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
            + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `meu_historico_${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Relatório exportado com sucesso!", "success");
    };

    return (
        <div className="flex-1 p-4 sm:p-6 h-full overflow-y-auto flex flex-col bg-gray-50 font-sans">
            
            {/* CABEÇALHO DA PÁGINA */}
            <header className="mb-6 bg-white p-5 sm:p-6 rounded-2xl border border-gray-200/90 shadow-2xs shrink-0 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
                        <History className="w-6 h-6 text-red-600 shrink-0" />
                        <span>Meu Histórico & Performance</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-2xl leading-relaxed">
                        Consulte suas auditorias operacionais detalhadas, feedbacks recebidos, avaliações semanais e alinhamentos mensais 1:1.
                    </p>
                </div>

                {/* Alternância de Modo de Exibição */}
                <div className="flex items-center gap-2 self-start sm:self-center bg-gray-100 p-1 rounded-xl border border-gray-200 shrink-0">
                    <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            viewMode === 'table'
                                ? 'bg-white text-gray-900 shadow-2xs'
                                : 'text-gray-500 hover:text-gray-800'
                        }`}
                        title="Visualizar em tabela detalhada"
                    >
                        <Table className="w-3.5 h-3.5" />
                        <span>Tabela</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode('cards')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            viewMode === 'cards'
                                ? 'bg-white text-gray-900 shadow-2xs'
                                : 'text-gray-500 hover:text-gray-800'
                        }`}
                        title="Visualizar em grade de cards visuais"
                    >
                        <LayoutGrid className="w-3.5 h-3.5" />
                        <span>Cards</span>
                    </button>
                </div>
            </header>

            {/* CARDS DE RESUMO ESTATÍSTICO (DINÂMICOS POR ABA) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 shrink-0">
                {summaryStats.map((stat, idx) => {
                    const IconComponent = stat.icon;
                    return (
                        <div key={idx} className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs flex items-center justify-between gap-3">
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                    {stat.label}
                                </span>
                                <span className="text-xl sm:text-2xl font-black text-gray-900 mt-1 block">
                                    {stat.value}
                                </span>
                            </div>
                            <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center shrink-0 border border-gray-100 shadow-inner`}>
                                <IconComponent className="w-5 h-5" />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* SELEÇÃO DE ABAS & TOOLBAR DE FILTROS AVANÇADOS */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-2xs mb-6 shrink-0 space-y-4">
                
                {/* Abas de Navegação */}
                <div className="flex space-x-2 border-b border-gray-100 pb-3 overflow-x-auto scrollbar-none">
                    <button 
                        onClick={() => handleTabChange('feedbacks')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'feedbacks' 
                                ? 'bg-zinc-950 text-white shadow-xs' 
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <MessageSquare className="w-4 h-4 text-red-500" />
                        <span>Feedbacks</span>
                    </button>
                    <button 
                        onClick={() => handleTabChange('audits')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'audits' 
                                ? 'bg-zinc-950 text-white shadow-xs' 
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                        <span>Auditorias QA</span>
                    </button>
                    <button 
                        onClick={() => handleTabChange('metrics')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'metrics' 
                                ? 'bg-zinc-950 text-white shadow-xs' 
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <TrendingUp className="w-4 h-4 text-amber-500" />
                        <span>Avaliações Semanais</span>
                    </button>
                    <button 
                        onClick={() => handleTabChange('monthly')} 
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'monthly' 
                                ? 'bg-zinc-950 text-white shadow-xs' 
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span>Análise Mensal (1:1)</span>
                    </button>
                </div>

                {/* Grid de Filtros Avançados */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
                    
                    {/* Campo de Busca */}
                    <div className="lg:col-span-4 relative">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                        <input 
                            type="text" 
                            placeholder={activeTab === 'audits' ? "Buscar por protocolo, processo, auditor..." : "Buscar no histórico..."}
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-xl outline-none text-xs sm:text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 bg-white shadow-inner" 
                        />
                    </div>

                    {/* Filtro Rápido de Período */}
                    <div className="lg:col-span-2 relative">
                        <select
                            value={periodFilter}
                            onChange={(e) => setPeriodFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-xs appearance-none bg-white cursor-pointer text-gray-700 font-semibold"
                        >
                            <option value="all">Todo o Período</option>
                            <option value="7d">Últimos 7 dias</option>
                            <option value="30d">Últimos 30 dias</option>
                            <option value="this_month">Este Mês</option>
                            <option value="last_month">Mês Anterior</option>
                        </select>
                    </div>

                    {/* Filtro de Data / Mês Específico */}
                    <div className="lg:col-span-2 relative">
                        <select
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-xs appearance-none bg-white cursor-pointer text-gray-700 font-semibold"
                        >
                            <option value="">Data Específica</option>
                            {filterOptions.months.length > 0 && (
                                <optgroup label="Por Mês">
                                    {filterOptions.months.map(m => <option key={m} value={m}>{m}</option>)}
                                </optgroup>
                            )}
                            {filterOptions.dates.length > 0 && (
                                <optgroup label="Por Data">
                                    {filterOptions.dates.map(d => <option key={d} value={d}>{d}</option>)}
                                </optgroup>
                            )}
                        </select>
                    </div>

                    {/* Filtro Contextual de Status / Categoria */}
                    <div className="lg:col-span-2 relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-xs appearance-none bg-white cursor-pointer text-gray-700 font-semibold"
                        >
                            <option value="all">
                                {activeTab === 'feedbacks' ? 'Todos os Tipos' : 
                                 activeTab === 'audits' ? 'Todos os Status' : 
                                 activeTab === 'monthly' ? 'Todas Classificações' : 
                                 'Todas as Pontuações'}
                            </option>
                            {activeTab === 'feedbacks' && (
                                <>
                                    <option value="Elogio">Elogio</option>
                                    <option value="Ponto de Melhoria">Ponto de Melhoria</option>
                                    <option value="unread">Não Lidos</option>
                                    <option value="read">Lidos</option>
                                </>
                            )}
                            {activeTab === 'audits' && (
                                <>
                                    <option value="Conforme">Conforme</option>
                                    <option value="Não Conforme">Não Conforme</option>
                                </>
                            )}
                            {activeTab === 'monthly' && (
                                <>
                                    <option value="Positiva">Positiva</option>
                                    <option value="Neutra">Neutra</option>
                                    <option value="Negativa">Negativa</option>
                                </>
                            )}
                            {activeTab === 'metrics' && (
                                <>
                                    <option value="high">Pontuação Alta (≥ 100)</option>
                                    <option value="medium">Média (50 a 99)</option>
                                    <option value="low">Baixa (&lt; 50)</option>
                                </>
                            )}
                        </select>
                    </div>

                    {/* Filtro por Processo QA (Somente em Auditorias) OU Ordenação */}
                    {activeTab === 'audits' && availableProcesses.length > 0 ? (
                        <div className="lg:col-span-2 relative">
                            <select
                                value={processFilter}
                                onChange={(e) => setProcessFilter(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-xs appearance-none bg-white cursor-pointer text-gray-700 font-semibold"
                            >
                                <option value="all">Todos os Processos</option>
                                {availableProcesses.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="lg:col-span-2 relative">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none text-xs appearance-none bg-white cursor-pointer text-gray-700 font-semibold"
                            >
                                <option value="recent">Mais Recentes</option>
                                <option value="oldest">Mais Antigos</option>
                                <option value="score_high">Maior Score</option>
                                <option value="score_low">Menor Score</option>
                            </select>
                        </div>
                    )}
                </div>

                {/* Linha de Feedback de Filtros & Ações Rápidas */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs border-t border-gray-100">
                    <div className="flex items-center gap-2">
                        <span className="text-gray-500">
                            Exibindo <strong className="text-gray-900">{filteredData.length}</strong> {filteredData.length === 1 ? 'registro' : 'registros'}
                        </span>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="text-red-600 hover:text-red-700 font-bold flex items-center gap-1 cursor-pointer transition-colors ml-2"
                            >
                                <RotateCcw className="w-3 h-3" /> Limpar filtros
                            </button>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleExportCsv}
                        className="text-gray-600 hover:text-gray-900 font-bold flex items-center gap-1.5 cursor-pointer transition-colors bg-gray-50 hover:bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-xl shadow-2xs"
                    >
                        <Download className="w-3.5 h-3.5 text-gray-500" /> Exportar Relatório CSV
                    </button>
                </div>
            </div>

            {/* CONTAINER DE CONTEÚDO PRINCIPAL (TABELA OU CARDS) */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs flex-1 flex flex-col overflow-hidden">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                        <Hourglass className="w-8 h-8 text-red-600 animate-spin mb-3" />
                        <span className="text-xs text-gray-400 font-medium">Carregando seus registros...</span>
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-12 text-center">
                        <Database className="w-12 h-12 mb-3 opacity-30 text-gray-400" />
                        <p className="text-base font-bold text-gray-700">Nenhum registro encontrado.</p>
                        <p className="text-xs text-gray-400 mt-1 max-w-sm">
                            {hasActiveFilters 
                                ? 'Tente ajustar ou limpar os filtros aplicados para ver mais resultados.' 
                                : 'Seus lançamentos futuros aparecerão aqui automaticamente.'}
                        </p>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Redefinir Filtros
                            </button>
                        )}
                    </div>
                ) : viewMode === 'table' ? (
                    /* VISUALIZAÇÃO EM TABELA DETALHADA */
                    <div className="overflow-x-auto flex-1">
                        <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm whitespace-nowrap">
                            <thead className="bg-zinc-950 text-white sticky top-0 z-10">
                                <tr>
                                    <th className="px-6 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Data</th>
                                    <th className="px-6 py-3.5 text-left font-bold text-xs uppercase tracking-wider">
                                        {activeTab === 'feedbacks' ? 'Tipo & Mensagem' :
                                         activeTab === 'audits' ? 'Auditoria QA (Status & Processo)' :
                                         activeTab === 'metrics' ? 'Score & Volumes de Atendimento' :
                                         'Classificação & Mês de Referência'}
                                    </th>
                                    <th className="px-6 py-3.5 text-center font-bold text-xs uppercase tracking-wider">
                                        {activeTab === 'audits' ? 'Protocolo' : 'Detalhe Adicional'}
                                    </th>
                                    <th className="px-6 py-3.5 text-right font-bold text-xs uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredData.map(item => (
                                    <tr 
                                        key={item.id} 
                                        onClick={() => handleViewItem(item)}
                                        className={`hover:bg-gray-50/80 transition-colors cursor-pointer ${
                                            activeTab === 'feedbacks' && !item.read ? 'bg-fuchsia-50/40' : ''
                                        }`}
                                    >
                                        <td className="px-6 py-4 text-gray-600 font-medium">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                                <span>{getSafeDateString(item)}</span>
                                            </div>
                                        </td>
                                        
                                        <td className="px-6 py-4">
                                            {/* ABA: FEEDBACKS */}
                                            {activeTab === 'feedbacks' && (
                                                <div className="flex items-center gap-2.5">
                                                    {!item.read && (
                                                        <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse shrink-0" title="Não lido"></span>
                                                    )}
                                                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                                                        item.type === 'Elogio' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 
                                                        item.type === 'Ponto de Melhoria' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 
                                                        'bg-blue-100 text-blue-800 border border-blue-200'
                                                    }`}>
                                                        {item.type}
                                                    </span>
                                                    <span className="text-xs text-gray-600 truncate max-w-sm">
                                                        {item.comment || 'Sem mensagem descritiva.'}
                                                    </span>
                                                </div>
                                            )}

                                            {/* ABA: AUDITORIAS QA */}
                                            {activeTab === 'audits' && (
                                                <div className="flex items-center gap-3">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black border ${
                                                        item.status === 'Conforme' 
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                            : 'bg-red-50 text-red-700 border-red-200'
                                                    }`}>
                                                        {item.status === 'Conforme' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-red-600" />}
                                                        <span>{item.status}</span>
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-900 truncate max-w-xs">
                                                        {item.processName || qaProcesses[item.processId]?.name || 'Procedimento Padrão'}
                                                    </span>
                                                </div>
                                            )}

                                            {/* ABA: MÉTRICAS SEMANAIS */}
                                            {activeTab === 'metrics' && (
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-gray-700">
                                                        Pontuação Final: <strong className="text-gray-900 font-mono font-black text-sm">{item.pontuacao || 0} pts</strong>
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        &bull; Ligações: <strong className="text-gray-700">{item.Ligacoes_Atendidas || 0}</strong> | Huggy: <strong className="text-gray-700">{item.Atendimentos_Huggy || 0}</strong>
                                                    </span>
                                                </div>
                                            )}

                                            {/* ABA: ANÁLISE MENSAL */}
                                            {activeTab === 'monthly' && (
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs text-gray-700">
                                                        Mês: <strong className="text-gray-900 font-mono font-bold">{formatMonth(item.referenceMonth)}</strong>
                                                    </span>
                                                    {getClassificationBadge(item.classification)}
                                                </div>
                                            )}
                                        </td>

                                        {/* COLUNA: DETALHE ADICIONAL */}
                                        <td className="px-6 py-4 text-center">
                                            {activeTab === 'audits' && (
                                                <span className="font-mono font-bold text-xs text-gray-700 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">
                                                    {item.protocol || '--'}
                                                </span>
                                            )}
                                            {activeTab === 'feedbacks' && (
                                                <span className="text-xs text-gray-500 font-medium">
                                                    {item.createdBy || 'Gestão'}
                                                </span>
                                            )}
                                            {activeTab === 'metrics' && (
                                                <span className="text-xs text-gray-500">
                                                    TMA: <strong className="text-gray-700 font-mono">{item.TMA_Telefonia || '--'}</strong>
                                                </span>
                                            )}
                                            {activeTab === 'monthly' && (
                                                <span className="text-xs text-gray-500 font-medium">
                                                    Avaliador: <strong className="text-gray-700">{item.evaluatorName || 'Gestão'}</strong>
                                                </span>
                                            )}
                                        </td>

                                        {/* COLUNA: AÇÕES */}
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                {activeTab === 'feedbacks' && !item.read && (
                                                    <button 
                                                        onClick={() => handleMarkAsRead(item.id)} 
                                                        className="text-[11px] font-bold text-fuchsia-600 hover:text-fuchsia-700 uppercase transition-colors cursor-pointer mr-2"
                                                    >
                                                        Marcar Lido
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleViewItem(item)} 
                                                    className="px-3 py-1.5 bg-gray-50 hover:bg-red-50 text-gray-700 hover:text-red-600 rounded-xl flex items-center gap-1.5 transition-colors border border-gray-200 cursor-pointer font-bold text-xs shadow-2xs"
                                                >
                                                    <Eye className="w-3.5 h-3.5 text-red-600" />
                                                    <span>Ver Detalhes</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* VISUALIZAÇÃO EM GRADE DE CARDS INTERATIVOS */
                    <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto flex-1">
                        {filteredData.map(item => (
                            <div 
                                key={item.id}
                                onClick={() => handleViewItem(item)}
                                className={`bg-white rounded-2xl p-4 sm:p-5 border transition-all hover:shadow-md cursor-pointer flex flex-col justify-between ${
                                    activeTab === 'feedbacks' && !item.read 
                                        ? 'border-fuchsia-300 bg-fuchsia-50/20' 
                                        : 'border-gray-200 hover:border-red-300'
                                }`}
                            >
                                <div className="space-y-3">
                                    {/* Topo do Card */}
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                            {getSafeDateString(item)}
                                        </span>

                                        {/* Badge Principal */}
                                        {activeTab === 'feedbacks' && (
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                                item.type === 'Elogio' ? 'bg-emerald-100 text-emerald-800' : 
                                                item.type === 'Ponto de Melhoria' ? 'bg-amber-100 text-amber-800' : 
                                                'bg-blue-100 text-blue-800'
                                            }`}>
                                                {item.type}
                                            </span>
                                        )}
                                        {activeTab === 'audits' && (
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black border ${
                                                item.status === 'Conforme' 
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                    : 'bg-red-50 text-red-700 border-red-200'
                                            }`}>
                                                {item.status === 'Conforme' ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
                                                {item.status}
                                            </span>
                                        )}
                                        {activeTab === 'metrics' && (
                                            <span className="font-mono font-black text-sm text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                                                {item.pontuacao || 0} pts
                                            </span>
                                        )}
                                        {activeTab === 'monthly' && getClassificationBadge(item.classification)}
                                    </div>

                                    {/* Corpo do Card */}
                                    {activeTab === 'feedbacks' && (
                                        <div className="space-y-2">
                                            <p className="text-xs text-gray-700 line-clamp-3 leading-relaxed">
                                                {item.comment || 'Sem mensagem descritiva.'}
                                            </p>
                                            {item.createdBy && (
                                                <div className="text-[11px] text-gray-400">
                                                    Por: <strong className="text-gray-700">{item.createdBy}</strong>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'audits' && (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-extrabold text-gray-900 leading-snug">
                                                {item.processName || qaProcesses[item.processId]?.name || 'Procedimento de Suporte'}
                                            </h4>
                                            <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                                                <span>Protocolo:</span>
                                                <span className="font-mono font-bold text-gray-800 bg-gray-50 px-2 py-0.5 rounded">
                                                    {item.protocol || 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'metrics' && (
                                        <div className="space-y-2">
                                            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                                                <div className="bg-gray-50 p-2 rounded-lg">
                                                    <span className="text-[10px] text-gray-400 block font-bold uppercase">Ligações</span>
                                                    <span className="font-black text-gray-800 text-sm">{item.Ligacoes_Atendidas || 0}</span>
                                                </div>
                                                <div className="bg-gray-50 p-2 rounded-lg">
                                                    <span className="text-[10px] text-gray-400 block font-bold uppercase">Huggy</span>
                                                    <span className="font-black text-gray-800 text-sm">{item.Atendimentos_Huggy || 0}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'monthly' && (
                                        <div className="space-y-2">
                                            <div className="text-xs text-gray-600">
                                                Mês Referência: <strong className="font-mono font-bold text-gray-900">{formatMonth(item.referenceMonth)}</strong>
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                Avaliador: <strong className="text-gray-700">{item.evaluatorName || 'Gestão'}</strong>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Rodapé do Card com Ação */}
                                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                                    <span className="text-[11px] font-semibold text-gray-400">Clique para abrir</span>
                                    <span className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1">
                                        <Eye className="w-3.5 h-3.5" /> Detalhes
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* MODAIS REFATORADOS DE VISUALIZAÇÃO DETALHADA                               */}
            {/* ========================================================================= */}

            {/* 1. Modal de Análise Detalhada da Auditoria QA (com etapas e critérios) */}
            {viewingItem && activeTab === 'audits' && (
                <AuditDetailModal
                    isOpen={true}
                    onClose={() => setViewingItem(null)}
                    audit={viewingItem}
                    qaProcess={qaProcesses[viewingItem.processId]}
                    onShowToast={showToast}
                />
            )}

            {/* 2. Modal Refatorado de Feedback */}
            {viewingItem && activeTab === 'feedbacks' && (
                <FeedbackDetailModal
                    isOpen={true}
                    onClose={() => setViewingItem(null)}
                    feedback={viewingItem}
                    onMarkAsRead={handleMarkAsRead}
                />
            )}

            {/* 3. Modal Refatorado de Desempenho Semanal */}
            {viewingItem && activeTab === 'metrics' && (
                <WeeklyMetricDetailModal
                    isOpen={true}
                    onClose={() => setViewingItem(null)}
                    metrics={viewingItem}
                />
            )}

            {/* 4. Modal Refatorado de Avaliação Mensal 1:1 */}
            {viewingItem && activeTab === 'monthly' && (
                <MonthlyEvaluationDetailModal
                    isOpen={true}
                    onClose={() => setViewingItem(null)}
                    evaluation={viewingItem}
                />
            )}

        </div>
    );
};

export default MyHistory;

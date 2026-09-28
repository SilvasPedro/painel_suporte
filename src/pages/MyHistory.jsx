import React, { useState, useEffect, useMemo } from 'react';
import {
    History, MessageSquare, TrendingUp, FileText, ShieldCheck,
    Search, Filter, Database, Hourglass, Eye, CalendarDays,
    CheckCircle2, Phone, ThumbsUp, Minus, ThumbsDown, LayoutGrid, 
    Table, Download, RotateCcw, Sparkles, XCircle, Award, 
    Calendar, ArrowUpDown, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
    SlidersHorizontal, Clock, AlertTriangle
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeSharedCollection } from '../services/dataCache';
import { useNotification } from '../context/NotificationContext';
import AuditDetailModal from '../components/history/AuditDetailModal';
import FeedbackDetailModal from '../components/history/FeedbackDetailModal';
import WeeklyMetricDetailModal from '../components/history/WeeklyMetricDetailModal';
import MonthlyEvaluationDetailModal from '../components/history/MonthlyEvaluationDetailModal';

const getItemDateObj = (item) => {
    if (!item) return null;
    if (item.date) {
        if (typeof item.date === 'string') {
            if (/^\d{4}-\d{2}-\d{2}/.test(item.date)) {
                const [y, m, d] = item.date.substring(0, 10).split('-').map(Number);
                return new Date(y, m - 1, d);
            }
            if (/^\d{2}\/\d{2}\/\d{4}/.test(item.date)) {
                const [d, m, y] = item.date.substring(0, 10).split('/').map(Number);
                return new Date(y, m - 1, d);
            }
            const parsed = new Date(item.date);
            if (!isNaN(parsed.getTime())) return parsed;
        } else if (typeof item.date === 'object') {
            if (typeof item.date.toDate === 'function') return item.date.toDate();
            if (item.date instanceof Date) return item.date;
        }
    }
    if (item.createdAt) {
        if (typeof item.createdAt.toDate === 'function') return item.createdAt.toDate();
        if (item.createdAt instanceof Date) return item.createdAt;
        const parsed = new Date(item.createdAt);
        if (!isNaN(parsed.getTime())) return parsed;
    }
    return null;
};

const parseDateObj = (dateStr) => {
    if (!dateStr) return 0;
    if (typeof dateStr === 'object' && dateStr.toMillis) return dateStr.toMillis();
    if (typeof dateStr === 'object' && dateStr.getTime) return dateStr.getTime();
    if (typeof dateStr === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
            const [y, m, d] = dateStr.substring(0, 10).split('-').map(Number);
            return new Date(y, m - 1, d).getTime();
        }
        if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) {
            const [d, m, y] = dateStr.substring(0, 10).split('/').map(Number);
            return new Date(y, m - 1, d).getTime();
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
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1 w-max shadow-2xs">
                    <ThumbsUp className="w-3 h-3 text-emerald-600"/> Positiva
                </span>
            );
        case 'Neutra': 
            return (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1 w-max shadow-2xs">
                    <Minus className="w-3 h-3 text-amber-600"/> Neutra
                </span>
            );
        case 'Negativa': 
            return (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 w-max shadow-2xs">
                    <ThumbsDown className="w-3 h-3 text-rose-600"/> Negativa
                </span>
            );
        default: 
            return (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200 flex items-center gap-1 w-max">
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
    const [showSummary, setShowSummary] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [periodFilter, setPeriodFilter] = useState('all'); // 'all' | 'today' | '7d' | '30d' | 'this_month' | 'last_month'
    const [dateFilter, setDateFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [processFilter, setProcessFilter] = useState('all');
    const [sortBy, setSortBy] = useState('recent'); // 'recent' | 'oldest' | 'score_high' | 'score_low'

    // Paginação
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(15);

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
            setCurrentPage(1);
        }
    };

    const getSafeDateString = item => {
        if (item.date) {
            if (typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.date)) {
                const [y, m, d] = item.date.substring(0, 10).split('-');
                return `${d}/${m}/${y}`;
            }
            return item.date;
        }
        return item.createdAt ? (typeof item.createdAt.toDate === 'function' ? item.createdAt.toDate().toLocaleDateString('pt-BR') : new Date(item.createdAt).toLocaleDateString('pt-BR')) : 'Sem data';
    };

    useEffect(() => {
        const unsubQA = subscribeSharedCollection("qa_processes", items => {
            const map = {};
            items.forEach(d => { map[d.id] = d; });
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

        if (!col) return () => unsubQA();

        const unsub = subscribeSharedCollection(col, items => {
            const res = [];
            items.forEach(dt => {
                if (dt.colabId === currentUserId || dt.collaboratorId === currentUserId) {
                    res.push(dt);
                }
            });

            res.sort((a, b) => {
                const dateA = getItemDateObj(a);
                const dateB = getItemDateObj(b);
                const timeA = dateA ? dateA.getTime() : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
                const timeB = dateB ? dateB.getTime() : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
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
                { label: 'Total Feedbacks', value: total, icon: MessageSquare, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Elogios', value: praises, icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Melhorias', value: improvements, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
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
                { label: 'Avaliações', value: total, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Média Score', value: `${avgScore} pts`, icon: Sparkles, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Maior Score', value: `${maxScore} pts`, icon: Award, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Ligações', value: totalCalls, icon: Phone, color: 'text-indigo-600', bg: 'bg-indigo-50' }
            ];
        }

        if (activeTab === 'monthly') {
            const total = data.length;
            const positives = data.filter(i => i.classification === 'Positiva').length;
            const neutrals = data.filter(i => i.classification === 'Neutra').length;
            const negatives = data.filter(i => i.classification === 'Negativa').length;
            return [
                { label: 'Avaliações 1:1', value: total, icon: CalendarDays, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Positivas', value: positives, icon: ThumbsUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Neutras', value: neutrals, icon: Minus, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Em Desenv.', value: negatives, icon: AlertTriangle, color: 'text-rose-600', bg: 'bg-rose-50' }
            ];
        }

        if (activeTab === 'audits') {
            const total = data.length;
            const conformes = data.filter(i => i.status === 'Conforme').length;
            const naoConformes = data.filter(i => i.status !== 'Conforme').length;
            const taxa = total > 0 ? Math.round((conformes / total) * 100) : 100;
            return [
                { label: 'Auditorias', value: total, icon: ShieldCheck, color: 'text-red-600', bg: 'bg-red-50' },
                { label: 'Aprovadas', value: conformes, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Reprovadas', value: naoConformes, icon: XCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
                { label: 'Conformidade', value: `${taxa}%`, icon: Sparkles, color: taxa >= 80 ? 'text-emerald-600' : 'text-amber-600', bg: taxa >= 80 ? 'bg-emerald-50' : 'bg-amber-50' }
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

        return data.filter(item => {
            const itemDate = getItemDateObj(item);

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
                const dateBr = itemDate ? itemDate.toLocaleDateString('pt-BR') : '';
                const dateIso = typeof item.date === 'string' ? item.date : '';

                if (!matchType && !matchComment && !matchNotes && !matchProtocol && !matchEvaluator && !matchProcess && !matchChannel && !dateBr.includes(term) && !dateIso.includes(term)) {
                    return false;
                }
            }

            // 2. Filtro de Período Rápido
            if (periodFilter !== 'all') {
                if (!itemDate) return false;
                if (periodFilter === 'today') {
                    const isSameDay = 
                        itemDate.getFullYear() === now.getFullYear() &&
                        itemDate.getMonth() === now.getMonth() &&
                        itemDate.getDate() === now.getDate();
                    if (!isSameDay) return false;
                } else if (periodFilter === '7d' && itemDate.getTime() < sevenDaysAgo) {
                    return false;
                } else if (periodFilter === '30d' && itemDate.getTime() < thirtyDaysAgo) {
                    return false;
                } else if (periodFilter === 'this_month' && (itemDate.getFullYear() !== now.getFullYear() || itemDate.getMonth() !== now.getMonth())) {
                    return false;
                } else if (periodFilter === 'last_month') {
                    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    if (itemDate.getFullYear() !== lastMonthDate.getFullYear() || itemDate.getMonth() !== lastMonthDate.getMonth()) {
                        return false;
                    }
                }
            }

            // 3. Filtro de Data Específica / Mês
            if (dateFilter) {
                const q = dateFilter.trim().toLowerCase();
                const safeDate = getSafeDateString(item).toLowerCase();
                const matchMonth = item.referenceMonth && formatMonth(item.referenceMonth).toLowerCase().includes(q);
                const isoDate = itemDate ? `${itemDate.getFullYear()}-${String(itemDate.getMonth() + 1).padStart(2, '0')}-${String(itemDate.getDate()).padStart(2, '0')}` : '';
                const rawDate = typeof item.date === 'string' ? item.date.toLowerCase() : '';

                if (!safeDate.includes(q) && !matchMonth && !isoDate.includes(q) && !rawDate.includes(q)) {
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

            // 5. Filtro por Processo QA
            if (activeTab === 'audits' && processFilter !== 'all') {
                if (item.processId !== processFilter) return false;
            }

            return true;
        }).sort((a, b) => {
            const dateA = getItemDateObj(a);
            const dateB = getItemDateObj(b);
            const timeA = dateA ? dateA.getTime() : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
            const timeB = dateB ? dateB.getTime() : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);

            if (sortBy === 'recent') return timeB - timeA;
            if (sortBy === 'oldest') return timeA - timeB;
            if (sortBy === 'score_high') {
                const sA = a.score || a.pontuacao || (a.status === 'Conforme' ? 100 : 0);
                const sB = b.score || b.pontuacao || (b.status === 'Conforme' ? 100 : 0);
                return sB - sA;
            }
            if (sortBy === 'score_low') {
                const sA = a.score || a.pontuacao || (a.status === 'Conforme' ? 100 : 0);
                const sB = b.score || b.pontuacao || (b.status === 'Conforme' ? 100 : 0);
                return sA - sB;
            }
            return 0;
        });
    }, [data, searchTerm, periodFilter, dateFilter, statusFilter, processFilter, sortBy, activeTab, qaProcesses]);

    // Paginação
    const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredData.slice(start, start + itemsPerPage);
    }, [filteredData, currentPage, itemsPerPage]);

    const hasActiveFilters = searchTerm !== '' || periodFilter !== 'all' || dateFilter !== '' || statusFilter !== 'all' || processFilter !== 'all' || sortBy !== 'recent';

    const handleResetFilters = () => {
        setSearchTerm('');
        setPeriodFilter('all');
        setDateFilter('');
        setStatusFilter('all');
        setProcessFilter('all');
        setSortBy('recent');
        setCurrentPage(1);
    };

    // EXPORTAR RELATÓRIO CSV
    const handleExportCsv = () => {
        if (filteredData.length === 0) {
            showToast("Nenhum registro para exportar com os filtros atuais.", "error");
            return;
        }

        let headers = [];
        let rows = [];

        if (activeTab === 'feedbacks') {
            headers = ['Data', 'Tipo', 'Remetente', 'Mensagem', 'Lido'];
            rows = filteredData.map(i => [
                getSafeDateString(i),
                i.type || '',
                i.createdBy || '',
                `"${(i.comment || '').replace(/"/g, '""')}"`,
                i.read ? 'Sim' : 'Não'
            ]);
        } else if (activeTab === 'audits') {
            headers = ['Data', 'Protocolo', 'Processo QA', 'Status', 'Score', 'Avaliador', 'Observações'];
            rows = filteredData.map(i => [
                getSafeDateString(i),
                `"${i.protocol || ''}"`,
                `"${(i.processName || qaProcesses[i.processId]?.name || '').replace(/"/g, '""')}"`,
                i.status || '',
                i.score !== undefined ? `${i.score}%` : (i.status === 'Conforme' ? '100%' : '0%'),
                i.evaluatorName || '',
                `"${(i.notes || '').replace(/"/g, '""')}"`
            ]);
        } else if (activeTab === 'metrics') {
            headers = ['Semana / Data', 'Pontuação', 'Atendimentos Finalizados', 'Ligações Atendidas', 'Atendimentos Huggy', 'Ligações Perdidas', 'TMA'];
            rows = filteredData.map(i => [
                getSafeDateString(i),
                i.pontuacao || 0,
                i.Atendimentos_Finalizados || 0,
                i.Ligacoes_Atendidas || 0,
                i.Atendimentos_Huggy || 0,
                i.Ligacoes_Perdidas || 0,
                i.TMA_Telefonia || '--'
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
        <div className="flex-1 p-2 sm:p-4 h-full flex flex-col bg-gray-50 font-sans overflow-hidden">
            
            {/* CABEÇALHO COMPACTO DA PÁGINA (OTIMIZADO NO EIXO VERTICAL) */}
            <header className="mb-2 bg-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-gray-200/90 shadow-2xs shrink-0 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 border border-red-200 flex items-center justify-center shrink-0 shadow-2xs">
                        <History className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm sm:text-base font-black text-gray-900 tracking-tight">
                                Meu Histórico & Performance
                            </h1>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                {filteredData.length} {filteredData.length === 1 ? 'registro' : 'registros'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Botões de Ação do Topo (Resumo, Visualização e Exportação) */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {/* Botão de Toggle do Resumo Estatístico */}
                    <button
                        type="button"
                        onClick={() => setShowSummary(prev => !prev)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200/80"
                        title={showSummary ? "Ocultar resumo estatístico para ampliar visão vertical" : "Exibir resumo estatístico"}
                    >
                        {showSummary ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
                        <span className="hidden sm:inline">{showSummary ? 'Ocultar Resumo' : 'Ver Resumo'}</span>
                    </button>

                    {/* Alternância de Modo: Tabela vs Cards */}
                    <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                viewMode === 'table'
                                    ? 'bg-white text-gray-900 shadow-2xs'
                                    : 'text-gray-500 hover:text-gray-800'
                            }`}
                            title="Modo Tabela (maior densidade)"
                        >
                            <Table className="w-3 h-3" />
                            <span className="hidden sm:inline">Tabela</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('cards')}
                            className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                viewMode === 'cards'
                                    ? 'bg-white text-gray-900 shadow-2xs'
                                    : 'text-gray-500 hover:text-gray-800'
                            }`}
                            title="Modo Cards"
                        >
                            <LayoutGrid className="w-3 h-3" />
                            <span className="hidden sm:inline">Cards</span>
                        </button>
                    </div>

                    {/* Botão Exportar CSV */}
                    <button
                        type="button"
                        onClick={handleExportCsv}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-2xs"
                        title="Exportar registros filtrados para CSV"
                    >
                        <Download className="w-3.5 h-3.5 text-gray-500" />
                        <span className="hidden md:inline">CSV</span>
                    </button>
                </div>
            </header>

            {/* FAIXA RESUMO ESTATÍSTICO COMPACTO (COLAPSÁVEL) */}
            {showSummary && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-2 shrink-0 animate-in fade-in duration-150">
                    {summaryStats.map((stat, idx) => {
                        const IconComponent = stat.icon;
                        return (
                            <div key={idx} className="bg-white rounded-xl px-3 py-1.5 sm:py-2 border border-gray-200/90 shadow-2xs flex items-center justify-between gap-2 min-w-0">
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block truncate">
                                        {stat.label}
                                    </span>
                                    <span className="text-sm sm:text-base font-black text-gray-900 mt-0.5 block truncate leading-none">
                                        {stat.value}
                                    </span>
                                </div>
                                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${stat.bg} ${stat.color} flex items-center justify-center shrink-0 border border-gray-100 shadow-2xs`}>
                                    <IconComponent className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* SELEÇÃO DE ABAS & TOOLBAR INTEGRADA E COMPACTA */}
            <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-gray-200 shadow-2xs mb-2 shrink-0 space-y-2">
                
                {/* Linha 1: Abas de Navegação Compactas */}
                <div className="flex items-center space-x-1.5 border-b border-gray-100 pb-2 overflow-x-auto scrollbar-none">
                    <button 
                        onClick={() => handleTabChange('feedbacks')} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'feedbacks' 
                                ? 'bg-zinc-950 text-white shadow-2xs' 
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <MessageSquare className="w-3.5 h-3.5 text-red-500" />
                        <span>Feedbacks</span>
                    </button>
                    <button 
                        onClick={() => handleTabChange('audits')} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'audits' 
                                ? 'bg-zinc-950 text-white shadow-2xs' 
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Auditorias QA</span>
                    </button>
                    <button 
                        onClick={() => handleTabChange('metrics')} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'metrics' 
                                ? 'bg-zinc-950 text-white shadow-2xs' 
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                        <span>Avaliações Semanais</span>
                    </button>
                    <button 
                        onClick={() => handleTabChange('monthly')} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'monthly' 
                                ? 'bg-zinc-950 text-white shadow-2xs' 
                                : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                        <FileText className="w-3.5 h-3.5 text-blue-500" />
                        <span>Análise Mensal (1:1)</span>
                    </button>
                </div>

                {/* Linha 2: Filtros Compactos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2 items-center text-xs">
                    
                    {/* Campo de Busca */}
                    <div className="md:col-span-4 relative">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input 
                            type="text" 
                            placeholder={activeTab === 'audits' ? "Buscar protocolo, processo, auditor..." : "Buscar nos registros..."}
                            value={searchTerm} 
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                            className="w-full pl-8 pr-6 py-1.5 border border-gray-200 rounded-lg outline-none text-xs focus:ring-1 focus:ring-red-500 focus:border-red-500 bg-gray-50/60 focus:bg-white transition-all font-medium" 
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filtro Rápido de Período (Incluindo Hoje / Mesmo Dia) */}
                    <div className="md:col-span-2 relative">
                        <select
                            value={periodFilter}
                            onChange={(e) => { setPeriodFilter(e.target.value); setCurrentPage(1); }}
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none text-xs bg-gray-50/60 hover:bg-white cursor-pointer text-gray-700 font-semibold"
                        >
                            <option value="all">Todo o Período</option>
                            <option value="today">Hoje (Mesmo dia)</option>
                            <option value="7d">Últimos 7 dias</option>
                            <option value="30d">Últimos 30 dias</option>
                            <option value="this_month">Este Mês</option>
                            <option value="last_month">Mês Anterior</option>
                        </select>
                    </div>

                    {/* Filtro de Data / Mês Específico */}
                    <div className="md:col-span-2 relative">
                        <select
                            value={dateFilter}
                            onChange={(e) => { setDateFilter(e.target.value); setCurrentPage(1); }}
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none text-xs bg-gray-50/60 hover:bg-white cursor-pointer text-gray-700 font-semibold"
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
                    <div className="md:col-span-2 relative">
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none text-xs bg-gray-50/60 hover:bg-white cursor-pointer text-gray-700 font-semibold"
                        >
                            <option value="all">
                                {activeTab === 'feedbacks' ? 'Todos os Tipos' : 
                                 activeTab === 'audits' ? 'Todos os Status' : 
                                 activeTab === 'monthly' ? 'Todas Classificações' : 
                                 'Todas as Notas'}
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

                    {/* Filtro por Processo QA ou Ordenação */}
                    <div className="md:col-span-2 relative flex items-center gap-1.5">
                        {activeTab === 'audits' && availableProcesses.length > 0 ? (
                            <select
                                value={processFilter}
                                onChange={(e) => { setProcessFilter(e.target.value); setCurrentPage(1); }}
                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none text-xs bg-gray-50/60 hover:bg-white cursor-pointer text-gray-700 font-semibold truncate"
                            >
                                <option value="all">Todos os Processos</option>
                                {availableProcesses.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        ) : (
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg focus:ring-1 focus:ring-red-500 focus:border-red-500 outline-none text-xs bg-gray-50/60 hover:bg-white cursor-pointer text-gray-700 font-semibold"
                            >
                                <option value="recent">Mais Recentes</option>
                                <option value="oldest">Mais Antigos</option>
                                <option value="score_high">Maior Score</option>
                                <option value="score_low">Menor Score</option>
                            </select>
                        )}

                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 cursor-pointer shrink-0 transition-colors"
                                title="Limpar todos os filtros"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* CONTAINER DE CONTEÚDO PRINCIPAL (MAXIMIZADO NO EIXO VERTICAL) */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-2xs flex-1 flex flex-col min-h-0 overflow-hidden">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <Hourglass className="w-7 h-7 text-red-600 animate-spin mb-2.5" />
                        <span className="text-xs text-gray-400 font-medium">Carregando seus registros...</span>
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                        <Database className="w-10 h-10 mb-2 opacity-30 text-gray-400" />
                        <p className="text-sm font-bold text-gray-700">Nenhum registro encontrado.</p>
                        <p className="text-xs text-gray-400 mt-0.5 max-w-sm">
                            {hasActiveFilters 
                                ? 'Tente ajustar ou limpar os filtros aplicados para ver mais resultados.' 
                                : 'Seus lançamentos futuros aparecerão aqui automaticamente.'}
                        </p>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="mt-3 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                            >
                                Redefinir Filtros
                            </button>
                        )}
                    </div>
                ) : viewMode === 'table' ? (
                    /* VISUALIZAÇÃO EM TABELA DE ALTA DENSIDADE VERTICAL */
                    <div className="flex-1 overflow-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-xs whitespace-nowrap">
                            <thead className="bg-zinc-950 text-white sticky top-0 z-10 shadow-xs">
                                <tr>
                                    <th className="px-3.5 py-2.5 text-left font-bold text-[11px] uppercase tracking-wider">Data</th>
                                    <th className="px-3.5 py-2.5 text-left font-bold text-[11px] uppercase tracking-wider">
                                        {activeTab === 'feedbacks' ? 'Tipo & Mensagem' :
                                         activeTab === 'audits' ? 'Auditoria QA (Status & Processo)' :
                                         activeTab === 'metrics' ? 'Score & Volumes de Atendimento' :
                                         'Classificação & Mês de Referência'}
                                    </th>
                                    <th className="px-3.5 py-2.5 text-center font-bold text-[11px] uppercase tracking-wider">
                                        {activeTab === 'audits' ? 'Protocolo' : 'Detalhe Adicional'}
                                    </th>
                                    <th className="px-3.5 py-2.5 text-right font-bold text-[11px] uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {paginatedData.map(item => (
                                    <tr 
                                        key={item.id} 
                                        onClick={() => handleViewItem(item)}
                                        className={`hover:bg-gray-50/80 transition-colors cursor-pointer ${
                                            activeTab === 'feedbacks' && !item.read ? 'bg-fuchsia-50/30' : ''
                                        }`}
                                    >
                                        <td className="px-3.5 py-2 text-gray-600 font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                <span className="font-semibold">{getSafeDateString(item)}</span>
                                            </div>
                                        </td>
                                        
                                        <td className="px-3.5 py-2">
                                            {/* ABA: FEEDBACKS */}
                                            {activeTab === 'feedbacks' && (
                                                <div className="flex items-center gap-2 max-w-lg">
                                                    {!item.read && (
                                                        <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse shrink-0" title="Não lido"></span>
                                                    )}
                                                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold shrink-0 border ${
                                                        item.type === 'Elogio' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 
                                                        item.type === 'Ponto de Melhoria' ? 'bg-amber-50 text-amber-800 border-amber-200' : 
                                                        'bg-blue-50 text-blue-800 border-blue-200'
                                                    }`}>
                                                        {item.type}
                                                    </span>
                                                    <span className="text-xs text-gray-700 truncate font-medium">
                                                        {item.comment || 'Sem mensagem descritiva.'}
                                                    </span>
                                                </div>
                                            )}

                                            {/* ABA: AUDITORIAS QA */}
                                            {activeTab === 'audits' && (
                                                <div className="flex items-center gap-2.5 max-w-lg">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border shrink-0 ${
                                                        item.status === 'Conforme' 
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                            : 'bg-red-50 text-red-700 border-red-200'
                                                    }`}>
                                                        {item.status === 'Conforme' ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
                                                        <span>{item.status}</span>
                                                    </span>
                                                    <span className="text-xs font-bold text-gray-900 truncate">
                                                        {item.processName || qaProcesses[item.processId]?.name || 'Procedimento Padrão'}
                                                    </span>
                                                    {item.score !== undefined && (
                                                        <span className="text-[11px] font-mono font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                                                            {item.score}%
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* ABA: MÉTRICAS SEMANAIS */}
                                            {activeTab === 'metrics' && (
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-xs text-gray-700">
                                                        Pontuação: <strong className="text-gray-900 font-mono font-black text-xs">{item.pontuacao || 0} pts</strong>
                                                    </span>
                                                    <span className="text-xs text-gray-400">
                                                        &bull; Ligações: <strong className="text-gray-700">{item.Ligacoes_Atendidas || 0}</strong> | Huggy: <strong className="text-gray-700">{item.Atendimentos_Huggy || 0}</strong>
                                                    </span>
                                                </div>
                                            )}

                                            {/* ABA: ANÁLISE MENSAL */}
                                            {activeTab === 'monthly' && (
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-xs text-gray-700">
                                                        Mês: <strong className="text-gray-900 font-mono font-bold">{formatMonth(item.referenceMonth)}</strong>
                                                    </span>
                                                    {getClassificationBadge(item.classification)}
                                                </div>
                                            )}
                                        </td>

                                        {/* COLUNA: DETALHE ADICIONAL */}
                                        <td className="px-3.5 py-2 text-center">
                                            {activeTab === 'audits' && (
                                                <span className="font-mono font-bold text-[11px] text-gray-700 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                                                    {item.protocol || '--'}
                                                </span>
                                            )}
                                            {activeTab === 'feedbacks' && (
                                                <span className="text-[11px] text-gray-500 font-medium">
                                                    {item.createdBy || 'Gestão'}
                                                </span>
                                            )}
                                            {activeTab === 'metrics' && (
                                                <span className="text-[11px] text-gray-500 font-medium">
                                                    TMA: <strong className="text-gray-700 font-mono">{item.TMA_Telefonia || '--'}</strong>
                                                </span>
                                            )}
                                            {activeTab === 'monthly' && (
                                                <span className="text-[11px] text-gray-500 font-medium">
                                                    {item.evaluatorName || 'Gestão'}
                                                </span>
                                            )}
                                        </td>

                                        {/* COLUNA: AÇÕES */}
                                        <td className="px-3.5 py-2 text-right">
                                            <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                                                {activeTab === 'feedbacks' && !item.read && (
                                                    <button 
                                                        onClick={() => handleMarkAsRead(item.id)} 
                                                        className="text-[10px] font-bold text-fuchsia-600 hover:text-fuchsia-700 uppercase transition-colors cursor-pointer mr-1"
                                                    >
                                                        Marcar Lido
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleViewItem(item)} 
                                                    className="px-2.5 py-1 bg-gray-50 hover:bg-red-50 text-gray-700 hover:text-red-600 rounded-lg flex items-center gap-1 transition-colors border border-gray-200 cursor-pointer font-bold text-xs shadow-2xs"
                                                >
                                                    <Eye className="w-3 h-3 text-red-600" />
                                                    <span>Detalhes</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    /* VISUALIZAÇÃO EM GRADE DE CARDS COMPACTOS */
                    <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto flex-1">
                        {paginatedData.map(item => (
                            <div 
                                key={item.id}
                                onClick={() => handleViewItem(item)}
                                className={`bg-white rounded-xl p-3 border transition-all hover:shadow-xs cursor-pointer flex flex-col justify-between ${
                                    activeTab === 'feedbacks' && !item.read 
                                        ? 'border-fuchsia-300 bg-fuchsia-50/20' 
                                        : 'border-gray-200 hover:border-red-300'
                                }`}
                            >
                                <div className="space-y-2">
                                    {/* Topo do Card */}
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-[11px] text-gray-500 font-semibold flex items-center gap-1">
                                            <Calendar className="w-3 h-3 text-gray-400" />
                                            {getSafeDateString(item)}
                                        </span>

                                        {/* Badge Principal */}
                                        {activeTab === 'feedbacks' && (
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                                item.type === 'Elogio' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 
                                                item.type === 'Ponto de Melhoria' ? 'bg-amber-50 text-amber-800 border-amber-200' : 
                                                'bg-blue-50 text-blue-800 border-blue-200'
                                            }`}>
                                                {item.type}
                                            </span>
                                        )}
                                        {activeTab === 'audits' && (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                                item.status === 'Conforme' 
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                    : 'bg-red-50 text-red-700 border-red-200'
                                            }`}>
                                                {item.status === 'Conforme' ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
                                                {item.status}
                                            </span>
                                        )}
                                        {activeTab === 'metrics' && (
                                            <span className="font-mono font-black text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                                {item.pontuacao || 0} pts
                                            </span>
                                        )}
                                        {activeTab === 'monthly' && getClassificationBadge(item.classification)}
                                    </div>

                                    {/* Corpo do Card */}
                                    {activeTab === 'feedbacks' && (
                                        <div className="space-y-1">
                                            <p className="text-xs text-gray-700 line-clamp-2 leading-snug">
                                                {item.comment || 'Sem mensagem descritiva.'}
                                            </p>
                                            {item.createdBy && (
                                                <div className="text-[10px] text-gray-400">
                                                    Por: <strong className="text-gray-700">{item.createdBy}</strong>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'audits' && (
                                        <div className="space-y-1">
                                            <h4 className="text-xs font-bold text-gray-900 leading-snug truncate">
                                                {item.processName || qaProcesses[item.processId]?.name || 'Procedimento de Suporte'}
                                            </h4>
                                            <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                                                <span>Protocolo:</span>
                                                <span className="font-mono font-bold text-gray-800 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200/60">
                                                    {item.protocol || 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'metrics' && (
                                        <div className="grid grid-cols-2 gap-1.5 text-xs pt-0.5">
                                            <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                                                <span className="text-[9px] text-gray-400 block font-bold uppercase">Ligações</span>
                                                <span className="font-black text-gray-800 text-xs">{item.Ligacoes_Atendidas || 0}</span>
                                            </div>
                                            <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                                                <span className="text-[9px] text-gray-400 block font-bold uppercase">Huggy</span>
                                                <span className="font-black text-gray-800 text-xs">{item.Atendimentos_Huggy || 0}</span>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'monthly' && (
                                        <div className="space-y-0.5 text-xs">
                                            <div className="text-gray-600">
                                                Mês: <strong className="font-mono font-bold text-gray-900">{formatMonth(item.referenceMonth)}</strong>
                                            </div>
                                            <div className="text-gray-500 text-[11px]">
                                                Avaliador: <strong className="text-gray-700">{item.evaluatorName || 'Gestão'}</strong>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Rodapé do Card com Ação */}
                                <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                                    <span className="text-[10px] text-gray-400 font-medium">Ver completo</span>
                                    <span className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1">
                                        <Eye className="w-3 h-3" /> Detalhes
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* BARRA DE PAGINAÇÃO COMPACTA */}
                {filteredData.length > 0 && (
                    <footer className="px-3 py-1.5 sm:py-2 bg-gray-50 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 shrink-0">
                        <div className="flex items-center gap-2">
                            <span>
                                Exibindo <strong className="text-gray-900 font-bold">{Math.min(filteredData.length, (currentPage - 1) * itemsPerPage + 1)}</strong>-
                                <strong className="text-gray-900 font-bold">{Math.min(filteredData.length, currentPage * itemsPerPage)}</strong> de <strong className="text-gray-900 font-bold">{filteredData.length}</strong>
                            </span>
                            <div className="flex items-center gap-1 ml-2 text-[11px]">
                                <span className="text-gray-400 hidden sm:inline">Por pág:</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="bg-white border border-gray-200 rounded px-1.5 py-0.5 font-semibold text-gray-700 outline-none cursor-pointer"
                                >
                                    <option value={10}>10</option>
                                    <option value={15}>15</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                </select>
                            </div>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="p-1 rounded-md bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                    title="Página anterior"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <span className="px-2 font-bold text-gray-700 text-[11px]">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-1 rounded-md bg-white border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                    title="Próxima página"
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </footer>
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

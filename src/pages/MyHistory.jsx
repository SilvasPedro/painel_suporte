import React, { useState, useEffect, useMemo } from 'react';
import {
    History, MessageSquare, TrendingUp, FileText, ShieldCheck,
    Search, Filter, Database, Hourglass, Eye, CalendarDays,
    CheckCircle2, Phone, ThumbsUp, Minus, ThumbsDown, LayoutGrid, 
    Table, Download, RotateCcw, Sparkles, XCircle, Award, 
    Calendar, ArrowUpDown, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
    SlidersHorizontal, Clock, AlertTriangle, Hash, CheckCheck, Tag, Archive
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeSharedCollection } from '../services/dataCache';
import { useNotification } from '../context/NotificationContext';
import AuditDetailModal from '../components/history/AuditDetailModal';
import FeedbackDetailModal from '../components/history/FeedbackDetailModal';
import WeeklyMetricDetailModal from '../components/history/WeeklyMetricDetailModal';
import MonthlyEvaluationDetailModal from '../components/history/MonthlyEvaluationDetailModal';
import { resolveUserName } from '../utils/userResolvers';
import { calculatePerformanceScore } from '../utils/scoringCalculations';
import { useAuth } from '../context/AuthContext';
import { isLegacy4PillarsFeedback, buildMarkAsReadPayload } from '../types/feedback.types';

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
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-max shadow-2xs">
                    <ThumbsUp className="w-3 h-3 text-emerald-500"/> Positiva
                </span>
            );
        case 'Neutra': 
            return (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1 w-max shadow-2xs">
                    <Minus className="w-3 h-3 text-amber-500"/> Neutra
                </span>
            );
        case 'Negativa': 
            return (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1 w-max shadow-2xs">
                    <ThumbsDown className="w-3 h-3 text-rose-500"/> Negativa
                </span>
            );
        default: 
            return (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-subtle text-muted-hub border border-subtle flex items-center gap-1 w-max">
                    <Minus className="w-3 h-3 opacity-70"/> {classification || 'N/A'}
                </span>
            );
    }
};

const MyHistory = ({ currentUserId }) => {
    const { showToast } = useNotification();
    const { currentUser } = useAuth();
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

    // Abre feedback automaticamente se acionado por notificação push ou clique de alerta
    useEffect(() => {
        const handleOpenFeedback = (e) => {
            if (e.detail?.feedback) {
                setActiveTab('feedbacks');
                setViewingItem(e.detail.feedback);
            }
        };
        window.addEventListener('HUBDESK_OPEN_FEEDBACK', handleOpenFeedback);
        return () => window.removeEventListener('HUBDESK_OPEN_FEEDBACK', handleOpenFeedback);
    }, []);

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

    const handleMarkAsRead = async (id, customPayload = null) => {
        try {
            const isMonthly = activeTab === 'monthly';
            const col = isMonthly ? 'monthly_evaluations' : 'feedbacks';
            const payload = customPayload || buildMarkAsReadPayload(currentUser);
            await updateDoc(doc(db, col, id), payload);
            if (!isMonthly) {
                window.dispatchEvent(new CustomEvent('HUBDESK_FEEDBACK_READ', { detail: { id } }));
            }
            showToast("Ciência confirmada com sucesso!", "success");
            setData(prev => prev.map(item => item.id === id ? { ...item, ...payload } : item));
            if (viewingItem && viewingItem.id === id) {
                setViewingItem(prev => ({ ...prev, ...payload }));
            }
        } catch (err) {
            showToast("Erro ao atualizar status: " + err.message, "error");
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
            const name = item.processName || qaProcesses[item.processId]?.name || 'Procedimento Padrão';
            const id = item.processId || name;
            procMap.set(id, name);
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
                { label: 'Total Feedbacks', value: total, icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                { label: 'Elogios', value: praises, icon: Award, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: 'Melhorias', value: improvements, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                { label: 'Não Lidos', value: unread, icon: Clock, color: 'text-rose-500', bg: 'bg-rose-500/10' }
            ];
        }

        if (activeTab === 'metrics') {
            const total = data.length;
            let totalScore = 0;
            let maxScore = 0;
            let totalCalls = 0;
            data.forEach(i => {
                const score = Number(i.pontuacao !== undefined ? i.pontuacao : calculatePerformanceScore(i));
                totalScore += score;
                if (score > maxScore) maxScore = score;
                totalCalls += Number(i.Ligacoes_Atendidas || 0);
            });
            const avgScore = total > 0 ? Math.round(totalScore / total) : 0;
            return [
                { label: 'Avaliações', value: total, icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                { label: 'Média Score', value: `${avgScore} pts`, icon: Sparkles, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: 'Maior Score', value: `${maxScore} pts`, icon: Award, color: 'text-blue-500', bg: 'bg-blue-500/10' },
                { label: 'Ligações', value: totalCalls, icon: Phone, color: 'text-rose-500', bg: 'bg-rose-500/10' }
            ];
        }

        if (activeTab === 'monthly') {
            const total = data.length;
            const positives = data.filter(i => i.classification === 'Positiva').length;
            const neutrals = data.filter(i => i.classification === 'Neutra').length;
            const negatives = data.filter(i => i.classification === 'Negativa').length;
            return [
                { label: 'Avaliações 1:1', value: total, icon: CalendarDays, color: 'text-rose-500', bg: 'bg-rose-500/10' },
                { label: 'Positivas', value: positives, icon: ThumbsUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: 'Neutras', value: neutrals, icon: Minus, color: 'text-amber-500', bg: 'bg-amber-500/10' },
                { label: 'Em Desenv.', value: negatives, icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500/10' }
            ];
        }

        if (activeTab === 'audits') {
            const total = data.length;
            const conformes = data.filter(i => i.status === 'Conforme').length;
            const naoConformes = data.filter(i => i.status !== 'Conforme').length;
            const taxa = total > 0 ? Math.round((conformes / total) * 100) : 100;
            return [
                { label: 'Auditorias', value: total, icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-500/10' },
                { label: 'Aprovadas', value: conformes, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                { label: 'Reprovadas', value: naoConformes, icon: XCircle, color: 'text-rose-500', bg: 'bg-rose-500/10' },
                { label: 'Conformidade', value: `${taxa}%`, icon: Sparkles, color: taxa >= 80 ? 'text-emerald-500' : 'text-amber-500', bg: taxa >= 80 ? 'bg-emerald-500/10' : 'bg-amber-500/10' }
            ];
        }

        return [];
    }, [data, activeTab]);

    // FILTRAGEM E ORDENAÇÃO AVANÇADA
    const filteredData = useMemo(() => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOf7d = startOfToday - (7 * 24 * 60 * 60 * 1000);
        const startOf30d = startOfToday - (30 * 24 * 60 * 60 * 1000);
        const currentMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

        return data.filter(item => {
            // 1. Busca textual
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const comment = (item.comment || '').toLowerCase();
                const protocol = (item.protocol || '').toLowerCase();
                const processName = (item.processName || qaProcesses[item.processId]?.name || '').toLowerCase();
                const evaluator = (item.evaluatorName || item.createdBy || '').toLowerCase();
                const generalComments = (item.generalComments || '').toLowerCase();
                const title = (item.title || '').toLowerCase();

                const match = comment.includes(term) ||
                              protocol.includes(term) ||
                              processName.includes(term) ||
                              evaluator.includes(term) ||
                              generalComments.includes(term) ||
                              title.includes(term);

                if (!match) return false;
            }

            // 2. Filtro de Período Rápido
            if (periodFilter !== 'all') {
                const dateObj = getItemDateObj(item);
                const itemTime = dateObj ? dateObj.getTime() : (item.createdAt?.toMillis ? item.createdAt.toMillis() : 0);

                if (periodFilter === 'today') {
                    if (itemTime < startOfToday) return false;
                } else if (periodFilter === '7d') {
                    if (itemTime < startOf7d) return false;
                } else if (periodFilter === '30d') {
                    if (itemTime < startOf30d) return false;
                } else if (periodFilter === 'this_month') {
                    if (item.referenceMonth) {
                        if (item.referenceMonth !== currentMonthPrefix) return false;
                    } else if (dateObj) {
                        const mStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                        if (mStr !== currentMonthPrefix) return false;
                    }
                } else if (periodFilter === 'last_month') {
                    if (item.referenceMonth) {
                        if (item.referenceMonth !== lastMonthPrefix) return false;
                    } else if (dateObj) {
                        const mStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
                        if (mStr !== lastMonthPrefix) return false;
                    }
                }
            }

            // 3. Filtro de Mês / Data Específica
            if (dateFilter) {
                const safeDate = getSafeDateString(item);
                const refMonthFormatted = item.referenceMonth ? formatMonth(item.referenceMonth) : '';
                if (dateFilter.includes('/')) {
                    if (dateFilter.length === 5) {
                        // MM/YYYY
                        if (refMonthFormatted !== dateFilter && !safeDate.endsWith(dateFilter)) return false;
                    } else {
                        // DD/MM/YYYY
                        if (safeDate !== dateFilter) return false;
                    }
                } else if (safeDate !== dateFilter) {
                    return false;
                }
            }

            // 4. Filtro por Status
            if (statusFilter !== 'all') {
                if (activeTab === 'feedbacks') {
                    if (statusFilter === 'unread' && item.read) return false;
                    if (statusFilter === 'read' && !item.read) return false;
                    if (statusFilter === 'elogio' && item.type !== 'Elogio') return false;
                    if (statusFilter === 'melhoria' && item.type !== 'Ponto de Melhoria') return false;
                    if (statusFilter === 'orientacao' && item.type !== 'Orientação') return false;
                } else if (activeTab === 'audits') {
                    if (statusFilter === 'conforme' && item.status !== 'Conforme') return false;
                    if (statusFilter === 'nao_conforme' && item.status === 'Conforme') return false;
                } else if (activeTab === 'monthly') {
                    if (item.classification !== statusFilter) return false;
                }
            }

            // 5. Filtro por Processo QA
            if (processFilter !== 'all' && activeTab === 'audits') {
                const itemProcId = item.processId || item.processName;
                if (itemProcId !== processFilter) return false;
            }

            return true;
        }).sort((a, b) => {
            if (sortBy === 'oldest') {
                const dateA = getItemDateObj(a);
                const dateB = getItemDateObj(b);
                const timeA = dateA ? dateA.getTime() : 0;
                const timeB = dateB ? dateB.getTime() : 0;
                return timeA - timeB;
            }
            if (sortBy === 'score_high') {
                const sA = a.score !== undefined ? Number(a.score) : (a.pontuacao || 0);
                const sB = b.score !== undefined ? Number(b.score) : (b.pontuacao || 0);
                return sB - sA;
            }
            if (sortBy === 'score_low') {
                const sA = a.score !== undefined ? Number(a.score) : (a.pontuacao || 0);
                const sB = b.score !== undefined ? Number(b.score) : (b.pontuacao || 0);
                return sA - sB;
            }
            // Padrão: mais recentes primeiro
            const dateA = getItemDateObj(a);
            const dateB = getItemDateObj(b);
            const timeA = dateA ? dateA.getTime() : (a.createdAt?.toMillis ? a.createdAt.toMillis() : 0);
            const timeB = dateB ? dateB.getTime() : (b.createdAt?.toMillis ? b.createdAt.toMillis() : 0);
            return timeB - timeA;
        });
    }, [data, searchTerm, periodFilter, dateFilter, statusFilter, processFilter, sortBy, activeTab, qaProcesses]);

    // Paginação
    const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
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
        <div className="flex-1 p-4 sm:p-6 lg:p-8 h-full flex flex-col bg-canvas text-primary-hub font-sans overflow-hidden space-y-4">
            
            {/* CABEÇALHO DA PÁGINA (OTIMIZADO NO EIXO VERTICAL) */}
            <header className="bg-surface px-4 sm:px-5 py-3 rounded-2xl sm:rounded-3xl border border-subtle shadow-xs shrink-0 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center shrink-0 shadow-2xs">
                        <History className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-base sm:text-lg font-black tracking-tight text-primary-hub">
                                Meu Histórico & Performance
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-subtle text-secondary-hub border border-subtle">
                                {filteredData.length} {filteredData.length === 1 ? 'registro' : 'registros'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Botões de Ação do Topo */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {/* Botão de Toggle do Resumo Estatístico */}
                    <button
                        type="button"
                        onClick={() => setShowSummary(prev => !prev)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-subtle hover:bg-surface text-secondary-hub border border-subtle"
                        title={showSummary ? "Ocultar resumo estatístico" : "Exibir resumo estatístico"}
                    >
                        {showSummary ? <ChevronUp className="w-3.5 h-3.5 text-muted-hub" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-hub" />}
                        <span className="hidden sm:inline">{showSummary ? 'Ocultar Resumo' : 'Ver Resumo'}</span>
                    </button>

                    {/* Alternância de Modo: Tabela vs Cards */}
                    <div className="flex items-center bg-subtle p-0.5 rounded-xl border border-subtle shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                viewMode === 'table'
                                    ? 'bg-surface text-primary-hub shadow-xs'
                                    : 'text-muted-hub hover:text-primary-hub'
                            }`}
                            title="Modo Tabela"
                        >
                            <Table className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Tabela</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('cards')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                viewMode === 'cards'
                                    ? 'bg-surface text-primary-hub shadow-xs'
                                    : 'text-muted-hub hover:text-primary-hub'
                            }`}
                            title="Modo Cards"
                        >
                            <LayoutGrid className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Cards</span>
                        </button>
                    </div>

                    {/* Botão Exportar CSV */}
                    <button
                        type="button"
                        onClick={handleExportCsv}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-surface hover:bg-subtle text-secondary-hub border border-subtle shadow-2xs"
                        title="Exportar registros filtrados para CSV"
                    >
                        <Download className="w-3.5 h-3.5 text-muted-hub" />
                        <span className="hidden md:inline">CSV</span>
                    </button>
                </div>
            </header>

            {/* FAIXA RESUMO ESTATÍSTICO COMPACTO (COLAPSÁVEL) */}
            {showSummary && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0 animate-in fade-in duration-150">
                    {summaryStats.map((stat, idx) => {
                        const IconComponent = stat.icon;
                        return (
                            <div key={idx} className="bg-surface rounded-2xl px-4 py-3 border border-subtle shadow-xs flex items-center justify-between gap-3 min-w-0">
                                <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block truncate">
                                        {stat.label}
                                    </span>
                                    <span className="text-base sm:text-lg font-black text-primary-hub mt-0.5 block truncate leading-none">
                                        {stat.value}
                                    </span>
                                </div>
                                <div className={`w-9 h-9 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center shrink-0 border border-subtle shadow-2xs`}>
                                    <IconComponent className="w-4 h-4" />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* SELEÇÃO DE ABAS & TOOLBAR INTEGRADA */}
            <div className="bg-surface p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-subtle shadow-xs shrink-0 space-y-3">
                
                {/* Linha 1: Abas de Navegação */}
                <div className="flex items-center space-x-2 border-b border-subtle pb-3 overflow-x-auto scrollbar-none">
                    <button 
                        onClick={() => handleTabChange('feedbacks')} 
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'feedbacks' 
                                ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-xs' 
                                : 'text-secondary-hub hover:bg-subtle'
                        }`}
                    >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Feedbacks</span>
                    </button>
                    <button 
                        onClick={() => handleTabChange('audits')} 
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'audits' 
                                ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-xs' 
                                : 'text-secondary-hub hover:bg-subtle'
                        }`}
                    >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Auditorias QA</span>
                    </button>
                    <button 
                        onClick={() => handleTabChange('metrics')} 
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'metrics' 
                                ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-xs' 
                                : 'text-secondary-hub hover:bg-subtle'
                        }`}
                    >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Avaliações Semanais</span>
                    </button>
                    <button 
                        onClick={() => handleTabChange('monthly')} 
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                            activeTab === 'monthly' 
                                ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-xs' 
                                : 'text-secondary-hub hover:bg-subtle'
                        }`}
                    >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Análise Mensal (1:1)</span>
                    </button>
                </div>

                {/* Linha 2: Filtros Integrados */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-2.5 items-center text-xs">
                    
                    {/* Campo de Busca */}
                    <div className="md:col-span-4 relative">
                        <Search className="w-3.5 h-3.5 text-muted-hub absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input 
                            type="text" 
                            placeholder={activeTab === 'audits' ? "Buscar protocolo, processo, auditor..." : "Buscar nos registros..."}
                            value={searchTerm} 
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
                            className="w-full pl-8 pr-7 py-2 border border-subtle rounded-xl outline-none text-xs focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 bg-subtle text-primary-hub placeholder:text-muted-hub transition-all font-medium" 
                        />
                        {searchTerm && (
                            <button
                                type="button"
                                onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-hub hover:text-rose-500 cursor-pointer"
                            >
                                <XCircle className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filtro de Período Rápido */}
                    <div className="md:col-span-2">
                        <select
                            value={periodFilter}
                            onChange={e => { setPeriodFilter(e.target.value); setCurrentPage(1); }}
                            className="w-full py-2 px-2.5 bg-subtle border border-subtle rounded-xl text-xs font-medium text-secondary-hub outline-none focus:ring-2 focus:ring-rose-500/20 cursor-pointer"
                        >
                            <option value="all">Todo o período</option>
                            <option value="today">Hoje</option>
                            <option value="7d">Últimos 7 dias</option>
                            <option value="30d">Últimos 30 dias</option>
                            <option value="this_month">Este Mês</option>
                            <option value="last_month">Mês Passado</option>
                        </select>
                    </div>

                    {/* Filtro de Status Específico por Aba */}
                    <div className="md:col-span-2">
                        <select
                            value={statusFilter}
                            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                            className="w-full py-2 px-2.5 bg-subtle border border-subtle rounded-xl text-xs font-medium text-secondary-hub outline-none focus:ring-2 focus:ring-rose-500/20 cursor-pointer"
                        >
                            <option value="all">Todos os status</option>
                            {activeTab === 'feedbacks' && (
                                <>
                                    <option value="unread">Não Lidos</option>
                                    <option value="read">Lidos</option>
                                    <option value="elogio">Elogios</option>
                                    <option value="melhoria">Melhorias</option>
                                    <option value="orientacao">Orientações</option>
                                </>
                            )}
                            {activeTab === 'audits' && (
                                <>
                                    <option value="conforme">Conformes</option>
                                    <option value="nao_conforme">Não Conformes</option>
                                </>
                            )}
                            {activeTab === 'monthly' && (
                                <>
                                    <option value="Positiva">Positivas</option>
                                    <option value="Neutra">Neutras</option>
                                    <option value="Negativa">Negativas</option>
                                </>
                            )}
                        </select>
                    </div>

                    {/* Filtro por Processo QA (apenas se audits) ou Ordenação */}
                    {activeTab === 'audits' && availableProcesses.length > 0 ? (
                        <div className="md:col-span-2">
                            <select
                                value={processFilter}
                                onChange={e => { setProcessFilter(e.target.value); setCurrentPage(1); }}
                                className="w-full py-2 px-2.5 bg-subtle border border-subtle rounded-xl text-xs font-medium text-secondary-hub outline-none focus:ring-2 focus:ring-rose-500/20 cursor-pointer truncate"
                            >
                                <option value="all">Todos os processos</option>
                                {availableProcesses.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="md:col-span-2">
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                                className="w-full py-2 px-2.5 bg-subtle border border-subtle rounded-xl text-xs font-medium text-secondary-hub outline-none focus:ring-2 focus:ring-rose-500/20 cursor-pointer"
                            >
                                <option value="recent">Mais recentes</option>
                                <option value="oldest">Mais antigos</option>
                                <option value="score_high">Maior pontuação</option>
                                <option value="score_low">Menor pontuação</option>
                            </select>
                        </div>
                    )}

                    {/* Botão Reset Filtros */}
                    <div className="md:col-span-2 flex items-center justify-end">
                        {hasActiveFilters ? (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="w-full py-2 px-2.5 rounded-xl text-xs font-bold text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Limpar</span>
                            </button>
                        ) : (
                            <div className="text-[11px] text-muted-hub text-right w-full font-mono">
                                {filteredData.length} registros
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* TABELA / CARDS VIEW */}
            <div className="flex-1 bg-surface rounded-2xl sm:rounded-3xl border border-subtle shadow-xs overflow-hidden flex flex-col">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
                        <span className="text-xs font-bold text-muted-hub">Carregando histórico operacional...</span>
                    </div>
                ) : filteredData.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-hub space-y-3">
                        <Archive className="w-10 h-10 opacity-30 text-muted-hub" />
                        <div>
                            <h3 className="text-sm font-bold text-primary-hub">Nenhum registro encontrado</h3>
                            <p className="text-xs text-muted-hub mt-1 max-w-sm">
                                Não localizamos dados com os filtros selecionados ou ainda não há lançamentos para este módulo.
                            </p>
                        </div>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="mt-2 px-3.5 py-1.5 bg-subtle hover:bg-surface text-secondary-hub border border-subtle rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Redefinir Filtros
                            </button>
                        )}
                    </div>
                ) : viewMode === 'table' ? (
                    /* VISUALIZAÇÃO EM TABELA */
                    <div className="flex-1 overflow-auto">
                        <table className="min-w-full text-xs whitespace-nowrap border-collapse">
                            <thead className="bg-subtle text-muted-hub sticky top-0 z-10 border-b border-subtle">
                                <tr>
                                    <th className="px-4 py-3 text-left font-bold text-[11px] uppercase tracking-wider">Data</th>
                                    <th className="px-4 py-3 text-left font-bold text-[11px] uppercase tracking-wider">
                                        {activeTab === 'feedbacks' ? 'Tipo & Mensagem' :
                                         activeTab === 'audits' ? 'Auditoria QA (Status & Processo)' :
                                         activeTab === 'metrics' ? 'Score & Volumes de Atendimento' :
                                         'Classificação & Mês de Referência'}
                                    </th>
                                    <th className="px-4 py-3 text-center font-bold text-[11px] uppercase tracking-wider">
                                        {activeTab === 'audits' ? 'Protocolo' : 'Detalhe Adicional'}
                                    </th>
                                    <th className="px-4 py-3 text-right font-bold text-[11px] uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="bg-surface">
                                {paginatedData.map(item => (
                                    <tr 
                                        key={item.id} 
                                        onClick={() => handleViewItem(item)}
                                        className={`border-b border-subtle last:border-b-0 hover:bg-subtle/60 transition-colors cursor-pointer ${
                                            activeTab === 'feedbacks' && !item.read ? 'bg-rose-500/5' : ''
                                        }`}
                                    >
                                        <td className="px-4 py-3 text-secondary-hub font-medium">
                                            <div className="flex items-center gap-1.5">
                                                <Calendar className="w-3.5 h-3.5 text-muted-hub shrink-0" />
                                                <span className="font-semibold">{getSafeDateString(item)}</span>
                                            </div>
                                        </td>
                                        
                                        <td className="px-4 py-3">
                                            {/* ABA: FEEDBACKS */}
                                            {activeTab === 'feedbacks' && (
                                                <div className="flex flex-col gap-1 max-w-xl py-0.5">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {!item.read ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                                Novo
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                                                <CheckCheck className="w-3 h-3 text-emerald-500" />
                                                                Lido
                                                            </span>
                                                        )}

                                                        <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                                                            item.type === 'Elogio' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 
                                                            item.type === 'Ponto de Melhoria' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' : 
                                                            'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                                        }`}>
                                                            {item.type}
                                                        </span>

                                                        {item.method && (
                                                            <span className="text-[10px] font-medium text-secondary-hub bg-subtle border border-subtle px-1.5 py-0.5 rounded">
                                                                {item.method}
                                                            </span>
                                                        )}

                                                        {item.protocol && item.protocol !== 'N/A' && (
                                                            <span className="text-[10px] font-mono font-bold text-primary-hub bg-subtle border border-subtle px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                                                                <Hash className="w-2.5 h-2.5 text-rose-500" />
                                                                {item.protocol}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Tags associadas */}
                                                    {Array.isArray(item.tags) && item.tags.length > 0 && (
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                            {item.tags.map(t => (
                                                                <span key={t} className="text-[9px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/20">
                                                                    {t}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <span className="text-xs text-secondary-hub line-clamp-1 font-medium">
                                                        {item.comment || 'Sem mensagem descritiva.'}
                                                    </span>
                                                </div>
                                            )}

                                            {/* ABA: AUDITORIAS QA */}
                                            {activeTab === 'audits' && (
                                                <div className="flex items-center gap-2.5 max-w-lg">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold border shrink-0 ${
                                                        item.status === 'Conforme' 
                                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                                    }`}>
                                                        {item.status === 'Conforme' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-rose-500" />}
                                                        <span>{item.status}</span>
                                                    </span>
                                                    <span className="text-xs font-bold text-primary-hub truncate">
                                                        {item.processName || qaProcesses[item.processId]?.name || 'Procedimento Padrão'}
                                                    </span>
                                                    {item.score !== undefined && (
                                                        <span className="text-[11px] font-mono font-bold text-muted-hub bg-subtle px-1.5 py-0.5 rounded border border-subtle shrink-0">
                                                            {item.score}%
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {/* ABA: MÉTRICAS SEMANAIS */}
                                            {activeTab === 'metrics' && (
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-xs text-secondary-hub">
                                                        Pontuação: <strong className="text-primary-hub font-mono font-black text-xs">{item.pontuacao || 0} pts</strong>
                                                    </span>
                                                    <span className="text-xs text-muted-hub">
                                                        &bull; Ligações: <strong className="text-secondary-hub">{item.Ligacoes_Atendidas || 0}</strong> | Huggy: <strong className="text-secondary-hub">{item.Atendimentos_Huggy || 0}</strong>
                                                    </span>
                                                </div>
                                            )}

                                            {/* ABA: ANÁLISE MENSAL */}
                                            {activeTab === 'monthly' && (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-black font-mono text-primary-hub">
                                                        {formatMonth(item.referenceMonth)}
                                                    </span>
                                                    {isLegacy4PillarsFeedback(item) ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                            <Archive className="w-3 h-3 text-amber-500" />
                                                            <span>Legado</span>
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                                            <FileText className="w-3 h-3 text-rose-500" />
                                                            <span>Markdown</span>
                                                        </span>
                                                    )}
                                                    {getClassificationBadge(item.classification)}
                                                </div>
                                            )}
                                        </td>

                                        {/* COLUNA: DETALHE ADICIONAL */}
                                        <td className="px-4 py-3 text-center">
                                            {activeTab === 'audits' && (
                                                <span className="font-mono font-bold text-[11px] text-secondary-hub bg-subtle border border-subtle px-2 py-0.5 rounded-lg">
                                                    {item.protocol || '--'}
                                                </span>
                                            )}
                                            {activeTab === 'feedbacks' && (
                                                <span className="text-[11px] text-muted-hub font-medium">
                                                    {resolveUserName(item.createdBy)}
                                                </span>
                                            )}
                                            {activeTab === 'metrics' && (
                                                <span className="text-[11px] text-muted-hub font-medium">
                                                    TMA: <strong className="text-secondary-hub font-mono">{item.TMA_Telefonia || '--'}</strong>
                                                </span>
                                            )}
                                            {activeTab === 'monthly' && (
                                                <span className="text-[11px] text-muted-hub font-medium">
                                                    {item.evaluatorName || 'Gestão'}
                                                </span>
                                            )}
                                        </td>

                                        {/* COLUNA: AÇÕES */}
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                {(activeTab === 'feedbacks' || activeTab === 'monthly') && !item.read && (
                                                    <button 
                                                        onClick={() => handleMarkAsRead(item.id)} 
                                                        className="text-[10px] font-bold text-rose-500 hover:text-rose-600 uppercase transition-colors cursor-pointer mr-1"
                                                    >
                                                        Marcar Lido
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => handleViewItem(item)} 
                                                    className="px-3 py-1.5 bg-subtle hover:bg-rose-500/10 text-secondary-hub hover:text-rose-500 rounded-xl flex items-center gap-1.5 transition-colors border border-subtle cursor-pointer font-bold text-xs shadow-2xs"
                                                >
                                                    <Eye className="w-3.5 h-3.5 text-rose-500" />
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
                    /* VISUALIZAÇÃO EM GRADE DE CARDS */
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto flex-1">
                        {paginatedData.map(item => (
                            <div 
                                key={item.id}
                                onClick={() => handleViewItem(item)}
                                className={`bg-surface rounded-2xl p-4 border transition-all hover:shadow-xs cursor-pointer flex flex-col justify-between ${
                                    activeTab === 'feedbacks' && !item.read 
                                        ? 'border-rose-500/40 bg-rose-500/5' 
                                        : 'border-subtle hover:border-rose-500/30'
                                }`}
                            >
                                <div className="space-y-3">
                                    {/* Topo do Card */}
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-[11px] text-muted-hub font-semibold flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5 opacity-70" />
                                            {getSafeDateString(item)}
                                        </span>

                                        {/* Badge Principal */}
                                        {activeTab === 'feedbacks' && (
                                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                                item.type === 'Elogio' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 
                                                item.type === 'Ponto de Melhoria' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' : 
                                                'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                            }`}>
                                                {item.type}
                                            </span>
                                        )}
                                        {activeTab === 'audits' && (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                                                item.status === 'Conforme' 
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' 
                                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                            }`}>
                                                {item.status === 'Conforme' ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <XCircle className="w-3 h-3 text-rose-500" />}
                                                {item.status}
                                            </span>
                                        )}
                                        {activeTab === 'metrics' && (
                                            <span className="font-mono font-black text-xs text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/20">
                                                {item.pontuacao || 0} pts
                                            </span>
                                        )}
                                        {activeTab === 'monthly' && getClassificationBadge(item.classification)}
                                    </div>

                                    {/* Corpo do Card */}
                                    {activeTab === 'feedbacks' && (
                                        <div className="space-y-2.5">
                                            {/* Status de Leitura & Canal */}
                                            <div className="flex items-center justify-between text-[11px] gap-1">
                                                {!item.read ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                                        Novo
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                                        <CheckCheck className="w-3 h-3 text-emerald-500" />
                                                        Lido
                                                    </span>
                                                )}

                                                <div className="flex items-center gap-1">
                                                    {item.method && (
                                                        <span className="text-[10px] text-secondary-hub bg-subtle border border-subtle px-1.5 py-0.5 rounded font-medium">
                                                            {item.method}
                                                        </span>
                                                    )}
                                                    {item.protocol && item.protocol !== 'N/A' && (
                                                        <span className="text-[10px] font-mono font-bold text-primary-hub bg-subtle border border-subtle px-1.5 py-0.5 rounded">
                                                            ID: {item.protocol}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Tags */}
                                            {Array.isArray(item.tags) && item.tags.length > 0 && (
                                                <div className="flex items-center gap-1 flex-wrap">
                                                    {item.tags.map(t => (
                                                        <span key={t} className="text-[9px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/20">
                                                            {t}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <p className="text-xs text-secondary-hub line-clamp-3 leading-snug bg-subtle p-2.5 rounded-xl border border-subtle italic">
                                                &quot;{item.comment || 'Sem mensagem descritiva.'}&quot;
                                            </p>

                                            {item.createdBy && (
                                                <div className="text-[10px] text-muted-hub">
                                                    Líder: <strong className="text-secondary-hub">{resolveUserName(item.createdBy)}</strong>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {activeTab === 'audits' && (
                                        <div className="space-y-1.5">
                                            <h4 className="text-xs font-bold text-primary-hub leading-snug truncate">
                                                {item.processName || qaProcesses[item.processId]?.name || 'Procedimento de Suporte'}
                                            </h4>
                                            <div className="flex items-center justify-between text-[11px] text-muted-hub pt-1">
                                                <span>Protocolo:</span>
                                                <span className="font-mono font-bold text-primary-hub bg-subtle px-1.5 py-0.5 rounded border border-subtle">
                                                    {item.protocol || 'N/A'}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'metrics' && (
                                        <div className="space-y-1.5 text-xs text-secondary-hub">
                                            <div className="flex justify-between">
                                                <span>Ligações Atendidas:</span>
                                                <strong className="text-primary-hub font-mono">{item.Ligacoes_Atendidas || 0}</strong>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Atendimentos Huggy:</span>
                                                <strong className="text-primary-hub font-mono">{item.Atendimentos_Huggy || 0}</strong>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>TMA Telefonia:</span>
                                                <strong className="text-primary-hub font-mono">{item.TMA_Telefonia || '--'}</strong>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'monthly' && (
                                        <div className="space-y-1.5 text-xs text-secondary-hub">
                                            <div className="flex justify-between">
                                                <span>Mês de Referência:</span>
                                                <strong className="text-primary-hub font-mono">{formatMonth(item.referenceMonth)}</strong>
                                            </div>
                                            <div className="flex justify-between">
                                                <span>Avaliador:</span>
                                                <strong className="text-primary-hub">{item.evaluatorName || 'Gestão'}</strong>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-3 pt-2.5 border-t border-subtle flex items-center justify-between">
                                    <span className="text-[10px] text-muted-hub font-medium">Ver completo</span>
                                    <span className="text-xs font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1">
                                        <Eye className="w-3.5 h-3.5" /> Detalhes
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* BARRA DE PAGINAÇÃO */}
                {filteredData.length > 0 && (
                    <footer className="px-4 py-3 bg-subtle border-t border-subtle flex flex-wrap items-center justify-between gap-2 text-xs text-secondary-hub shrink-0">
                        <div className="flex items-center gap-2">
                            <span>
                                Exibindo <strong className="text-primary-hub font-bold">{Math.min(filteredData.length, (currentPage - 1) * itemsPerPage + 1)}</strong>-
                                <strong className="text-primary-hub font-bold">{Math.min(filteredData.length, currentPage * itemsPerPage)}</strong> de <strong className="text-primary-hub font-bold">{filteredData.length}</strong>
                            </span>
                            <div className="flex items-center gap-1 ml-2 text-[11px]">
                                <span className="text-muted-hub hidden sm:inline">Por pág:</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => {
                                        setItemsPerPage(Number(e.target.value));
                                        setCurrentPage(1);
                                    }}
                                    className="bg-surface border border-subtle rounded-lg px-2 py-0.5 font-semibold text-primary-hub outline-none cursor-pointer"
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
                                    className="p-1.5 rounded-lg bg-surface border border-subtle hover:bg-subtle disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                    title="Página anterior"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <span className="px-2 font-bold text-primary-hub text-[11px]">
                                    {currentPage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-1.5 rounded-lg bg-surface border border-subtle hover:bg-subtle disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                    title="Próxima página"
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </footer>
                )}
            </div>

            {/* MODAIS DE VISUALIZAÇÃO DETALHADA */}

            {/* 1. Modal de Análise Detalhada da Auditoria QA */}
            {viewingItem && activeTab === 'audits' && (
                <AuditDetailModal
                    isOpen={true}
                    onClose={() => setViewingItem(null)}
                    audit={viewingItem}
                    qaProcess={qaProcesses[viewingItem.processId]}
                    onShowToast={showToast}
                />
            )}

            {/* 2. Modal de Feedback */}
            {viewingItem && activeTab === 'feedbacks' && (
                <FeedbackDetailModal
                    isOpen={true}
                    onClose={() => setViewingItem(null)}
                    feedback={viewingItem}
                    onMarkAsRead={handleMarkAsRead}
                />
            )}

            {/* 3. Modal de Desempenho Semanal */}
            {viewingItem && activeTab === 'metrics' && (
                <WeeklyMetricDetailModal
                    isOpen={true}
                    onClose={() => setViewingItem(null)}
                    metrics={viewingItem}
                />
            )}

            {/* 4. Modal de Avaliação Mensal 1:1 */}
            {viewingItem && activeTab === 'monthly' && (
                <MonthlyEvaluationDetailModal
                    isOpen={true}
                    onClose={() => setViewingItem(null)}
                    evaluation={viewingItem}
                    onMarkAsRead={handleMarkAsRead}
                    currentUser={currentUser}
                />
            )}

        </div>
    );
};

export default MyHistory;

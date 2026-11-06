import React, { useState, useEffect, useMemo } from 'react';
import { 
    CalendarDays, Plus, Search, Eye, Edit2, Trash2, X, Loader2, 
    AlertTriangle, Star, CheckSquare, Clock, ShieldCheck, MessageSquare, Save, User,
    ThumbsUp, Minus, ThumbsDown, Filter, FileText, Archive, Sparkles, CheckCheck,
    EyeOff, RefreshCw, BarChart2, TrendingUp, Users, CheckCircle2
} from 'lucide-react';
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeSharedCollection } from '../services/dataCache';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { 
    FEEDBACK_FORMATS,
    isLegacy4PillarsFeedback,
    isMarkdownFeedback,
    DEFAULT_1ON1_MARKDOWN_TEMPLATE,
    formatReferenceMonth,
    formatFeedbackReadStatus,
    buildMarkAsReadPayload,
    validateMarkdownFeedback
} from '../types/feedback.types';
import MonthlyEvaluationDetailModal from '../components/history/MonthlyEvaluationDetailModal';
import MarkdownRenderer from '../components/common/MarkdownRenderer';
import { BorderBeam } from '../components/magicui/BorderBeam';

const MonthlyEvaluations = () => {
    const { showToast } = useNotification();
    const { currentUser } = useAuth();
    
    const [evaluations, setEvaluations] = useState([]);
    const [collaborators, setCollaborators] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [classificationFilter, setClassificationFilter] = useState(''); 
    const [formatFilter, setFormatFilter] = useState('all'); // 'all' | 'markdown' | 'legacy'
    const [readFilter, setReadFilter] = useState('all'); // 'all' | 'read' | 'unread'

    // Controles de Modais
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewingEval, setViewingEval] = useState(null);
    const [deletingEval, setDeletingEval] = useState(null);
    
    // Formulário (Novo Formato Markdown Consolidado v3.11.0 / v4.0.0)
    const [editingId, setEditingId] = useState(null);
    const [isEditingLegacy, setIsEditingLegacy] = useState(false);
    const [activeTabForm, setActiveTabForm] = useState('write'); // 'write' | 'preview'
    
    const [formData, setFormData] = useState({
        colabId: '',
        colabName: '',
        referenceMonth: new Date().toISOString().slice(0, 7), // Formato YYYY-MM
        classification: 'Positiva',
        title: 'Alinhamento 1:1 Consolidado',
        contentMarkdown: DEFAULT_1ON1_MARKDOWN_TEMPLATE,
        performance: '',
        performanceScore: '',
        behavior: '',
        behaviorScore: '',
        punctuality: '',
        punctualityScore: '',
        quality: '',
        qualityScore: '',
        generalComments: ''
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Busca Colaboradores Ativos
        const unsubColabs = subscribeSharedCollection("collaborators", (items) => {
            const colabs = [];
            items.forEach(d => {
                if (d.active !== false) colabs.push(d);
            });
            colabs.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setCollaborators(colabs);
        });

        // Busca Avaliações Mensais
        const unsubEvals = subscribeSharedCollection("monthly_evaluations", (items) => {
            const fetchedData = [...items];
            // Ordena pelas mais recentes (Mês de referência decrescente)
            fetchedData.sort((a, b) => (b.referenceMonth || '').localeCompare(a.referenceMonth || ''));
            
            setEvaluations(fetchedData);
            setLoading(false);
        });

        return () => { unsubColabs(); unsubEvals(); };
    }, []);

    // Formata YYYY-MM para MM/YYYY
    const formatMonth = (yyyyMm) => formatReferenceMonth(yyyyMm);

    // --- FILTRAGEM ---
    const filteredEvaluations = useMemo(() => {
        return evaluations.filter(e => {
            const matchSearch = searchTerm === '' || (e.colabName || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchMonth = monthFilter === '' || e.referenceMonth === monthFilter;
            const matchClassification = classificationFilter === '' || e.classification === classificationFilter;
            
            const isLegacy = isLegacy4PillarsFeedback(e);
            const matchFormat = formatFilter === 'all' 
                ? true 
                : formatFilter === 'markdown' 
                ? !isLegacy 
                : isLegacy;

            const matchRead = readFilter === 'all'
                ? true
                : readFilter === 'read'
                ? Boolean(e.read)
                : !e.read;

            return matchSearch && matchMonth && matchClassification && matchFormat && matchRead;
        });
    }, [evaluations, searchTerm, monthFilter, classificationFilter, formatFilter, readFilter]);

    // Extrai meses únicos para o filtro
    const availableMonths = useMemo(() => {
        return [...new Set(evaluations.map(e => e.referenceMonth))].filter(Boolean).sort().reverse();
    }, [evaluations]);

    // Métricas para os Cards Bento no Topo
    const stats = useMemo(() => {
        const total = evaluations.length;
        const readCount = evaluations.filter(e => e.read).length;
        const readPercent = total > 0 ? Math.round((readCount / total) * 100) : 0;
        const positiveCount = evaluations.filter(e => e.classification === 'Positiva').length;
        const markdownCount = evaluations.filter(e => !isLegacy4PillarsFeedback(e)).length;

        return {
            total,
            readCount,
            readPercent,
            positiveCount,
            markdownCount
        };
    }, [evaluations]);

    // --- AÇÕES ---
    const openNewModal = () => {
        setEditingId(null);
        setIsEditingLegacy(false);
        setActiveTabForm('write');
        setFormData({
            colabId: '', 
            colabName: '', 
            referenceMonth: new Date().toISOString().slice(0, 7),
            classification: 'Positiva',
            title: 'Alinhamento 1:1 Consolidado',
            contentMarkdown: DEFAULT_1ON1_MARKDOWN_TEMPLATE,
            performance: '', performanceScore: '', 
            behavior: '', behaviorScore: '', 
            punctuality: '', punctualityScore: '', 
            quality: '', qualityScore: '', 
            generalComments: ''
        });
        setIsModalOpen(true);
    };

    const openEditModal = (evaluation) => {
        setEditingId(evaluation.id);
        const legacy = isLegacy4PillarsFeedback(evaluation);
        setIsEditingLegacy(legacy);
        setActiveTabForm('write');

        setFormData({
            colabId: evaluation.colabId || '',
            colabName: evaluation.colabName || '',
            referenceMonth: evaluation.referenceMonth || new Date().toISOString().slice(0, 7),
            classification: evaluation.classification || 'Positiva',
            title: evaluation.title || 'Alinhamento 1:1 Consolidado',
            contentMarkdown: evaluation.contentMarkdown || evaluation.markdownContent || evaluation.generalComments || '',
            performance: evaluation.performance || '',
            performanceScore: evaluation.performanceScore || '',
            behavior: evaluation.behavior || '',
            behaviorScore: evaluation.behaviorScore || '',
            punctuality: evaluation.punctuality || '',
            punctualityScore: evaluation.punctualityScore || '',
            quality: evaluation.quality || '',
            qualityScore: evaluation.qualityScore || '',
            generalComments: evaluation.generalComments || ''
        });
        setIsModalOpen(true);
    };

    const handleLoadTemplate = () => {
        setFormData(prev => ({
            ...prev,
            contentMarkdown: DEFAULT_1ON1_MARKDOWN_TEMPLATE
        }));
        showToast("Modelo oficial de 1:1 carregado com sucesso!", "info");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.colabId) {
            showToast("Selecione um colaborador.", "error");
            return;
        }

        // Se for modo legado existente, alerta de proteção read-only
        if (isEditingLegacy) {
            showToast("Registros em modo legado (4 Pilares) são somente leitura para preservar histórico.", "warning");
            setIsModalOpen(false);
            return;
        }

        const validation = validateMarkdownFeedback(formData);
        if (!validation.isValid) {
            showToast(validation.errors[0], "error");
            return;
        }

        setSaving(true);
        try {
            const now = new Date();
            const payload = { 
                colabId: formData.colabId,
                colabName: formData.colabName,
                referenceMonth: formData.referenceMonth,
                classification: formData.classification,
                title: formData.title || 'Alinhamento 1:1 Consolidado',
                contentMarkdown: formData.contentMarkdown.trim(),
                format: FEEDBACK_FORMATS.MARKDOWN,
                updatedAt: now.toISOString()
            };

            if (editingId) {
                await updateDoc(doc(db, "monthly_evaluations", editingId), payload);
                showToast("Feedback 1:1 atualizado com sucesso!", "success");
            } else {
                payload.evaluatorId = currentUser?.firestoreId || currentUser?.uid || 'gestor';
                payload.evaluatorName = currentUser?.name || currentUser?.displayName || 'Liderança';
                payload.createdAt = now.toISOString();
                payload.read = false; // Define como não lida ao criar
                const docRef = await addDoc(collection(db, "monthly_evaluations"), payload);

                // Dispara notificação persistente para o colaborador
                try {
                    await addDoc(collection(db, "notifications"), {
                        userId: formData.colabId,
                        recipientId: formData.colabId,
                        recipientName: formData.colabName,
                        type: 'feedback',
                        subtab: 'monthly',
                        evaluationId: docRef.id,
                        title: '🎯 Novo Feedback 1:1 Disponível!',
                        body: `Seu alinhamento mensal (${formatMonth(formData.referenceMonth)}) foi registrado por ${payload.evaluatorName}. Acesse Meu Histórico para ler e confirmar ciência.`,
                        read: false,
                        createdAt: now.toISOString(),
                        date: now.toLocaleDateString('pt-BR'),
                        data: {
                            id: docRef.id,
                            type: 'monthly_evaluation',
                            subtab: 'monthly',
                            evaluation: { ...payload, id: docRef.id }
                        }
                    });
                } catch (notifErr) {
                    console.warn('[MonthlyEvaluations] Aviso ao registrar notificação persistente:', notifErr);
                }

                showToast("Novo Feedback 1:1 em Markdown registrado e notificação enviada ao colaborador!", "success");
            }
            setIsModalOpen(false);
        } catch (error) {
            showToast("Erro ao salvar: " + error.message, "error");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            await deleteDoc(doc(db, "monthly_evaluations", deletingEval.id));
            showToast("Avaliação excluída permanentemente.", "success");
            setDeletingEval(null);
            if (viewingEval?.id === deletingEval.id) {
                setViewingEval(null);
            }
        } catch {
            showToast("Erro ao excluir.", "error");
        }
    };

    const handleMarkAsRead = async (id, auditPayload) => {
        try {
            const payload = auditPayload || buildMarkAsReadPayload(currentUser);
            await updateDoc(doc(db, "monthly_evaluations", id), payload);
            showToast("Ciência confirmada com sucesso!", "success");
            setEvaluations(prev => prev.map(item => item.id === id ? { ...item, ...payload } : item));
            if (viewingEval && viewingEval.id === id) {
                setViewingEval(prev => ({ ...prev, ...payload }));
            }
        } catch (err) {
            showToast("Erro ao confirmar ciência: " + err.message, "error");
        }
    };

    const handleColabChange = (e) => {
        const id = e.target.value;
        const colab = collaborators.find(c => c.id === id);
        setFormData({ ...formData, colabId: id, colabName: colab ? colab.name : '' });
    };

    // --- UI HELPERS ---
    const getClassificationBadge = (classification) => {
        switch (classification) {
            case 'Positiva': 
                return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 w-max"><ThumbsUp className="w-3 h-3"/> Positiva</span>;
            case 'Neutra': 
                return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5 w-max"><Minus className="w-3 h-3"/> Neutra</span>;
            case 'Negativa': 
                return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1.5 w-max"><ThumbsDown className="w-3 h-3"/> Negativa</span>;
            default: 
                return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-subtle text-muted-hub border border-subtle flex items-center gap-1.5 w-max"><Minus className="w-3 h-3"/> N/A</span>;
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-canvas h-full">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
                    <span className="text-xs font-semibold text-muted-hub tracking-wide uppercase">Carregando feedbacks 1:1...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-canvas flex flex-col space-y-6">
            
            {/* CABEÇALHO HERO EXECUTIVO */}
            <div className="relative">

                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5">
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-2 text-xs font-semibold text-rose-500 uppercase tracking-wider"><CalendarDays className="w-3.5 h-3.5" />Módulo de Liderança • Alinhamentos 1:1</span>
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-subtle text-secondary-hub border border-subtle">
                                {evaluations.length} Registros
                            </span>
                        </div>
                        <h1 className="font-brand text-2xl sm:text-3xl font-bold text-primary-hub tracking-tight">
                            Feedbacks & Análise Mensal 1:1
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-hub max-w-2xl leading-relaxed">
                            Gestão estruturada de reuniões de feedback 1:1 em Markdown com confirmação formal de ciência e trilha de auditoria completa.
                        </p>
                    </div>

                    <button 
                        onClick={openNewModal}
                        className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md shadow-rose-950/20 flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
                    >
                        <Plus className="w-4 h-4" /> Novo Feedback 1:1
                    </button>
                </div>
            </div>

            {/* BENTO STATS CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-surface border border-subtle p-4 rounded-2xl shadow-xs">
                    <div className="flex items-center justify-between text-muted-hub mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Total de 1:1s</span>
                        <FileText className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-primary-hub tracking-tight font-mono">{stats.total}</span>
                        <span className="text-xs font-medium text-muted-hub">avaliações</span>
                    </div>
                    <div className="text-[11px] text-muted-hub mt-2 font-mono">
                        {stats.markdownCount} Markdown • {stats.total - stats.markdownCount} Legado
                    </div>
                </div>

                <div className="bg-surface border border-subtle p-4 rounded-2xl shadow-xs">
                    <div className="flex items-center justify-between text-muted-hub mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Taxa de Ciência</span>
                        <CheckCheck className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-primary-hub tracking-tight font-mono">{stats.readPercent}%</span>
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">({stats.readCount} confirmados)</span>
                    </div>
                    <div className="w-full bg-subtle h-1.5 rounded-full mt-2.5 overflow-hidden">
                        <div 
                            className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${stats.readPercent}%` }}
                        />
                    </div>
                </div>

                <div className="bg-surface border border-subtle p-4 rounded-2xl shadow-xs">
                    <div className="flex items-center justify-between text-muted-hub mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Classificação Positiva</span>
                        <ThumbsUp className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-primary-hub tracking-tight font-mono">{stats.positiveCount}</span>
                        <span className="text-xs font-medium text-muted-hub">alinhamentos</span>
                    </div>
                    <div className="text-[11px] text-muted-hub mt-2 font-mono">
                        {stats.total > 0 ? Math.round((stats.positiveCount / stats.total) * 100) : 0}% de avaliações positivas
                    </div>
                </div>

                <div className="bg-surface border border-subtle p-4 rounded-2xl shadow-xs">
                    <div className="flex items-center justify-between text-muted-hub mb-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Equipe Ativa</span>
                        <Users className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-primary-hub tracking-tight font-mono">{collaborators.length}</span>
                        <span className="text-xs font-medium text-muted-hub">colaboradores</span>
                    </div>
                    <div className="text-[11px] text-muted-hub mt-2 font-mono">
                        Elegíveis para alinhamento 1:1
                    </div>
                </div>
            </div>

            {/* BARRA DE FILTROS REFINADA */}
            <div className="bg-surface p-4 rounded-2xl border border-subtle shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Busca */}
                <div className="relative sm:col-span-2 lg:col-span-1">
                    <Search className="w-4 h-4 text-muted-hub absolute left-3 top-2.5" />
                    <input 
                        type="text" 
                        placeholder="Buscar por colaborador..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-subtle border border-subtle rounded-xl text-primary-hub placeholder:text-muted-hub focus:bg-surface focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-xs transition-all font-medium"
                    />
                </div>

                {/* Filtro de Formato (Markdown vs Legado) */}
                <div className="relative">
                    <select 
                        value={formatFilter}
                        onChange={(e) => setFormatFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-subtle border border-subtle rounded-xl text-primary-hub focus:bg-surface focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-xs appearance-none cursor-pointer font-bold"
                    >
                        <option value="all">Todos os Formatos</option>
                        <option value="markdown">Markdown (Novos)</option>
                        <option value="legacy">Legado (4 Pilares)</option>
                    </select>
                </div>

                {/* Filtro de Status de Leitura */}
                <div className="relative">
                    <select 
                        value={readFilter}
                        onChange={(e) => setReadFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-subtle border border-subtle rounded-xl text-primary-hub focus:bg-surface focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-xs appearance-none cursor-pointer font-bold"
                    >
                        <option value="all">Todas as Leituras</option>
                        <option value="read">Confirmado (Lido)</option>
                        <option value="unread">Pendente de Leitura</option>
                    </select>
                </div>
                
                {/* Filtro de Classificação */}
                <div className="relative">
                    <select 
                        value={classificationFilter}
                        onChange={(e) => setClassificationFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-subtle border border-subtle rounded-xl text-primary-hub focus:bg-surface focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-xs appearance-none cursor-pointer font-medium"
                    >
                        <option value="">Todas Classificações</option>
                        <option value="Positiva">Positiva</option>
                        <option value="Neutra">Neutra</option>
                        <option value="Negativa">Negativa</option>
                    </select>
                </div>

                {/* Filtro de Mês */}
                <div className="relative">
                    <select 
                        value={monthFilter}
                        onChange={(e) => setMonthFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-subtle border border-subtle rounded-xl text-primary-hub focus:bg-surface focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-xs appearance-none cursor-pointer font-medium"
                    >
                        <option value="">Todos os Meses</option>
                        {availableMonths.map(m => (
                            <option key={m} value={m}>{formatMonth(m)}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* TABELA ENTERPRISE DE FEEDBACKS */}
            <div className="bg-surface rounded-3xl border border-subtle shadow-xs flex-1 flex flex-col overflow-hidden">
                {filteredEvaluations.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-hub p-12 text-center min-h-[300px]">
                        <CalendarDays className="w-12 h-12 mb-3 opacity-20 text-muted-hub" />
                        <p className="text-base font-bold text-primary-hub">Nenhum feedback 1:1 encontrado.</p>
                        <p className="text-xs mt-1 text-muted-hub">Tente ajustar os filtros ou registre um novo alinhamento.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto flex-1">
                        <table className="min-w-full text-xs">
                            <thead>
                                <tr className="bg-subtle/80 text-muted-hub border-b border-subtle">
                                    <th className="px-5 py-3.5 text-left font-bold uppercase tracking-wider w-28">Mês/Ano</th>
                                    <th className="px-5 py-3.5 text-left font-bold uppercase tracking-wider">Colaborador</th>
                                    <th className="px-5 py-3.5 text-left font-bold uppercase tracking-wider">Formato</th>
                                    <th className="px-5 py-3.5 text-left font-bold uppercase tracking-wider">Classificação</th>
                                    <th className="px-5 py-3.5 text-left font-bold uppercase tracking-wider">Ciência (Status)</th>
                                    <th className="px-5 py-3.5 text-left font-bold uppercase tracking-wider">Líder</th>
                                    <th className="px-5 py-3.5 text-right font-bold uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEvaluations.map((evaluation) => {
                                    const isLegacy = isLegacy4PillarsFeedback(evaluation);
                                    return (
                                        <tr 
                                            key={evaluation.id} 
                                            className="border-b border-subtle last:border-b-0 hover:bg-subtle/50 transition-colors"
                                        >
                                            <td className="px-5 py-3.5">
                                                <span className="font-bold text-primary-hub bg-subtle px-2.5 py-1 rounded-lg border border-subtle font-mono text-[11px]">
                                                    {formatMonth(evaluation.referenceMonth)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 font-bold text-primary-hub">
                                                {evaluation.colabName}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                {isLegacy ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                        <Archive className="w-3 h-3 text-amber-500" />
                                                        <span>Legado (4 Pilares)</span>
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                                        <FileText className="w-3 h-3 text-blue-500" />
                                                        <span>Markdown 1:1</span>
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                {getClassificationBadge(evaluation.classification)}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                {evaluation.read ? (
                                                    <span 
                                                        className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-max"
                                                        title={formatFeedbackReadStatus(evaluation)}
                                                    >
                                                        <CheckCheck className="w-3.5 h-3.5 text-emerald-500"/> Confirmado
                                                    </span>
                                                ) : (
                                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1 w-max">
                                                        <Clock className="w-3.5 h-3.5 text-amber-500"/> Pendente
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 text-muted-hub font-medium">
                                                {evaluation.evaluatorName || 'Liderança'}
                                            </td>
                                            
                                            <td className="px-5 py-3.5 text-right flex justify-end gap-1.5">
                                                <button 
                                                    onClick={() => setViewingEval(evaluation)} 
                                                    className="p-1.5 text-blue-500 hover:bg-blue-500/10 rounded-xl transition-colors cursor-pointer" 
                                                    title="Visualizar Alinhamento Completo"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                {!isLegacy && (
                                                    <button 
                                                        onClick={() => openEditModal(evaluation)} 
                                                        className="p-1.5 text-amber-500 hover:bg-amber-500/10 rounded-xl transition-colors cursor-pointer" 
                                                        title="Editar Feedback Markdown"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button 
                                                    onClick={() => setDeletingEval(evaluation)} 
                                                    className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer" 
                                                    title="Excluir Registro"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* MODAL DE CRIAÇÃO / EDIÇÃO DE FEEDBACK 1:1 EM MARKDOWN */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center p-3 sm:p-5 z-[80] backdrop-blur-xs overflow-y-auto">
                    <div className="relative bg-surface rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[94vh] border border-subtle animate-in zoom-in-95 duration-150">
                        <BorderBeam size={200} duration={8} colorFrom="#f43f5e" colorTo="#e11d48" borderWidth={1.5} />

                        {/* HEADER DO FORMULÁRIO */}
                        <div className="p-5 sm:p-6 bg-surface border-b border-subtle flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center">
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-primary-hub flex items-center gap-2">
                                        {editingId ? 'Editar Feedback 1:1' : 'Novo Alinhamento Mensal 1:1'}
                                        <span className="text-[10px] font-mono uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold">
                                            Markdown
                                        </span>
                                    </h3>
                                    <p className="text-xs text-muted-hub">
                                        Redija o feedback consolidado em Markdown profissional com ciência auditável.
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)} 
                                className="p-2 text-muted-hub hover:text-primary-hub hover:bg-subtle rounded-xl transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* CORPO DO FORMULÁRIO */}
                        <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-canvas space-y-5">
                            {isEditingLegacy && (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                                    <Archive className="w-4 h-4 text-amber-500 shrink-0" />
                                    <span>Este é um registro legado dos 4 pilares. Ele está protegido em modo somente leitura para preservar histórico de auditoria.</span>
                                </div>
                            )}

                            <form id="evalForm" onSubmit={handleSubmit} className="space-y-5">
                                {/* DADOS GERAIS */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-surface p-4 rounded-2xl border border-subtle shadow-xs">
                                    <div>
                                        <label className="block text-xs font-bold text-secondary-hub uppercase mb-1">
                                            Colaborador <span className="text-rose-500">*</span>
                                        </label>
                                        <select 
                                            required 
                                            disabled={isEditingLegacy}
                                            value={formData.colabId} 
                                            onChange={handleColabChange} 
                                            className="w-full p-2.5 bg-subtle border border-subtle rounded-xl text-primary-hub focus:bg-surface focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-xs font-medium"
                                        >
                                            <option value="" disabled>Selecione um colaborador...</option>
                                            {collaborators.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-secondary-hub uppercase mb-1">
                                            Mês de Referência <span className="text-rose-500">*</span>
                                        </label>
                                        <input 
                                            type="month" 
                                            required 
                                            disabled={isEditingLegacy}
                                            value={formData.referenceMonth} 
                                            onChange={(e) => setFormData({...formData, referenceMonth: e.target.value})} 
                                            className="w-full p-2.5 bg-subtle border border-subtle rounded-xl text-primary-hub focus:bg-surface focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-xs font-mono font-medium" 
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-secondary-hub uppercase mb-1">
                                            Classificação Geral <span className="text-rose-500">*</span>
                                        </label>
                                        <select 
                                            required 
                                            disabled={isEditingLegacy}
                                            value={formData.classification} 
                                            onChange={(e) => setFormData({...formData, classification: e.target.value})} 
                                            className="w-full p-2.5 bg-subtle border border-subtle rounded-xl text-primary-hub focus:bg-surface focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-xs font-bold"
                                        >
                                            <option value="Positiva">Positiva</option>
                                            <option value="Neutra">Neutra</option>
                                            <option value="Negativa">Negativa</option>
                                        </select>
                                    </div>
                                </div>

                                {/* TÍTULO DO FEEDBACK */}
                                <div className="bg-surface p-4 rounded-2xl border border-subtle shadow-xs space-y-1">
                                    <label className="block text-xs font-bold text-secondary-hub uppercase">
                                        Título do Alinhamento 1:1
                                    </label>
                                    <input 
                                        type="text" 
                                        disabled={isEditingLegacy}
                                        value={formData.title} 
                                        onChange={(e) => setFormData({...formData, title: e.target.value})} 
                                        placeholder="Ex: Alinhamento de Metas & PDI - Outubro/2026"
                                        className="w-full p-2.5 bg-subtle border border-subtle rounded-xl text-primary-hub placeholder:text-muted-hub focus:bg-surface focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none text-xs font-semibold"
                                    />
                                </div>

                                {/* EDITOR MARKDOWN COM ABAS (ESCREVER / PREVIEW) */}
                                <div className="bg-surface rounded-2xl border border-subtle shadow-xs overflow-hidden">
                                    {/* Barra de Ferramentas do Editor */}
                                    <div className="p-3 bg-subtle/70 border-b border-subtle flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setActiveTabForm('write')}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                                    activeTabForm === 'write' 
                                                        ? 'bg-primary-hub text-white dark:text-zinc-950 border-transparent shadow-xs' 
                                                        : 'bg-subtle text-secondary-hub hover:bg-surface border-subtle'
                                                }`}
                                            >
                                                Escrever (Markdown)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setActiveTabForm('preview')}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                                                    activeTabForm === 'preview' 
                                                        ? 'bg-primary-hub text-white dark:text-zinc-950 border-transparent shadow-xs' 
                                                        : 'bg-subtle text-secondary-hub hover:bg-surface border-subtle'
                                                }`}
                                            >
                                                Visualizar Prévia
                                            </button>
                                        </div>

                                        {!isEditingLegacy && (
                                            <button
                                                type="button"
                                                onClick={handleLoadTemplate}
                                                className="px-3 py-1.5 bg-subtle hover:bg-surface text-secondary-hub hover:text-primary-hub border border-subtle rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                                                title="Carregar template pré-formatado"
                                            >
                                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                                <span>Carregar Modelo Oficial 1:1</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* CONTEÚDO DO EDITOR */}
                                    {activeTabForm === 'write' ? (
                                        <div className="p-4">
                                            <textarea 
                                                rows="14" 
                                                required
                                                disabled={isEditingLegacy}
                                                value={formData.contentMarkdown} 
                                                onChange={(e) => setFormData({...formData, contentMarkdown: e.target.value})} 
                                                placeholder="Escreva em formato Markdown (.md)... Utilize títulos, listas, tabelas e citações."
                                                className="w-full p-4 font-mono text-xs leading-relaxed border border-subtle rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-primary-hub bg-subtle focus:bg-surface resize-y"
                                            />
                                            <p className="text-[11px] text-muted-hub mt-2 flex items-center gap-2">
                                                <span>Suporta tabelas (| Coluna |), listas (- item), negrito (**texto**) e blocos de código.</span>
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="p-6 bg-surface min-h-[300px]">
                                            <MarkdownRenderer content={formData.contentMarkdown || '*Nenhum conteúdo para visualizar.*'} />
                                        </div>
                                    )}
                                </div>
                            </form>
                        </div>
                        
                        {/* RODAPÉ DO FORMULÁRIO */}
                        <div className="p-4 bg-surface border-t border-subtle flex justify-end gap-3 shrink-0">
                            <button 
                                type="button" 
                                onClick={() => setIsModalOpen(false)} 
                                className="px-5 py-2.5 border border-subtle text-secondary-hub hover:text-primary-hub text-xs font-bold rounded-xl hover:bg-subtle transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            {!isEditingLegacy && (
                                <button 
                                    type="submit" 
                                    form="evalForm" 
                                    disabled={saving} 
                                    className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-950/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Salvar Feedback 1:1
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL UNIFICADO DE VISUALIZAÇÃO (LEGADO & MARKDOWN) */}
            {viewingEval && (
                <MonthlyEvaluationDetailModal
                    isOpen={true}
                    evaluation={viewingEval}
                    onClose={() => setViewingEval(null)}
                    onMarkAsRead={handleMarkAsRead}
                    currentUser={currentUser}
                />
            )}

            {/* MODAL DE DELEÇÃO */}
            {deletingEval && (
                <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[90] backdrop-blur-xs">
                    <div className="bg-surface rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-6 animate-in zoom-in-95 border border-subtle">
                        <div className="w-14 h-14 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-rose-500 border border-rose-500/20">
                            <AlertTriangle className="w-7 h-7" />
                        </div>
                        <h3 className="text-base font-bold text-primary-hub mb-1">Excluir Feedback 1:1?</h3>
                        <p className="text-muted-hub text-xs mb-6 leading-relaxed">
                            Esta ação não pode ser desfeita. O documento será removido do histórico do colaborador.
                        </p>
                        <div className="flex gap-2.5">
                            <button 
                                onClick={() => setDeletingEval(null)} 
                                className="flex-1 py-2.5 bg-subtle text-secondary-hub hover:text-primary-hub text-xs rounded-xl hover:bg-surface border border-subtle font-bold transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleDelete} 
                                className="flex-1 py-2.5 bg-rose-600 text-white text-xs rounded-xl hover:bg-rose-700 font-bold transition-colors cursor-pointer shadow-xs active:scale-95"
                            >
                                Sim, Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default MonthlyEvaluations;

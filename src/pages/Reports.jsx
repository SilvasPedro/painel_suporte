import React, { useState, useEffect, useMemo } from 'react';
import { 
    Plus, Search, Eye, Edit2, Trash2, X, Loader2, 
    AlertTriangle, CheckCircle, Clock, Filter, 
    Lightbulb, Monitor, Building, Zap, Bug, MessageSquare, Send,
    Table, Columns3, LayoutGrid, List, Copy, ChevronLeft, ChevronRight,
    User, ShieldCheck, Check, Sparkles, AlertOctagon, RotateCcw, Hourglass, Lock,
    CornerDownRight, MessageCircle, ChevronUp, ChevronDown
} from 'lucide-react';
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeSharedCollection } from '../services/dataCache';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';

const Reports = () => {
    const { showToast } = useNotification();
    const { currentUser } = useAuth();
    const { normalizedRole, isMasterAdmin, canEdit } = usePermissions();

    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    // ==========================================
    // CONTROLE DE ACESSO E PERMISSÕES (RBAC)
    // ==========================================
    // Gestor e Supervisor (e Admin/Master) visualizam TODOS os relatórios
    const canViewAllReports = useMemo(() => {
        if (isMasterAdmin) return true;
        const role = String(normalizedRole || '').toLowerCase();
        if (role === 'gestor' || role === 'supervisor') return true;
        const rawRole = String(currentUser?.role || '').toLowerCase();
        return rawRole.includes('gestor') || rawRole.includes('supervis') || rawRole.includes('admin') || rawRole.includes('gerente') || rawRole.includes('coordenador');
    }, [isMasterAdmin, normalizedRole, currentUser?.role]);

    // Gestor e Supervisor podem gerenciar tickets (mudar status e dar parecer)
    const canManageTickets = useMemo(() => {
        return canViewAllReports || canEdit('reports');
    }, [canViewAllReports, canEdit]);

    // Permissão de edição ou exclusão do registro
    const canEditOrDelete = (report) => {
        if (canManageTickets) return true;
        const userUid = currentUser?.firestoreId || currentUser?.uid;
        return report.creatorId === userUid;
    };

    // ==========================================
    // ESTADOS DE VISUALIZAÇÃO E FILTROS
    // ==========================================
    // Modos de visualização: 'table' (Tabela), 'kanban' (Quadro), 'cards' (Grade), 'compact' (Lista rápida)
    const [viewMode, setViewMode] = useState('table');
    const [showSummary, setShowSummary] = useState(true);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [clientImpactFilter, setClientImpactFilter] = useState('');
    const [creatorFilter, setCreatorFilter] = useState(''); // Apenas para quem vê todos

    // Feedback de cópia
    const [copiedText, setCopiedText] = useState(false);

    // Controles de Modais
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewingReport, setViewingReport] = useState(null);
    const [deletingReport, setDeletingReport] = useState(null);

    // Formulário de Criação/Edição
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        type: 'Análise de Erro', 
        priority: 'Normal', 
        date: new Date().toISOString().split('T')[0],
        affectedClient: 'Não',
        howAffected: '',
        protocol: '',
        description: '',
        status: 'Pendente'
    });
    const [saving, setSaving] = useState(false);

    // Controles Rápidos de Gestão (Dentro do Modal de Visualização)
    const [quickStatus, setQuickStatus] = useState('');
    const [quickComment, setQuickComment] = useState('');
    const [quickSaving, setQuickSaving] = useState(false);

    // Thread de Interação em Comentários
    const [newCommentText, setNewCommentText] = useState('');
    const [newCommentStatus, setNewCommentStatus] = useState('');
    const [sendingComment, setSendingComment] = useState(false);

    // ==========================================
    // BUSCA DE DADOS EM TEMPO REAL VIA CACHE COMPARTILHADO
    // ==========================================
    useEffect(() => {
        if (!currentUser) return;

        const userIdentifier = currentUser.firestoreId || currentUser.uid;
        const userIds = new Set([currentUser.firestoreId, currentUser.uid].filter(Boolean));

        const unsubscribe = subscribeSharedCollection("critical_reports", (items) => {
            let fetchedData = [...items];

            // Se for Colaborador/Apoio (sem permissão geral): filtra apenas seus relatórios na memória
            if (!canViewAllReports) {
                fetchedData = fetchedData.filter(r => userIds.has(r.creatorId) || r.creatorId === userIdentifier);
            }

            // Ordenação pelo mais recente
            fetchedData.sort((a, b) => {
                const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.date ? new Date(a.date).getTime() : 0);
                const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.date ? new Date(b.date).getTime() : 0);
                return dateB - dateA;
            });

            setReports(fetchedData);
            setViewingReport(prev => {
                if (!prev) return null;
                return fetchedData.find(r => r.id === prev.id) || prev;
            });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, canViewAllReports]);

    // ==========================================
    // HELPERS E FILTRAGEM
    // ==========================================
    const getDisplayTitle = (r) => {
        if (r.title && r.title.trim()) return r.title;
        if (r.description) return `[Sem título] ${r.description.substring(0, 45)}...`;
        return 'Solicitação Sem Título';
    };

    // Extrai lista única de solicitantes (para filtro de Gestor/Supervisor)
    const uniqueCreators = useMemo(() => {
        const names = new Set();
        reports.forEach(r => {
            if (r.creatorName) names.add(r.creatorName);
        });
        return Array.from(names).sort();
    }, [reports]);

    // Relatórios filtrados
    const filteredReports = useMemo(() => {
        return reports.filter(r => {
            const titleSafe = getDisplayTitle(r).toLowerCase();
            const descSafe = (r.description || '').toLowerCase();
            const protoSafe = (r.protocol || '').toLowerCase();
            const authorSafe = (r.creatorName || '').toLowerCase();
            const commentSafe = (r.adminComment || r.closingComment || '').toLowerCase();
            const commentsSafe = Array.isArray(r.comments)
                ? r.comments.map(c => `${c.content || ''} ${c.authorName || ''}`).join(' ').toLowerCase()
                : '';
            const searchLower = searchTerm.toLowerCase();

            const matchSearch = searchTerm === '' || 
                titleSafe.includes(searchLower) ||
                descSafe.includes(searchLower) ||
                protoSafe.includes(searchLower) ||
                authorSafe.includes(searchLower) ||
                commentSafe.includes(searchLower) ||
                commentsSafe.includes(searchLower);

            const matchStatus = statusFilter === '' || r.status === statusFilter;
            const matchType = typeFilter === '' || r.type === typeFilter;
            const matchPriority = priorityFilter === '' || r.priority === priorityFilter;
            const matchClient = clientImpactFilter === '' || r.affectedClient === clientImpactFilter;
            const matchCreator = creatorFilter === '' || r.creatorName === creatorFilter;

            return matchSearch && matchStatus && matchType && matchPriority && matchClient && matchCreator;
        });
    }, [reports, searchTerm, statusFilter, typeFilter, priorityFilter, clientImpactFilter, creatorFilter]);

    // Métricas para o Ribbon de Resumo
    const metricsSummary = useMemo(() => {
        const total = reports.length;
        const pending = reports.filter(r => r.status === 'Pendente' || !r.status).length;
        const inProgress = reports.filter(r => r.status === 'Em Andamento').length;
        const resolved = reports.filter(r => r.status === 'Resolvido' || r.status === 'Concluído').length;
        const clientImpact = reports.filter(r => r.affectedClient === 'Sim').length;
        return { total, pending, inProgress, resolved, clientImpact };
    }, [reports]);

    const hasActiveFilters = Boolean(searchTerm || statusFilter || typeFilter || priorityFilter || clientImpactFilter || creatorFilter);

    const clearAllFilters = () => {
        setSearchTerm('');
        setStatusFilter('');
        setTypeFilter('');
        setPriorityFilter('');
        setClientImpactFilter('');
        setCreatorFilter('');
    };

    // Navegação no Modal (Anterior / Próximo)
    const currentViewingIndex = useMemo(() => {
        if (!viewingReport) return -1;
        return filteredReports.findIndex(r => r.id === viewingReport.id);
    }, [viewingReport, filteredReports]);

    const hasPrevReport = currentViewingIndex > 0;
    const hasNextReport = currentViewingIndex >= 0 && currentViewingIndex < filteredReports.length - 1;

    const navigateReport = (direction) => {
        const targetIndex = direction === 'prev' ? currentViewingIndex - 1 : currentViewingIndex + 1;
        if (targetIndex >= 0 && targetIndex < filteredReports.length) {
            handleOpenViewModal(filteredReports[targetIndex]);
        }
    };

    // ==========================================
    // AÇÕES DE CRIAÇÃO E EDIÇÃO
    // ==========================================
    const openNewReportModal = () => {
        setEditingId(null);
        setFormData({
            title: '', 
            type: 'Análise de Erro', 
            priority: 'Normal', 
            date: new Date().toISOString().split('T')[0], 
            affectedClient: 'Não', 
            howAffected: '', 
            protocol: '', 
            description: '', 
            status: 'Pendente'
        });
        setIsModalOpen(true);
    };

    const openEditModal = (report) => {
        setEditingId(report.id);
        setFormData({
            title: report.title || '',
            type: report.type || 'Análise de Erro',
            priority: report.priority || 'Normal',
            date: report.date || '',
            affectedClient: report.affectedClient || 'Não',
            howAffected: report.howAffected || '',
            protocol: report.protocol || '',
            description: report.description || '',
            status: report.status || 'Pendente',
            adminComment: report.adminComment || report.closingComment || report.solution || ''
        });
        setIsModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.description.trim()) {
            showToast("A descrição da solicitação é obrigatória.", "error");
            return;
        }

        setSaving(true);
        try {
            const reportPayload = { 
                ...formData, 
                updatedAt: new Date() 
            };
            if (!reportPayload.title) {
                reportPayload.title = `[Ajuste] ${reportPayload.description.substring(0, 35)}...`;
            }

            if (editingId) {
                const existingRep = reports.find(r => r.id === editingId);
                
                // REQUISITO: Usuários que NÃO têm role de supervisor ou gestor só podem editar o que escreveram.
                // Os campos de solução e status NÃO podem ser alterados por eles, preservando o valor definido pela liderança!
                if (!canManageTickets && existingRep) {
                    reportPayload.status = existingRep.status || 'Pendente';
                    if (existingRep.adminComment !== undefined) reportPayload.adminComment = existingRep.adminComment;
                    if (existingRep.closingComment !== undefined) reportPayload.closingComment = existingRep.closingComment;
                    if (existingRep.solution !== undefined) reportPayload.solution = existingRep.solution;
                    if (existingRep.lastUpdatedBy !== undefined) reportPayload.lastUpdatedBy = existingRep.lastUpdatedBy;
                }

                await updateDoc(doc(db, "critical_reports", editingId), reportPayload);
                showToast("Solicitação atualizada com sucesso!", "success");
            } else {
                reportPayload.creatorId = currentUser.firestoreId || currentUser.uid;
                reportPayload.creatorName = currentUser.name || currentUser.displayName || 'Colaborador';
                reportPayload.createdAt = new Date();
                await addDoc(collection(db, "critical_reports"), reportPayload);
                showToast("Solicitação enviada com sucesso!", "success");
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
            await deleteDoc(doc(db, "critical_reports", deletingReport.id));
            showToast("Solicitação excluída permanentemente.", "success");
            setDeletingReport(null);
            if (viewingReport?.id === deletingReport.id) {
                setViewingReport(null);
            }
        } catch (err) {
            showToast("Erro ao excluir: " + err.message, "error");
        }
    };

    // ==========================================
    // AÇÕES DO GESTOR NO MODAL DE VISUALIZAÇÃO
    // ==========================================
    const handleOpenViewModal = (report) => {
        setViewingReport(report);
        setQuickStatus(report.status || 'Pendente');
        setQuickComment(report.adminComment || report.closingComment || '');
        setNewCommentText('');
        setNewCommentStatus(report.status || 'Pendente');
    };

    // Abre o relatório automaticamente se disparado por notificação push ou clique de alerta
    useEffect(() => {
        const handleOpenReport = (e) => {
            if (e.detail?.report) {
                const found = reports.find(r => r.id === e.detail.report.id) || e.detail.report;
                handleOpenViewModal(found);
            }
        };
        window.addEventListener('HUBDESK_OPEN_REPORT', handleOpenReport);
        return () => window.removeEventListener('HUBDESK_OPEN_REPORT', handleOpenReport);
    }, [reports]);

    const formatCommentDate = (dateVal) => {
        if (!dateVal) return '';
        try {
            const d = typeof dateVal === 'string' ? new Date(dateVal) : (dateVal.toDate ? dateVal.toDate() : new Date(dateVal));
            if (isNaN(d.getTime())) return '';
            const now = new Date();
            const isToday = d.toDateString() === now.toDateString();
            const timeStr = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            if (isToday) {
                return `Hoje às ${timeStr}`;
            }
            const dateStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            return `${dateStr} às ${timeStr}`;
        } catch {
            return '';
        }
    };

    // Adicionar novo comentário na thread (Colaborador ou Gestão)
    const handleAddComment = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!viewingReport || !newCommentText.trim()) return;

        setSendingComment(true);
        try {
            const userUid = currentUser?.firestoreId || currentUser?.uid || 'user';
            const userName = currentUser?.name || currentUser?.displayName || 'Usuário';
            const userRole = currentUser?.role || normalizedRole || 'Colaborador';

            const newComment = {
                id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                authorId: userUid,
                authorName: userName,
                authorRole: userRole,
                isStaff: Boolean(canManageTickets),
                content: newCommentText.trim(),
                createdAt: new Date().toISOString()
            };

            const existingComments = Array.isArray(viewingReport.comments) ? viewingReport.comments : [];
            const updatedComments = [...existingComments, newComment];

            const updateData = {
                comments: updatedComments,
                lastActivityAt: new Date(),
                lastUpdatedBy: userName,
                updatedAt: new Date()
            };

            // Se for gestor/supervisor e alterou o status junto com o comentário
            if (canManageTickets && newCommentStatus && newCommentStatus !== viewingReport.status) {
                updateData.status = newCommentStatus;
            }

            await updateDoc(doc(db, "critical_reports", viewingReport.id), updateData);

            setViewingReport(prev => ({
                ...prev,
                ...updateData
            }));

            setNewCommentText('');
            showToast("Comentário adicionado com sucesso!", "success");
        } catch (err) {
            showToast("Erro ao adicionar comentário: " + err.message, "error");
        } finally {
            setSendingComment(false);
        }
    };

    const handleQuickUpdate = async () => {
        if (!viewingReport) return;
        setQuickSaving(true);
        try {
            const userName = currentUser?.name || 'Gestão';
            const userUid = currentUser?.firestoreId || currentUser?.uid || 'user';
            const userRole = currentUser?.role || normalizedRole || 'Gestor';

            const updatePayload = {
                status: quickStatus,
                adminComment: quickComment,
                lastUpdatedBy: userName,
                updatedAt: new Date()
            };

            // Se um comentário/parecer for preenchido, adiciona também na thread de comentários
            if (quickComment && quickComment.trim()) {
                const existingComments = Array.isArray(viewingReport.comments) ? viewingReport.comments : [];
                const lastComment = existingComments[existingComments.length - 1];
                if (!lastComment || lastComment.content !== quickComment.trim()) {
                    const newComment = {
                        id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                        authorId: userUid,
                        authorName: userName,
                        authorRole: userRole,
                        isStaff: true,
                        content: `[Parecer da Gestão • Status: ${quickStatus}]\n${quickComment.trim()}`,
                        createdAt: new Date().toISOString()
                    };
                    updatePayload.comments = [...existingComments, newComment];
                }
            }

            await updateDoc(doc(db, "critical_reports", viewingReport.id), updatePayload);
            showToast("Andamento e parecer atualizados com sucesso!", "success");
            setViewingReport(prev => ({ 
                ...prev, 
                ...updatePayload
            }));
        } catch (err) {
            showToast("Erro ao atualizar ticket: " + err.message, "error");
        } finally {
            setQuickSaving(false);
        }
    };

    // Copiar Resumo do Ticket com Histórico de Comentários
    const handleCopyReportSummary = (report) => {
        let text = `📋 [TAREFA / RELATÓRIO #${report.id.slice(0, 6).toUpperCase()}]
• Título: ${getDisplayTitle(report)}
• Tipo: ${report.type || 'Análise de Erro'}
• Prioridade: ${report.priority || 'Normal'}
• Status: ${report.status || 'Pendente'}
• Solicitante: ${report.creatorName || 'Desconhecido'}
• Data: ${report.date || 'N/A'}
• Protocolo: ${report.protocol || 'N/A'}
• Impacto no Cliente: ${report.affectedClient === 'Sim' ? `SIM (${report.howAffected || 'Sim'})` : 'Não'}
• Descrição:
${report.description || 'Sem descrição'}`;

        if (Array.isArray(report.comments) && report.comments.length > 0) {
            text += `\n\n💬 Histórico de Interações (${report.comments.length}):`;
            report.comments.forEach((c, idx) => {
                const roleTag = c.authorRole || (c.isStaff ? 'Liderança' : 'Solicitante');
                text += `\n[${idx + 1}] ${c.authorName} (${roleTag}): ${c.content}`;
            });
        } else if (report.adminComment || report.closingComment) {
            text += `\n• Parecer da Gestão:\n${report.adminComment || report.closingComment}`;
        }

        navigator.clipboard.writeText(text);
        setCopiedText(true);
        showToast("Resumo da demanda copiado para a área de transferência!", "success");
        setTimeout(() => setCopiedText(false), 2000);
    };

    // ==========================================
    // HELPERS VISUAIS
    // ==========================================
    const getStatusBadge = (status) => {
        switch (status) {
            case 'Resolvido':
            case 'Concluído':
                return (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600"/> Resolvido
                    </span>
                );
            case 'Em Andamento':
                return (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
                        <span className="w-4 h-4 rounded-full bg-blue-200/90 border border-blue-400 flex items-center justify-center shrink-0">
                            <Clock className="w-2.5 h-2.5 text-blue-700" />
                        </span>
                        Em Andamento
                    </span>
                );
            case 'Recusado':
            case 'Cancelado':
                return (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300 inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
                        <X className="w-3.5 h-3.5 text-gray-500"/> Cancelado
                    </span>
                );
            default:
                return (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 inline-flex items-center gap-1.5 whitespace-nowrap shadow-2xs">
                        <Clock className="w-3.5 h-3.5 text-amber-600"/> Pendente
                    </span>
                );
        }
    };

    const getTypeIcon = (type, className = "w-4 h-4") => {
        if (!type) return <Bug className={`${className} text-gray-400`} />;
        if (type.includes('Sistema')) return <Monitor className={`${className} text-blue-600`} />;
        if (type.includes('Ambiente')) return <Building className={`${className} text-emerald-600`} />;
        return <Bug className={`${className} text-red-600`} />;
    };

    const getPriorityBadge = (priority) => {
        switch (priority) {
            case 'Alta': 
                return (
                    <span className="text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-md border border-red-200 inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></span>
                        Alta
                    </span>
                );
            case 'Baixa': 
                return (
                    <span className="text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200">
                        Baixa
                    </span>
                );
            case 'Normal': 
            default:
                return (
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                        Normal
                    </span>
                );
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '--';
        try {
            return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        } catch {
            return dateStr;
        }
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 h-full p-8">
                <Loader2 className="w-10 h-10 text-red-600 animate-spin mb-3" />
                <p className="text-sm font-medium text-gray-600">Carregando tarefas e relatórios...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 p-2 sm:p-4 h-full flex flex-col bg-gray-50 font-sans overflow-hidden">
            
            {/* ========================================================================= */}
            {/* CABEÇALHO COMPACTO DA PÁGINA (OTIMIZADO NO EIXO VERTICAL - REF: MEU HISTÓRICO) */}
            {/* ========================================================================= */}
            <header className="mb-2 bg-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-gray-200/90 shadow-2xs shrink-0 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 border border-red-200 flex items-center justify-center shrink-0 shadow-2xs">
                        <Lightbulb className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-sm sm:text-base font-black text-gray-900 tracking-tight">
                                Tarefas & Relatórios
                            </h1>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                {filteredReports.length} {filteredReports.length === 1 ? 'ticket' : 'tickets'}
                            </span>
                            {canViewAllReports ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 hidden sm:inline-flex items-center gap-1">
                                    <ShieldCheck className="w-3 h-3 text-purple-600" /> Visão Operacional
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hidden sm:inline-flex items-center gap-1">
                                    <User className="w-3 h-3 text-blue-600" /> Meus Chamados
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Ações do Topo: Toggle de Resumo, Alternância de Modo e Nova Solicitação */}
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    {/* Toggle do Resumo Estatístico */}
                    <button
                        type="button"
                        onClick={() => setShowSummary(prev => !prev)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200/80"
                        title={showSummary ? "Ocultar cards de resumo para focar no histórico de tickets" : "Exibir cards de resumo"}
                    >
                        {showSummary ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
                        <span className="hidden sm:inline">{showSummary ? 'Ocultar Resumo' : 'Ver Resumo'}</span>
                    </button>

                    {/* Modos de Visualização Compactos */}
                    <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                viewMode === 'table' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                            }`}
                            title="Tabela (Foco no histórico detalhado)"
                        >
                            <Table className="w-3 h-3 text-red-600" />
                            <span className="hidden sm:inline">Tabela</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('kanban')}
                            className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                viewMode === 'kanban' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                            }`}
                            title="Quadro Kanban (Por fases)"
                        >
                            <Columns3 className="w-3 h-3 text-red-600" />
                            <span className="hidden sm:inline">Kanban</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('cards')}
                            className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                viewMode === 'cards' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                            }`}
                            title="Cards"
                        >
                            <LayoutGrid className="w-3 h-3 text-red-600" />
                            <span className="hidden sm:inline">Cards</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('compact')}
                            className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                viewMode === 'compact' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-800'
                            }`}
                            title="Lista Compacta"
                        >
                            <List className="w-3 h-3 text-red-600" />
                            <span className="hidden sm:inline">Compacta</span>
                        </button>
                    </div>

                    {/* Botão Nova Solicitação */}
                    <button
                        type="button"
                        onClick={openNewReportModal}
                        className="px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white shadow-2xs"
                        title="Abrir novo chamado / solicitação crítica"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Nova Solicitação</span>
                    </button>
                </div>
            </header>

            {/* ========================================================================= */}
            {/* FAIXA RESUMO ESTATÍSTICO COMPACTO (COLAPSÁVEL - REF: MEU HISTÓRICO)       */}
            {/* ========================================================================= */}
            {showSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 mb-2 shrink-0 animate-in fade-in duration-150">
                    <button 
                        onClick={() => setStatusFilter('')}
                        className={`bg-white rounded-xl px-3 py-1.5 sm:py-2 border shadow-2xs flex items-center justify-between gap-2 min-w-0 transition-all text-left cursor-pointer ${
                            statusFilter === '' && clientImpactFilter === ''
                                ? 'border-zinc-900 bg-zinc-900 text-white ring-1 ring-zinc-900' 
                                : 'border-gray-200/90 text-gray-700 hover:border-gray-300'
                        }`}
                        title="Mostrar todas as solicitações"
                    >
                        <div className="min-w-0 flex-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider block truncate ${statusFilter === '' && clientImpactFilter === '' ? 'text-zinc-300' : 'text-gray-400'}`}>
                                Total Registrado
                            </span>
                            <span className={`text-sm sm:text-base font-black mt-0.5 block truncate leading-none ${statusFilter === '' && clientImpactFilter === '' ? 'text-white' : 'text-gray-900'}`}>
                                {metricsSummary.total}
                            </span>
                        </div>
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs ${
                            statusFilter === '' && clientImpactFilter === ''
                                ? 'bg-zinc-800 text-white border-zinc-700'
                                : 'bg-gray-50 text-gray-700 border-gray-100'
                        }`}>
                            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                    </button>

                    <button 
                        onClick={() => { setStatusFilter('Pendente'); setClientImpactFilter(''); }}
                        className={`bg-white rounded-xl px-3 py-1.5 sm:py-2 border shadow-2xs flex items-center justify-between gap-2 min-w-0 transition-all text-left cursor-pointer ${
                            statusFilter === 'Pendente' 
                                ? 'border-amber-600 bg-amber-600 text-white ring-1 ring-amber-600' 
                                : 'border-gray-200/90 text-gray-700 hover:border-amber-300'
                        }`}
                        title="Filtrar por solicitações pendentes"
                    >
                        <div className="min-w-0 flex-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider block truncate ${statusFilter === 'Pendente' ? 'text-amber-100' : 'text-amber-700'}`}>
                                Pendentes
                            </span>
                            <span className={`text-sm sm:text-base font-black mt-0.5 block truncate leading-none ${statusFilter === 'Pendente' ? 'text-white' : 'text-amber-800'}`}>
                                {metricsSummary.pending}
                            </span>
                        </div>
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs ${
                            statusFilter === 'Pendente' 
                                ? 'bg-amber-700 text-white border-amber-600' 
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                    </button>

                    <button 
                        onClick={() => { setStatusFilter('Em Andamento'); setClientImpactFilter(''); }}
                        className={`bg-white rounded-xl px-3 py-1.5 sm:py-2 border shadow-2xs flex items-center justify-between gap-2 min-w-0 transition-all text-left cursor-pointer ${
                            statusFilter === 'Em Andamento' 
                                ? 'border-blue-600 bg-blue-600 text-white ring-1 ring-blue-600' 
                                : 'border-gray-200/90 text-gray-700 hover:border-blue-300'
                        }`}
                        title="Filtrar por solicitações em andamento"
                    >
                        <div className="min-w-0 flex-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider block truncate ${statusFilter === 'Em Andamento' ? 'text-blue-100' : 'text-blue-700'}`}>
                                Em Andamento
                            </span>
                            <span className={`text-sm sm:text-base font-black mt-0.5 block truncate leading-none ${statusFilter === 'Em Andamento' ? 'text-white' : 'text-blue-800'}`}>
                                {metricsSummary.inProgress}
                            </span>
                        </div>
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs ${
                            statusFilter === 'Em Andamento' 
                                ? 'bg-blue-700 text-white border-blue-600' 
                                : 'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                    </button>

                    <button 
                        onClick={() => { setStatusFilter('Resolvido'); setClientImpactFilter(''); }}
                        className={`bg-white rounded-xl px-3 py-1.5 sm:py-2 border shadow-2xs flex items-center justify-between gap-2 min-w-0 transition-all text-left cursor-pointer ${
                            statusFilter === 'Resolvido' 
                                ? 'border-emerald-600 bg-emerald-600 text-white ring-1 ring-emerald-600' 
                                : 'border-gray-200/90 text-gray-700 hover:border-emerald-300'
                        }`}
                        title="Filtrar por solicitações resolvidas"
                    >
                        <div className="min-w-0 flex-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider block truncate ${statusFilter === 'Resolvido' ? 'text-emerald-100' : 'text-emerald-700'}`}>
                                Resolvidos
                            </span>
                            <span className={`text-sm sm:text-base font-black mt-0.5 block truncate leading-none ${statusFilter === 'Resolvido' ? 'text-white' : 'text-emerald-800'}`}>
                                {metricsSummary.resolved}
                            </span>
                        </div>
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs ${
                            statusFilter === 'Resolvido' 
                                ? 'bg-emerald-700 text-white border-emerald-600' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                            <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                    </button>

                    <button 
                        onClick={() => { setClientImpactFilter('Sim'); setStatusFilter(''); }}
                        className={`bg-white rounded-xl px-3 py-1.5 sm:py-2 border shadow-2xs flex items-center justify-between gap-2 min-w-0 transition-all text-left cursor-pointer col-span-2 sm:col-span-1 ${
                            clientImpactFilter === 'Sim' 
                                ? 'border-red-600 bg-red-600 text-white ring-1 ring-red-600' 
                                : 'border-gray-200/90 text-gray-700 hover:border-red-300'
                        }`}
                        title="Filtrar por casos que impactaram o cliente"
                    >
                        <div className="min-w-0 flex-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider block truncate ${clientImpactFilter === 'Sim' ? 'text-red-100' : 'text-red-700'}`}>
                                Afetou Cliente
                            </span>
                            <span className={`text-sm sm:text-base font-black mt-0.5 block truncate leading-none ${clientImpactFilter === 'Sim' ? 'text-white' : 'text-red-800'}`}>
                                {metricsSummary.clientImpact}
                            </span>
                        </div>
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs ${
                            clientImpactFilter === 'Sim' 
                                ? 'bg-red-700 text-white border-red-600' 
                                : 'bg-red-50 text-red-700 border-red-100'
                        }`}>
                            <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                    </button>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TOOLBAR INTEGRADA E COMPACTA (REF: MEU HISTÓRICO)                          */}
            {/* ========================================================================= */}
            <div className="bg-white p-2 sm:p-2.5 rounded-xl border border-gray-200 shadow-2xs mb-2 shrink-0">
                <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center justify-between">
                    
                    {/* Campo de Busca Compacto */}
                    <div className="flex-1 relative min-w-[200px]">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input 
                            type="text" 
                            placeholder="Buscar por título, descrição, protocolo, autor ou resposta..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-8 pr-7 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:ring-1 focus:ring-red-500 outline-none transition-all bg-gray-50/50 focus:bg-white"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')} 
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                                title="Limpar busca"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filtros Dropdowns Compactos */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 bg-white focus:ring-1 focus:ring-red-500 outline-none cursor-pointer"
                        >
                            <option value="">Status: Todos</option>
                            <option value="Pendente">Pendente</option>
                            <option value="Em Andamento">Em Andamento</option>
                            <option value="Resolvido">Resolvido</option>
                            <option value="Cancelado">Cancelado</option>
                        </select>

                        <select 
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 bg-white focus:ring-1 focus:ring-red-500 outline-none cursor-pointer"
                        >
                            <option value="">Tipo: Todos</option>
                            <option value="Análise de Erro">Análise de Erro</option>
                            <option value="Melhoria de Sistema">Melhoria Sistema</option>
                            <option value="Melhoria de Ambiente">Melhoria Ambiente</option>
                        </select>

                        <select 
                            value={priorityFilter}
                            onChange={(e) => setPriorityFilter(e.target.value)}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 bg-white focus:ring-1 focus:ring-red-500 outline-none cursor-pointer"
                        >
                            <option value="">Prioridade: Todas</option>
                            <option value="Alta">Alta</option>
                            <option value="Normal">Normal</option>
                            <option value="Baixa">Baixa</option>
                        </select>

                        <select 
                            value={clientImpactFilter}
                            onChange={(e) => setClientImpactFilter(e.target.value)}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 bg-white focus:ring-1 focus:ring-red-500 outline-none cursor-pointer"
                        >
                            <option value="">Impacto: Todos</option>
                            <option value="Sim">Afetou Cliente</option>
                            <option value="Não">Interno</option>
                        </select>

                        {canViewAllReports && (
                            <select 
                                value={creatorFilter}
                                onChange={(e) => setCreatorFilter(e.target.value)}
                                className="px-2 py-1.5 border border-purple-200 rounded-lg text-xs font-medium text-purple-900 bg-purple-50/50 focus:ring-1 focus:ring-purple-500 outline-none cursor-pointer max-w-[150px] truncate"
                            >
                                <option value="">Solicitante: Todos ({uniqueCreators.length})</option>
                                {uniqueCreators.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        )}

                        {hasActiveFilters && (
                            <button 
                                onClick={clearAllFilters}
                                className="px-2 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                title="Limpar todos os filtros ativos"
                            >
                                <RotateCcw className="w-3 h-3" />
                                <span className="hidden sm:inline">Limpar</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* CONTAINER DEDICADO AO HISTÓRICO DE TICKETS (FOCO TOTAL NA VISUALIZAÇÃO)     */}
            {/* ========================================================================= */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">

            {/* ========================================== */}
            {/* CONTEÚDO PRINCIPAL (BASEADO NO VIEW MODE)  */}
            {/* ========================================== */}
            {filteredReports.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center flex flex-col items-center justify-center flex-1">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center mb-4 text-gray-400">
                        <Lightbulb className="w-8 h-8 opacity-40" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">Nenhuma solicitação encontrada</h3>
                    <p className="text-sm text-gray-500 max-w-md mt-1 mb-6">
                        {hasActiveFilters 
                            ? "Nenhum ticket corresponde aos filtros selecionados. Tente ajustar os termos de busca ou limpar os filtros."
                            : "Você ainda não possui solicitações registradas. Clique no botão abaixo para lançar sua primeira demanda."}
                    </p>
                    {hasActiveFilters ? (
                        <button 
                            onClick={clearAllFilters}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-lg transition-colors cursor-pointer"
                        >
                            Limpar Filtros Ativos
                        </button>
                    ) : (
                        <button 
                            onClick={openNewReportModal}
                            className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                        >
                            <Plus className="w-4 h-4" /> Nova Solicitação
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {/* -------------------------------------- */}
                    {/* MODO 1: TABELA DETALHADA               */}
                    {/* -------------------------------------- */}
                    {viewMode === 'table' && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden flex-1 min-h-0 flex flex-col">
                            <div className="overflow-x-auto overflow-y-auto flex-1">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-zinc-950 text-white sticky top-0 z-10">
                                        <tr>
                                            <th className="px-5 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Ticket</th>
                                            <th className="px-5 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Data</th>
                                            <th className="px-5 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Status</th>
                                            <th className="px-5 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Tipo</th>
                                            <th className="px-5 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Resumo & Prioridade</th>
                                            <th className="px-5 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Solicitante</th>
                                            <th className="px-5 py-3.5 text-center font-bold text-xs uppercase tracking-wider">Impacto</th>
                                            <th className="px-5 py-3.5 text-right font-bold text-xs uppercase tracking-wider">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {filteredReports.map((report) => (
                                            <tr key={report.id} className="hover:bg-gray-50/80 transition-colors group">
                                                <td className="px-5 py-4 whitespace-nowrap font-mono text-xs font-bold text-gray-500">
                                                    #{report.id.slice(0, 6).toUpperCase()}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-600 font-medium">
                                                    {formatDate(report.date)}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    {getStatusBadge(report.status)}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2 font-medium text-xs text-gray-800">
                                                        {getTypeIcon(report.type)}
                                                        <span>{report.type || 'Análise de Erro'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    <div className="flex flex-col gap-1 max-w-[320px]">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-gray-900 text-sm truncate" title={getDisplayTitle(report)}>
                                                                {getDisplayTitle(report)}
                                                            </span>
                                                            {getPriorityBadge(report.priority)}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {report.protocol && (
                                                                <span className="text-[11px] text-gray-400 font-mono">
                                                                    Prot: {report.protocol}
                                                                </span>
                                                            )}
                                                            {Array.isArray(report.comments) && report.comments.length > 0 && (
                                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200" title={`${report.comments.length} comentários registrados`}>
                                                                    <MessageSquare className="w-2.5 h-2.5" />
                                                                    {report.comments.length}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-700">
                                                            {(report.creatorName || 'U').charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="text-xs font-medium text-gray-700">
                                                            {report.creatorName || 'Desconhecido'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-center">
                                                    {report.affectedClient === 'Sim' ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-50 text-red-700 border border-red-200" title={report.howAffected}>
                                                            <AlertTriangle className="w-3 h-3" /> Sim
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-gray-400">Não</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 whitespace-nowrap text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button 
                                                            onClick={() => handleOpenViewModal(report)} 
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors border border-transparent hover:border-blue-200 cursor-pointer" 
                                                            title="Ver Detalhes e Andamento"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        {canEditOrDelete(report) && (
                                                            <>
                                                                <button 
                                                                    onClick={() => openEditModal(report)} 
                                                                    className="p-1.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700 rounded-lg transition-colors border border-transparent hover:border-amber-200 cursor-pointer" 
                                                                    title="Editar Solicitação"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                                <button 
                                                                    onClick={() => setDeletingReport(report)} 
                                                                    className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors border border-transparent hover:border-red-200 cursor-pointer" 
                                                                    title="Excluir"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* -------------------------------------- */}
                    {/* MODO 2: QUADRO KANBAN POR STATUS       */}
                    {/* -------------------------------------- */}
                    {viewMode === 'kanban' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 min-h-0 overflow-y-auto">
                            {[
                                { status: 'Pendente', title: 'Triagem / Pendentes', color: 'border-amber-300 bg-amber-50/40 text-amber-900', badge: 'bg-amber-100 text-amber-800' },
                                { status: 'Em Andamento', title: 'Em Andamento', color: 'border-blue-300 bg-blue-50/40 text-blue-900', badge: 'bg-blue-100 text-blue-800' },
                                { status: 'Resolvido', title: 'Concluídos / Resolvidos', color: 'border-emerald-300 bg-emerald-50/40 text-emerald-900', badge: 'bg-emerald-100 text-emerald-800' },
                                { status: 'Cancelado', title: 'Recusados / Cancelados', color: 'border-gray-300 bg-gray-50/60 text-gray-800', badge: 'bg-gray-200 text-gray-700' }
                            ].map(col => {
                                const colReports = filteredReports.filter(r => {
                                    if (col.status === 'Pendente') return r.status === 'Pendente' || !r.status;
                                    if (col.status === 'Resolvido') return r.status === 'Resolvido' || r.status === 'Concluído';
                                    if (col.status === 'Cancelado') return r.status === 'Cancelado' || r.status === 'Recusado';
                                    return r.status === col.status;
                                });

                                return (
                                    <div key={col.status} className={`rounded-xl border flex flex-col max-h-[75vh] ${col.color} shadow-2xs`}>
                                        <div className="p-3.5 border-b border-gray-200/80 flex items-center justify-between bg-white/70 rounded-t-xl">
                                            <h4 className="font-bold text-xs uppercase tracking-wider">{col.title}</h4>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-black ${col.badge}`}>
                                                {colReports.length}
                                            </span>
                                        </div>

                                        <div className="p-3 overflow-y-auto space-y-3 flex-1">
                                            {colReports.length === 0 ? (
                                                <div className="text-center py-8 text-gray-400 text-xs font-medium">
                                                    Nenhum chamado nesta fase
                                                </div>
                                            ) : (
                                                colReports.map(report => (
                                                    <div 
                                                        key={report.id}
                                                        onClick={() => handleOpenViewModal(report)}
                                                        className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs hover:shadow-md hover:border-gray-300 transition-all cursor-pointer space-y-2.5"
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-center gap-1.5">
                                                                {getTypeIcon(report.type, "w-3.5 h-3.5")}
                                                                <span className="text-[11px] font-bold text-gray-600 truncate max-w-[120px]">
                                                                    {report.type || 'Análise de Erro'}
                                                                </span>
                                                            </div>
                                                            {getPriorityBadge(report.priority)}
                                                        </div>

                                                        <h5 className="font-bold text-gray-900 text-sm line-clamp-2 leading-snug">
                                                            {getDisplayTitle(report)}
                                                        </h5>

                                                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                                            {report.description}
                                                        </p>

                                                        {report.affectedClient === 'Sim' && (
                                                            <div className="px-2 py-1 bg-red-50 text-red-700 border border-red-100 rounded-md text-[10px] font-bold flex items-center gap-1">
                                                                <AlertTriangle className="w-3 h-3 text-red-600" /> Afetou Atendimento
                                                            </div>
                                                        )}

                                                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                                                            <span className="font-mono text-gray-400">#{report.id.slice(0, 5).toUpperCase()}</span>
                                                            <span className="font-medium text-gray-600 truncate max-w-[100px]">{report.creatorName || 'Autor'}</span>
                                                            <span>{formatDate(report.date)}</span>
                                                        </div>

                                                        {Array.isArray(report.comments) && report.comments.length > 0 ? (
                                                            <div className="flex items-center gap-1.5 text-[11px] text-blue-700 font-bold bg-blue-50/90 p-1.5 rounded-md border border-blue-200">
                                                                <MessageSquare className="w-3 h-3 text-blue-600" />
                                                                <span>{report.comments.length} {report.comments.length === 1 ? 'interação' : 'interações'}</span>
                                                            </div>
                                                        ) : (report.adminComment || report.closingComment) ? (
                                                            <div className="flex items-center gap-1 text-[11px] text-blue-600 font-bold bg-blue-50/70 p-1.5 rounded-md">
                                                                <MessageSquare className="w-3 h-3" /> Resposta da Gestão registrada
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* -------------------------------------- */}
                    {/* MODO 3: GRADE DE CARTÕES (BENTO GRID)  */}
                    {/* -------------------------------------- */}
                    {viewMode === 'cards' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 flex-1 min-h-0 overflow-y-auto pr-1">
                            {filteredReports.map((report) => (
                                <div 
                                    key={report.id}
                                    className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs hover:shadow-md hover:border-gray-300 transition-all flex flex-col justify-between space-y-4"
                                >
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-gray-100 rounded-lg">
                                                    {getTypeIcon(report.type)}
                                                </div>
                                                <span className="text-xs font-bold text-gray-700">
                                                    {report.type || 'Análise de Erro'}
                                                </span>
                                            </div>
                                            {getStatusBadge(report.status)}
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-mono text-[11px] text-gray-400 font-bold">
                                                    #{report.id.slice(0, 6).toUpperCase()}
                                                </span>
                                                {getPriorityBadge(report.priority)}
                                            </div>
                                            <h4 className="text-base font-bold text-gray-900 line-clamp-2 leading-snug">
                                                {getDisplayTitle(report)}
                                            </h4>
                                        </div>

                                        <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                                            {report.description || 'Sem descrição informada.'}
                                        </p>

                                        {report.affectedClient === 'Sim' && (
                                            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start gap-2">
                                                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                                <div className="line-clamp-2">
                                                    <strong className="block font-bold">Impactou Cliente:</strong>
                                                    {report.howAffected || 'Sem detalhes informados'}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                                        <div className="text-xs text-gray-500">
                                            <span className="block font-bold text-gray-700">{report.creatorName || 'Desconhecido'}</span>
                                            <span>{formatDate(report.date)}</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {Array.isArray(report.comments) && report.comments.length > 0 && (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200" title={`${report.comments.length} comentários`}>
                                                    <MessageSquare className="w-3 h-3 text-blue-600" />
                                                    <span>{report.comments.length}</span>
                                                </span>
                                            )}
                                            <button 
                                                onClick={() => handleOpenViewModal(report)} 
                                                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                            >
                                                <Eye className="w-3.5 h-3.5" /> Detalhes
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* -------------------------------------- */}
                    {/* MODO 4: LISTA COMPACTA (ALTA DENSIDADE) */}
                    {/* -------------------------------------- */}
                    {viewMode === 'compact' && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden flex-1 min-h-0 flex flex-col">
                            <div className="divide-y divide-gray-200 overflow-y-auto flex-1">
                                {filteredReports.map((report) => (
                                    <div 
                                        key={report.id}
                                        onClick={() => handleOpenViewModal(report)}
                                        className="p-3 hover:bg-gray-50 transition-colors flex items-center justify-between gap-4 cursor-pointer text-xs"
                                    >
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <span className="font-mono text-gray-400 font-bold w-16 shrink-0">
                                                #{report.id.slice(0, 6).toUpperCase()}
                                            </span>
                                            <span className="text-gray-500 w-24 shrink-0 font-medium">
                                                {formatDate(report.date)}
                                            </span>
                                            <div className="w-28 shrink-0">
                                                {getStatusBadge(report.status)}
                                            </div>
                                            <div className="w-20 shrink-0">
                                                {getPriorityBadge(report.priority)}
                                            </div>
                                            <span className="font-bold text-gray-900 truncate flex-1">
                                                {getDisplayTitle(report)}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-3 shrink-0">
                                            {Array.isArray(report.comments) && report.comments.length > 0 && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                                    <MessageSquare className="w-2.5 h-2.5" />
                                                    {report.comments.length}
                                                </span>
                                            )}
                                            <span className="text-gray-600 font-medium hidden sm:inline">
                                                {report.creatorName || 'Autor'}
                                            </span>
                                            <button className="p-1 text-gray-400 hover:text-blue-600">
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
            </div>

            {/* ========================================================================= */}
            {/* MODAL DE CRIAÇÃO / EDIÇÃO DE SOLICITAÇÃO                                 */}
            {/* ========================================================================= */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[80] backdrop-blur-xs">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 bg-zinc-950 text-white flex justify-between items-center shrink-0">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Lightbulb className="w-5 h-5 text-red-500" />
                                {editingId ? 'Editar Detalhes da Solicitação' : 'Nova Solicitação / Ocorrência'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer">
                                <X className="w-5 h-5 text-gray-400 hover:text-white" />
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                            <form id="reportForm" onSubmit={handleSubmit} className="space-y-6">
                                
                                {/* 1. TIPO DE REGISTRO */}
                                <div className="space-y-3">
                                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-1.5">
                                        1. Categoria da Demanda
                                    </h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center text-center transition-all ${formData.type === 'Análise de Erro' ? 'border-red-500 bg-red-50/50 shadow-xs' : 'border-gray-200 bg-white hover:border-red-200'}`}>
                                            <input type="radio" name="type" value="Análise de Erro" checked={formData.type === 'Análise de Erro'} onChange={(e) => setFormData({...formData, type: e.target.value})} className="hidden" />
                                            <Bug className={`w-7 h-7 mb-2 ${formData.type === 'Análise de Erro' ? 'text-red-600' : 'text-gray-400'}`} />
                                            <span className={`font-bold text-sm ${formData.type === 'Análise de Erro' ? 'text-red-900' : 'text-gray-700'}`}>Análise de Erro</span>
                                            <span className="text-[11px] text-gray-500 mt-1">Falhas operacionais, bug ou problema em ferramenta</span>
                                        </label>

                                        <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center text-center transition-all ${formData.type === 'Melhoria de Sistema' ? 'border-blue-500 bg-blue-50/50 shadow-xs' : 'border-gray-200 bg-white hover:border-blue-200'}`}>
                                            <input type="radio" name="type" value="Melhoria de Sistema" checked={formData.type === 'Melhoria de Sistema'} onChange={(e) => setFormData({...formData, type: e.target.value})} className="hidden" />
                                            <Monitor className={`w-7 h-7 mb-2 ${formData.type === 'Melhoria de Sistema' ? 'text-blue-600' : 'text-gray-400'}`} />
                                            <span className={`font-bold text-sm ${formData.type === 'Melhoria de Sistema' ? 'text-blue-900' : 'text-gray-700'}`}>Melhoria de Sistema</span>
                                            <span className="text-[11px] text-gray-500 mt-1">Sugestões de novos recursos ou ajustes de fluxo</span>
                                        </label>

                                        <label className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center text-center transition-all ${formData.type === 'Melhoria de Ambiente' ? 'border-emerald-500 bg-emerald-50/50 shadow-xs' : 'border-gray-200 bg-white hover:border-emerald-200'}`}>
                                            <input type="radio" name="type" value="Melhoria de Ambiente" checked={formData.type === 'Melhoria de Ambiente'} onChange={(e) => setFormData({...formData, type: e.target.value})} className="hidden" />
                                            <Building className={`w-7 h-7 mb-2 ${formData.type === 'Melhoria de Ambiente' ? 'text-emerald-600' : 'text-gray-400'}`} />
                                            <span className={`font-bold text-sm ${formData.type === 'Melhoria de Ambiente' ? 'text-emerald-900' : 'text-gray-700'}`}>Melhoria de Ambiente</span>
                                            <span className="text-[11px] text-gray-500 mt-1">Infraestrutura física, cadeiras, equipamentos</span>
                                        </label>
                                    </div>

                                    <div className="pt-2">
                                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nível de Urgência (Prioridade)</label>
                                        <div className="flex bg-white border border-gray-200 rounded-xl p-1 w-max">
                                            <label className={`cursor-pointer px-4 py-2 text-xs font-bold rounded-lg transition-all ${formData.priority === 'Baixa' ? 'bg-gray-200 text-gray-800' : 'text-gray-500 hover:bg-gray-50'}`}>
                                                <input type="radio" name="priority" value="Baixa" checked={formData.priority === 'Baixa'} onChange={(e) => setFormData({...formData, priority: e.target.value})} className="hidden" />
                                                Baixa
                                            </label>
                                            <label className={`cursor-pointer px-4 py-2 text-xs font-bold rounded-lg transition-all ${formData.priority === 'Normal' ? 'bg-amber-100 text-amber-800 shadow-2xs' : 'text-gray-500 hover:bg-amber-50'}`}>
                                                <input type="radio" name="priority" value="Normal" checked={formData.priority === 'Normal'} onChange={(e) => setFormData({...formData, priority: e.target.value})} className="hidden" />
                                                Normal
                                            </label>
                                            <label className={`cursor-pointer px-4 py-2 text-xs font-bold rounded-lg transition-all ${formData.priority === 'Alta' ? 'bg-red-600 text-white shadow-2xs' : 'text-gray-500 hover:bg-red-50'}`}>
                                                <input type="radio" name="priority" value="Alta" checked={formData.priority === 'Alta'} onChange={(e) => setFormData({...formData, priority: e.target.value})} className="hidden" />
                                                Alta Urgência
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* 2. CONTEXTO E DETALHES */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-1.5">
                                        2. Detalhes da Solicitação
                                    </h4>
                                    
                                    <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                                Título Resumido da Solicitação
                                            </label>
                                            <input 
                                                type="text" 
                                                required
                                                placeholder="Ex: Erro ao gerar espelho de atendimento no sistema X..." 
                                                value={formData.title} 
                                                onChange={(e) => setFormData({...formData, title: e.target.value})} 
                                                className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none font-bold text-gray-900 text-sm" 
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                                Descrição Completa da Ocorrência
                                            </label>
                                            <textarea 
                                                required 
                                                rows="4" 
                                                placeholder="Descreva o que ocorreu, passo a passo para reproduzir ou o que é necessário para solucionar..." 
                                                value={formData.description} 
                                                onChange={(e) => setFormData({...formData, description: e.target.value})} 
                                                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm text-gray-800 resize-none leading-relaxed" 
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Data da Observação</label>
                                                <input 
                                                    type="date" 
                                                    required 
                                                    value={formData.date} 
                                                    onChange={(e) => setFormData({...formData, date: e.target.value})} 
                                                    className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm text-gray-800" 
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                                    Protocolo Vinculado <span className="font-normal text-gray-400">(Opcional)</span>
                                                </label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Ex: #TK-98421" 
                                                    value={formData.protocol} 
                                                    onChange={(e) => setFormData({...formData, protocol: e.target.value})} 
                                                    className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-mono text-gray-800" 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 3. IMPACTO OPERACIONAL / CLIENTE */}
                                {formData.type === 'Análise de Erro' && (
                                    <div className="space-y-4">
                                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-1.5">
                                            3. Impacto Operacional no Cliente
                                        </h4>
                                        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-2xs space-y-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                                                    A ocorrência afetou a experiência do cliente?
                                                </label>
                                                <select 
                                                    required 
                                                    value={formData.affectedClient} 
                                                    onChange={(e) => setFormData({...formData, affectedClient: e.target.value})} 
                                                    className="w-full sm:w-64 p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none text-sm font-medium"
                                                >
                                                    <option value="Não">Não (Erro interno / Processo)</option>
                                                    <option value="Sim">Sim (Cliente foi impactado diretamente)</option>
                                                </select>
                                            </div>

                                            {formData.affectedClient === 'Sim' && (
                                                <div className="bg-red-50 p-4 rounded-xl border border-red-200 space-y-2 animate-in fade-in slide-in-from-top-2">
                                                    <label className="block text-xs font-bold text-red-900 uppercase tracking-wider">
                                                        Como afetou o cliente?
                                                    </label>
                                                    <textarea 
                                                        required 
                                                        rows="3" 
                                                        placeholder="Descreva o impacto percebido pelo cliente (ex: atraso na resposta, cobrança indevida, queda de ligação)..." 
                                                        value={formData.howAffected} 
                                                        onChange={(e) => setFormData({...formData, howAffected: e.target.value})} 
                                                        className="w-full p-2.5 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-600 outline-none bg-white text-sm text-gray-800" 
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* 4. STATUS & SOLUÇÃO DA LIDERANÇA (RESTRIÇÃO DE PERMISSÕES) */}
                                {editingId && !canManageTickets && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-200 pb-1.5 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5 text-gray-800">
                                                <Lock className="w-3.5 h-3.5 text-amber-600" />
                                                4. Status & Solução da Liderança
                                            </span>
                                            <span className="text-[10px] text-amber-800 font-bold bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300 inline-flex items-center gap-1">
                                                <Lock className="w-3 h-3" /> Apenas Leitura (Gestores / Supervisores)
                                            </span>
                                        </h4>

                                        <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 space-y-3">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-amber-200/60">
                                                <div>
                                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                                                        Status Atual Definido pela Gestão
                                                    </span>
                                                    {getStatusBadge(formData.status)}
                                                </div>
                                                <div className="text-[11px] text-amber-900/80 max-w-sm leading-relaxed bg-white/70 p-2.5 rounded-lg border border-amber-200">
                                                    <strong>Aviso de Permissão:</strong> Você pode editar os dados do seu relato acima (categoria, urgência, título, descrição e impacto). O status e a solução são definidos exclusivamente pela liderança.
                                                </div>
                                            </div>

                                            <div>
                                                <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block mb-1">
                                                    Parecer Oficial / Solução Registrada pela Liderança:
                                                </span>
                                                <div className="bg-white p-3.5 rounded-xl border border-amber-200 text-xs text-gray-800 leading-relaxed font-normal whitespace-pre-wrap">
                                                    {formData.adminComment || reports.find(r => r.id === editingId)?.solution || reports.find(r => r.id === editingId)?.closingComment || (
                                                        <span className="text-gray-400 italic">
                                                            Nenhuma solução ou parecer registrado pela liderança até o momento. Sua solicitação está na fila de atendimento.
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {editingId && canManageTickets && (
                                    <div className="space-y-3">
                                        <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider border-b border-blue-200 pb-1.5 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <ShieldCheck className="w-4 h-4 text-blue-600" />
                                                4. Status & Solução da Liderança (Modo Gestor/Supervisor)
                                            </span>
                                            <span className="text-[10px] text-blue-800 font-bold bg-blue-100 px-2 py-0.5 rounded border border-blue-300">
                                                Edição Liberada
                                            </span>
                                        </h4>

                                        <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-200 space-y-3">
                                            <div>
                                                <label className="block text-xs font-bold text-blue-950 uppercase tracking-wider mb-1">
                                                    Status do Chamado
                                                </label>
                                                <select 
                                                    value={formData.status} 
                                                    onChange={(e) => setFormData({...formData, status: e.target.value})} 
                                                    className="w-full sm:w-72 p-2.5 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white font-bold text-blue-950 text-sm cursor-pointer shadow-2xs"
                                                >
                                                    <option value="Pendente">Pendente</option>
                                                    <option value="Em Andamento">Em Andamento</option>
                                                    <option value="Resolvido">Resolvido</option>
                                                    <option value="Cancelado">Cancelado</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-blue-950 uppercase tracking-wider mb-1">
                                                    Parecer Oficial / Solução Técnica
                                                </label>
                                                <textarea 
                                                    rows="3" 
                                                    placeholder="Descreva a solução aplicada, instruções ao colaborador ou motivo do encerramento..." 
                                                    value={formData.adminComment || ''} 
                                                    onChange={(e) => setFormData({...formData, adminComment: e.target.value})} 
                                                    className="w-full p-2.5 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-xs text-gray-800 resize-none leading-relaxed" 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </form>
                        </div>
                        
                        <div className="p-4 bg-white border-t border-gray-200 flex gap-3 shrink-0">
                            <button 
                                type="button" 
                                onClick={() => setIsModalOpen(false)} 
                                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-bold text-sm transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                form="reportForm" 
                                disabled={saving} 
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-70 flex justify-center items-center gap-2 shadow-sm cursor-pointer"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                Salvar Solicitação
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL DE VISUALIZAÇÃO EVOLUÍDO E COMPLETO                                */}
            {/* ========================================================================= */}
            {viewingReport && (
                <div className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-3 sm:p-6 z-[80] backdrop-blur-xs">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl xl:max-w-6xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
                        
                        {/* CABEÇALHO DO MODAL */}
                        <div className="p-5 bg-zinc-950 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0 border-b border-zinc-800">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-3 bg-zinc-900 rounded-xl border border-zinc-800 text-red-500">
                                    {getTypeIcon(viewingReport.type, "w-6 h-6")}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="px-2.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-xs font-bold">
                                            #{viewingReport.id.slice(0, 8).toUpperCase()}
                                        </span>
                                        <span className="text-xs text-zinc-400 font-medium">
                                            {viewingReport.type || 'Análise de Erro'}
                                        </span>
                                        {getPriorityBadge(viewingReport.priority || 'Normal')}
                                    </div>
                                    <h3 className="text-lg font-bold text-white leading-tight truncate max-w-xl" title={getDisplayTitle(viewingReport)}>
                                        {getDisplayTitle(viewingReport)}
                                    </h3>
                                </div>
                            </div>

                            {/* Controles de Navegação e Fechar */}
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                <div className="flex items-center bg-zinc-900 rounded-lg border border-zinc-800 p-0.5">
                                    <button 
                                        onClick={() => navigateReport('prev')}
                                        disabled={!hasPrevReport}
                                        className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors cursor-pointer"
                                        title="Solicitação Anterior"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-[11px] font-mono text-zinc-500 px-2">
                                        {currentViewingIndex + 1}/{filteredReports.length}
                                    </span>
                                    <button 
                                        onClick={() => navigateReport('next')}
                                        disabled={!hasNextReport}
                                        className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors cursor-pointer"
                                        title="Próxima Solicitação"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                                <button 
                                    onClick={() => setViewingReport(null)} 
                                    className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* LINHA DO TEMPO / STEPPER DE STATUS */}
                        <div className="bg-gray-100/70 border-b border-gray-200 px-6 py-3 shrink-0">
                            <div className="flex items-center justify-between max-w-3xl mx-auto text-xs font-bold">
                                
                                {/* Passo 1: Registrado */}
                                <div className="flex items-center gap-2 text-emerald-700">
                                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                                        ✓
                                    </div>
                                    <span>1. Registrado</span>
                                </div>

                                <div className={`flex-1 h-0.5 mx-3 ${
                                    viewingReport.status === 'Em Andamento' || viewingReport.status === 'Resolvido' || viewingReport.status === 'Concluído'
                                        ? 'bg-blue-600' : 'bg-gray-300'
                                }`} />

                                {/* Passo 2: Em Andamento */}
                                <div className={`flex items-center gap-2 ${
                                    viewingReport.status === 'Em Andamento' 
                                        ? 'text-blue-700 font-extrabold' 
                                        : (viewingReport.status === 'Resolvido' || viewingReport.status === 'Concluído' ? 'text-emerald-700' : 'text-gray-400')
                                }`}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                                        viewingReport.status === 'Em Andamento' 
                                            ? 'bg-blue-600 text-white' 
                                            : (viewingReport.status === 'Resolvido' || viewingReport.status === 'Concluído' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500')
                                    }`}>
                                        2
                                    </div>
                                    <span>2. Em Análise</span>
                                </div>

                                <div className={`flex-1 h-0.5 mx-3 ${
                                    viewingReport.status === 'Resolvido' || viewingReport.status === 'Concluído'
                                        ? 'bg-emerald-600' : 'bg-gray-300'
                                }`} />

                                {/* Passo 3: Finalizado */}
                                <div className={`flex items-center gap-2 ${
                                    viewingReport.status === 'Resolvido' || viewingReport.status === 'Concluído'
                                        ? 'text-emerald-700 font-extrabold' 
                                        : (viewingReport.status === 'Cancelado' || viewingReport.status === 'Recusado' ? 'text-gray-700' : 'text-gray-400')
                                }`}>
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${
                                        viewingReport.status === 'Resolvido' || viewingReport.status === 'Concluído'
                                            ? 'bg-emerald-600 text-white' 
                                            : (viewingReport.status === 'Cancelado' || viewingReport.status === 'Recusado' ? 'bg-gray-600 text-white' : 'bg-gray-200 text-gray-500')
                                    }`}>
                                        3
                                    </div>
                                    <span>
                                        {viewingReport.status === 'Cancelado' || viewingReport.status === 'Recusado' ? '3. Encerrado' : '3. Resolvido'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        {/* CORPO DO MODAL */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-gray-50">
                            
                            {/* ========================================================================= */}
                            {/* PARTE DE CIMA: VISUALIZAÇÃO ESTENDIDA DOS DADOS DO TICKET                 */}
                            {/* ========================================================================= */}
                            <div className="space-y-4">
                                {/* Painel de Metadados e Solicitante Estendido */}
                                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4 border-b border-gray-100">
                                        <div>
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status Atual</span>
                                            {getStatusBadge(viewingReport.status)}
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Prioridade</span>
                                            {getPriorityBadge(viewingReport.priority || 'Normal')}
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Data Ocorrência</span>
                                            <span className="text-xs font-bold text-gray-900 block mt-0.5">
                                                {formatDate(viewingReport.date)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Protocolo</span>
                                            <span className="text-xs font-mono font-bold text-gray-700 block mt-0.5">
                                                {viewingReport.protocol || 'Nenhum'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Solicitante e Data de Criação */}
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-0.5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 font-bold flex items-center justify-center text-sm border border-red-200 shrink-0">
                                                {(viewingReport.creatorName || 'U').charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-gray-900 block">
                                                    {viewingReport.creatorName || 'Desconhecido'}
                                                </span>
                                                <span className="text-[11px] text-gray-500">
                                                    Solicitante / Analista responsável pelo registro
                                                </span>
                                            </div>
                                        </div>

                                        {viewingReport.createdAt?.toDate && (
                                            <span className="text-[11px] text-gray-400 font-medium">
                                                Registrado em: {viewingReport.createdAt.toDate().toLocaleString('pt-BR')}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Descrição Completa Estendida */}
                                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                                            Descrição Completa da Demanda
                                        </span>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(viewingReport.description || '');
                                                showToast("Descrição copiada!", "success");
                                            }}
                                            className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                            <Copy className="w-3.5 h-3.5" /> Copiar texto
                                        </button>
                                    </div>
                                    <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 p-4 rounded-xl border border-gray-100 leading-relaxed font-normal">
                                        {viewingReport.description || 'Sem descrição informada.'}
                                    </p>
                                </div>

                                {/* Alerta de Impacto no Cliente (se houver) */}
                                {viewingReport.affectedClient === 'Sim' && (
                                    <div className="p-4 rounded-2xl bg-red-50 border border-red-200 shadow-2xs space-y-1.5">
                                        <div className="flex items-center gap-2 text-red-800 font-black text-xs uppercase tracking-wider">
                                            <AlertOctagon className="w-4 h-4 text-red-600" />
                                            Impacto Identificado no Atendimento ao Cliente
                                        </div>
                                        <p className="text-xs text-red-900 leading-relaxed bg-white/80 p-3 rounded-xl border border-red-200/60 font-medium">
                                            {viewingReport.howAffected || 'Impacto confirmado, porém sem descrição adicional.'}
                                        </p>
                                    </div>
                                )}

                                {/* Ações Rápidas no Rodapé da Solicitação Estendida */}
                                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleCopyReportSummary(viewingReport)}
                                            className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-200 text-gray-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                        >
                                            {copiedText ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                            Copiar Resumo Formatado
                                        </button>
                                    </div>

                                    {canEditOrDelete(viewingReport) && (
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => {
                                                    const rep = viewingReport;
                                                    setViewingReport(null);
                                                    openEditModal(rep);
                                                }}
                                                className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" /> Editar Solicitação
                                            </button>
                                            <button 
                                                onClick={() => setDeletingReport(viewingReport)}
                                                className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" /> Excluir
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ========================================================================= */}
                            {/* PARTE DE BAIXO: LADO A LADO - COMENTÁRIOS E DESPACHO / GESTÃO              */}
                            {/* ========================================================================= */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start pt-1">
                                
                                {/* LADO ESQUERDO: INTERAÇÕES & COMENTÁRIOS DO CHAMADO */}
                                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4 flex flex-col">
                                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100">
                                                <MessageSquare className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                                    Interações & Comentários
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                                                        {Array.isArray(viewingReport.comments) ? viewingReport.comments.length : 0}
                                                    </span>
                                                </h4>
                                                <p className="text-[11px] text-gray-400">
                                                    Canal direto de comunicação entre o solicitante e a liderança
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Parecer / Solução Histórica Legada (se existir adminComment fora do array de comentários) */}
                                    {(viewingReport.adminComment || viewingReport.closingComment || viewingReport.solution) && (!Array.isArray(viewingReport.comments) || !viewingReport.comments.some(c => c.content?.includes(viewingReport.adminComment || viewingReport.closingComment || viewingReport.solution))) && (
                                        <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200/80 text-xs text-blue-950 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-[11px] text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                                                    Posicionamento / Resolução Registrada:
                                                </span>
                                                {viewingReport.lastUpdatedBy && (
                                                    <span className="text-[10px] text-blue-600 font-medium">
                                                        Por: {viewingReport.lastUpdatedBy}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="whitespace-pre-wrap leading-relaxed">
                                                {viewingReport.adminComment || viewingReport.closingComment || viewingReport.solution}
                                            </p>
                                        </div>
                                    )}

                                    {/* Lista de Comentários / Timeline */}
                                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                                        {Array.isArray(viewingReport.comments) && viewingReport.comments.length > 0 ? (
                                            viewingReport.comments.map((comment, idx) => {
                                                const isAuthor = comment.authorId === (currentUser?.firestoreId || currentUser?.uid);
                                                const isTicketCreator = comment.authorId === viewingReport.creatorId;
                                                const isLeader = comment.isStaff || (comment.authorRole && ['gestor', 'supervisor', 'admin', 'gerente', 'coordenador'].some(r => String(comment.authorRole).toLowerCase().includes(r)));

                                                return (
                                                    <div 
                                                        key={comment.id || idx}
                                                        className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                                                            isLeader 
                                                                ? 'bg-blue-50/50 border-blue-200/80' 
                                                                : isTicketCreator
                                                                    ? 'bg-amber-50/40 border-amber-200/70'
                                                                    : 'bg-gray-50 border-gray-200'
                                                        }`}
                                                    >
                                                        {/* Avatar com inicial */}
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${
                                                            isLeader 
                                                                ? 'bg-blue-600 text-white border-blue-700' 
                                                                : isTicketCreator
                                                                    ? 'bg-amber-500 text-white border-amber-600'
                                                                    : 'bg-gray-700 text-white border-gray-800'
                                                        }`}>
                                                            {(comment.authorName || 'U').charAt(0).toUpperCase()}
                                                        </div>

                                                        {/* Conteúdo da Mensagem */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    <span className="text-xs font-bold text-gray-900">
                                                                        {comment.authorName}
                                                                    </span>
                                                                    {isAuthor && (
                                                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-zinc-200/80 text-zinc-800">
                                                                            Você
                                                                        </span>
                                                                    )}
                                                                    {isLeader ? (
                                                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                                                            {comment.authorRole || 'Liderança / Gestão'}
                                                                        </span>
                                                                    ) : isTicketCreator ? (
                                                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                                            Autor do Chamado
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-gray-200 text-gray-700">
                                                                            {comment.authorRole || 'Colaborador'}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] text-gray-400 font-medium">
                                                                    {formatCommentDate(comment.createdAt)}
                                                                </span>
                                                            </div>

                                                            <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap break-words font-normal">
                                                                {comment.content}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="p-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 text-center space-y-1">
                                                <MessageSquare className="w-5 h-5 text-gray-400 mx-auto" />
                                                <p className="text-xs font-medium text-gray-500">
                                                    Nenhum comentário registrado ainda.
                                                </p>
                                                <p className="text-[11px] text-gray-400">
                                                    Tire dúvidas, informe detalhes que faltaram ou complemente o chamado no campo abaixo.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Formulário Interativo de Envio de Comentário */}
                                    <div className="pt-2 border-t border-gray-100 space-y-2.5">
                                        {/* Sugestões Rápidas (Chips de 1 clique) */}
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                                                Respostas Rápidas / Atalhos
                                            </span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {(canManageTickets ? [
                                                    "⚠️ Faltam dados ou protocolo para análise.",
                                                    "⏳ Em análise pela equipe técnica.",
                                                    "✅ Ajuste aplicado com sucesso.",
                                                    "🔄 Aguardando retorno do solicitante."
                                                ] : [
                                                    "ℹ️ Informações adicionadas conforme solicitado.",
                                                    "📌 Segue protocolo de atendimento.",
                                                    "👍 Testado e confirmado o funcionamento.",
                                                    "❓ Gostaria de um retorno sobre o andamento."
                                                ]).map((chip, idx) => (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => setNewCommentText(prev => prev ? `${prev} ${chip}` : chip)}
                                                        className="text-[10px] font-medium bg-gray-100 hover:bg-blue-50 text-gray-600 hover:text-blue-700 border border-gray-200 hover:border-blue-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        {chip}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Campo de Texto para Comentar */}
                                        <div className="space-y-2">
                                            <textarea
                                                rows={3}
                                                value={newCommentText}
                                                onChange={(e) => setNewCommentText(e.target.value)}
                                                placeholder={canManageTickets 
                                                    ? "Escreva um comentário, solicite informações faltantes ou responda ao colaborador..." 
                                                    : "Escreva sua atualização, responda às dúvidas da liderança ou anexe o protocolo..."}
                                                className="w-full p-3 border border-gray-300 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-blue-600 outline-none bg-white resize-none shadow-2xs leading-relaxed"
                                            />

                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                                                {/* Se for gestor/supervisor, pode alterar o status do ticket no próprio envio do comentário */}
                                                {canManageTickets ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[11px] font-bold text-gray-600 whitespace-nowrap">
                                                            Status ao comentar:
                                                        </span>
                                                        <select
                                                            value={newCommentStatus}
                                                            onChange={(e) => setNewCommentStatus(e.target.value)}
                                                            className="text-xs p-1.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-800 font-bold focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer"
                                                        >
                                                            <option value={viewingReport.status}>Manter atual ({viewingReport.status})</option>
                                                            <option value="Pendente">Pendente</option>
                                                            <option value="Em Andamento">Em Andamento</option>
                                                            <option value="Resolvido">Resolvido</option>
                                                            <option value="Cancelado">Cancelado</option>
                                                        </select>
                                                    </div>
                                                ) : (
                                                    <div className="text-[11px] text-gray-500 flex items-center gap-1">
                                                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                                        Sua resposta atualiza o chamado sem precisar editar o original.
                                                    </div>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={handleAddComment}
                                                    disabled={sendingComment || !newCommentText.trim()}
                                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                                                >
                                                    {sendingComment ? (
                                                        <>
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            <span>Enviando...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Send className="w-3.5 h-3.5" />
                                                            <span>Enviar Comentário</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* LADO DIREITO: DESPACHO & GESTÃO DO TICKET (OU VISÃO DA GESTÃO) */}
                                <div className="flex flex-col gap-4">
                                    {canManageTickets ? (
                                        /* PAINEL DE GESTÃO DO TICKET (GESTOR / SUPERVISOR) */
                                        <div className="bg-white p-5 rounded-2xl border border-blue-200 shadow-sm flex flex-col gap-4">
                                            <div className="border-b border-blue-100 pb-3">
                                                <h4 className="text-xs font-black text-blue-900 uppercase tracking-wider flex items-center gap-2">
                                                    <ShieldCheck className="w-4 h-4 text-blue-600"/>
                                                    Despacho & Gestão do Ticket
                                                </h4>
                                                <p className="text-[11px] text-gray-500 mt-1">
                                                    Atualize a fase do chamado e registre a resolução visível ao colaborador.
                                                </p>
                                            </div>

                                            {/* Mudança de Status */}
                                            <div>
                                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                                    Atualizar Status
                                                </label>
                                                <select 
                                                    value={quickStatus} 
                                                    onChange={(e) => setQuickStatus(e.target.value)} 
                                                    className="w-full p-2.5 border border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-blue-50/40 font-bold text-blue-950 text-sm cursor-pointer shadow-2xs"
                                                >
                                                    <option value="Pendente">Pendente (Na fila de triagem)</option>
                                                    <option value="Em Andamento">Em Andamento (Em análise/resolução)</option>
                                                    <option value="Resolvido">Resolvido (Demanda solucionada)</option>
                                                    <option value="Cancelado">Cancelado / Recusado</option>
                                                </select>
                                            </div>

                                            {/* Modelos Rápidos de Resposta */}
                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                                                    Modelos Rápidos de Parecer
                                                </label>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {[
                                                        "Em análise pela equipe técnica.",
                                                        "Ajuste aplicado com sucesso.",
                                                        "Solicitamos mais detalhes para reprodução.",
                                                        "Resolvido na versão atual."
                                                    ].map((tmpl, idx) => (
                                                        <button 
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => setQuickComment(tmpl)}
                                                            className="text-[10px] font-medium bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-800 px-2 py-1 rounded-lg transition-colors cursor-pointer text-left border border-gray-200 hover:border-blue-200"
                                                        >
                                                            {tmpl}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Campo de Comentário / Parecer */}
                                            <div className="flex-1 flex flex-col">
                                                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                                                    Parecer da Liderança / Resolução
                                                </label>
                                                <textarea 
                                                    rows="5" 
                                                    placeholder="Descreva a ação tomada, orientações ao colaborador ou justificativa do encerramento..." 
                                                    value={quickComment} 
                                                    onChange={(e) => setQuickComment(e.target.value)} 
                                                    className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 outline-none bg-white text-gray-800 text-xs shadow-2xs resize-none leading-relaxed" 
                                                />
                                            </div>

                                            <button 
                                                onClick={handleQuickUpdate} 
                                                disabled={quickSaving}
                                                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-70 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                                            >
                                                {quickSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                Salvar Andamento & Parecer
                                            </button>
                                        </div>
                                    ) : (
                                        /* PAINEL DE FEEDBACK E RESOLUÇÃO VISÍVEL AO COLABORADOR */
                                        <div className="space-y-4">
                                            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                                                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                            <ShieldCheck className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                                                                Status & Resolução Oficial
                                                            </h4>
                                                            <p className="text-[10px] text-gray-400">
                                                                Posicionamento da Supervisão e Gestão
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                                        <Lock className="w-3 h-3 text-amber-600" />
                                                        Gestão Exclusiva
                                                    </div>
                                                </div>

                                                {/* Status em Destaque com Descrição Operacional */}
                                                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between gap-3">
                                                    <div>
                                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                                            Fase Atual do Ticket
                                                        </span>
                                                        <div className="mt-1">
                                                            {getStatusBadge(viewingReport.status)}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-[11px] font-medium text-gray-500 block">
                                                            {viewingReport.status === 'Resolvido' || viewingReport.status === 'Concluído' ? (
                                                                'Demanda concluída'
                                                            ) : viewingReport.status === 'Em Andamento' ? (
                                                                'Análise técnica em curso'
                                                            ) : (
                                                                'Na fila de triagem'
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Solução Técnica ou Parecer da Liderança */}
                                                {(viewingReport.adminComment || viewingReport.closingComment || viewingReport.solution) ? (
                                                    <div className="space-y-2 pt-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                                                                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                                                                Parecer / Solução da Gestão:
                                                            </span>
                                                            <button 
                                                                type="button"
                                                                onClick={() => {
                                                                    const solText = viewingReport.adminComment || viewingReport.closingComment || viewingReport.solution || '';
                                                                    navigator.clipboard.writeText(solText);
                                                                    showToast("Parecer copiado com sucesso!", "success");
                                                                }}
                                                                className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <Copy className="w-3 h-3" /> Copiar Solução
                                                            </button>
                                                        </div>

                                                        <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 text-xs text-blue-950 leading-relaxed font-normal whitespace-pre-wrap shadow-2xs">
                                                            {viewingReport.adminComment || viewingReport.closingComment || viewingReport.solution}
                                                        </div>

                                                        {viewingReport.lastUpdatedBy && (
                                                            <div className="flex items-center justify-end gap-1 text-[10px] text-gray-400 font-medium pt-1">
                                                                <span>Atendido por:</span>
                                                                <strong className="text-gray-600">{viewingReport.lastUpdatedBy}</strong>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="p-4 rounded-xl border border-dashed border-gray-300 bg-amber-50/30 text-center space-y-1.5">
                                                        <Clock className="w-6 h-6 text-amber-500 mx-auto" />
                                                        <h5 className="font-bold text-xs text-gray-800">
                                                            Aguardando Solução da Liderança
                                                        </h5>
                                                        <p className="text-[11px] text-gray-500 leading-relaxed">
                                                            Sua solicitação está registrada e aguardando despacho de um supervisor ou gestor. Assim que houver um parecer, ele será exibido aqui.
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Bloco de Instrução da Nova Interação */}
                                                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-[11px] text-blue-900 space-y-1.5">
                                                    <div className="flex items-center gap-1.5 font-bold text-blue-950 text-xs">
                                                        <MessageSquare className="w-4 h-4 text-blue-600" />
                                                        Interação Contínua
                                                    </div>
                                                    <p className="leading-relaxed text-[11px] text-blue-800">
                                                        Precisa complementar informações, anexar protocolos ou responder dúvidas da gestão? Utilize o campo de comentários ao lado para dialogar em sequência sem precisar recriar ou editar o chamado original.
                                                    </p>
                                                </div>

                                                {/* Botão de Edição Rápida do Relato pelo Autor */}
                                                {canEditOrDelete(viewingReport) && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const rep = viewingReport;
                                                            setViewingReport(null);
                                                            openEditModal(rep);
                                                        }}
                                                        className="w-full py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5 text-amber-700" />
                                                        <span>Editar Meu Relato / Solicitação</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                            </div>

                        </div>
                        
                        {/* RODAPÉ DO MODAL */}
                        <div className="p-4 bg-white border-t border-gray-200 flex justify-between items-center">
                            <span className="text-xs text-gray-400">
                                Pressione Esc ou clique fora para fechar
                            </span>
                            <button 
                                onClick={() => setViewingReport(null)} 
                                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                            >
                                Fechar Janela
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO                                         */}
            {/* ========================================================================= */}
            {deletingReport && (
                <div className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[90] backdrop-blur-xs">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-6 animate-in zoom-in-95 duration-150">
                        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-200 text-red-600">
                            <AlertTriangle className="w-7 h-7" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">Excluir Solicitação?</h3>
                        <p className="text-gray-500 text-xs mb-6 leading-relaxed">
                            Esta ação é permanente e removerá o ticket <strong>#{deletingReport.id.slice(0, 6).toUpperCase()}</strong> definitivamente do sistema.
                        </p>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setDeletingReport(null)} 
                                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleDelete} 
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm"
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

export default Reports;

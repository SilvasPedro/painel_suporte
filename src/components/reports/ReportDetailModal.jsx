import React, { useState, useEffect } from 'react';
import { 
    X, Check, AlertTriangle, UserCheck, Eye, Edit2, Trash2, 
    Copy, MessageSquare, Send, Calendar, Building, Bug, 
    CheckSquare, Monitor, Sparkles, AlertOctagon, Clock, 
    User, ShieldCheck, Hourglass, ChevronLeft, ChevronRight, 
    Loader2, Lock, FileText, CheckCircle, Flame
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import SafeMarkdown from './SafeMarkdown';
import { BorderBeam } from '../magicui/BorderBeam';
import { calculateSlaStatus } from '../../utils/ispHelpers';
import { 
    normalizeCategory, 
    getCategoryMetadata, 
    getTaskOriginDepartment,
    getTaskAssignee,
    getTaskWatchers,
    canUserViewTask,
    isUserWatcherOnly,
    canUserManageWatchers,
    canUserAssignResponsible,
    canUserDispatchOrCloseTask,
    isUserTaskCreator
} from '../../types/request.types';
import { resolveUserName } from '../../utils/userResolvers';
import { getRoleLabel } from '../../services/rbac';

/**
 * ReportDetailModal (Hubdesk v4.0.0)
 * Modal completo e moderno de visualização de detalhes, linha do tempo e despacho de O.S. / Chamados.
 */
export default function ReportDetailModal({
    report,
    isOpen,
    onClose,
    onReportUpdate,
    user,
    currentUser,
    collaborators = [],
    canManageTickets = false,
    canEditOrDelete = () => false,
    onEdit = () => {},
    onDelete = () => {},
    onNavigate = () => {},
    hasPrev = false,
    hasNext = false,
    currentIndex = 0,
    totalCount = 0,
    showToast = () => {}
}) {
    // 1. Estados locais do formulário de despacho e comentários
    const [quickStatus, setQuickStatus] = useState(report?.status || 'Pendente');
    const [quickComment, setQuickComment] = useState(report?.adminComment || report?.closingComment || '');
    const [quickSaving, setQuickSaving] = useState(false);
    
    const [newCommentText, setNewCommentText] = useState('');
    const [newCommentStatus, setNewCommentStatus] = useState(report?.status || 'Pendente');
    const [sendingComment, setSendingComment] = useState(false);

    const [modalWatcherToAdd, setModalWatcherToAdd] = useState('');
    const [copiedDescription, setCopiedDescription] = useState(false);
    const [copiedSummary, setCopiedSummary] = useState(false);
    const [copiedSolution, setCopiedSolution] = useState(false);

    // Sincroniza estados quando o chamado em exibição mudar
    useEffect(() => {
        if (report) {
            setQuickStatus(report.status || 'Pendente');
            setQuickComment(report.adminComment || report.closingComment || '');
            setNewCommentText('');
            setNewCommentStatus(report.status || 'Pendente');
            setModalWatcherToAdd('');
        }
    }, [report?.id, report?.status]);

    // Atalhos de teclado (Esc para fechar, Setas para navegação)
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowLeft' && hasPrev) {
                onNavigate('prev');
            } else if (e.key === 'ArrowRight' && hasNext) {
                onNavigate('next');
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, hasPrev, hasNext, onNavigate]);

    if (!isOpen || !report) return null;

    // Metadados calculados
    const sla = calculateSlaStatus(report);
    const categoryKey = normalizeCategory(report.category || report.type);
    const catMeta = getCategoryMetadata(categoryKey);
    const originDept = getTaskOriginDepartment(report) || report.department || 'Geral / Suporte';
    const assignee = getTaskAssignee(report);
    const watchers = getTaskWatchers(report);
    const isWatcher = isUserWatcherOnly(report, user);
    const canDispatch = canUserDispatchOrCloseTask(report, user);
    const canAssign = canUserAssignResponsible(report, user);
    const canWatch = canUserManageWatchers(report, user);
    const canModify = canEditOrDelete(report);

    // Formatadores de data
    const formatDate = (dateStr) => {
        if (!dateStr) return '--';
        try {
            return new Date(dateStr).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        } catch {
            return dateStr;
        }
    };

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

    // Ações de cópia
    const handleCopyDescription = () => {
        if (!report.description) return;
        navigator.clipboard.writeText(report.description);
        setCopiedDescription(true);
        showToast("Descrição copiada para a área de transferência!", "success");
        setTimeout(() => setCopiedDescription(false), 2000);
    };

    const handleCopySolution = () => {
        const solText = report.adminComment || report.closingComment || report.solution || '';
        if (!solText) return;
        navigator.clipboard.writeText(solText);
        setCopiedSolution(true);
        showToast("Parecer técnico copiado!", "success");
        setTimeout(() => setCopiedSolution(false), 2000);
    };

    const handleCopySummary = () => {
        const title = report.title || report.titulo || report.type || 'Demanda';
        const protocol = report.id.slice(0, 8).toUpperCase();
        const dept = originDept;
        const resp = assignee ? assignee.name : 'Triagem por Supervisores';
        const stat = report.status || 'Pendente';
        const impact = report.affectedClient === 'Sim' ? `Sim (${report.howAffected || 'Impacto confirmado'})` : 'Não';
        const text = `📋 [HUBDESK v4.0 • O.S. #${protocol}]\n🔹 Título: ${title}\n🔹 Tipo: ${catMeta.label} | Depto: ${dept}\n🔹 Status: ${stat} | Prioridade: ${report.priority || 'Normal'}\n🔹 Responsável: ${resp}\n🔹 Afetou Cliente: ${impact}\n🔹 Prazo: ${formatDate(report.due_date || report.date)}\n\n📝 Descrição:\n${report.description || 'Sem descrição.'}`;
        navigator.clipboard.writeText(text);
        setCopiedSummary(true);
        showToast("Resumo da demanda copiado com sucesso!", "success");
        setTimeout(() => setCopiedSummary(false), 2000);
    };

    // Atribuir Responsável
    const handleAssign = async (assigneeId) => {
        if (!canAssign) {
            showToast("Apenas lideranças (Gestor / Supervisor) podem atribuir responsáveis.", "error");
            return;
        }
        try {
            let resolvedAssignee = null;
            if (assigneeId) {
                const matchedCollab = collaborators.find(
                    (c) => String(c.id || c.uid) === String(assigneeId)
                );
                if (matchedCollab) {
                    const aId = String(matchedCollab.id || matchedCollab.uid || matchedCollab.email || matchedCollab.name).trim();
                    resolvedAssignee = {
                        id: aId,
                        uid: String(matchedCollab.uid || aId),
                        name: String(matchedCollab.name || matchedCollab.email || aId),
                        email: String(matchedCollab.email || ''),
                        role: String(matchedCollab.role || 'Operacional'),
                        assignedAt: new Date().toISOString(),
                        assignedBy: user?.name || user?.email || 'Liderança'
                    };
                }
            }

            let updatedWatchers = getTaskWatchers(report);
            if (resolvedAssignee && user && !isUserTaskCreator(report, user)) {
                const currentUserId = String(user.id || user.uid || user.email || '').trim();
                const isAssigningToSelf = String(resolvedAssignee.id) === currentUserId;
                const alreadyWatching = updatedWatchers.some(
                    (w) => String(w.id).toLowerCase() === currentUserId.toLowerCase()
                );
                if (!isAssigningToSelf && !alreadyWatching && currentUserId) {
                    updatedWatchers = [
                        ...updatedWatchers,
                        {
                            id: currentUserId,
                            uid: String(user.uid || currentUserId),
                            name: String(user.name || user.displayName || user.email || 'Gestor'),
                            email: String(user.email || ''),
                            role: String(user.role || 'Gestor'),
                            addedAt: new Date().toISOString(),
                            addedBy: 'Sistema (Delegação)'
                        }
                    ];
                }
            }

            const updatePayload = {
                assignedTo: resolvedAssignee,
                assigned_to: resolvedAssignee ? resolvedAssignee.id : null,
                assignedToId: resolvedAssignee ? resolvedAssignee.id : null,
                assignedToName: resolvedAssignee ? resolvedAssignee.name : null,
                assignedToEmail: resolvedAssignee ? resolvedAssignee.email : null,
                watchers: updatedWatchers,
                watcherIds: updatedWatchers.map((w) => w.id),
                updatedAt: new Date()
            };

            await updateDoc(doc(db, "critical_reports", report.id), updatePayload);
            onReportUpdate({ ...report, ...updatePayload });
            showToast(
                resolvedAssignee
                    ? `Responsável atribuído: ${resolvedAssignee.name}`
                    : "Chamado direcionado para a fila geral de supervisores.",
                "success"
            );
        } catch (err) {
            showToast("Erro ao atribuir responsável: " + err.message, "error");
        }
    };

    // Adicionar Visualizador
    const handleAddWatcher = async (collabId) => {
        if (!collabId || !canWatch) return;
        try {
            const found = collaborators.find((c) => String(c.id || c.uid) === String(collabId));
            if (!found) return;
            const fId = String(found.id || found.uid || found.email || found.name).trim();
            const currentWatchers = getTaskWatchers(report);
            const exists = currentWatchers.some(
                (w) =>
                    String(w.id).toLowerCase() === fId.toLowerCase() ||
                    (found.email && String(w.email || '').toLowerCase() === String(found.email).toLowerCase())
            );
            if (exists) {
                showToast("Este colaborador já é um visualizador deste chamado.", "info");
                return;
            }

            const newWatcher = {
                id: fId,
                uid: String(found.uid || fId),
                name: String(found.name || found.email || fId),
                email: String(found.email || ''),
                role: String(found.role || 'Operacional'),
                addedAt: new Date().toISOString(),
                addedBy: user?.name || user?.email || 'Liderança'
            };

            const updatedList = [...currentWatchers, newWatcher];
            const updatePayload = {
                watchers: updatedList,
                watcherIds: updatedList.map((w) => w.id),
                updatedAt: new Date()
            };

            await updateDoc(doc(db, "critical_reports", report.id), updatePayload);
            onReportUpdate({ ...report, ...updatePayload });
            setModalWatcherToAdd('');
            showToast(`Visualizador ${found.name} adicionado com sucesso!`, "success");
        } catch (err) {
            showToast("Erro ao adicionar visualizador: " + err.message, "error");
        }
    };

    // Remover Visualizador
    const handleRemoveWatcher = async (watcherId) => {
        if (!canWatch) return;
        try {
            const currentWatchers = getTaskWatchers(report);
            const updatedList = currentWatchers.filter((w) => String(w.id) !== String(watcherId));
            const updatePayload = {
                watchers: updatedList,
                watcherIds: updatedList.map((w) => w.id),
                updatedAt: new Date()
            };
            await updateDoc(doc(db, "critical_reports", report.id), updatePayload);
            onReportUpdate({ ...report, ...updatePayload });
            showToast("Visualizador removido.", "info");
        } catch (err) {
            showToast("Erro ao remover visualizador: " + err.message, "error");
        }
    };

    // Envio de Comentário / Interação
    const handleSendComment = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!newCommentText.trim() || sendingComment || isWatcher) return;

        setSendingComment(true);
        try {
            const userUid = currentUser?.firestoreId || currentUser?.uid || 'user';
            const userName = currentUser?.name || currentUser?.displayName || resolveUserName(currentUser?.email) || 'Usuário';
            const userRole = currentUser?.role || 'Operacional';

            const newComment = {
                id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
                authorId: userUid,
                authorName: userName,
                authorRole: userRole,
                isStaff: Boolean(canManageTickets),
                content: newCommentText.trim(),
                createdAt: new Date().toISOString()
            };

            const existingComments = Array.isArray(report.comments) ? report.comments : [];
            const updatedComments = [...existingComments, newComment];

            const updateData = {
                comments: updatedComments,
                lastActivityAt: new Date(),
                lastUpdatedBy: userName,
                updatedAt: new Date()
            };

            if (canDispatch && newCommentStatus && newCommentStatus !== report.status) {
                updateData.status = newCommentStatus;
            }

            await updateDoc(doc(db, "critical_reports", report.id), updateData);
            onReportUpdate({ ...report, ...updateData });
            setNewCommentText('');
            showToast("Comentário adicionado com sucesso!", "success");
        } catch (err) {
            showToast("Erro ao adicionar comentário: " + err.message, "error");
        } finally {
            setSendingComment(false);
        }
    };

    // Atualização Rápida de Despacho (Gestão / Responsável)
    const handleQuickDispatch = async () => {
        if (!canDispatch) {
            showToast("Sem permissão para alterar status ou encerrar este chamado.", "error");
            return;
        }
        setQuickSaving(true);
        try {
            const userName = currentUser?.name || currentUser?.displayName || resolveUserName(currentUser?.email) || 'Gestão';
            const userUid = currentUser?.firestoreId || currentUser?.uid || 'user';
            const userRole = currentUser?.role || 'Gestor';

            const updatePayload = {
                status: quickStatus,
                adminComment: quickComment,
                lastUpdatedBy: userName,
                updatedAt: new Date()
            };

            if (quickComment && quickComment.trim()) {
                const existingComments = Array.isArray(report.comments) ? report.comments : [];
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

            await updateDoc(doc(db, "critical_reports", report.id), updatePayload);
            onReportUpdate({ ...report, ...updatePayload });
            showToast("Andamento e parecer atualizados com sucesso!", "success");
        } catch (err) {
            showToast("Erro ao atualizar chamado: " + err.message, "error");
        } finally {
            setQuickSaving(false);
        }
    };

    // Ícone da Categoria
    const renderCategoryIcon = () => {
        switch (categoryKey) {
            case 'error_analysis':
                return <Bug className="w-5 h-5 text-rose-500" />;
            case 'task':
                return <CheckSquare className="w-5 h-5 text-sky-500" />;
            case 'system_improvement':
                return <Monitor className="w-5 h-5 text-indigo-500" />;
            case 'facility_improvement':
                return <Building className="w-5 h-5 text-emerald-500" />;
            default:
                return <Sparkles className="w-5 h-5 text-purple-500" />;
        }
    };

    // Badge de Status
    const renderStatusBadge = (status) => {
        switch (status) {
            case 'Resolvido':
            case 'Concluído':
                return (
                    <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1.5 shadow-2xs">
                        <CheckCircle className="w-3.5 h-3.5" /> Resolvido
                    </span>
                );
            case 'Em Andamento':
                return (
                    <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 inline-flex items-center gap-1.5 shadow-2xs">
                        <Clock className="w-3.5 h-3.5" /> Em Andamento
                    </span>
                );
            case 'Suspenso':
                return (
                    <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/35 inline-flex items-center gap-1.5 shadow-xs">
                        <Hourglass className="w-3.5 h-3.5 animate-pulse" /> Suspenso
                    </span>
                );
            case 'Recusado':
            case 'Cancelado':
                return (
                    <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-subtle text-muted-hub border border-subtle inline-flex items-center gap-1.5 shadow-2xs">
                        <X className="w-3.5 h-3.5" /> Cancelado
                    </span>
                );
            default:
                return (
                    <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 inline-flex items-center gap-1.5 shadow-2xs">
                        <Clock className="w-3.5 h-3.5" /> Pendente
                    </span>
                );
        }
    };

    // Badge de Prioridade
    const renderPriorityBadge = (p) => {
        switch (p) {
            case 'Crítica':
                return (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                        Crítica
                    </span>
                );
            case 'Alta':
                return (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Alta
                    </span>
                );
            case 'Baixa':
                return (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Baixa
                    </span>
                );
            default:
                return (
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30 inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                        Normal
                    </span>
                );
        }
    };

    return (
        <div className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-2 sm:p-4 z-[85] backdrop-blur-md overflow-y-auto">
            <div 
                role="dialog"
                aria-modal="true"
                className="relative bg-surface rounded-3xl shadow-2xl w-full max-w-5xl xl:max-w-6xl overflow-hidden flex flex-col max-h-[92vh] border border-subtle text-primary-hub animate-in fade-in zoom-in-95 duration-200"
            >
                <BorderBeam size={260} duration={8} colorFrom="#f43f5e" colorTo="#e11d48" borderWidth={1.5} />

                {/* 1. CABEÇALHO HERO DO MODAL V4.0 */}
                <div className="p-5 sm:p-6 bg-surface text-primary-hub flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 border-b border-subtle">
                    <div className="flex items-center gap-3.5 min-w-0">
                        <div className="p-3 bg-subtle rounded-2xl border border-subtle shrink-0">
                            {renderCategoryIcon()}
                        </div>
                        <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-0.5 rounded-lg bg-subtle border border-subtle text-secondary-hub font-mono text-xs font-bold">
                                    #{report.id.slice(0, 8).toUpperCase()}
                                </span>
                                
                                <span className="text-xs font-bold text-secondary-hub">
                                    {catMeta.label}
                                </span>

                                {renderPriorityBadge(report.priority || 'Normal')}

                                {/* Departamento de Origem */}
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 inline-flex items-center gap-1">
                                    <Building className="w-3 h-3 text-indigo-500" />
                                    {originDept}
                                </span>

                                {/* Impacto no Cliente */}
                                {report.affectedClient === 'Sim' ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 inline-flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-rose-500" />
                                        Afetou Cliente
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-subtle text-muted-hub border border-subtle inline-flex items-center gap-1">
                                        Interno
                                    </span>
                                )}

                                {/* Modo Visualizador */}
                                {isWatcher && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 inline-flex items-center gap-1">
                                        <Eye className="w-3 h-3 text-amber-500" />
                                        Visualizador
                                    </span>
                                )}
                            </div>
                            
                            <h3 className="text-lg sm:text-xl font-bold text-primary-hub font-brand leading-tight truncate max-w-2xl" title={report.title || 'Sem título'}>
                                {report.title || 'Solicitação sem título'}
                            </h3>
                        </div>
                    </div>

                    {/* Navegação entre Chamados e Fechar */}
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <div className="flex items-center bg-subtle rounded-xl border border-subtle p-0.5">
                            <button 
                                onClick={() => onNavigate('prev')}
                                disabled={!hasPrev}
                                className="p-1.5 text-secondary-hub hover:text-primary-hub disabled:opacity-30 transition-colors cursor-pointer rounded-lg hover:bg-canvas"
                                title="Solicitação Anterior (←)"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-[11px] font-mono text-muted-hub px-2">
                                {currentIndex + 1}/{totalCount}
                            </span>
                            <button 
                                onClick={() => onNavigate('next')}
                                disabled={!hasNext}
                                className="p-1.5 text-secondary-hub hover:text-primary-hub disabled:opacity-30 transition-colors cursor-pointer rounded-lg hover:bg-canvas"
                                title="Próxima Solicitação (→)"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                        <button 
                            onClick={onClose} 
                            className="p-2 hover:bg-subtle rounded-xl text-muted-hub hover:text-primary-hub transition-colors cursor-pointer border border-transparent hover:border-subtle"
                            title="Fechar (Esc)"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* 2. LINHA DO TEMPO / STEPPER DE STATUS COM SUPORTE A SUSPENSO */}
                <div className="bg-subtle/40 border-b border-subtle px-6 py-3.5 shrink-0">
                    <div className="flex items-center justify-between max-w-3xl mx-auto text-xs font-bold">
                        
                        {/* Passo 1: Registrado */}
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                                ✓
                            </div>
                            <span>1. Registrado</span>
                        </div>

                        <div className={`flex-1 h-0.5 mx-3 transition-colors ${
                            report.status === 'Em Andamento' || report.status === 'Resolvido' || report.status === 'Concluído'
                                ? 'bg-sky-500' 
                                : report.status === 'Suspenso'
                                    ? 'bg-purple-500'
                                    : 'bg-subtle'
                        }`} />

                        {/* Passo 2: Em Andamento / Suspenso */}
                        {report.status === 'Suspenso' ? (
                            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-300">
                                <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px] font-bold">
                                    <Hourglass className="w-3 h-3 animate-pulse" />
                                </div>
                                <span>2. Em Pausa (Suspenso)</span>
                            </div>
                        ) : (
                            <div className={`flex items-center gap-2 ${
                                report.status === 'Em Andamento' 
                                    ? 'text-sky-600 dark:text-sky-400 font-extrabold' 
                                    : (report.status === 'Resolvido' || report.status === 'Concluído' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-hub')
                            }`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    report.status === 'Em Andamento' 
                                        ? 'bg-sky-600 text-white' 
                                        : (report.status === 'Resolvido' || report.status === 'Concluído' ? 'bg-emerald-600 text-white' : 'bg-subtle text-secondary-hub border border-subtle')
                                }`}>
                                    2
                                </div>
                                <span>2. Em Análise</span>
                            </div>
                        )}

                        <div className={`flex-1 h-0.5 mx-3 transition-colors ${
                            report.status === 'Resolvido' || report.status === 'Concluído'
                                ? 'bg-emerald-600' : 'bg-subtle'
                        }`} />

                        {/* Passo 3: Resolvido / Concluído */}
                        <div className={`flex items-center gap-2 ${
                            report.status === 'Resolvido' || report.status === 'Concluído'
                                ? 'text-emerald-600 dark:text-emerald-400 font-extrabold' 
                                : (report.status === 'Cancelado' || report.status === 'Recusado' ? 'text-muted-hub' : 'text-muted-hub')
                        }`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                report.status === 'Resolvido' || report.status === 'Concluído'
                                    ? 'bg-emerald-600 text-white' 
                                    : (report.status === 'Cancelado' || report.status === 'Recusado' ? 'bg-subtle text-muted-hub border border-subtle' : 'bg-subtle text-secondary-hub border border-subtle')
                            }`}>
                                3
                            </div>
                            <span>
                                {report.status === 'Cancelado' || report.status === 'Recusado' ? '3. Encerrado' : '3. Concluído'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* BANNER EM DESTAQUE SE O CHAMADO ESTIVER SUSPENSO */}
                {report.status === 'Suspenso' && (
                    <div className="bg-purple-500/10 border-b border-purple-500/20 px-6 py-3 flex items-center justify-between text-xs text-purple-700 dark:text-purple-300 animate-in fade-in">
                        <div className="flex items-center gap-2.5 font-bold">
                            <div className="w-6 h-6 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-300">
                                <Hourglass className="w-3.5 h-3.5 animate-pulse" />
                            </div>
                            <span>Chamado Suspenso / Em Pausa</span>
                            <span className="font-normal text-secondary-hub hidden sm:inline">
                                — Aguardando retorno do assinante, fornecedor ou tratativa externa.
                            </span>
                        </div>
                        <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-500/30">
                            Pausado
                        </span>
                    </div>
                )}

                {/* 3. CORPO SCROLLABLE (BENTO GRID MODERNO) */}
                <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-canvas space-y-6">
                    
                    {/* AVISO DE VISUALIZADOR SOMENTE LEITURA */}
                    {isWatcher && (
                        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-3 shadow-xs">
                            <Eye className="w-4 h-4 text-amber-500 shrink-0" />
                            <span>
                                <strong>Modo Visualizador (Somente Leitura):</strong> Você possui acesso de acompanhamento a este chamado para conferir o andamento e a resolução, sem permissão para despachar ou editar campos.
                            </span>
                        </div>
                    )}

                    {/* 3.1 BENTO CARD: METADADOS E SLA */}
                    <div className="bg-surface p-5 sm:p-6 rounded-3xl border border-subtle shadow-xs space-y-5">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pb-5 border-b border-subtle">
                            <div>
                                <span className="block text-[10px] font-bold text-muted-hub uppercase tracking-wider mb-1.5">
                                    Tipo da Demanda
                                </span>
                                <span className="text-xs font-bold text-primary-hub block">
                                    {catMeta.label}
                                </span>
                            </div>

                            <div>
                                <span className="block text-[10px] font-bold text-muted-hub uppercase tracking-wider mb-1.5">
                                    Status Operacional
                                </span>
                                {renderStatusBadge(report.status)}
                            </div>

                            <div>
                                <span className="block text-[10px] font-bold text-muted-hub uppercase tracking-wider mb-1.5">
                                    Prioridade
                                </span>
                                {renderPriorityBadge(report.priority || 'Normal')}
                            </div>

                            <div>
                                <span className="block text-[10px] font-bold text-muted-hub uppercase tracking-wider mb-1.5">
                                    Setor de Origem
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 text-xs font-bold">
                                    <Building className="w-3 h-3" />
                                    {originDept}
                                </span>
                            </div>

                            <div>
                                <span className="block text-[10px] font-bold text-muted-hub uppercase tracking-wider mb-1.5">
                                    Prazo / SLA
                                </span>
                                <div className="space-y-0.5">
                                    <span className="text-xs font-bold text-primary-hub block">
                                        {formatDate(report.due_date || report.date)}
                                    </span>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border inline-block ${sla.badgeClass}`}>
                                        {sla.remainingText}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <span className="block text-[10px] font-bold text-muted-hub uppercase tracking-wider mb-1.5">
                                    Afetou Cliente?
                                </span>
                                {report.affectedClient === 'Sim' ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                                        <AlertTriangle className="w-3 h-3 text-rose-500" /> Sim
                                    </span>
                                ) : (
                                    <span className="text-xs text-secondary-hub font-medium block pt-1">
                                        Não
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Bloco Condicional: Detalhes do Impacto no Cliente */}
                        {report.affectedClient === 'Sim' && (
                            <div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/30 space-y-1.5">
                                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                                    <AlertOctagon className="w-4 h-4 text-rose-500" />
                                    Detalhamento do Impacto no Atendimento ao Assinante:
                                </span>
                                <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed font-medium">
                                    {report.howAffected || 'Impacto confirmado pelo solicitante no momento da abertura.'}
                                </p>
                            </div>
                        )}

                        {/* Linha do Solicitante e Data de Criação */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1 pb-5 border-b border-subtle">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold flex items-center justify-center text-sm border border-rose-500/20 shrink-0">
                                    {(report.creatorName || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-primary-hub block">
                                        {report.creatorName || 'Autor Desconhecido'}
                                    </span>
                                    <span className="text-[11px] text-muted-hub">
                                        Solicitante / Responsável pelo registro da demanda
                                    </span>
                                </div>
                            </div>

                            {report.createdAt?.toDate && (
                                <span className="text-xs text-muted-hub font-medium">
                                    Registrado em: <strong className="text-secondary-hub">{report.createdAt.toDate().toLocaleString('pt-BR')}</strong>
                                </span>
                            )}
                        </div>

                        {/* Controle de Responsável e Visualizadores */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                            {/* Responsável Atribuído */}
                            <div className="p-4 rounded-2xl bg-canvas border border-subtle space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                        <UserCheck className="w-3.5 h-3.5 text-sky-500" />
                                        Pessoa Responsável
                                    </span>
                                    {!assignee && (
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                            Fila de Gestão
                                        </span>
                                    )}
                                </div>

                                {canAssign ? (
                                    <select
                                        value={assignee?.id || ''}
                                        onChange={(e) => handleAssign(e.target.value)}
                                        className="w-full px-3 py-2 border border-subtle rounded-xl text-xs font-semibold text-primary-hub bg-surface focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none cursor-pointer"
                                    >
                                        <option value="">
                                            Sem responsável direto (Direcionado a Gestores e Supervisores)
                                        </option>
                                        {collaborators.map((c) => {
                                            const cid = String(c.id || c.uid || c.email || c.name);
                                            return (
                                                <option key={cid} value={cid}>
                                                    {c.name} {c.role ? `(${c.role})` : ''}
                                                </option>
                                            );
                                        })}
                                    </select>
                                ) : (
                                    <div className="text-xs font-semibold py-1">
                                        {assignee ? (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                                                <UserCheck className="w-3.5 h-3.5" />
                                                {assignee.name}
                                            </span>
                                        ) : (
                                            <span className="text-muted-hub">
                                                Sem responsável atribuído (Roteado para a liderança).
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Visualizadores (Watchers) */}
                            <div className="p-4 rounded-2xl bg-canvas border border-subtle space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                        <Eye className="w-3.5 h-3.5 text-indigo-500" />
                                        Visualizadores ({watchers.length})
                                    </span>
                                    <span className="text-[10px] text-muted-hub">
                                        Acompanhamento
                                    </span>
                                </div>

                                {canWatch && (
                                    <div className="flex gap-2">
                                        <select
                                            value={modalWatcherToAdd}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setModalWatcherToAdd(val);
                                                if (val) {
                                                    handleAddWatcher(val);
                                                }
                                            }}
                                            className="flex-1 px-3 py-2 border border-subtle rounded-xl text-xs text-primary-hub bg-surface focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none cursor-pointer"
                                        >
                                            <option value="">Adicionar visualizador...</option>
                                            {collaborators.map((c) => {
                                                const cid = String(c.id || c.uid || c.email || c.name);
                                                return (
                                                    <option key={cid} value={cid}>
                                                        {c.name} {c.role ? `(${c.role})` : ''}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                )}

                                {watchers.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {watchers.map((w) => (
                                            <span
                                                key={w.id}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-subtle text-primary-hub border border-subtle text-xs font-medium"
                                            >
                                                <span>{w.name}</span>
                                                {canWatch && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveWatcher(w.id)}
                                                        className="text-muted-hub hover:text-rose-500 cursor-pointer p-0.5 rounded transition-colors"
                                                        title="Remover visualizador"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-hub italic">
                                        Nenhum visualizador adicionado.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 3.2 BENTO CARD: DESCRIÇÃO COMPLETA DA DEMANDA (MARKDOWN GFM) */}
                    <div className="bg-surface p-5 sm:p-6 rounded-3xl border border-subtle shadow-xs space-y-3">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                            <span className="text-xs font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-rose-500" />
                                Descrição Detalhada da Ordem de Serviço
                            </span>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={handleCopyDescription}
                                    className="text-xs text-secondary-hub hover:text-primary-hub flex items-center gap-1 cursor-pointer transition-colors px-2.5 py-1 rounded-lg bg-canvas border border-subtle hover:bg-subtle"
                                >
                                    {copiedDescription ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span>{copiedDescription ? 'Copiado!' : 'Copiar Texto'}</span>
                                </button>
                                <button 
                                    onClick={handleCopySummary}
                                    className="text-xs text-secondary-hub hover:text-primary-hub flex items-center gap-1 cursor-pointer transition-colors px-2.5 py-1 rounded-lg bg-canvas border border-subtle hover:bg-subtle"
                                >
                                    {copiedSummary ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                    <span>{copiedSummary ? 'Copiado!' : 'Copiar Resumo'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="bg-canvas p-4 sm:p-5 rounded-2xl border border-subtle text-primary-hub leading-relaxed overflow-x-auto text-sm">
                            <SafeMarkdown content={report.description || 'Sem descrição informada no registro.'} />
                        </div>

                        {/* Ações Rápidas de Edição e Exclusão */}
                        {canModify && (
                            <div className="flex items-center justify-end gap-2 pt-2">
                                <button 
                                    onClick={() => onEdit(report)}
                                    className="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Edit2 className="w-3.5 h-3.5" /> Editar Solicitação
                                </button>
                                <button 
                                    onClick={() => onDelete(report)}
                                    className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 3.3 GRID INFERIOR (2 COLUNAS): COMENTÁRIOS E DESPACHO / GESTÃO */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        
                        {/* COLUNA ESQUERDA: LINHA DO TEMPO & INTERAÇÕES */}
                        <div className="bg-surface p-5 sm:p-6 rounded-3xl border border-subtle shadow-xs space-y-4 flex flex-col">
                            <div className="flex items-center justify-between border-b border-subtle pb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-2 bg-sky-500/10 text-sky-500 rounded-xl border border-sky-500/20">
                                        <MessageSquare className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-primary-hub uppercase tracking-wider flex items-center gap-2">
                                            Interações & Linha do Tempo
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
                                                {Array.isArray(report.comments) ? report.comments.length : 0}
                                            </span>
                                        </h4>
                                        <p className="text-[11px] text-muted-hub">
                                            Canal de diálogo entre solicitante, equipe e gestão
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Solução Histórica Legada */}
                            {(report.adminComment || report.closingComment || report.solution) && (
                                <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-xs text-sky-800 dark:text-sky-300 space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                                            <ShieldCheck className="w-3.5 h-3.5 text-sky-500" />
                                            Parecer Técnico / Resolução Oficial:
                                        </span>
                                        {report.lastUpdatedBy && (
                                            <span className="text-[10px] opacity-80 font-medium">
                                                Por: {report.lastUpdatedBy}
                                            </span>
                                        )}
                                    </div>
                                    <p className="whitespace-pre-wrap leading-relaxed">
                                        {report.adminComment || report.closingComment || report.solution}
                                    </p>
                                </div>
                            )}

                            {/* Lista de Mensagens / Comentários */}
                            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
                                {Array.isArray(report.comments) && report.comments.length > 0 ? (
                                    report.comments.map((comment, idx) => {
                                        const isAuthor = comment.authorId === (currentUser?.firestoreId || currentUser?.uid);
                                        const isTicketCreator = comment.authorId === report.creatorId;
                                        const isLeader = comment.isStaff || (comment.authorRole && ['gestor', 'supervisor', 'admin', 'gerente', 'coordenador'].some(r => String(comment.authorRole).toLowerCase().includes(r)));

                                        return (
                                            <div 
                                                key={comment.id || idx}
                                                className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all ${
                                                    isLeader 
                                                        ? 'bg-indigo-500/5 border-indigo-500/30' 
                                                        : isTicketCreator
                                                            ? 'bg-amber-500/5 border-amber-500/30'
                                                            : 'bg-canvas border-subtle'
                                                }`}
                                            >
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${
                                                    isLeader 
                                                        ? 'bg-indigo-600 text-white border-indigo-700' 
                                                        : isTicketCreator
                                                            ? 'bg-amber-500 text-white border-amber-600'
                                                            : 'bg-subtle text-secondary-hub border-subtle'
                                                }`}>
                                                    {(comment.authorName || 'U').charAt(0).toUpperCase()}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-xs font-bold text-primary-hub">
                                                                {comment.authorName}
                                                            </span>
                                                            {isAuthor && (
                                                                <span className="px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-subtle text-secondary-hub border border-subtle">
                                                                    Você
                                                                </span>
                                                            )}
                                                            {isLeader ? (
                                                                <span className="px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                                                                    {comment.authorRole || 'Liderança'}
                                                                </span>
                                                            ) : isTicketCreator ? (
                                                                <span className="px-1.5 py-0.2 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                                                    Autor
                                                                </span>
                                                            ) : (
                                                                <span className="px-1.5 py-0.2 rounded-md text-[10px] font-medium bg-subtle text-muted-hub border border-subtle">
                                                                    {getRoleLabel(comment.authorRole)}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-muted-hub font-medium">
                                                            {formatCommentDate(comment.createdAt)}
                                                        </span>
                                                    </div>

                                                    <p className="text-xs text-secondary-hub leading-relaxed whitespace-pre-wrap break-words">
                                                        {comment.content}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-5 rounded-2xl border border-dashed border-subtle bg-canvas text-center space-y-1">
                                        <MessageSquare className="w-5 h-5 text-muted-hub mx-auto" />
                                        <p className="text-xs font-medium text-secondary-hub">
                                            Nenhuma mensagem registrada até o momento.
                                        </p>
                                        <p className="text-[11px] text-muted-hub">
                                            Utilize o campo abaixo para tirar dúvidas ou complementar a demanda.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Formulário de Envio de Mensagem */}
                            {!isWatcher && (
                                <div className="pt-3 border-t border-subtle space-y-3">
                                    {/* Chips de Respostas Rápidas */}
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">
                                            Respostas Rápidas
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
                                                    className="text-[10px] font-medium bg-canvas hover:bg-subtle text-secondary-hub border border-subtle px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    {chip}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Textarea e Ações */}
                                    <div className="space-y-2">
                                        <textarea
                                            rows={3}
                                            value={newCommentText}
                                            onChange={(e) => setNewCommentText(e.target.value)}
                                            placeholder={canManageTickets 
                                                ? "Escreva uma orientação técnica ou resposta ao colaborador..." 
                                                : "Escreva uma resposta, anexe o protocolo ou complemente os dados..."}
                                            className="w-full p-3.5 border border-subtle rounded-2xl text-xs text-primary-hub placeholder:text-muted-hub focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none bg-canvas resize-none shadow-xs leading-relaxed"
                                        />

                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                                            {canDispatch ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-bold text-secondary-hub whitespace-nowrap">
                                                        Status ao comentar:
                                                    </span>
                                                    <select
                                                        value={newCommentStatus}
                                                        onChange={(e) => setNewCommentStatus(e.target.value)}
                                                        className="text-xs px-2.5 py-1.5 border border-subtle rounded-xl bg-surface text-primary-hub font-bold focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none cursor-pointer"
                                                    >
                                                        <option value={report.status}>Manter atual ({report.status})</option>
                                                        <option value="Pendente">Pendente</option>
                                                        <option value="Em Andamento">Em Andamento</option>
                                                        <option value="Suspenso">Suspenso (Em pausa)</option>
                                                        <option value="Resolvido">Resolvido</option>
                                                        <option value="Cancelado">Cancelado</option>
                                                    </select>
                                                </div>
                                            ) : (
                                                <div className="text-[11px] text-muted-hub flex items-center gap-1">
                                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                                    Sua resposta atualiza o chamado sem precisar editá-lo.
                                                </div>
                                            )}

                                            <button
                                                type="button"
                                                onClick={handleSendComment}
                                                disabled={sendingComment || !newCommentText.trim()}
                                                className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-950/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
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
                            )}
                        </div>

                        {/* COLUNA DIREITA: DESPACHO & GESTÃO DA LIDERANÇA OU PARECER OFICIAL */}
                        <div className="flex flex-col gap-4">
                            {canDispatch ? (
                                /* PAINEL DE GESTÃO E DESPACHO (GESTOR / SUPERVISOR / RESPONSÁVEL) */
                                <div className="bg-surface p-5 sm:p-6 rounded-3xl border border-subtle shadow-xs flex flex-col gap-4">
                                    <div className="border-b border-subtle pb-3">
                                        <h4 className="text-xs font-bold text-primary-hub uppercase tracking-wider flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-rose-500"/>
                                            Despacho & Gestão do Chamado
                                        </h4>
                                        <p className="text-[11px] text-muted-hub mt-1">
                                            Atualize a fase do ticket e registre a resolução visível ao colaborador.
                                        </p>
                                    </div>

                                    {/* Seletor de Status (com Suspenso!) */}
                                    <div className="space-y-1.5">
                                        <label className="block text-xs font-bold text-secondary-hub uppercase tracking-wider">
                                            Atualizar Status Operacional
                                        </label>
                                        <select 
                                            value={quickStatus} 
                                            onChange={(e) => setQuickStatus(e.target.value)} 
                                            className="w-full px-3.5 py-2.5 border border-subtle rounded-xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none bg-canvas font-bold text-primary-hub text-sm cursor-pointer shadow-xs"
                                        >
                                            <option value="Pendente">🟡 Pendente (Fila de triagem)</option>
                                            <option value="Em Andamento">🔵 Em Andamento (Em análise/execução)</option>
                                            <option value="Suspenso">🟣 Suspenso (Em pausa / Aguardando retorno)</option>
                                            <option value="Resolvido">🟢 Resolvido (Demanda solucionada)</option>
                                            <option value="Cancelado">⚪ Cancelado / Recusado</option>
                                        </select>
                                    </div>

                                    {/* Modelos Rápidos de Resposta */}
                                    <div className="space-y-1">
                                        <label className="block text-[10px] font-bold text-muted-hub uppercase tracking-wider">
                                            Modelos Rápidos de Resolução
                                        </label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {[
                                                "Em análise pela equipe técnica especializada.",
                                                "Ajuste aplicado com sucesso na infraestrutura.",
                                                "Solicitamos mais detalhes para reprodução.",
                                                "Resolvido na versão operacional atual."
                                            ].map((tmpl, idx) => (
                                                <button 
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setQuickComment(tmpl)}
                                                    className="text-[10px] font-medium bg-canvas hover:bg-subtle text-secondary-hub px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-left border border-subtle"
                                                >
                                                    {tmpl}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Campo de Parecer Técnico da Liderança */}
                                    <div className="flex-1 flex flex-col space-y-1.5">
                                        <label className="block text-xs font-bold text-secondary-hub uppercase tracking-wider">
                                            Parecer da Liderança / Resolução Oficial
                                        </label>
                                        <textarea 
                                            rows={5} 
                                            placeholder="Descreva a ação tomada, orientações técnicas ao colaborador ou justificativa do encerramento..." 
                                            value={quickComment} 
                                            onChange={(e) => setQuickComment(e.target.value)} 
                                            className="w-full p-3.5 border border-subtle rounded-2xl focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none bg-canvas text-primary-hub placeholder:text-muted-hub text-xs shadow-xs resize-none leading-relaxed" 
                                        />
                                    </div>

                                    <button 
                                        type="button"
                                        onClick={handleQuickDispatch} 
                                        disabled={quickSaving}
                                        className="w-full py-3 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl font-bold text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-rose-950/20 cursor-pointer active:scale-95"
                                    >
                                        {quickSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                        <span>Salvar Andamento & Parecer</span>
                                    </button>
                                </div>
                            ) : (
                                /* PAINEL DE FEEDBACK E RESOLUÇÃO VISÍVEL AO COLABORADOR / VISUALIZADOR */
                                <div className="space-y-4">
                                    <div className="bg-surface p-5 sm:p-6 rounded-3xl border border-subtle shadow-xs space-y-4">
                                        <div className="flex items-center justify-between border-b border-subtle pb-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center border border-sky-500/20">
                                                    <ShieldCheck className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-primary-hub uppercase tracking-wider">
                                                        Status & Resolução Oficial
                                                    </h4>
                                                    <p className="text-[10px] text-muted-hub">
                                                        Posicionamento da Supervisão e Gestão
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-1 text-[10px] font-bold text-secondary-hub bg-subtle px-2 py-0.5 rounded-lg border border-subtle">
                                                <Lock className="w-3 h-3 text-amber-500" />
                                                Gestão Exclusiva
                                            </div>
                                        </div>

                                        {/* Status em Destaque */}
                                        <div className="p-3.5 rounded-2xl bg-canvas border border-subtle flex items-center justify-between gap-3">
                                            <div>
                                                <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">
                                                    Fase Atual da Solicitação
                                                </span>
                                                <div className="mt-1">
                                                    {renderStatusBadge(report.status)}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[11px] font-medium text-secondary-hub block">
                                                    {report.status === 'Resolvido' || report.status === 'Concluído' ? (
                                                        'Demanda concluída'
                                                    ) : report.status === 'Suspenso' ? (
                                                        'Aguardando tratativa externa'
                                                    ) : report.status === 'Em Andamento' ? (
                                                        'Análise técnica em curso'
                                                    ) : (
                                                        'Na fila de triagem'
                                                    )}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Solução Técnica ou Parecer da Liderança */}
                                        {(report.adminComment || report.closingComment || report.solution) ? (
                                            <div className="space-y-2 pt-1">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                                                        <MessageSquare className="w-3.5 h-3.5" />
                                                        Parecer Oficial da Gestão:
                                                    </span>
                                                    <button 
                                                        type="button"
                                                        onClick={handleCopySolution}
                                                        className="text-[10px] text-sky-600 dark:text-sky-400 hover:text-sky-700 font-bold flex items-center gap-1 cursor-pointer"
                                                    >
                                                        {copiedSolution ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                                        <span>{copiedSolution ? 'Copiado!' : 'Copiar Solução'}</span>
                                                    </button>
                                                </div>

                                                <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-xs text-sky-900 dark:text-sky-200 leading-relaxed font-normal whitespace-pre-wrap">
                                                    {report.adminComment || report.closingComment || report.solution}
                                                </div>

                                                {report.lastUpdatedBy && (
                                                    <div className="flex items-center justify-end gap-1 text-[10px] text-muted-hub font-medium pt-1">
                                                        <span>Atendido por:</span>
                                                        <strong className="text-secondary-hub">{report.lastUpdatedBy}</strong>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="p-5 rounded-2xl border border-dashed border-subtle bg-canvas text-center space-y-1.5">
                                                <Clock className="w-6 h-6 text-amber-500 mx-auto" />
                                                <h5 className="font-bold text-xs text-primary-hub">
                                                    Aguardando Parecer da Liderança
                                                </h5>
                                                <p className="text-[11px] text-muted-hub leading-relaxed">
                                                    Sua solicitação está na fila e aguarda despacho de um supervisor ou gestor. Assim que houver um parecer, ele será exibido aqui.
                                                </p>
                                            </div>
                                        )}

                                        {/* Bloco de Instrução da Nova Interação */}
                                        {!isWatcher && (
                                            <div className="p-4 rounded-2xl bg-canvas border border-subtle text-[11px] text-secondary-hub space-y-1">
                                                <div className="flex items-center gap-1.5 font-bold text-primary-hub text-xs">
                                                    <MessageSquare className="w-3.5 h-3.5 text-rose-500" />
                                                    Interação Contínua
                                                </div>
                                                <p className="leading-relaxed text-muted-hub">
                                                    Precisa complementar informações ou anexar protocolos? Utilize o campo de comentários ao lado para dialogar em sequência.
                                                </p>
                                            </div>
                                        )}

                                        {/* Botão de Edição Rápida pelo Autor */}
                                        {canModify && (
                                            <button
                                                type="button"
                                                onClick={() => onEdit(report)}
                                                className="w-full py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                                <span>Editar Meu Relato / Solicitação</span>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>

                </div>

                {/* 4. RODAPÉ FIXO DO MODAL */}
                <div className="p-4 sm:px-6 bg-surface border-t border-subtle flex justify-between items-center shrink-0">
                    <span className="text-xs text-muted-hub">
                        Pressione <kbd className="px-1.5 py-0.5 rounded bg-subtle border border-subtle font-mono text-[10px]">Esc</kbd> ou clique fora para fechar
                    </span>
                    <button 
                        type="button"
                        onClick={onClose} 
                        className="px-6 py-2.5 bg-canvas hover:bg-subtle border border-subtle text-secondary-hub hover:text-primary-hub rounded-xl font-bold text-xs transition-colors cursor-pointer"
                    >
                        Fechar Janela
                    </button>
                </div>
            </div>
        </div>
    );
}

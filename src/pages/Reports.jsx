import React, { useState, useEffect, useMemo } from 'react';
import { 
    Plus, Search, Eye, Edit2, Trash2, X, Loader2, 
    AlertTriangle, CheckCircle, Clock, Filter, 
    Lightbulb, Monitor, Building, Zap, Bug, MessageSquare, Send,
    Table, Columns3, LayoutGrid, List, Copy, ChevronLeft, ChevronRight,
    User, ShieldCheck, Check, Sparkles, AlertOctagon, RotateCcw, Hourglass, Lock,
    CornerDownRight, MessageCircle, ChevronUp, ChevronDown, UserCheck, CheckSquare
} from 'lucide-react';
import { collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeSharedCollection } from '../services/dataCache';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { resolveUserName } from '../utils/userResolvers';
import TicketDrawer from '../components/reports/TicketDrawer';
import MassiveOutageBanner from '../components/reports/MassiveOutageBanner';
import NewRequestModal from '../components/reports/NewRequestModal';
import SafeMarkdown from '../components/reports/SafeMarkdown';
import { calculateSlaStatus } from '../utils/ispHelpers';
import { 
    normalizeCategory, 
    getCategoryMetadata, 
    REQUEST_CATEGORIES, 
    ERROR_DEPARTMENTS,
    getTaskOriginDepartment,
    getTaskAssignee,
    getTaskWatchers,
    canUserViewTask,
    filterVisibleTasks,
    isUserWatcherOnly,
    canUserManageWatchers,
    canUserAssignResponsible,
    canUserDispatchOrCloseTask,
    isUserTaskCreator
} from '../types/request.types';

const Reports = () => {
    const { showToast } = useNotification();
    const { currentUser } = useAuth();
    const { normalizedRole, isMasterAdmin, canEdit } = usePermissions();

    const [reports, setReports] = useState([]);
    const [collaborators, setCollaborators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalWatcherToAdd, setModalWatcherToAdd] = useState('');

    // ==========================================
    // CONTROLE DE ACESSO E PERMISSÕES (RBAC / RLS)
    // ==========================================
    const canViewAllReports = useMemo(() => {
        if (isMasterAdmin) return true;
        const role = String(normalizedRole || '').toLowerCase();
        if (role === 'gestor' || role === 'supervisor') return true;
        const rawRole = String(currentUser?.role || '').toLowerCase();
        return rawRole.includes('gestor') || rawRole.includes('supervis') || rawRole.includes('admin') || rawRole.includes('gerente') || rawRole.includes('coordenador');
    }, [isMasterAdmin, normalizedRole, currentUser?.role]);

    const effectiveUser = useMemo(() => {
        if (!currentUser) return null;
        return {
            ...currentUser,
            uid: currentUser.uid || currentUser.firestoreId,
            id: currentUser.firestoreId || currentUser.uid,
            role: canViewAllReports ? (normalizedRole || currentUser.role || 'Gestor') : (normalizedRole || currentUser.role || 'Colaborador')
        };
    }, [currentUser, normalizedRole, canViewAllReports]);

    // Gestor e Supervisor podem gerenciar tickets (mudar status e dar parecer)
    const canManageTickets = useMemo(() => {
        return canViewAllReports || canEdit('reports');
    }, [canViewAllReports, canEdit]);

    // Permissão de edição ou exclusão do registro (Visualizadores nunca podem editar/excluir)
    const canEditOrDelete = (report) => {
        if (!report || !effectiveUser) return false;
        if (isUserWatcherOnly(report, effectiveUser)) return false;
        if (canManageTickets) return true;
        return isUserTaskCreator(report, effectiveUser);
    };

    // ==========================================
    // ESTADOS DE VISUALIZAÇÃO E FILTROS
    // ==========================================
    // Modos de visualização: 'table' (Tabela), 'kanban' (Quadro), 'cards' (Grade), 'compact' (Lista rápida)
    const [viewMode, setViewMode] = useState('table');
    const [showSummary, setShowSummary] = useState(true);

    // Filtros Rápidos
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState(''); // Filtro por Categoria Oficial
    const [departmentFilter, setDepartmentFilter] = useState(''); // Filtro por Departamento de Origem
    const [slaFilter, setSlaFilter] = useState(''); // Filtro por SLA (ok, warning, breached, resolved)
    const [typeFilter, setTypeFilter] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('');
    const [clientImpactFilter, setClientImpactFilter] = useState('');
    const [creatorFilter, setCreatorFilter] = useState(''); // Apenas para quem vê todos
    const [regionFilter, setRegionFilter] = useState(''); // Filtro de região / falha massiva

    // Feedback de cópia
    const [copiedText, setCopiedText] = useState(false);

    // Controles de Modais & Drawer Lateral
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [viewingReport, setViewingReport] = useState(null);
    const [isFullModalOpen, setIsFullModalOpen] = useState(false);
    const [deletingReport, setDeletingReport] = useState(null);

    // Formulário de Criação/Edição
    const [editingId, setEditingId] = useState(null);
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
    // BUSCA DE COLABORADORES PARA ATRIBUIÇÃO / WATCHERS
    // ==========================================
    useEffect(() => {
        if (!currentUser) return;
        const unsubscribe = subscribeSharedCollection("collaborators", (items) => {
            const activeList = items
                .filter((c) => c.active !== false && c.name)
                .sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
            setCollaborators(activeList);
        });
        return () => unsubscribe();
    }, [currentUser]);

    // ==========================================
    // BUSCA DE DADOS COM CACHE FINOPS & POLÍTICA RLS
    // ==========================================
    useEffect(() => {
        if (!effectiveUser) return;

        // Aplicação estrita da Matriz de Acesso e Visibilidade (RLS):
        // - Usuário comum: apenas se for Criador, Responsável ou Visualizador.
        // - Gestor/Supervisor: suas próprias tarefas, onde é responsável/visualizador e todas sem responsável.
        const unsubscribe = subscribeSharedCollection("critical_reports", (items) => {
            const fetchedData = filterVisibleTasks(items, effectiveUser);

            // Ordenação pelo mais recente
            fetchedData.sort((a, b) => {
                const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.date ? new Date(a.date).getTime() : 0);
                const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.date ? new Date(b.date).getTime() : 0);
                return dateB - dateA;
            });

            setReports(fetchedData);
            setViewingReport(prev => {
                if (!prev) return null;
                const updated = fetchedData.find(r => r.id === prev.id);
                return updated || null;
            });
            setLoading(false);
        });

        return () => unsubscribe();
    }, [effectiveUser]);

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
            const matchCategory = categoryFilter === '' || normalizeCategory(r.category || r.type) === categoryFilter;
            const matchDepartment = departmentFilter === '' || getTaskOriginDepartment(r) === departmentFilter;
            const matchSla = slaFilter === '' || calculateSlaStatus(r).status === slaFilter;
            const matchType = typeFilter === '' || r.type === typeFilter;
            const matchPriority = priorityFilter === '' || r.priority === priorityFilter;
            const matchClient = clientImpactFilter === '' || r.affectedClient === clientImpactFilter;
            const matchCreator = creatorFilter === '' || r.creatorName === creatorFilter;
            const matchRegion = !regionFilter || (r.region && r.region.toLowerCase().includes(regionFilter.toLowerCase())) || (r.title && r.title.toLowerCase().includes(regionFilter.toLowerCase()));

            return matchSearch && matchStatus && matchCategory && matchDepartment && matchSla && matchType && matchPriority && matchClient && matchCreator && matchRegion;
        });
    }, [reports, searchTerm, statusFilter, categoryFilter, departmentFilter, slaFilter, typeFilter, priorityFilter, clientImpactFilter, creatorFilter, regionFilter]);

    // Métricas para o Ribbon de Resumo
    const metricsSummary = useMemo(() => {
        const total = reports.length;
        const pending = reports.filter(r => r.status === 'Pendente' || !r.status).length;
        const inProgress = reports.filter(r => r.status === 'Em Andamento').length;
        const resolved = reports.filter(r => r.status === 'Resolvido' || r.status === 'Concluído').length;
        const clientImpact = reports.filter(r => r.affectedClient === 'Sim').length;
        return { total, pending, inProgress, resolved, clientImpact };
    }, [reports]);

    const hasActiveFilters = Boolean(searchTerm || statusFilter || categoryFilter || departmentFilter || slaFilter || typeFilter || priorityFilter || clientImpactFilter || creatorFilter || regionFilter);

    const clearAllFilters = () => {
        setSearchTerm('');
        setStatusFilter('');
        setCategoryFilter('');
        setDepartmentFilter('');
        setSlaFilter('');
        setTypeFilter('');
        setPriorityFilter('');
        setClientImpactFilter('');
        setCreatorFilter('');
        setRegionFilter('');
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
    // AÇÕES DE CRIAÇÃO E EDIÇÃO (NEW REQUEST MODAL)
    // ==========================================
    const openNewReportModal = () => {
        setEditingId(null);
        setIsModalOpen(true);
    };

    const openEditModal = (report) => {
        setEditingId(report.id);
        setIsModalOpen(true);
    };

    // Atalhos Globais de Teclado (Ctrl+N / Alt+N para Novo Chamado)
    useEffect(() => {
        const handleKeys = (e) => {
            if ((e.ctrlKey || e.altKey) && e.key.toLowerCase() === 'n') {
                e.preventDefault();
                openNewReportModal();
            }
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, []);

    const handleSaveRequest = async (payload) => {
        setSaving(true);
        try {
            const reportPayload = { 
                ...payload, 
                updatedAt: new Date() 
            };

            if (editingId) {
                const existingRep = reports.find(r => r.id === editingId);
                
                // Preservar pareceres e status definidos pela liderança caso o usuário não tenha permissão de gestão
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
                reportPayload.creatorName = currentUser.name || currentUser.displayName || resolveUserName(currentUser.email) || 'Colaborador';
                reportPayload.creatorEmail = currentUser.email || '';
                reportPayload.createdAt = new Date();
                
                // Metadados de ciclo de vida e targetDueDate para SLA dinâmico
                const slaHours = payload.slaHours || 72;
                reportPayload.targetDueDate = new Date(Date.now() + (slaHours * 60 * 60 * 1000));
                reportPayload.status = 'Pendente';

                await addDoc(collection(db, "critical_reports"), reportPayload);
                showToast("Solicitação enviada com sucesso!", "success");
            }
            setIsModalOpen(false);
            setEditingId(null);
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
    // AÇÕES DO GESTOR E RLS NO MODAL DE VISUALIZAÇÃO
    // ==========================================
    const handleOpenViewModal = (report) => {
        if (!report || !canUserViewTask(report, effectiveUser)) {
            showToast("Acesso negado: você não possui permissão para visualizar este chamado.", "error");
            return;
        }
        setViewingReport(report);
        setIsFullModalOpen(true);
        setIsDrawerOpen(false);
        setQuickStatus(report.status || 'Pendente');
        setQuickComment(report.adminComment || report.closingComment || '');
        setNewCommentText('');
        setNewCommentStatus(report.status || 'Pendente');
        setModalWatcherToAdd('');
    };

    const handleAssignResponsible = async (report, assigneeId) => {
        if (!report || !canUserAssignResponsible(report, effectiveUser)) {
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
                        role: String(matchedCollab.role || 'Colaborador'),
                        assignedAt: new Date().toISOString(),
                        assignedBy: effectiveUser?.name || effectiveUser?.email || 'Liderança'
                    };
                }
            }

            // Se a liderança atribuir para outro colaborador e não for o criador,
            // garante que quem atribuiu permaneça como visualizador para continuar acompanhando
            let updatedWatchers = getTaskWatchers(report);
            if (resolvedAssignee && effectiveUser && !isUserTaskCreator(report, effectiveUser)) {
                const currentUserId = String(effectiveUser.id || effectiveUser.uid || effectiveUser.email || '').trim();
                const isAssigningToSelf = String(resolvedAssignee.id) === currentUserId;
                const alreadyWatching = updatedWatchers.some(
                    (w) => String(w.id).toLowerCase() === currentUserId.toLowerCase()
                );
                if (!isAssigningToSelf && !alreadyWatching && currentUserId) {
                    updatedWatchers = [
                        ...updatedWatchers,
                        {
                            id: currentUserId,
                            uid: String(effectiveUser.uid || currentUserId),
                            name: String(effectiveUser.name || effectiveUser.displayName || effectiveUser.email || 'Gestor'),
                            email: String(effectiveUser.email || ''),
                            role: String(effectiveUser.role || 'Gestor'),
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
            setViewingReport((prev) => (prev && prev.id === report.id ? { ...prev, ...updatePayload } : prev));
            showToast(
                resolvedAssignee
                    ? `Responsável atribuído: ${resolvedAssignee.name}`
                    : "Tarefa sem responsável direto (visível para Gestores e Supervisores).",
                "success"
            );
        } catch (err) {
            showToast("Erro ao atribuir responsável: " + err.message, "error");
        }
    };

    const handleAddWatcherToReport = async (report, collabId) => {
        if (!report || !collabId) return;
        if (!canUserManageWatchers(report, effectiveUser)) {
            showToast("Sem permissão para gerenciar visualizadores neste chamado.", "error");
            return;
        }
        try {
            const found = collaborators.find((c) => String(c.id || c.uid) === String(collabId));
            if (!found) return;
            const currentWatchers = getTaskWatchers(report);
            const fId = String(found.id || found.uid || found.email || found.name).trim();
            const exists = currentWatchers.some(
                (w) =>
                    String(w.id).toLowerCase() === fId.toLowerCase() ||
                    (found.email && String(w.email || '').toLowerCase() === String(found.email).toLowerCase()) ||
                    String(w.name || '').toLowerCase() === String(found.name || '').toLowerCase()
            );
            if (exists) {
                showToast("Este colaborador já está na lista de visualizadores.", "info");
                setModalWatcherToAdd('');
                return;
            }
            const nextWatchers = [
                ...currentWatchers,
                {
                    id: fId,
                    uid: String(found.uid || fId),
                    name: String(found.name || found.email || fId),
                    email: String(found.email || ''),
                    role: String(found.role || 'Colaborador'),
                    addedAt: new Date().toISOString(),
                    addedBy: effectiveUser?.name || effectiveUser?.email || 'Usuário'
                }
            ];
            const updatePayload = {
                watchers: nextWatchers,
                watcherIds: nextWatchers.map((w) => w.id),
                updatedAt: new Date()
            };
            await updateDoc(doc(db, "critical_reports", report.id), updatePayload);
            setViewingReport((prev) => (prev && prev.id === report.id ? { ...prev, ...updatePayload } : prev));
            setModalWatcherToAdd('');
            showToast(`${found.name} adicionado como visualizador!`, "success");
        } catch (err) {
            showToast("Erro ao adicionar visualizador: " + err.message, "error");
        }
    };

    const handleRemoveWatcherFromReport = async (report, watcherId) => {
        if (!report || !watcherId) return;
        if (!canUserManageWatchers(report, effectiveUser)) {
            showToast("Sem permissão para remover visualizadores neste chamado.", "error");
            return;
        }
        try {
            const currentWatchers = getTaskWatchers(report);
            const nextWatchers = currentWatchers.filter((w) => String(w.id) !== String(watcherId));
            const updatePayload = {
                watchers: nextWatchers,
                watcherIds: nextWatchers.map((w) => w.id),
                updatedAt: new Date()
            };
            await updateDoc(doc(db, "critical_reports", report.id), updatePayload);
            setViewingReport((prev) => (prev && prev.id === report.id ? { ...prev, ...updatePayload } : prev));
            showToast("Visualizador removido.", "success");
        } catch (err) {
            showToast("Erro ao remover visualizador: " + err.message, "error");
        }
    };

    const handleDrawerUpdateStatus = async (reportId, newStatus) => {
        const target = reports.find(r => r.id === reportId) || viewingReport;
        if (target && !canUserDispatchOrCloseTask(target, effectiveUser)) {
            showToast("Visualizadores possuem acesso somente leitura e não podem alterar o status.", "error");
            return;
        }
        try {
            await updateDoc(doc(db, "critical_reports", reportId), {
                status: newStatus,
                updatedAt: new Date()
            });
            showToast(`Status atualizado para ${newStatus}!`, "success");
            setViewingReport(prev => prev ? { ...prev, status: newStatus } : null);
        } catch (err) {
            console.error("Erro ao atualizar status:", err);
            showToast("Falha ao atualizar status: " + err.message, "error");
        }
    };

    const handleDrawerAddComment = async (reportId, content) => {
        const target = reports.find(r => r.id === reportId) || viewingReport;
        if (target && isUserWatcherOnly(target, effectiveUser)) {
            showToast("Visualizadores possuem permissão estritamente de leitura.", "error");
            return;
        }
        try {
            const reportRef = doc(db, "critical_reports", reportId);
            const currentComments = Array.isArray(target?.comments) ? target.comments : [];
            const newComment = {
                authorId: currentUser?.uid || 'user',
                authorName: currentUser?.name || currentUser?.email?.split('@')[0] || 'Técnico',
                content: content.trim(),
                date: new Date().toLocaleString('pt-BR')
            };
            await updateDoc(reportRef, {
                comments: [...currentComments, newComment],
                updatedAt: new Date()
            });
            showToast("Parecer técnico registrado com sucesso!", "success");
            setViewingReport(prev => prev ? { ...prev, comments: [...(prev.comments || []), newComment] } : null);
        } catch (err) {
            console.error("Erro ao adicionar parecer:", err);
            showToast("Falha ao registrar parecer: " + err.message, "error");
        }
    };

    // Abre o relatório automaticamente se disparado por notificação push ou clique de alerta (validando RLS)
    useEffect(() => {
        const handleOpenReport = (e) => {
            if (e.detail?.report) {
                const found = reports.find(r => r.id === e.detail.report.id) || e.detail.report;
                if (!canUserViewTask(found, effectiveUser)) {
                    showToast("Acesso negado: você não possui permissão para acessar este chamado.", "error");
                    return;
                }
                setViewingReport(found);
                setIsFullModalOpen(true);
                setIsDrawerOpen(false);
                setQuickStatus(found.status || 'Pendente');
                setQuickComment(found.adminComment || found.closingComment || '');
                setNewCommentText('');
                setNewCommentStatus(found.status || 'Pendente');
                setModalWatcherToAdd('');
            }
        };
        window.addEventListener('HUBDESK_OPEN_REPORT', handleOpenReport);
        return () => window.removeEventListener('HUBDESK_OPEN_REPORT', handleOpenReport);
    }, [reports, effectiveUser, showToast]);

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

    // Adicionar novo comentário na thread (Colaborador ou Gestão; bloqueado para Visualizadores somente leitura)
    const handleAddComment = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!viewingReport || !newCommentText.trim()) return;
        if (isUserWatcherOnly(viewingReport, effectiveUser)) {
            showToast("Visualizadores possuem acesso apenas de leitura e não podem alterar o chamado.", "error");
            return;
        }

        setSendingComment(true);
        try {
            const userUid = currentUser?.firestoreId || currentUser?.uid || 'user';
            const userName = currentUser?.name || currentUser?.displayName || resolveUserName(currentUser?.email) || 'Usuário';
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

            // Se for gestor/supervisor ou responsável e alterou o status junto com o comentário
            if (canUserDispatchOrCloseTask(viewingReport, effectiveUser) && newCommentStatus && newCommentStatus !== viewingReport.status) {
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
        if (!canUserDispatchOrCloseTask(viewingReport, effectiveUser)) {
            showToast("Sem permissão para alterar status ou encerrar este chamado.", "error");
            return;
        }
        setQuickSaving(true);
        try {
            const userName = currentUser?.name || currentUser?.displayName || resolveUserName(currentUser?.email) || 'Gestão';
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

    const getTypeIcon = (categoryOrType, className = "w-4 h-4") => {
        const cat = normalizeCategory(categoryOrType);
        if (cat === 'error_analysis') return <Bug className={`${className} text-rose-600`} />;
        if (cat === 'task') return <CheckSquare className={`${className} text-sky-600`} />;
        if (cat === 'system_improvement') return <Monitor className={`${className} text-indigo-600`} />;
        if (cat === 'facility_improvement') return <Building className={`${className} text-emerald-600`} />;
        return <Sparkles className={`${className} text-purple-600`} />;
    };

    const getTypeBadge = (categoryOrType) => {
        const meta = getCategoryMetadata(categoryOrType);
        const cat = normalizeCategory(categoryOrType);
        return (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${meta.theme.badgeClass}`}>
                {cat === 'error_analysis' && <Bug className="w-3.5 h-3.5" />}
                {cat === 'task' && <CheckSquare className="w-3.5 h-3.5" />}
                {cat === 'system_improvement' && <Monitor className="w-3.5 h-3.5" />}
                {cat === 'facility_improvement' && <Building className="w-3.5 h-3.5" />}
                {cat === 'other' && <Sparkles className="w-3.5 h-3.5" />}
                <span>{meta.label}</span>
            </span>
        );
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
                        className={`rounded-xl px-3 py-1.5 sm:py-2 border shadow-2xs flex items-center justify-between gap-2 min-w-0 transition-all text-left cursor-pointer ${
                            statusFilter === '' && clientImpactFilter === ''
                                ? 'bg-zinc-200/80 border-zinc-700 text-neutral-900 ring-2 ring-zinc-700/25 shadow-xs' 
                                : 'bg-white border-gray-200/90 text-gray-700 hover:border-gray-300'
                        }`}
                        title="Mostrar todas as solicitações"
                    >
                        <div className="min-w-0 flex-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider block truncate ${statusFilter === '' && clientImpactFilter === '' ? 'text-neutral-800' : 'text-gray-500'}`}>
                                Total Registrado
                            </span>
                            <span className={`text-sm sm:text-base font-black mt-0.5 block truncate leading-none ${statusFilter === '' && clientImpactFilter === '' ? 'text-neutral-950' : 'text-gray-900'}`}>
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
                        className={`rounded-xl px-3 py-1.5 sm:py-2 border shadow-2xs flex items-center justify-between gap-2 min-w-0 transition-all text-left cursor-pointer ${
                            statusFilter === 'Pendente' 
                                ? 'bg-amber-100 border-amber-600 text-amber-950 ring-2 ring-amber-500/30 shadow-xs' 
                                : 'bg-white border-gray-200/90 text-gray-700 hover:border-amber-300'
                        }`}
                        title="Filtrar por solicitações pendentes"
                    >
                        <div className="min-w-0 flex-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider block truncate ${statusFilter === 'Pendente' ? 'text-amber-900' : 'text-amber-700'}`}>
                                Pendentes
                            </span>
                            <span className={`text-sm sm:text-base font-black mt-0.5 block truncate leading-none ${statusFilter === 'Pendente' ? 'text-amber-950' : 'text-amber-800'}`}>
                                {metricsSummary.pending}
                            </span>
                        </div>
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs ${
                            statusFilter === 'Pendente' 
                                ? 'bg-amber-600 text-white border-amber-700' 
                                : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                    </button>

                    <button 
                        onClick={() => { setStatusFilter('Em Andamento'); setClientImpactFilter(''); }}
                        className={`rounded-xl px-3 py-1.5 sm:py-2 border shadow-2xs flex items-center justify-between gap-2 min-w-0 transition-all text-left cursor-pointer ${
                            statusFilter === 'Em Andamento' 
                                ? 'bg-blue-100 border-blue-600 text-blue-950 ring-2 ring-blue-500/30 shadow-xs' 
                                : 'bg-white border-gray-200/90 text-gray-700 hover:border-blue-300'
                        }`}
                        title="Filtrar por solicitações em andamento"
                    >
                        <div className="min-w-0 flex-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider block truncate ${statusFilter === 'Em Andamento' ? 'text-blue-900' : 'text-blue-700'}`}>
                                Em Andamento
                            </span>
                            <span className={`text-sm sm:text-base font-black mt-0.5 block truncate leading-none ${statusFilter === 'Em Andamento' ? 'text-blue-950' : 'text-blue-800'}`}>
                                {metricsSummary.inProgress}
                            </span>
                        </div>
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs ${
                            statusFilter === 'Em Andamento' 
                                ? 'bg-blue-600 text-white border-blue-700' 
                                : 'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                            <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                    </button>

                    <button 
                        onClick={() => { setStatusFilter('Resolvido'); setClientImpactFilter(''); }}
                        className={`rounded-xl px-3 py-1.5 sm:py-2 border shadow-2xs flex items-center justify-between gap-2 min-w-0 transition-all text-left cursor-pointer ${
                            statusFilter === 'Resolvido' 
                                ? 'bg-emerald-100 border-emerald-600 text-emerald-950 ring-2 ring-emerald-500/30 shadow-xs' 
                                : 'bg-white border-gray-200/90 text-gray-700 hover:border-emerald-300'
                        }`}
                        title="Filtrar por solicitações resolvidas"
                    >
                        <div className="min-w-0 flex-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider block truncate ${statusFilter === 'Resolvido' ? 'text-emerald-900' : 'text-emerald-700'}`}>
                                Resolvidos
                            </span>
                            <span className={`text-sm sm:text-base font-black mt-0.5 block truncate leading-none ${statusFilter === 'Resolvido' ? 'text-emerald-950' : 'text-emerald-800'}`}>
                                {metricsSummary.resolved}
                            </span>
                        </div>
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs ${
                            statusFilter === 'Resolvido' 
                                ? 'bg-emerald-600 text-white border-emerald-700' 
                                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                            <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                    </button>

                    <button 
                        onClick={() => { setClientImpactFilter('Sim'); setStatusFilter(''); }}
                        className={`rounded-xl px-3 py-1.5 sm:py-2 border shadow-2xs flex items-center justify-between gap-2 min-w-0 transition-all text-left cursor-pointer col-span-2 sm:col-span-1 ${
                            clientImpactFilter === 'Sim' 
                                ? 'bg-red-100 border-red-600 text-red-950 ring-2 ring-red-500/30 shadow-xs' 
                                : 'bg-white border-gray-200/90 text-gray-700 hover:border-red-300'
                        }`}
                        title="Filtrar por casos que impactaram o cliente"
                    >
                        <div className="min-w-0 flex-1">
                            <span className={`text-[10px] font-bold uppercase tracking-wider block truncate ${clientImpactFilter === 'Sim' ? 'text-red-900' : 'text-red-700'}`}>
                                Afetou Cliente
                            </span>
                            <span className={`text-sm sm:text-base font-black mt-0.5 block truncate leading-none ${clientImpactFilter === 'Sim' ? 'text-red-950' : 'text-red-800'}`}>
                                {metricsSummary.clientImpact}
                            </span>
                        </div>
                        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs ${
                            clientImpactFilter === 'Sim' 
                                ? 'bg-red-600 text-white border-red-700' 
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

                    {/* Filtros Dropdowns Compactos e Inteligentes */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Filtro por Categoria Oficial */}
                        <select 
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-800 bg-white focus:ring-1 focus:ring-red-500 outline-none cursor-pointer"
                            title="Filtrar por categoria"
                        >
                            <option value="">Categoria: Todas</option>
                            <option value="error_analysis">Análise de Erro (48h)</option>
                            <option value="system_improvement">Melhoria de Sistema (120h)</option>
                            <option value="facility_improvement">Melhoria de Ambiente (72h)</option>
                            <option value="other">Outros / Ideias (72h)</option>
                        </select>

                        {/* Filtro por Departamento de Origem */}
                        <select 
                            value={departmentFilter}
                            onChange={(e) => setDepartmentFilter(e.target.value)}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 bg-white focus:ring-1 focus:ring-red-500 outline-none cursor-pointer"
                            title="Filtrar por setor de origem"
                        >
                            <option value="">Setor: Todos</option>
                            {ERROR_DEPARTMENTS.map(d => (
                                <option key={d} value={d}>{d}</option>
                            ))}
                        </select>

                        {/* Filtro por Status */}
                        <select 
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 bg-white focus:ring-1 focus:ring-red-500 outline-none cursor-pointer"
                            title="Filtrar por status do chamado"
                        >
                            <option value="">Status: Todos</option>
                            <option value="Pendente">Pendente</option>
                            <option value="Em Andamento">Em Andamento</option>
                            <option value="Resolvido">Resolvido</option>
                            <option value="Cancelado">Cancelado</option>
                        </select>

                        {/* Filtro por Indicador de SLA */}
                        <select 
                            value={slaFilter}
                            onChange={(e) => setSlaFilter(e.target.value)}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 bg-white focus:ring-1 focus:ring-red-500 outline-none cursor-pointer"
                            title="Filtrar por prazo de SLA"
                        >
                            <option value="">SLA: Todos</option>
                            <option value="ok">No Prazo</option>
                            <option value="warning">Vence Hoje / Atenção</option>
                            <option value="breached">SLA Estourado / Atrasado</option>
                        </select>

                        {/* Filtro por Impacto no Cliente */}
                        <select 
                            value={clientImpactFilter}
                            onChange={(e) => setClientImpactFilter(e.target.value)}
                            className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 bg-white focus:ring-1 focus:ring-red-500 outline-none cursor-pointer"
                            title="Filtrar por impacto direto ao cliente"
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

            {/* BANNER DE DETECÇÃO DE FALHAS MASSIVAS POR REGIÃO (ISP ENTERPRISE) */}
            <MassiveOutageBanner 
                reports={reports} 
                onFilterByRegion={setRegionFilter} 
                activeRegionFilter={regionFilter} 
            />

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
                                            <th className="px-4 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Ticket</th>
                                            <th className="px-4 py-3.5 text-left font-bold text-xs uppercase tracking-wider">SLA ISP</th>
                                            <th className="px-4 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Data</th>
                                            <th className="px-4 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Status</th>
                                            <th className="px-4 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Tipo</th>
                                            <th className="px-4 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Resumo & Prioridade</th>
                                            <th className="px-4 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Solicitante</th>
                                            <th className="px-4 py-3.5 text-center font-bold text-xs uppercase tracking-wider">Impacto</th>
                                            <th className="px-4 py-3.5 text-right font-bold text-xs uppercase tracking-wider">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {filteredReports.map((report) => (
                                            <tr key={report.id} className="hover:bg-gray-50/80 transition-colors group cursor-pointer" onClick={() => handleOpenViewModal(report)}>
                                                <td className="px-4 py-3.5 whitespace-nowrap font-mono text-xs font-bold text-gray-500">
                                                    #{report.id.slice(0, 6).toUpperCase()}
                                                </td>
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    {(() => {
                                                        const sla = calculateSlaStatus(report);
                                                        return (
                                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border ${sla.badgeClass}`}>
                                                                <Clock className="w-3 h-3" />
                                                                {sla.remainingText}
                                                            </span>
                                                        );
                                                    })()}
                                                </td>
                                                <td className="px-4 py-3.5 whitespace-nowrap text-xs text-gray-600 font-medium">
                                                    {formatDate(report.date)}
                                                </td>
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    {getStatusBadge(report.status)}
                                                </td>
                                                <td className="px-4 py-3.5 whitespace-nowrap">
                                                    {getTypeBadge(report.category || report.type)}
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
                                                        <div className="flex items-start justify-between gap-1.5 flex-wrap">
                                                            {getTypeBadge(report.category || report.type)}
                                                            <div className="flex items-center gap-1">
                                                                {(() => {
                                                                    const sla = calculateSlaStatus(report);
                                                                    return (
                                                                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${sla.badgeClass}`}>
                                                                            {sla.remainingText}
                                                                        </span>
                                                                    );
                                                                })()}
                                                                {getPriorityBadge(report.priority)}
                                                            </div>
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
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                            {getTypeBadge(report.category || report.type)}
                                            <div className="flex items-center gap-1.5">
                                                {(() => {
                                                    const sla = calculateSlaStatus(report);
                                                    return (
                                                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border ${sla.badgeClass}`}>
                                                            {sla.remainingText}
                                                        </span>
                                                    );
                                                })()}
                                                {getStatusBadge(report.status)}
                                            </div>
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
                                            <div className="w-24 shrink-0">
                                                {(() => {
                                                    const sla = calculateSlaStatus(report);
                                                    return (
                                                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${sla.badgeClass}`}>
                                                            {sla.remainingText}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                            <div className="shrink-0">
                                                {getTypeBadge(report.category || report.type)}
                                            </div>
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
            {/* NOVO MODAL DINÂMICO E CONTEXTUAL DE SOLICITAÇÃO (ISP ARCHITECTURE)        */}
            {/* ========================================================================= */}
            <NewRequestModal 
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingId(null); }}
                onSave={handleSaveRequest}
                editingReport={editingId ? reports.find(r => r.id === editingId) : null}
                saving={saving}
                canManage={canManageTickets}
                user={effectiveUser}
                collaborators={collaborators}
            />

            {/* ========================================================================= */}
            {/* MODAL DE VISUALIZAÇÃO EVOLUÍDO E COMPLETO (EXPANDIDO)                     */}
            {/* ========================================================================= */}
            {viewingReport && isFullModalOpen && canUserViewTask(viewingReport, effectiveUser) && (
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
                                        {/* Badge em Destaque do Departamento de Origem */}
                                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-950/80 text-indigo-200 border border-indigo-500/40 inline-flex items-center gap-1">
                                            <Building className="w-3 h-3 text-indigo-400" />
                                            Departamento: {getTaskOriginDepartment(viewingReport) || 'Geral / Suporte'}
                                        </span>
                                        {viewingReport.affectedClient === 'Sim' ? (
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-950/80 text-rose-200 border border-rose-500/40 inline-flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3 text-rose-400" />
                                                Afetou Cliente: Sim
                                            </span>
                                        ) : (
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-400 border border-zinc-700 inline-flex items-center gap-1">
                                                Afetou Cliente: Não
                                            </span>
                                        )}
                                        {isUserWatcherOnly(viewingReport, effectiveUser) && (
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950/80 text-amber-200 border border-amber-500/40 inline-flex items-center gap-1">
                                                <Eye className="w-3 h-3 text-amber-400" />
                                                Visualizador (Somente Leitura)
                                            </span>
                                        )}
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
                                    onClick={() => {
                                        setViewingReport(null);
                                        setIsFullModalOpen(false);
                                    }} 
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
                                {/* Aviso de Modo Visualizador (Somente Leitura) */}
                                {isUserWatcherOnly(viewingReport, effectiveUser) && (
                                    <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-950 text-xs flex items-center gap-2.5 shadow-2xs">
                                        <Eye className="w-4 h-4 text-indigo-600 shrink-0" />
                                        <span>
                                            <strong>Modo Visualizador (Somente Leitura):</strong> Você consta na lista de visualizadores deste chamado e pode acompanhar o status e todas as interações, sem permissão para editar campos, encerrar o chamado ou gerenciar visualizadores.
                                        </span>
                                    </div>
                                )}

                                {/* Painel Unificado de Metadados e Solicitante */}
                                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 pb-4 border-b border-gray-100">
                                        <div>
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tipo de O.S.</span>
                                            {getTypeBadge(viewingReport.category || viewingReport.type)}
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Status Atual</span>
                                            {getStatusBadge(viewingReport.status)}
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Prioridade</span>
                                            {getPriorityBadge(viewingReport.priority || 'Normal')}
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Departamento</span>
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-bold mt-0.5">
                                                <Building className="w-3 h-3 text-indigo-600" />
                                                {getTaskOriginDepartment(viewingReport) || 'Geral / Suporte'}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Data / Prazo</span>
                                            <span className="text-xs font-bold text-gray-900 block mt-0.5">
                                                {formatDate(viewingReport.due_date || viewingReport.date)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Afetou Cliente?</span>
                                            {viewingReport.affectedClient === 'Sim' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 mt-0.5">
                                                    <AlertTriangle className="w-3 h-3 text-rose-600" /> Sim
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-500 font-medium block mt-1">Não</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Informação Breve de Como Afetou o Cliente */}
                                    {viewingReport.affectedClient === 'Sim' && (
                                        <div className="p-3.5 bg-rose-50/80 rounded-xl border border-rose-200 space-y-1">
                                            <span className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                                                <AlertOctagon className="w-3.5 h-3.5 text-rose-600" />
                                                Impacto no Atendimento ao Cliente:
                                            </span>
                                            <p className="text-xs text-rose-800 leading-relaxed font-medium">
                                                {viewingReport.howAffected || 'Impacto confirmado pelo solicitante.'}
                                            </p>
                                        </div>
                                    )}

                                    {/* Solicitante e Data de Criação */}
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-0.5 pb-4 border-b border-gray-100">
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

                                    {/* CONTROLE DE RESPONSÁVEL (ASSIGNED_TO) E VISUALIZADORES (WATCHERS) */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                        {/* Coluna 1: Responsável Atribuído */}
                                        <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                                    <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                                                    Responsável pela Tarefa
                                                </span>
                                                {!getTaskAssignee(viewingReport) && (
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                                        Fila Gestor / Supervisor
                                                    </span>
                                                )}
                                            </div>

                                            {canUserAssignResponsible(viewingReport, effectiveUser) ? (
                                                <select
                                                    value={getTaskAssignee(viewingReport)?.id || ''}
                                                    onChange={(e) => handleAssignResponsible(viewingReport, e.target.value)}
                                                    className="w-full p-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-800 bg-white focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                                                >
                                                    <option value="">
                                                        Sem responsável (Visível p/ Gestores e Supervisores)
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
                                                <div className="text-xs font-semibold text-gray-800 py-1">
                                                    {getTaskAssignee(viewingReport) ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 border border-blue-200">
                                                            <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                                                            {getTaskAssignee(viewingReport).name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-600">
                                                            Sem responsável atribuído (Direcionado a Gestores e Supervisores)
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Coluna 2: Visualizadores (Watchers) */}
                                        <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                                                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                                    Visualizadores ({getTaskWatchers(viewingReport).length})
                                                </span>
                                                <span className="text-[10px] text-gray-400">
                                                    Somente leitura
                                                </span>
                                            </div>

                                            {canUserManageWatchers(viewingReport, effectiveUser) && (
                                                <div className="flex gap-1.5">
                                                    <select
                                                        value={modalWatcherToAdd}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setModalWatcherToAdd(val);
                                                            if (val) {
                                                                handleAddWatcherToReport(viewingReport, val);
                                                            }
                                                        }}
                                                        className="flex-1 p-2 border border-gray-300 rounded-lg text-xs text-gray-800 bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
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

                                            {getTaskWatchers(viewingReport).length > 0 ? (
                                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                                    {getTaskWatchers(viewingReport).map((w) => (
                                                        <span
                                                            key={w.id}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-900 border border-indigo-200 text-xs font-semibold"
                                                        >
                                                            <span>{w.name}</span>
                                                            {canUserManageWatchers(viewingReport, effectiveUser) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveWatcherFromReport(viewingReport, w.id)}
                                                                    className="text-indigo-500 hover:text-red-600 cursor-pointer ml-0.5"
                                                                    title="Remover visualizador"
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[11px] text-gray-400 italic">
                                                    Nenhum visualizador adicionado.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Descrição Completa Estendida (Renderização Markdown GFM Segura + Tabelas) */}
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
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                        <SafeMarkdown content={viewingReport.description || 'Sem descrição informada.'} />
                                    </div>
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

                                    {/* Formulário Interativo de Envio de Comentário (Bloqueado para Visualizadores somente leitura) */}
                                    {!isUserWatcherOnly(viewingReport, effectiveUser) && (
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
                                                    {/* Se for gestor/supervisor ou responsável, pode alterar o status do ticket no próprio envio do comentário */}
                                                    {canUserDispatchOrCloseTask(viewingReport, effectiveUser) ? (
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
                                    )}
                                </div>

                                {/* LADO DIREITO: DESPACHO & GESTÃO DO TICKET (OU VISÃO DA GESTÃO) */}
                                <div className="flex flex-col gap-4">
                                    {canUserDispatchOrCloseTask(viewingReport, effectiveUser) ? (
                                        /* PAINEL DE GESTÃO DO TICKET (GESTOR / SUPERVISOR / RESPONSÁVEL) */
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
                                        /* PAINEL DE FEEDBACK E RESOLUÇÃO VISÍVEL AO COLABORADOR / VISUALIZADOR */
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
                                                {!isUserWatcherOnly(viewingReport, effectiveUser) && (
                                                    <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 text-[11px] text-blue-900 space-y-1.5">
                                                        <div className="flex items-center gap-1.5 font-bold text-blue-950 text-xs">
                                                            <MessageSquare className="w-4 h-4 text-blue-600" />
                                                            Interação Contínua
                                                        </div>
                                                        <p className="leading-relaxed text-[11px] text-blue-800">
                                                            Precisa complementar informações, anexar protocolos ou responder dúvidas da gestão? Utilize o campo de comentários ao lado para dialogar em sequência sem precisar recriar ou editar o chamado original.
                                                        </p>
                                                    </div>
                                                )}

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
                                onClick={() => {
                                    setViewingReport(null);
                                    setIsFullModalOpen(false);
                                }} 
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

            {/* ========================================================================= */}
            {/* DRAWER LATERAL DE INSPEÇÃO DE TICKET (SLIDE-OVER ISP ERGONÔMICO)         */}
            {/* ========================================================================= */}
            <TicketDrawer
                report={viewingReport}
                isOpen={isDrawerOpen && Boolean(viewingReport) && !isFullModalOpen && canUserViewTask(viewingReport, effectiveUser)}
                onClose={() => {
                    setIsDrawerOpen(false);
                    setViewingReport(null);
                    setIsFullModalOpen(false);
                }}
                onUpdateStatus={handleDrawerUpdateStatus}
                onAddComment={handleDrawerAddComment}
                canManage={canUserDispatchOrCloseTask(viewingReport, effectiveUser)}
                onExpandFull={() => setIsFullModalOpen(true)}
                user={effectiveUser}
            />

        </div>
    );
};

export default Reports;

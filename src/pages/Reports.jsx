import React, { useState, useEffect, useMemo } from 'react';
import { 
    Plus, Search, Eye, Edit2, Trash2, X, Loader2, 
    AlertTriangle, CheckCircle, Clock, Filter, 
    Lightbulb, Monitor, Building, Zap, Bug, MessageSquare, Send,
    Table, Columns3, LayoutGrid, List, Copy, ChevronLeft, ChevronRight,
    User, ShieldCheck, Check, Sparkles, AlertOctagon, RotateCcw, Hourglass, Lock,
    CornerDownRight, MessageCircle, ChevronUp, ChevronDown, UserCheck, CheckSquare, ArrowUpDown
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
import ReportDetailModal from '../components/reports/ReportDetailModal';
import SafeMarkdown from '../components/reports/SafeMarkdown';
import { BorderBeam } from '../components/magicui/BorderBeam';
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
import { sendReportDm } from '../services/discordDm';
import { formatDateTime } from '../utils/reportTimeline';
import {
    SORT_OPTIONS, UNASSIGNED_FILTER, MINE_FILTER, getDefaultSortDir, getAssigneeName, getLastChange,
    formatRelativeTime, isStale, matchesAssigneeFilter, listAssignees, sortReports
} from '../utils/reportTable';

const TABLE_PAGE_SIZE = 50;

// Cabeçalho de coluna que ordena a tabela ao clicar (clicar de novo inverte)
function SortHeader({ label, sortKey, sort, onSort, className = '' }) {
    const active = sort.key === sortKey;
    const Icon = !active ? ArrowUpDown : (sort.dir === 'asc' ? ChevronUp : ChevronDown);
    return (
        <th className={`px-4 py-3.5 text-left font-bold text-xs uppercase tracking-wider ${className}`} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
            <button type="button" onClick={() => onSort(sortKey)} className={`inline-flex items-center gap-1 uppercase tracking-wider font-bold cursor-pointer hover:text-gray-900 ${active ? 'text-red-600' : ''}`} title={`Ordenar por ${label}`}>
                {label}
                <Icon className={`w-3 h-3 ${active ? '' : 'opacity-50'}`} aria-hidden="true" />
            </button>
        </th>
    );
}

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
    const [assigneeFilter, setAssigneeFilter] = useState(''); // Responsável: todos, eu, sem responsável ou uma pessoa
    const [sort, setSort] = useState({ key: 'default', dir: 'desc' });
    const [visibleCount, setVisibleCount] = useState(TABLE_PAGE_SIZE);
    const [nowMs, setNowMs] = useState(() => Date.now()); // referência dos textos "há 5 min"

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


    useEffect(() => {
        const timer = setInterval(() => setNowMs(Date.now()), 60 * 1000);
        return () => clearInterval(timer);
    }, []);

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

    const myIds = useMemo(() => [effectiveUser?.id, effectiveUser?.uid, effectiveUser?.email, currentUser?.firestoreId, currentUser?.uid].filter(Boolean).map(String), [effectiveUser, currentUser]);
    const assigneeOptions = useMemo(() => listAssignees(reports), [reports]);

    // Relatórios filtrados (e ordenados)
    const filteredReports = useMemo(() => {
        const filtered = reports.filter(r => {
            const titleSafe = getDisplayTitle(r).toLowerCase();
            const descSafe = (r.description || '').toLowerCase();
            const protoSafe = (r.protocol || '').toLowerCase();
            const authorSafe = (r.creatorName || '').toLowerCase();
            const assigneeSafe = getAssigneeName(r).toLowerCase();
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
                assigneeSafe.includes(searchLower) ||
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
            const matchAssignee = matchesAssigneeFilter(r, assigneeFilter, myIds);
            const matchRegion = !regionFilter || (r.region && r.region.toLowerCase().includes(regionFilter.toLowerCase())) || (r.title && r.title.toLowerCase().includes(regionFilter.toLowerCase()));

            return matchSearch && matchStatus && matchCategory && matchDepartment && matchSla && matchType && matchPriority && matchClient && matchCreator && matchAssignee && matchRegion;
        });
        return sortReports(filtered, sort.key, sort.dir);
    }, [reports, searchTerm, statusFilter, categoryFilter, departmentFilter, slaFilter, typeFilter, priorityFilter, clientImpactFilter, creatorFilter, assigneeFilter, regionFilter, myIds, sort]);

    // Métricas para o Ribbon de Resumo
    const metricsSummary = useMemo(() => {
        const total = reports.length;
        const pending = reports.filter(r => r.status === 'Pendente' || !r.status).length;
        const inProgress = reports.filter(r => r.status === 'Em Andamento').length;
        const resolved = reports.filter(r => r.status === 'Resolvido' || r.status === 'Concluído').length;
        const suspended = reports.filter(r => r.status === 'Suspenso').length;
        const clientImpact = reports.filter(r => r.affectedClient === 'Sim').length;
        return { total, pending, inProgress, resolved, suspended, clientImpact };
    }, [reports]);

    const hasActiveFilters = Boolean(searchTerm || statusFilter || categoryFilter || departmentFilter || slaFilter || typeFilter || priorityFilter || clientImpactFilter || creatorFilter || assigneeFilter || regionFilter);

    // A paginação da tabela volta ao início quando filtros ou ordenação mudam (ajuste durante a renderização)
    const listSignature = [searchTerm, statusFilter, categoryFilter, departmentFilter, slaFilter, typeFilter, priorityFilter, clientImpactFilter, creatorFilter, assigneeFilter, regionFilter, sort.key, sort.dir].join('|');
    const [appliedSignature, setAppliedSignature] = useState(listSignature);
    if (listSignature !== appliedSignature) {
        setAppliedSignature(listSignature);
        setVisibleCount(TABLE_PAGE_SIZE);
    }
    const visibleRows = filteredReports.slice(0, visibleCount);

    const handleSort = (key) => {
        setSort(prev => (prev.key === key
            ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
            : { key, dir: getDefaultSortDir(key) }));
    };

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
        setAssigneeFilter('');
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
                if (canManageTickets && existingRep && reportPayload.status && reportPayload.status !== existingRep.status) {
                    void sendReportDm({ report: existingRep, kind: 'status' }); // DM ao solicitante
                }
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
            if (target && target.status !== newStatus) void sendReportDm({ report: target, kind: 'status' });
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
            void sendReportDm({ report: target, kind: 'comment' });
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

            // DM ao solicitante: mudança de status (com comentário junto) ou só o comentário
            const statusChanged = Boolean(updateData.status && updateData.status !== viewingReport.status);
            void sendReportDm({ report: viewingReport, kind: statusChanged ? 'status' : 'comment', withComment: statusChanged });

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

            // DM ao solicitante: status mudou (com parecer junto) ou só o parecer
            const quickStatusChanged = Boolean(updatePayload.status && updatePayload.status !== viewingReport.status);
            const quickCommentAdded = Boolean(updatePayload.comments);
            if (quickStatusChanged) {
                void sendReportDm({ report: viewingReport, kind: 'status', withComment: quickCommentAdded });
            } else if (quickCommentAdded) {
                void sendReportDm({ report: viewingReport, kind: 'comment' });
            }
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
            case 'Suspenso':
                return (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/25 inline-flex items-center gap-1.5 whitespace-nowrap shadow-xs">
                        <Hourglass className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Suspenso
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
            <div className="flex-1 flex flex-col items-center justify-center bg-canvas text-primary-hub h-full p-8">
                <Loader2 className="w-10 h-10 text-red-600 animate-spin mb-3" />
                <p className="text-sm font-medium text-gray-600">Carregando tarefas e relatórios...</p>
            </div>
        );
    }

    return (
        <div className="flex-1 p-2 sm:p-4 h-full flex flex-col bg-canvas text-primary-hub font-sans overflow-hidden">
            
            {/* CABEÇALHO EXECUTIVO (NO FUNDO DA PÁGINA) */}
            <header className="mb-2 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-rose-500 uppercase tracking-wider">
                        <Lightbulb className="w-3.5 h-3.5" />
                        <span>Central de Demandas & O.S.</span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="font-brand text-2xl sm:text-3xl font-bold text-primary-hub tracking-tight">
                            Tarefas & Relatórios
                        </h1>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-subtle text-secondary-hub border border-subtle">
                            {filteredReports.length} {filteredReports.length === 1 ? 'ticket' : 'tickets'}
                        </span>
                        {canViewAllReports ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 inline-flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-purple-500" /> Visão Operacional
                            </span>
                        ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 inline-flex items-center gap-1">
                                <User className="w-3 h-3 text-blue-500" /> Meus Chamados
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-secondary-hub mt-0.5">
                        Acompanhamento de chamados críticos, ordens de serviço, melhorias e tratativas com SLAs automatizados.
                    </p>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    {/* Toggle do Resumo */}
                    <button
                        type="button"
                        onClick={() => setShowSummary(prev => !prev)}
                        className="px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 bg-surface hover:bg-subtle text-secondary-hub hover:text-primary-hub border border-subtle shadow-xs active:scale-95"
                        title={showSummary ? "Ocultar cards de resumo" : "Exibir cards de resumo"}
                    >
                        {showSummary ? <ChevronUp className="w-3.5 h-3.5 text-muted-hub" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-hub" />}
                        <span className="hidden sm:inline">{showSummary ? 'Ocultar Resumo' : 'Ver Resumo'}</span>
                    </button>

                    {/* Modos de Visualização */}
                    <div className="flex items-center bg-subtle p-1 rounded-xl border border-subtle shrink-0 gap-1">
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                viewMode === 'table' ? 'bg-surface text-primary-hub shadow-xs font-black border border-subtle' : 'text-secondary-hub hover:text-primary-hub'
                            }`}
                            title="Tabela"
                        >
                            <Table className="w-3.5 h-3.5 text-rose-500" />
                            <span className="hidden sm:inline">Tabela</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('kanban')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                viewMode === 'kanban' ? 'bg-surface text-primary-hub shadow-xs font-black border border-subtle' : 'text-secondary-hub hover:text-primary-hub'
                            }`}
                            title="Kanban"
                        >
                            <Columns3 className="w-3.5 h-3.5 text-rose-500" />
                            <span className="hidden sm:inline">Kanban</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('cards')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                viewMode === 'cards' ? 'bg-surface text-primary-hub shadow-xs font-black border border-subtle' : 'text-secondary-hub hover:text-primary-hub'
                            }`}
                            title="Cards"
                        >
                            <LayoutGrid className="w-3.5 h-3.5 text-rose-500" />
                            <span className="hidden sm:inline">Cards</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('compact')}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                viewMode === 'compact' ? 'bg-surface text-primary-hub shadow-xs font-black border border-subtle' : 'text-secondary-hub hover:text-primary-hub'
                            }`}
                            title="Lista Compacta"
                        >
                            <List className="w-3.5 h-3.5 text-rose-500" />
                            <span className="hidden sm:inline">Compacta</span>
                        </button>
                    </div>

                    {/* Botão Nova Solicitação */}
                    <button
                        type="button"
                        onClick={openNewReportModal}
                        className="px-4 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-950/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Novo Chamado</span>
                    </button>
                </div>
            </header>

            {/* ========================================================================= */}
            {/* CARTÕES EXECUTIVOS DE STATUS & QUANTIDADE (6 CARDS BENTO FLUIDO)          */}
            {/* ========================================================================= */}
            {showSummary && (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mb-2 shrink-0 animate-in fade-in duration-150">
                    {/* Card 1: Total Geral */}
                    <button 
                        onClick={() => { setStatusFilter(''); setClientImpactFilter(''); }}
                        className={`rounded-2xl p-3.5 border shadow-xs flex items-center justify-between gap-3 transition-all text-left cursor-pointer active:scale-98 ${
                            statusFilter === '' && clientImpactFilter === ''
                                ? 'bg-surface border-rose-500 ring-2 ring-rose-500/30' 
                                : 'bg-surface border-subtle hover:border-border-hub hover:bg-subtle/50'
                        }`}
                        title="Ver todas as solicitações"
                    >
                        <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider block truncate text-muted-hub">
                                Total Registrado
                            </span>
                            <span className="text-xl sm:text-2xl font-black mt-0.5 block truncate leading-tight font-brand text-primary-hub">
                                {metricsSummary.total}
                            </span>
                        </div>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-subtle text-primary-hub border-subtle shadow-xs">
                            <Sparkles className="w-4 h-4 text-rose-500" />
                        </div>
                    </button>

                    {/* Card 2: Pendentes */}
                    <button 
                        onClick={() => { setStatusFilter('Pendente'); setClientImpactFilter(''); }}
                        className={`rounded-2xl p-3.5 border shadow-xs flex items-center justify-between gap-3 transition-all text-left cursor-pointer active:scale-98 ${
                            statusFilter === 'Pendente' 
                                ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/30' 
                                : 'bg-surface border-subtle hover:border-border-hub hover:bg-subtle/50'
                        }`}
                        title="Filtrar por solicitações pendentes"
                    >
                        <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider block truncate text-amber-600 dark:text-amber-400">
                                Pendentes
                            </span>
                            <span className="text-xl sm:text-2xl font-black mt-0.5 block truncate leading-tight font-brand text-amber-700 dark:text-amber-400">
                                {metricsSummary.pending}
                            </span>
                        </div>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-xs">
                            <Clock className="w-4 h-4" />
                        </div>
                    </button>

                    {/* Card 3: Em Andamento */}
                    <button 
                        onClick={() => { setStatusFilter('Em Andamento'); setClientImpactFilter(''); }}
                        className={`rounded-2xl p-3.5 border shadow-xs flex items-center justify-between gap-3 transition-all text-left cursor-pointer active:scale-98 ${
                            statusFilter === 'Em Andamento' 
                                ? 'bg-blue-500/10 border-blue-500 ring-2 ring-blue-500/30' 
                                : 'bg-surface border-subtle hover:border-border-hub hover:bg-subtle/50'
                        }`}
                        title="Filtrar por solicitações em andamento"
                    >
                        <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider block truncate text-blue-600 dark:text-blue-400">
                                Em Andamento
                            </span>
                            <span className="text-xl sm:text-2xl font-black mt-0.5 block truncate leading-tight font-brand text-blue-700 dark:text-blue-400">
                                {metricsSummary.inProgress}
                            </span>
                        </div>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 shadow-xs">
                            <Clock className="w-4 h-4" />
                        </div>
                    </button>

                    {/* Card 4: Suspensos (NOVO STATUS) */}
                    <button 
                        onClick={() => { setStatusFilter('Suspenso'); setClientImpactFilter(''); }}
                        className={`rounded-2xl p-3.5 border shadow-xs flex items-center justify-between gap-3 transition-all text-left cursor-pointer active:scale-98 ${
                            statusFilter === 'Suspenso' 
                                ? 'bg-purple-500/10 border-purple-500 ring-2 ring-purple-500/30' 
                                : 'bg-surface border-subtle hover:border-border-hub hover:bg-subtle/50'
                        }`}
                        title="Filtrar por chamados suspensos (aguardando terceiro / cliente)"
                    >
                        <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider block truncate text-purple-600 dark:text-purple-400">
                                Suspensos
                            </span>
                            <span className="text-xl sm:text-2xl font-black mt-0.5 block truncate leading-tight font-brand text-purple-700 dark:text-purple-400">
                                {metricsSummary.suspended || 0}
                            </span>
                        </div>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 shadow-xs">
                            <Hourglass className="w-4 h-4" />
                        </div>
                    </button>

                    {/* Card 5: Resolvidos */}
                    <button 
                        onClick={() => { setStatusFilter('Resolvido'); setClientImpactFilter(''); }}
                        className={`rounded-2xl p-3.5 border shadow-xs flex items-center justify-between gap-3 transition-all text-left cursor-pointer active:scale-98 ${
                            statusFilter === 'Resolvido' 
                                ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/30' 
                                : 'bg-surface border-subtle hover:border-border-hub hover:bg-subtle/50'
                        }`}
                        title="Filtrar por solicitações resolvidas"
                    >
                        <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider block truncate text-emerald-600 dark:text-emerald-400">
                                Resolvidos
                            </span>
                            <span className="text-xl sm:text-2xl font-black mt-0.5 block truncate leading-tight font-brand text-emerald-700 dark:text-emerald-400">
                                {metricsSummary.resolved}
                            </span>
                        </div>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-xs">
                            <CheckCircle className="w-4 h-4" />
                        </div>
                    </button>

                    {/* Card 6: Afeta Cliente */}
                    <button 
                        onClick={() => { setClientImpactFilter('Sim'); setStatusFilter(''); }}
                        className={`rounded-2xl p-3.5 border shadow-xs flex items-center justify-between gap-3 transition-all text-left cursor-pointer active:scale-98 ${
                            clientImpactFilter === 'Sim' 
                                ? 'bg-rose-500/10 border-rose-500 ring-2 ring-rose-500/30' 
                                : 'bg-surface border-subtle hover:border-border-hub hover:bg-subtle/50'
                        }`}
                        title="Filtrar por chamados que impactaram o cliente"
                    >
                        <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider block truncate text-rose-600 dark:text-rose-400">
                                Afeta Cliente
                            </span>
                            <span className="text-xl sm:text-2xl font-black mt-0.5 block truncate leading-tight font-brand text-rose-700 dark:text-rose-400">
                                {metricsSummary.clientImpact}
                            </span>
                        </div>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-xs">
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                    </button>
                </div>
            )}

            {/* ========================================================================= */}
            {/* TOOLBAR INTEGRADA E COMPACTA (REF: MEU HISTÓRICO)                          */}
            {/* ========================================================================= */}
            <div className="bg-surface p-4 rounded-2xl border border-subtle shadow-xs mb-4 shrink-0">
                <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center justify-between">
                    
                    {/* Campo de Busca Compacto */}
                    <div className="flex-1 relative min-w-[200px]">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input 
                            type="text" 
                            placeholder="Buscar por título, descrição, protocolo, autor ou resposta..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-7 py-2 bg-subtle border border-subtle rounded-xl text-xs text-primary-hub placeholder:text-muted-hub focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all focus:bg-surface font-medium"
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
                            <option value="Suspenso">Suspenso</option>
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

                        <select
                            value={assigneeFilter}
                            onChange={(e) => setAssigneeFilter(e.target.value)}
                            className="px-2 py-1.5 border border-sky-200 rounded-lg text-xs font-medium text-sky-900 bg-sky-50/50 focus:ring-1 focus:ring-sky-500 outline-none cursor-pointer max-w-[160px] truncate"
                            title="Filtrar por responsável"
                            aria-label="Filtrar por responsável"
                        >
                            <option value="">Responsável: Todos</option>
                            <option value={MINE_FILTER}>Atribuídos a mim</option>
                            <option value={UNASSIGNED_FILTER}>Sem responsável (fila)</option>
                            {assigneeOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
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
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-2 text-xs text-gray-500">
                        <span>
                            {viewMode === 'table' && filteredReports.length > visibleRows.length
                                ? <>Mostrando <strong className="text-gray-700">{visibleRows.length}</strong> de <strong className="text-gray-700">{filteredReports.length}</strong> solicitações</>
                                : <><strong className="text-gray-700">{filteredReports.length}</strong> {filteredReports.length === 1 ? 'solicitação' : 'solicitações'}</>}
                            {hasActiveFilters ? ` (de ${reports.length} no total)` : ''}
                        </span>
                        <label className="flex items-center gap-1.5 font-medium">
                            Ordenar por
                            <select
                                value={sort.key}
                                onChange={(e) => setSort({ key: e.target.value, dir: getDefaultSortDir(e.target.value) })}
                                className="px-2 py-1 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 bg-white focus:ring-1 focus:ring-red-500 outline-none cursor-pointer"
                            >
                                {SORT_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                            </select>
                            {sort.key !== 'default' && (
                                <button
                                    type="button"
                                    onClick={() => setSort(prev => ({ ...prev, dir: prev.dir === 'asc' ? 'desc' : 'asc' }))}
                                    className="p-1 border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 cursor-pointer"
                                    title={sort.dir === 'asc' ? 'Ordem crescente (clique para inverter)' : 'Ordem decrescente (clique para inverter)'}
                                    aria-label="Inverter a ordem"
                                >
                                    {sort.dir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                            )}
                        </label>
                    </div>

                    {/* -------------------------------------- */}
                    {/* MODO 1: TABELA DETALHADA               */}
                    {/* -------------------------------------- */}
                    {viewMode === 'table' && (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden flex-1 min-h-0 flex flex-col">
                            <div className="overflow-x-auto overflow-y-auto flex-1">
                                <table className="min-w-full divide-y divide-gray-200 text-sm">
                                    <thead className="bg-subtle/90 text-muted-hub border-b border-subtle sticky top-0 z-10 backdrop-blur-xs">
                                        <tr>
                                            <th className="px-4 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Ticket</th>
                                            <SortHeader label="SLA ISP" sortKey="sla" sort={sort} onSort={handleSort} />
                                            <SortHeader label="Abertura" sortKey="date" sort={sort} onSort={handleSort} />
                                            <SortHeader label="Última alteração" sortKey="updated" sort={sort} onSort={handleSort} />
                                            <SortHeader label="Status" sortKey="status" sort={sort} onSort={handleSort} />
                                            <th className="px-4 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Tipo</th>
                                            <SortHeader label="Resumo & Prioridade" sortKey="priority" sort={sort} onSort={handleSort} />
                                            <th className="px-4 py-3.5 text-left font-bold text-xs uppercase tracking-wider">Solicitante</th>
                                            <SortHeader label="Responsável" sortKey="assignee" sort={sort} onSort={handleSort} />
                                            <th className="px-4 py-3.5 text-center font-bold text-xs uppercase tracking-wider">Impacto</th>
                                            <th className="px-4 py-3.5 text-right font-bold text-xs uppercase tracking-wider">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {visibleRows.map((report) => (
                                            <tr
                                                key={report.id}
                                                className="hover:bg-gray-50/80 focus-visible:bg-gray-50 focus-visible:outline-2 focus-visible:outline-red-500 transition-colors group cursor-pointer"
                                                onClick={() => handleOpenViewModal(report)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) handleOpenViewModal(report); }}
                                                tabIndex={0}
                                            >
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
                                                    {(() => {
                                                        const change = getLastChange(report);
                                                        if (change.at === null) return <span className="text-xs text-gray-400">--</span>;
                                                        const stale = isStale(report, nowMs);
                                                        return (
                                                            <div className="flex flex-col leading-tight" title={`${formatDateTime(change.at)}${change.by ? ` por ${change.by}` : ''}`}>
                                                                <span className="text-xs font-medium text-gray-700">{formatDateTime(change.at, new Date(nowMs))}</span>
                                                                <span className={`text-[11px] ${stale ? 'text-amber-600 font-semibold' : 'text-gray-400'}`}>
                                                                    {formatRelativeTime(change.at, nowMs)}{change.by ? ` • ${change.by}` : ''}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
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
                                                <td className="px-5 py-4 whitespace-nowrap">
                                                    {(() => {
                                                        const name = getAssigneeName(report);
                                                        return name ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center text-[10px] font-bold text-sky-700">
                                                                    {name.charAt(0).toUpperCase()}
                                                                </div>
                                                                <span className="text-xs font-medium text-gray-700 max-w-[140px] truncate" title={name}>{name}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs italic text-gray-400">Fila da liderança</span>
                                                        );
                                                    })()}
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
                                                            onClick={(e) => { e.stopPropagation(); handleOpenViewModal(report); }}
                                                            className="p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors border border-transparent hover:border-blue-200 cursor-pointer"
                                                            title="Ver Detalhes e Andamento"
                                                            aria-label="Ver detalhes e andamento"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        {canEditOrDelete(report) && (
                                                            <>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); openEditModal(report); }}
                                                                    className="p-1.5 text-amber-600 hover:bg-amber-50 hover:text-amber-700 rounded-lg transition-colors border border-transparent hover:border-amber-200 cursor-pointer"
                                                                    title="Editar Solicitação"
                                                                    aria-label="Editar solicitação"
                                                                >
                                                                    <Edit2 className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setDeletingReport(report); }}
                                                                    className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg transition-colors border border-transparent hover:border-red-200 cursor-pointer"
                                                                    title="Excluir"
                                                                    aria-label="Excluir solicitação"
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
                            {filteredReports.length > visibleRows.length && (
                                <div className="shrink-0 border-t border-gray-200 bg-gray-50/60 p-2.5 flex justify-center">
                                    <button
                                        type="button"
                                        onClick={() => setVisibleCount(n => n + TABLE_PAGE_SIZE)}
                                        className="px-4 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                                    >
                                        Mostrar mais ({filteredReports.length - visibleRows.length} restantes)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* -------------------------------------- */}
                    {/* MODO 2: QUADRO KANBAN POR STATUS       */}
                    {/* -------------------------------------- */}
                    {viewMode === 'kanban' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3.5 flex-1 min-h-0 overflow-y-auto">
                            {[
                                { status: 'Pendente', title: 'Triagem / Pendentes', color: 'border-amber-300 bg-amber-50/40 text-amber-900', badge: 'bg-amber-100 text-amber-800' },
                                { status: 'Em Andamento', title: 'Em Andamento', color: 'border-blue-300 bg-blue-50/40 text-blue-900', badge: 'bg-blue-100 text-blue-800' },
                                { status: 'Suspenso', title: 'Suspensos (Aguardando)', color: 'border-purple-300 bg-purple-50/40 text-purple-900', badge: 'bg-purple-100 text-purple-800' },
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
            {/* MODAL DE VISUALIZAÇÃO EVOLUÍDO E COMPLETO (EXPANDIDO v4.0.0)             */}
            {/* ========================================================================= */}
            <ReportDetailModal
                report={viewingReport}
                isOpen={isFullModalOpen && Boolean(viewingReport) && canUserViewTask(viewingReport, effectiveUser)}
                onClose={() => {
                    setViewingReport(null);
                    setIsFullModalOpen(false);
                }}
                onReportUpdate={(updatedReport) => {
                    setViewingReport(updatedReport);
                }}
                user={effectiveUser}
                currentUser={currentUser}
                collaborators={collaborators}
                canManageTickets={canManageTickets}
                canEditOrDelete={canEditOrDelete}
                onEdit={(rep) => {
                    setViewingReport(null);
                    setIsFullModalOpen(false);
                    openEditModal(rep);
                }}
                onDelete={(rep) => {
                    setViewingReport(null);
                    setIsFullModalOpen(false);
                    setDeletingReport(rep);
                }}
                onNavigate={navigateReport}
                hasPrev={hasPrevReport}
                hasNext={hasNextReport}
                currentIndex={currentViewingIndex}
                totalCount={filteredReports.length}
                showToast={showToast}
            />

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

import React, { useState, useEffect, useRef, useId } from 'react';
import {
    X, Check, AlertTriangle, Eye, Copy, ChevronLeft, ChevronRight,
    FileText, Bug, CheckSquare, Monitor, Building, Sparkles, ShieldCheck, Hourglass
} from 'lucide-react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../services/firebase';
import SafeMarkdown from './SafeMarkdown';
import { calculateSlaStatus } from '../../utils/ispHelpers';
import {
    normalizeCategory,
    getCategoryMetadata,
    getTaskOriginDepartment,
    getTaskAssignee,
    getTaskWatchers,
    isUserWatcherOnly,
    canUserManageWatchers,
    canUserAssignResponsible,
    canUserDispatchOrCloseTask,
    isUserTaskCreator
} from '../../types/request.types';
import { resolveUserName } from '../../utils/userResolvers';
import { sendReportDm } from '../../services/discordDm';
import {
    normalizeStatus, getStatusLabel, getOfficialOpinion, getStageDates, createEvent, createComment,
    formatDateOnly, formatDateTime
} from '../../utils/reportTimeline';
import { StatusPill } from './detail/badges';
import StatusStepper from './detail/StatusStepper';
import ActivityFeed from './detail/ActivityFeed';
import Composer from './detail/Composer';
import DetailSidebar from './detail/DetailSidebar';

const CATEGORY_ICON = {
    error_analysis: <Bug className="w-5 h-5 text-rose-500" aria-hidden="true" />,
    task: <CheckSquare className="w-5 h-5 text-sky-500" aria-hidden="true" />,
    system_improvement: <Monitor className="w-5 h-5 text-indigo-500" aria-hidden="true" />,
    facility_improvement: <Building className="w-5 h-5 text-emerald-500" aria-hidden="true" />
};

const FIELD_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

/**
 * ReportDetailModal (Hubdesk v4.16.0)
 * Duas colunas: conteúdo e linha do tempo à esquerda; dados e ações rápidas na barra lateral.
 * Status, atribuições e visualizadores viram eventos na linha do tempo (`events`).
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
    const [sending, setSending] = useState(false);
    const [composerRequest, setComposerRequest] = useState(null);
    const [copiedSummary, setCopiedSummary] = useState(false);
    const [copiedSolution, setCopiedSolution] = useState(false);
    const dialogRef = useRef(null);
    const titleId = useId();

    // Atalhos: Esc fecha; setas trocam de chamado, mas nunca enquanto a pessoa digita
    useEffect(() => {
        if (!isOpen) return undefined;
        const handleKeyDown = (e) => {
            const tag = e.target?.tagName;
            const typing = FIELD_TAGS.includes(tag) || e.target?.isContentEditable;
            if (e.key === 'Escape') {
                onClose();
            } else if (!typing && !e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowLeft' && hasPrev) {
                onNavigate('prev');
            } else if (!typing && !e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'ArrowRight' && hasNext) {
                onNavigate('next');
            } else if (e.key === 'Tab' && dialogRef.current) {
                const focusable = dialogRef.current.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, hasPrev, hasNext, onNavigate]);

    // Foco no diálogo ao abrir e de volta ao elemento anterior ao fechar
    useEffect(() => {
        if (!isOpen) return undefined;
        const previous = document.activeElement;
        dialogRef.current?.focus();
        return () => { if (previous && typeof previous.focus === 'function') previous.focus(); };
    }, [isOpen]);

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
    const status = normalizeStatus(report.status);
    const opinion = getOfficialOpinion(report);
    const stages = getStageDates(report);

    const myIds = [user?.id, user?.uid, user?.email, currentUser?.firestoreId, currentUser?.uid]
        .filter(Boolean).map(v => String(v).toLowerCase());
    const isMine = Boolean(assignee) && myIds.includes(String(assignee.id).toLowerCase());
    const actorId = currentUser?.firestoreId || currentUser?.uid || user?.uid || 'user';
    const actorName = currentUser?.name || currentUser?.displayName || resolveUserName(currentUser?.email) || user?.name || 'Usuário';
    const actor = { id: actorId, name: actorName, role: currentUser?.role || user?.role || '' };

    const isoDue = report.due_date || report.date;
    const protocol = report.id.slice(0, 8).toUpperCase();

    // Grava campos + eventos + comentários sem sobrescrever o que outras pessoas gravaram ao mesmo tempo
    const persist = async ({ fields = {}, events = [], comments = [] }) => {
        const now = new Date();
        const payload = { ...fields, updatedAt: now, lastActivityAt: now, lastUpdatedBy: actorName };
        if (events.length) payload.events = arrayUnion(...events);
        if (comments.length) payload.comments = arrayUnion(...comments);
        await updateDoc(doc(db, 'critical_reports', report.id), payload);
        const local = { ...report, ...fields, updatedAt: now, lastActivityAt: now, lastUpdatedBy: actorName };
        if (events.length) local.events = [...(Array.isArray(report.events) ? report.events : []), ...events];
        if (comments.length) local.comments = [...(Array.isArray(report.comments) ? report.comments : []), ...comments];
        onReportUpdate(local);
    };

    // Ações de cópia
    const handleCopySummary = () => {
        const title = report.title || report.titulo || report.type || 'Demanda';
        const resp = assignee ? assignee.name : 'Fila da liderança';
        const impact = report.affectedClient === 'Sim' ? `Sim (${report.howAffected || 'Impacto confirmado'})` : 'Não';
        const text = `📋 [HUBDESK • Chamado #${protocol}]\n🔹 Título: ${title}\n🔹 Tipo: ${catMeta.label} | Setor: ${originDept}\n🔹 Status: ${getStatusLabel(status)} | Prioridade: ${report.priority || 'Normal'}\n🔹 Responsável: ${resp}\n🔹 Afetou cliente: ${impact}\n🔹 Prazo: ${formatDateOnly(isoDue)}\n\n📝 Descrição:\n${report.description || 'Sem descrição.'}`;
        navigator.clipboard.writeText(text);
        setCopiedSummary(true);
        showToast('Resumo do chamado copiado.', 'success');
        setTimeout(() => setCopiedSummary(false), 2000);
    };

    const handleCopySolution = () => {
        if (!opinion) return;
        navigator.clipboard.writeText(opinion);
        setCopiedSolution(true);
        showToast('Parecer copiado.', 'success');
        setTimeout(() => setCopiedSolution(false), 2000);
    };

    // Atribuir responsável
    const handleAssign = async (assigneeId) => {
        if (!canAssign) {
            showToast('Apenas lideranças (Gestor / Supervisor) podem atribuir responsáveis.', 'error');
            return;
        }
        try {
            let resolved = null;
            if (assigneeId) {
                const matched = collaborators.find(c => String(c.id || c.uid || c.email || c.name) === String(assigneeId));
                if (matched) {
                    const aId = String(matched.id || matched.uid || matched.email || matched.name).trim();
                    resolved = {
                        id: aId,
                        uid: String(matched.uid || aId),
                        name: String(matched.name || matched.email || aId),
                        email: String(matched.email || ''),
                        role: String(matched.role || 'Operacional'),
                        assignedAt: new Date().toISOString(),
                        assignedBy: actorName
                    };
                }
            }
            if (assigneeId && !resolved) {
                showToast('Colaborador não encontrado.', 'error');
                return;
            }

            // Quem delega passa a acompanhar o chamado
            let updatedWatchers = getTaskWatchers(report);
            if (resolved && user && !isUserTaskCreator(report, user)) {
                const currentUserId = String(user.id || user.uid || user.email || '').trim();
                const alreadyWatching = updatedWatchers.some(w => String(w.id).toLowerCase() === currentUserId.toLowerCase());
                if (String(resolved.id) !== currentUserId && !alreadyWatching && currentUserId) {
                    updatedWatchers = [...updatedWatchers, {
                        id: currentUserId,
                        uid: String(user.uid || currentUserId),
                        name: String(user.name || user.displayName || user.email || 'Gestor'),
                        email: String(user.email || ''),
                        role: String(user.role || 'Gestor'),
                        addedAt: new Date().toISOString(),
                        addedBy: 'Sistema (Delegação)'
                    }];
                }
            }

            const fields = {
                assignedTo: resolved,
                assigned_to: resolved ? resolved.id : null,
                assignedToId: resolved ? resolved.id : null,
                assignedToName: resolved ? resolved.name : null,
                assignedToEmail: resolved ? resolved.email : null,
                watchers: updatedWatchers,
                watcherIds: updatedWatchers.map(w => w.id)
            };
            const event = createEvent({ type: 'assigned', actor, from: assignee?.name || '', targetName: resolved?.name || '' });
            await persist({ fields, events: [event] });
            showToast(resolved ? `Responsável atribuído: ${resolved.name}` : 'Chamado devolvido para a fila da liderança.', 'success');
        } catch (err) {
            showToast('Erro ao atribuir responsável: ' + err.message, 'error');
        }
    };

    const handleAssumeSelf = () => {
        const mine = collaborators.find(c => myIds.includes(String(c.id || c.uid || '').toLowerCase()) || (c.email && myIds.includes(String(c.email).toLowerCase())));
        if (!mine) {
            showToast('Seu perfil não está na lista de colaboradores. Escolha o responsável no seletor.', 'error');
            return;
        }
        handleAssign(String(mine.id || mine.uid || mine.email || mine.name));
    };

    // Visualizadores
    const handleAddWatcher = async (collabId) => {
        if (!collabId || !canWatch) return;
        try {
            const found = collaborators.find(c => String(c.id || c.uid || c.email || c.name) === String(collabId));
            if (!found) return;
            const fId = String(found.id || found.uid || found.email || found.name).trim();
            const current = getTaskWatchers(report);
            const exists = current.some(w =>
                String(w.id).toLowerCase() === fId.toLowerCase() ||
                (found.email && String(w.email || '').toLowerCase() === String(found.email).toLowerCase())
            );
            if (exists) {
                showToast('Este colaborador já é um visualizador deste chamado.', 'info');
                return;
            }
            const watcher = {
                id: fId,
                uid: String(found.uid || fId),
                name: String(found.name || found.email || fId),
                email: String(found.email || ''),
                role: String(found.role || 'Operacional'),
                addedAt: new Date().toISOString(),
                addedBy: actorName
            };
            const list = [...current, watcher];
            const event = createEvent({ type: 'watcher_added', actor, targetName: watcher.name });
            await persist({ fields: { watchers: list, watcherIds: list.map(w => w.id) }, events: [event] });
            showToast(`Visualizador ${watcher.name} adicionado.`, 'success');
        } catch (err) {
            showToast('Erro ao adicionar visualizador: ' + err.message, 'error');
        }
    };

    const handleRemoveWatcher = async (watcher) => {
        if (!canWatch) return;
        try {
            const list = getTaskWatchers(report).filter(w => String(w.id) !== String(watcher.id));
            const event = createEvent({ type: 'watcher_removed', actor, targetName: watcher.name });
            await persist({ fields: { watchers: list, watcherIds: list.map(w => w.id) }, events: [event] });
            showToast('Visualizador removido.', 'info');
        } catch (err) {
            showToast('Erro ao remover visualizador: ' + err.message, 'error');
        }
    };

    // Mudança direta de status (atalho "Iniciar")
    const handleStartWork = async () => {
        if (!canDispatch) return;
        try {
            const event = createEvent({ type: 'status', actor, from: status, to: 'Em Andamento' });
            await persist({ fields: { status: 'Em Andamento' }, events: [event] });
            void sendReportDm({ report, kind: 'status', withComment: false });
            showToast('Atendimento iniciado.', 'success');
        } catch (err) {
            showToast('Erro ao atualizar o chamado: ' + err.message, 'error');
        }
    };

    // Atalhos que pedem texto (Suspender, Resolver): preparam o campo de parecer
    const handleRequestStatus = (target) => {
        setComposerRequest({
            nonce: Date.now(),
            tab: 'opinion',
            status: target,
            placeholder: target === 'Suspenso' ? 'Informe o motivo da suspensão' : 'Descreva a solução aplicada para encerrar o chamado'
        });
    };

    // Envio do campo único (comentário ou parecer, com ou sem mudança de status)
    const handleComposerSubmit = async ({ tab, text, status: target }) => {
        if (isWatcher || sending) return false;
        const statusChanged = canDispatch && normalizeStatus(target) !== status;
        const newStatus = statusChanged ? normalizeStatus(target) : status;
        setSending(true);
        try {
            const events = [];
            const comments = [];
            const fields = {};
            if (statusChanged) {
                fields.status = newStatus;
                events.push(createEvent({ type: 'status', actor, from: status, to: newStatus }));
            }
            if (tab === 'opinion' && canDispatch) {
                if (text) {
                    fields.adminComment = text;
                    const lastOpinion = [...(Array.isArray(report.comments) ? report.comments : [])].reverse().find(c => c.kind === 'opinion');
                    const duplicated = lastOpinion && lastOpinion.content === text && !statusChanged;
                    if (!duplicated) comments.push(createComment({ text, actor, isStaff: true, kind: 'opinion', status: newStatus }));
                }
            } else if (text) {
                comments.push(createComment({ text, actor, isStaff: Boolean(canManageTickets) }));
            }
            if (!events.length && !comments.length && !Object.keys(fields).length) return true;

            await persist({ fields, events, comments });

            // Aviso ao solicitante: mudança de status (com o texto junto) ou só o comentário
            if (statusChanged) void sendReportDm({ report, kind: 'status', withComment: Boolean(text) });
            else if (comments.length) void sendReportDm({ report, kind: 'comment' });
            showToast(tab === 'opinion' ? 'Parecer registrado.' : 'Comentário adicionado.', 'success');
            return true;
        } catch (err) {
            showToast('Erro ao enviar: ' + err.message, 'error');
            return false;
        } finally {
            setSending(false);
        }
    };

    // Clicar no fundo escuro fecha (mouse pressionado e solto fora do diálogo)
    const handleBackdropMouseDown = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-2 sm:p-4 z-[85] backdrop-blur-md overflow-y-auto"
            onMouseDown={handleBackdropMouseDown}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className="relative bg-surface rounded-3xl shadow-2xl w-full max-w-5xl xl:max-w-6xl overflow-hidden flex flex-col max-h-[92vh] border border-subtle text-primary-hub outline-none animate-in fade-in zoom-in-95 duration-200"
            >
                {/* CABEÇALHO ENXUTO */}
                <div className="px-4 sm:px-6 py-3.5 flex items-center gap-3 shrink-0 border-b border-subtle">
                    <div className="p-2.5 bg-subtle rounded-xl border border-subtle shrink-0 hidden sm:block">
                        {CATEGORY_ICON[categoryKey] || <Sparkles className="w-5 h-5 text-purple-500" aria-hidden="true" />}
                    </div>
                    <span className="px-2.5 py-0.5 rounded-lg bg-subtle border border-subtle text-secondary-hub font-mono text-xs font-bold shrink-0">#{protocol}</span>
                    <h3 id={titleId} className="text-base sm:text-lg font-bold font-brand leading-tight truncate flex-1 min-w-0" title={report.title || 'Sem título'}>
                        {report.title || 'Solicitação sem título'}
                    </h3>
                    <StatusPill status={status} className="hidden sm:inline-flex" />
                    {isWatcher && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 inline-flex items-center gap-1 shrink-0">
                            <Eye className="w-3 h-3" aria-hidden="true" />Visualizador
                        </span>
                    )}
                    <div className="flex items-center bg-subtle rounded-xl border border-subtle p-0.5 shrink-0">
                        <button type="button" onClick={() => onNavigate('prev')} disabled={!hasPrev} aria-label="Chamado anterior" title="Anterior (←)"
                            className="p-1.5 text-secondary-hub hover:text-primary-hub disabled:opacity-30 transition-colors cursor-pointer rounded-lg hover:bg-canvas">
                            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <span className="text-xs font-mono text-muted-hub px-1.5">{currentIndex + 1}/{totalCount}</span>
                        <button type="button" onClick={() => onNavigate('next')} disabled={!hasNext} aria-label="Próximo chamado" title="Próximo (→)"
                            className="p-1.5 text-secondary-hub hover:text-primary-hub disabled:opacity-30 transition-colors cursor-pointer rounded-lg hover:bg-canvas">
                            <ChevronRight className="w-4 h-4" aria-hidden="true" />
                        </button>
                    </div>
                    <button type="button" onClick={handleCopySummary} aria-label="Copiar resumo do chamado" title="Copiar resumo"
                        className="p-2 rounded-xl text-muted-hub hover:text-primary-hub hover:bg-subtle border border-transparent hover:border-subtle transition-colors cursor-pointer shrink-0">
                        {copiedSummary ? <Check className="w-4 h-4 text-emerald-500" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
                    </button>
                    <button type="button" onClick={onClose} aria-label="Fechar" title="Fechar (Esc)"
                        className="p-2 rounded-xl text-muted-hub hover:text-primary-hub hover:bg-subtle border border-transparent hover:border-subtle transition-colors cursor-pointer shrink-0">
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                {/* CORPO: conteúdo à esquerda, detalhes à direita (no celular, detalhes ficam depois) */}
                <div className="flex-1 overflow-y-auto bg-canvas">
                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px]">
                        <div className="p-5 sm:p-6 space-y-5 min-w-0">
                            <div className="bg-surface rounded-2xl border border-subtle px-4 py-4 overflow-x-auto">
                                <StatusStepper status={status} stages={stages} />
                            </div>

                            {isWatcher && (
                                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-3">
                                    <Eye className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
                                    <span><strong>Modo visualizador (somente leitura):</strong> você acompanha o andamento, sem permissão para despachar ou comentar.</span>
                                </div>
                            )}

                            {status === 'Suspenso' && (
                                <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/25 text-purple-700 dark:text-purple-300 text-xs flex items-center gap-2.5">
                                    <Hourglass className="w-4 h-4 shrink-0" aria-hidden="true" />
                                    <span><strong>Chamado suspenso.</strong> Aguardando retorno do assinante, de fornecedor ou de tratativa externa.</span>
                                </div>
                            )}

                            {report.affectedClient === 'Sim' && (
                                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
                                    <span><strong>Afetou cliente.</strong> {report.howAffected || 'Impacto confirmado pelo solicitante na abertura.'}</span>
                                </div>
                            )}

                            <section aria-label="Descrição">
                                <h4 className="text-xs font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                    <FileText className="w-3.5 h-3.5 text-rose-500" aria-hidden="true" />Descrição
                                </h4>
                                <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-subtle text-primary-hub leading-relaxed overflow-x-auto text-sm">
                                    <SafeMarkdown content={report.description || 'Sem descrição informada no registro.'} />
                                </div>
                            </section>

                            {opinion && (
                                <section aria-label="Parecer oficial" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                                    <div className="flex items-center justify-between gap-3 mb-1.5">
                                        <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />Parecer oficial
                                        </h4>
                                        <button type="button" onClick={handleCopySolution} className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1 cursor-pointer">
                                            {copiedSolution ? <Check className="w-3 h-3" aria-hidden="true" /> : <Copy className="w-3 h-3" aria-hidden="true" />}
                                            {copiedSolution ? 'Copiado' : 'Copiar'}
                                        </button>
                                    </div>
                                    <p className="text-sm text-primary-hub leading-relaxed whitespace-pre-wrap">{opinion}</p>
                                    {report.lastUpdatedBy && (
                                        <p className="text-xs text-muted-hub mt-2">Atualizado por {report.lastUpdatedBy}{report.updatedAt ? ` • ${formatDateTime(report.updatedAt)}` : ''}</p>
                                    )}
                                </section>
                            )}

                            <ActivityFeed report={report} currentUserId={actorId} />

                            {!isWatcher && (
                                <Composer
                                    key={report.id}
                                    report={report}
                                    canDispatch={canDispatch}
                                    canManageTickets={canManageTickets}
                                    sending={sending}
                                    request={composerRequest}
                                    onSubmit={handleComposerSubmit}
                                />
                            )}
                        </div>

                        <DetailSidebar
                            report={report}
                            catMeta={catMeta}
                            originDept={originDept}
                            sla={sla}
                            assignee={assignee}
                            watchers={watchers}
                            collaborators={collaborators}
                            canAssign={canAssign}
                            canWatch={canWatch}
                            canDispatch={canDispatch}
                            canModify={canModify}
                            isMine={isMine}
                            onAssign={handleAssign}
                            onAssumeSelf={handleAssumeSelf}
                            onStartWork={handleStartWork}
                            onRequestStatus={handleRequestStatus}
                            onAddWatcher={handleAddWatcher}
                            onRemoveWatcher={handleRemoveWatcher}
                            onEdit={() => onEdit(report)}
                            onDelete={() => onDelete(report)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

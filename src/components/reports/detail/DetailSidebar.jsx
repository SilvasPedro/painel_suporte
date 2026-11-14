import React, { useState } from 'react';
import {
    UserPlus, Play, PauseCircle, CheckCircle2, Edit2, Trash2, Plus, X, Building, AlarmClock, UserCheck
} from 'lucide-react';
import { PriorityPill } from './badges';
import { formatDateOnly, formatDateTime, normalizeStatus, toMillis } from '../../../utils/reportTimeline';

const Label = ({ children }) => (
    <p className="text-xs font-semibold text-muted-hub uppercase tracking-wider mb-1.5">{children}</p>
);

const selectCls = 'w-full px-3 py-2 border border-subtle rounded-xl text-xs font-semibold text-primary-hub bg-surface focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none cursor-pointer';
const quickBtn = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-subtle bg-surface text-secondary-hub hover:text-primary-hub hover:border-strong transition-colors cursor-pointer';

const collabId = (c) => String(c.id || c.uid || c.email || c.name);
const isInactive = (c) => ['inativo', 'inactive', 'desligado'].includes(String(c.status || '').toLowerCase());

/** Barra lateral com todos os dados e ações rápidas do chamado. */
export default function DetailSidebar({
    report, catMeta, originDept, sla, assignee, watchers, collaborators,
    canAssign, canWatch, canDispatch, canModify, isMine,
    onAssign, onAssumeSelf, onStartWork, onRequestStatus, onAddWatcher, onRemoveWatcher, onEdit, onDelete
}) {
    const [addingWatcher, setAddingWatcher] = useState(false);
    const status = normalizeStatus(report.status);
    const dueRaw = report.due_date || report.date;
    const createdMs = toMillis(report.createdAt) ?? toMillis(report.date);
    const activeCollaborators = collaborators.filter(c => !isInactive(c) || (assignee && collabId(c) === String(assignee.id)));
    const open = status !== 'Resolvido' && status !== 'Cancelado';

    return (
        <aside aria-label="Detalhes do chamado" className="flex flex-col gap-5 p-5 bg-subtle/40 border-t lg:border-t-0 lg:border-l border-subtle">
            <div>
                <Label>Responsável</Label>
                {canAssign ? (
                    <select value={assignee?.id || ''} onChange={e => onAssign(e.target.value)} aria-label="Responsável pelo chamado" className={selectCls}>
                        <option value="">Fila da liderança (sem responsável)</option>
                        {activeCollaborators.map(c => (
                            <option key={collabId(c)} value={collabId(c)}>{c.name}{c.role ? ` (${c.role})` : ''}</option>
                        ))}
                    </select>
                ) : assignee ? (
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-primary-hub"><UserCheck className="w-4 h-4 text-sky-500" aria-hidden="true" />{assignee.name}</p>
                ) : (
                    <p className="text-xs text-muted-hub">Sem responsável. Roteado para a liderança.</p>
                )}

                {open && (canAssign || canDispatch) && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {canAssign && !isMine && (
                            <button type="button" className={quickBtn} onClick={onAssumeSelf}><UserPlus className="w-3.5 h-3.5" aria-hidden="true" />Assumir</button>
                        )}
                        {canDispatch && status === 'Pendente' && (
                            <button type="button" className={quickBtn} onClick={onStartWork}><Play className="w-3.5 h-3.5" aria-hidden="true" />Iniciar</button>
                        )}
                        {canDispatch && status !== 'Suspenso' && (
                            <button type="button" className={quickBtn} onClick={() => onRequestStatus('Suspenso')}><PauseCircle className="w-3.5 h-3.5" aria-hidden="true" />Suspender</button>
                        )}
                        {canDispatch && (
                            <button type="button" className={quickBtn} onClick={() => onRequestStatus('Resolvido')}><CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />Resolver</button>
                        )}
                    </div>
                )}
            </div>

            <div>
                <Label>Prioridade</Label>
                <PriorityPill priority={report.priority || 'Normal'} />
            </div>

            <div>
                <Label>Prazo e SLA</Label>
                <p className="text-sm font-semibold text-primary-hub">{formatDateOnly(dueRaw)}</p>
                <span className={`mt-1 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border ${sla.badgeClass}`}>
                    <AlarmClock className="w-3 h-3" aria-hidden="true" />{sla.remainingText}
                </span>
            </div>

            <div>
                <Label>Tipo e setor</Label>
                <p className="text-sm font-semibold text-primary-hub">{catMeta.label}</p>
                <p className="text-xs text-secondary-hub mt-0.5 flex items-center gap-1"><Building className="w-3 h-3" aria-hidden="true" />{originDept}</p>
            </div>

            <div>
                <Label>Solicitante</Label>
                <p className="text-sm font-semibold text-primary-hub">{report.creatorName || 'Autor desconhecido'}</p>
                {createdMs !== null && <p className="text-xs text-secondary-hub mt-0.5">Criado: {formatDateTime(createdMs)}</p>}
                {report.lastUpdatedBy && <p className="text-xs text-secondary-hub">Última ação: {report.lastUpdatedBy}</p>}
            </div>

            <div>
                <Label>Visualizadores ({watchers.length})</Label>
                <div className="flex flex-wrap gap-1.5">
                    {watchers.length === 0 && !canWatch && <p className="text-xs text-muted-hub">Nenhum visualizador.</p>}
                    {watchers.map(w => (
                        <span key={w.id} className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-1 rounded-full bg-surface text-primary-hub border border-subtle text-xs font-medium">
                            {w.name}
                            {canWatch && (
                                <button type="button" onClick={() => onRemoveWatcher(w)} aria-label={`Remover ${w.name} dos visualizadores`} className="p-0.5 rounded text-muted-hub hover:text-rose-500 cursor-pointer">
                                    <X className="w-3 h-3" aria-hidden="true" />
                                </button>
                            )}
                        </span>
                    ))}
                    {canWatch && !addingWatcher && (
                        <button type="button" onClick={() => setAddingWatcher(true)} aria-label="Adicionar visualizador" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-strong text-xs text-secondary-hub hover:text-primary-hub cursor-pointer">
                            <Plus className="w-3 h-3" aria-hidden="true" />Adicionar
                        </button>
                    )}
                </div>
                {canWatch && addingWatcher && (
                    <select
                        autoFocus
                        defaultValue=""
                        aria-label="Escolher visualizador"
                        onChange={e => { if (e.target.value) { onAddWatcher(e.target.value); setAddingWatcher(false); } }}
                        onBlur={() => setAddingWatcher(false)}
                        className={`${selectCls} mt-2`}
                    >
                        <option value="">Escolha um colaborador…</option>
                        {activeCollaborators.map(c => <option key={collabId(c)} value={collabId(c)}>{c.name}{c.role ? ` (${c.role})` : ''}</option>)}
                    </select>
                )}
            </div>

            {canModify && (
                <div className="pt-4 border-t border-subtle flex flex-col gap-1.5 mt-auto">
                    <button type="button" onClick={onEdit} className={`${quickBtn} w-full justify-start`}><Edit2 className="w-3.5 h-3.5" aria-hidden="true" />Editar solicitação</button>
                    <button type="button" onClick={onDelete} className={`${quickBtn} w-full justify-start text-rose-600 dark:text-rose-400 hover:text-rose-700`}><Trash2 className="w-3.5 h-3.5" aria-hidden="true" />Excluir</button>
                </div>
            )}
        </aside>
    );
}

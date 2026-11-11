import React, { useState } from 'react';
import { Edit2, Trash2, Send, MessageSquare, Phone, MapPin, Calendar, Clock, Hash, ShieldAlert } from 'lucide-react';
import { Modal, Button, Badge } from '../ui';
import { cn } from '../../utils/cn';
import {
    SMART_PRE_STATUSES, SMART_PRE_RESOLUTIONS, getStatusMeta, getResolutionMeta,
    getDaysToFirstContact, normalizeIssues, getIssueLabel, toDateKey
} from '../../utils/smartPre';

const inputCls = 'w-full px-3 py-2 rounded-xl bg-surface border border-subtle text-sm text-primary-hub placeholder:text-muted-hub focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 transition-colors';

const formatDate = (value) => {
    const key = toDateKey(value);
    if (!key) return '—';
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y}`;
};

const formatDateTime = (iso) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

const Info = ({ icon: Icon, label, children }) => (
    <div className="flex items-start gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-subtle border border-subtle flex items-center justify-center text-muted-hub shrink-0">
            <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-hub">{label}</p>
            <p className="text-sm text-primary-hub break-words">{children || '—'}</p>
        </div>
    </div>
);

/** Detalhes do cliente + relatos (comentários) e atualização de situação. Remontado a cada cliente (o pai usa `key`). */
export default function SmartPreDetailModal({ client, onClose, canEdit, onEdit, onDelete, onSubmitUpdate, submitting, deleting }) {
    const [text, setText] = useState('');
    const [status, setStatus] = useState(client.status || 'monitoring');
    const [resolutionType, setResolutionType] = useState(client.resolutionType || '');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState('');

    const statusMeta = getStatusMeta(client.status);
    const resolutionMeta = getResolutionMeta(client.resolutionType);
    const days = getDaysToFirstContact(client);
    const comments = Array.isArray(client.comments) ? client.comments : [];
    const changed = status !== (client.status || 'monitoring') || resolutionType !== (client.resolutionType || '');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!text.trim() && !changed) return;
        if (status === 'resolved' && !resolutionType) {
            setError('Informe como o problema foi resolvido antes de marcar como resolvido.');
            return;
        }
        const ok = await onSubmitUpdate({ text, status, resolutionType });
        if (ok) setText('');
    };

    return (
        <Modal
            isOpen
            onClose={onClose}
            size="xl"
            title={client.clientName}
            description={`Instalado em ${formatDate(client.installedAt)}${client.erpCode ? ` • Código ${client.erpCode}` : ''}`}
            footer={canEdit ? (
                confirmDelete ? (
                    <>
                        <span className="mr-auto text-xs text-rose-600 dark:text-rose-400 font-medium">Excluir este cliente e todos os relatos? Não dá para desfazer.</span>
                        <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancelar</Button>
                        <Button variant="danger" size="sm" icon={Trash2} loading={deleting} onClick={() => onDelete(client)}>Confirmar exclusão</Button>
                    </>
                ) : (
                    <>
                        <Button variant="ghost" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>Excluir</Button>
                        <Button variant="secondary" size="sm" icon={Edit2} onClick={() => onEdit(client)}>Editar cadastro</Button>
                    </>
                )
            ) : null}
        >
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Resumo */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant={statusMeta.variant} dot>{statusMeta.label}</Badge>
                        {resolutionMeta && <Badge variant="purple">{resolutionMeta.label}</Badge>}
                    </div>

                    <div className="space-y-3">
                        <Info icon={Phone} label="Telefone">{client.phone}</Info>
                        <Info icon={MapPin} label="Cidade / bairro">{client.city}</Info>
                        <Info icon={Hash} label="Código / contrato">{client.erpCode}</Info>
                        <Info icon={Calendar} label="Data da instalação">{formatDate(client.installedAt)}</Info>
                        <Info icon={Clock} label="Primeiro contato">
                            {client.contacted
                                ? `${formatDate(client.firstContactAt)}${days !== null ? ` (${days === 0 ? 'no mesmo dia' : `${days} dia${days > 1 ? 's' : ''} após instalar`})` : ''}${client.contactChannel ? ` • ${client.contactChannel}` : ''}`
                                : 'Ainda não entrou em contato'}
                        </Info>
                    </div>

                    {client.contacted && (
                        <div className="rounded-xl border border-subtle bg-subtle/40 p-3 space-y-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-hub">Problema relatado</p>
                            <div className="flex flex-wrap gap-1.5">
                                {normalizeIssues(client).map(id => <Badge key={id} variant="neutral" size="sm">{getIssueLabel(id)}</Badge>)}
                            </div>
                            {client.issueDescription && <p className="text-xs text-secondary-hub leading-relaxed whitespace-pre-wrap">{client.issueDescription}</p>}
                        </div>
                    )}
                </div>

                {/* Relatos */}
                <div className="lg:col-span-3 flex flex-col min-h-0">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-primary-hub mb-3">
                        <MessageSquare className="w-4 h-4 text-rose-500" /> Relatos e acompanhamento
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-subtle border border-subtle text-secondary-hub">{comments.length}</span>
                    </h3>

                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {comments.length === 0 ? (
                            <p className="text-xs text-muted-hub py-6 text-center rounded-xl border border-dashed border-subtle">Nenhum relato registrado ainda.</p>
                        ) : comments.map(c => (
                            <div key={c.id} className="rounded-xl border border-subtle bg-surface p-3">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="text-xs font-bold text-primary-hub truncate">
                                        {c.authorName}
                                        {c.authorRole && <span className="ml-1.5 font-medium text-muted-hub">• {c.authorRole}</span>}
                                    </span>
                                    <span className="text-[10px] text-muted-hub shrink-0">{formatDateTime(c.createdAt)}</span>
                                </div>
                                <p className="text-sm text-secondary-hub whitespace-pre-wrap break-words">{c.content}</p>
                            </div>
                        ))}
                    </div>

                    {canEdit ? (
                        <form onSubmit={handleSubmit} className="mt-4 space-y-3 rounded-2xl border border-subtle bg-subtle/40 p-3">
                            <textarea
                                rows={3}
                                value={text}
                                onChange={e => setText(e.target.value)}
                                maxLength={2000}
                                placeholder="Registre um relato: o que o cliente informou, o que foi feito, próximos passos…"
                                className={cn(inputCls, 'resize-none')}
                            />
                            {client.contacted ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <select aria-label="Situação" className={inputCls} value={status} onChange={e => setStatus(e.target.value)}>
                                        {SMART_PRE_STATUSES.filter(s => s.id !== 'monitoring').map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                    </select>
                                    <select aria-label="Tratativa" className={inputCls} value={resolutionType} onChange={e => setResolutionType(e.target.value)}>
                                        <option value="">Tratativa não definida</option>
                                        {SMART_PRE_RESOLUTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                                    </select>
                                </div>
                            ) : (
                                <p className="text-[11px] text-muted-hub flex items-center gap-1.5">
                                    <ShieldAlert className="w-3.5 h-3.5" /> Para alterar a situação, registre antes o contato do cliente em “Editar cadastro”.
                                </p>
                            )}
                            {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
                            <div className="flex justify-end">
                                <Button type="submit" size="sm" icon={Send} loading={submitting} disabled={!text.trim() && !changed}>
                                    {text.trim() ? 'Registrar relato' : 'Salvar andamento'}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <p className="mt-4 text-[11px] text-muted-hub">Seu perfil tem acesso somente de leitura nesta tela.</p>
                    )}
                </div>
            </div>
        </Modal>
    );
}

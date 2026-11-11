import React, { useState } from 'react';
import {
    Edit2, Trash2, Send, MessageSquare, Phone, MapPin, Calendar, Clock, Hash, Plus, FileText, Save, X, AlertCircle
} from 'lucide-react';
import { Modal, Button, Badge } from '../ui';
import { cn } from '../../utils/cn';
import {
    SMART_PRE_ISSUES, SMART_PRE_CHANNELS, SMART_PRE_RESOLUTIONS, PROTOCOL_STATUSES,
    getStatusMeta, getClientStatus, getProtocols, getProtocolStatusMeta, getResolutionMeta, getProtocolDuration,
    getDaysToFirstContact, getFirstContactDate, getIssueLabel, toDateKey, validateProtocol, buildProtocolRecord
} from '../../utils/smartPre';

const inputCls = 'w-full px-3 py-2 rounded-xl bg-surface border border-subtle text-sm text-primary-hub placeholder:text-muted-hub focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 transition-colors';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-secondary-hub mb-1';

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

const todayKey = () => toDateKey(new Date());

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

const emptyProtocolForm = () => ({
    id: '', protocol: '', openedAt: todayKey(), channel: SMART_PRE_CHANNELS[0], classification: '', description: '',
    status: 'open', closedAt: '', resolutionType: '', closingNotes: ''
});

/** Formulário de abertura/encerramento de protocolo, dentro do detalhe do cliente. */
function ProtocolForm({ client, initial, authorName, saving, onCancel, onSave }) {
    const [form, setForm] = useState(() => (initial ? {
        ...emptyProtocolForm(), ...initial, openedAt: toDateKey(initial.openedAt), closedAt: toDateKey(initial.closedAt)
    } : emptyProtocolForm()));
    const [errors, setErrors] = useState([]);
    const set = (patch) => setForm(prev => ({ ...prev, ...patch }));
    const isEditing = Boolean(initial);

    const setStatus = (status) => set({ status, closedAt: status === 'closed' && !form.closedAt ? todayKey() : form.closedAt });

    const submit = (e) => {
        e.preventDefault();
        const found = validateProtocol(form, client);
        setErrors(found);
        if (found.length === 0) onSave(buildProtocolRecord(form, { authorName }));
    };

    return (
        <form onSubmit={submit} className="rounded-2xl border border-rose-500/25 bg-rose-500/[0.04] p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-primary-hub">{isEditing ? 'Editar protocolo' : 'Novo protocolo de atendimento'}</h4>
                <button type="button" onClick={onCancel} aria-label="Cancelar" className="p-1 rounded-lg text-muted-hub hover:text-primary-hub hover:bg-subtle cursor-pointer"><X className="w-4 h-4" /></button>
            </div>

            {errors.length > 0 && (
                <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-400 space-y-1">
                    {errors.map(msg => <p key={msg} className="flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />{msg}</p>)}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label className={labelCls} htmlFor="pr-number">Nº do protocolo *</label>
                    <input id="pr-number" className={inputCls} value={form.protocol} onChange={e => set({ protocol: e.target.value })} maxLength={40} autoFocus />
                </div>
                <div>
                    <label className={labelCls} htmlFor="pr-opened">Abertura *</label>
                    <input id="pr-opened" type="date" min={toDateKey(client.installedAt) || undefined} max={todayKey()} className={inputCls} value={form.openedAt} onChange={e => set({ openedAt: e.target.value })} />
                </div>
                <div>
                    <label className={labelCls} htmlFor="pr-channel">Canal</label>
                    <select id="pr-channel" className={inputCls} value={form.channel} onChange={e => set({ channel: e.target.value })}>
                        {SMART_PRE_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>

            <div>
                <label className={labelCls} htmlFor="pr-class">Classificação de abertura *</label>
                <select id="pr-class" className={inputCls} value={form.classification} onChange={e => set({ classification: e.target.value })}>
                    <option value="">Selecione o que o cliente solicitou</option>
                    {SMART_PRE_ISSUES.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
                </select>
            </div>

            <div>
                <label className={labelCls} htmlFor="pr-desc">O que foi solicitado</label>
                <textarea id="pr-desc" rows={2} className={cn(inputCls, 'resize-none')} value={form.description} onChange={e => set({ description: e.target.value })} maxLength={1000} placeholder="Resumo do que o cliente relatou" />
            </div>

            <div>
                <span className={labelCls}>Situação do protocolo</span>
                <div className="flex gap-2">
                    {PROTOCOL_STATUSES.map(s => (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => setStatus(s.id)}
                            className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer',
                                form.status === s.id ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/40' : 'bg-surface text-secondary-hub border-subtle hover:border-strong'
                            )}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {form.status === 'closed' && (
                <div className="space-y-3 rounded-xl border border-subtle bg-surface p-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls} htmlFor="pr-closed">Data do encerramento *</label>
                            <input id="pr-closed" type="date" min={form.openedAt || undefined} max={todayKey()} className={inputCls} value={form.closedAt} onChange={e => set({ closedAt: e.target.value })} />
                        </div>
                        <div>
                            <label className={labelCls} htmlFor="pr-resolution">Encerramento *</label>
                            <select id="pr-resolution" className={inputCls} value={form.resolutionType} onChange={e => set({ resolutionType: e.target.value })}>
                                <option value="">Como foi encerrado?</option>
                                {SMART_PRE_RESOLUTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className={labelCls} htmlFor="pr-notes">Observações do encerramento</label>
                        <textarea id="pr-notes" rows={2} className={cn(inputCls, 'resize-none')} value={form.closingNotes} onChange={e => set({ closingNotes: e.target.value })} maxLength={1000} placeholder="O que foi feito para resolver" />
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>Cancelar</Button>
                <Button type="submit" size="sm" icon={Save} loading={saving}>{isEditing ? 'Salvar protocolo' : 'Registrar protocolo'}</Button>
            </div>
        </form>
    );
}

/** Detalhe do cliente: protocolos de atendimento e relatos. Remontado a cada cliente (o pai usa `key`). */
export default function SmartPreDetailModal({
    client, onClose, canEdit, authorName, onEdit, onDelete, onSaveProtocol, onDeleteProtocol, onSubmitComment,
    submitting, savingProtocol, deleting
}) {
    const [text, setText] = useState('');
    const [protocolForm, setProtocolForm] = useState(null); // null = fechado, 'new' = novo, objeto = edição
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [confirmProtocolId, setConfirmProtocolId] = useState('');

    const statusMeta = getStatusMeta(getClientStatus(client));
    const protocols = getProtocols(client);
    const days = getDaysToFirstContact(client);
    const firstContact = getFirstContactDate(client);
    const comments = Array.isArray(client.comments) ? client.comments : [];

    const handleSaveProtocol = async (record) => {
        const ok = await onSaveProtocol(record);
        if (ok) setProtocolForm(null);
    };

    const handleComment = async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        const ok = await onSubmitComment(text);
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
                        <span className="mr-auto text-xs text-rose-600 dark:text-rose-400 font-medium">Excluir este cliente, os protocolos e os relatos? Não dá para desfazer.</span>
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
                {/* Resumo do cliente */}
                <div className="lg:col-span-2 space-y-4">
                    <Badge variant={statusMeta.variant} dot>{statusMeta.label}</Badge>
                    <div className="space-y-3">
                        <Info icon={Phone} label="Telefone">{client.phone}</Info>
                        <Info icon={MapPin} label="Cidade / bairro">{client.city}</Info>
                        <Info icon={Hash} label="Código / contrato">{client.erpCode}</Info>
                        <Info icon={Calendar} label="Data da instalação">{formatDate(client.installedAt)}</Info>
                        <Info icon={Clock} label="Primeiro atendimento">
                            {firstContact
                                ? `${formatDate(firstContact)}${days !== null ? ` (${days === 0 ? 'no mesmo dia da instalação' : `${days} dia${days > 1 ? 's' : ''} após instalar`})` : ''}`
                                : 'Ainda não entrou em contato'}
                        </Info>
                    </div>
                </div>

                {/* Protocolos e relatos */}
                <div className="lg:col-span-3 space-y-6 min-w-0">
                    <section>
                        <div className="flex items-center justify-between gap-2 mb-3">
                            <h3 className="flex items-center gap-2 text-sm font-bold text-primary-hub">
                                <FileText className="w-4 h-4 text-rose-500" /> Protocolos de atendimento
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-subtle border border-subtle text-secondary-hub">{protocols.length}</span>
                            </h3>
                            {canEdit && !protocolForm && (
                                <Button size="sm" icon={Plus} onClick={() => setProtocolForm('new')}>Novo protocolo</Button>
                            )}
                        </div>

                        {protocolForm && (
                            <div className="mb-3">
                                <ProtocolForm
                                    key={protocolForm === 'new' ? 'new' : protocolForm.id}
                                    client={client}
                                    initial={protocolForm === 'new' ? null : protocolForm}
                                    authorName={authorName}
                                    saving={savingProtocol}
                                    onCancel={() => setProtocolForm(null)}
                                    onSave={handleSaveProtocol}
                                />
                            </div>
                        )}

                        {protocols.length === 0 && !protocolForm ? (
                            <p className="text-xs text-muted-hub py-6 text-center rounded-xl border border-dashed border-subtle">
                                Nenhum atendimento registrado. {canEdit ? 'Use “Novo protocolo” quando o cliente entrar em contato.' : ''}
                            </p>
                        ) : (
                            <ul className="space-y-2.5">
                                {[...protocols].reverse().map(p => {
                                    const st = getProtocolStatusMeta(p.status);
                                    const res = getResolutionMeta(p.resolutionType);
                                    const duration = getProtocolDuration(p);
                                    return (
                                        <li key={p.id} className="rounded-xl border border-subtle bg-surface p-3">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                                    <span className="font-mono text-xs font-bold text-primary-hub">{p.protocol ? `#${p.protocol}` : 'Sem nº de protocolo'}</span>
                                                    <Badge variant={st.variant} size="sm" dot>{st.label}</Badge>
                                                    {res && <Badge variant="purple" size="sm">{res.label}</Badge>}
                                                </div>
                                                {canEdit && (
                                                    confirmProtocolId === p.id ? (
                                                        <span className="flex items-center gap-1.5 text-[11px]">
                                                            <span className="text-rose-600 dark:text-rose-400 font-medium">Excluir protocolo?</span>
                                                            <Button variant="ghost" size="sm" onClick={() => setConfirmProtocolId('')}>Não</Button>
                                                            <Button variant="danger" size="sm" onClick={async () => { await onDeleteProtocol(p.id); setConfirmProtocolId(''); }}>Sim</Button>
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1">
                                                            <button type="button" aria-label="Editar protocolo" title="Editar / encerrar" onClick={() => setProtocolForm(p)} className="p-1.5 rounded-lg text-secondary-hub hover:text-primary-hub hover:bg-subtle cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                                                            <button type="button" aria-label="Excluir protocolo" title="Excluir" onClick={() => setConfirmProtocolId(p.id)} className="p-1.5 rounded-lg text-secondary-hub hover:text-rose-600 hover:bg-subtle cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                            <p className="text-[11px] text-muted-hub mt-1.5">
                                                Aberto em {formatDate(p.openedAt)}{p.channel ? ` • ${p.channel}` : ''} • <strong className="font-semibold text-secondary-hub">{getIssueLabel(p.classification)}</strong>
                                            </p>
                                            {p.description && <p className="text-xs text-secondary-hub mt-1.5 whitespace-pre-wrap break-words">{p.description}</p>}
                                            {p.status === 'closed' && (
                                                <p className="text-[11px] text-muted-hub mt-1.5 border-t border-subtle pt-1.5">
                                                    Encerrado em {formatDate(p.closedAt)}{duration !== null ? ` (${duration === 0 ? 'no mesmo dia' : `${duration} dia${duration > 1 ? 's' : ''} em aberto`})` : ''}
                                                    {p.closingNotes ? ` — ${p.closingNotes}` : ''}
                                                </p>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>

                    <section>
                        <h3 className="flex items-center gap-2 text-sm font-bold text-primary-hub mb-3">
                            <MessageSquare className="w-4 h-4 text-rose-500" /> Relatos e acompanhamento
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-subtle border border-subtle text-secondary-hub">{comments.length}</span>
                        </h3>

                        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                            {comments.length === 0 ? (
                                <p className="text-xs text-muted-hub py-5 text-center rounded-xl border border-dashed border-subtle">Nenhum relato registrado ainda.</p>
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
                            <form onSubmit={handleComment} className="mt-3 space-y-2 rounded-2xl border border-subtle bg-subtle/40 p-3">
                                <textarea
                                    rows={3}
                                    value={text}
                                    onChange={e => setText(e.target.value)}
                                    maxLength={2000}
                                    placeholder="Registre um relato: o que o cliente informou, o que foi feito, próximos passos…"
                                    className={cn(inputCls, 'resize-none')}
                                />
                                <div className="flex justify-end">
                                    <Button type="submit" size="sm" icon={Send} loading={submitting} disabled={!text.trim()}>Registrar relato</Button>
                                </div>
                            </form>
                        ) : (
                            <p className="mt-3 text-[11px] text-muted-hub">Seu perfil tem acesso somente de leitura nesta tela.</p>
                        )}
                    </section>
                </div>
            </div>
        </Modal>
    );
}

import React, { useState } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { Modal, Button } from '../ui';
import { cn } from '../../utils/cn';
import {
    SMART_PRE_ISSUES, SMART_PRE_CHANNELS, SMART_PRE_RESOLUTIONS, SMART_PRE_STATUSES,
    validateSmartPreClient, toDateKey, normalizeIssues
} from '../../utils/smartPre';

const inputCls = 'w-full px-3 py-2 rounded-xl bg-surface border border-subtle text-sm text-primary-hub placeholder:text-muted-hub focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 transition-colors';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-secondary-hub mb-1';

const todayKey = () => toDateKey(new Date());

const emptyForm = () => ({
    clientName: '', erpCode: '', phone: '', city: '',
    installedAt: todayKey(),
    contacted: false, firstContactAt: '', contactChannel: SMART_PRE_CHANNELS[0],
    issues: [], issueDescription: '',
    status: 'monitoring', resolutionType: ''
});

const fromClient = (client) => ({
    ...emptyForm(),
    ...client,
    installedAt: toDateKey(client.installedAt),
    firstContactAt: toDateKey(client.firstContactAt),
    issues: normalizeIssues(client),
    contactChannel: client.contactChannel || SMART_PRE_CHANNELS[0],
    resolutionType: client.resolutionType || ''
});

const Chip = ({ active, onClick, children }) => (
    <button
        type="button"
        onClick={onClick}
        className={cn(
            'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer',
            active ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/40' : 'bg-surface text-secondary-hub border-subtle hover:border-strong'
        )}
    >
        {children}
    </button>
);

/** Formulário de cadastro/edição. Remontado a cada abertura (o pai usa `key`), então o estado inicial vem das props. */
export default function SmartPreFormModal({ isOpen, onClose, client, onSave, saving }) {
    const [form, setForm] = useState(() => (client ? fromClient(client) : emptyForm()));
    const [errors, setErrors] = useState([]);
    const isEditing = Boolean(client);

    const set = (patch) => setForm(prev => ({ ...prev, ...patch }));

    const toggleContacted = (value) => {
        if (!value) {
            // Sem contato: limpa tudo que depende dele
            set({ contacted: false, firstContactAt: '', issues: [], issueDescription: '', status: 'monitoring', resolutionType: '' });
        } else {
            set({ contacted: true, status: form.status === 'monitoring' ? 'in_progress' : form.status });
        }
    };

    const toggleIssue = (id) => {
        const has = form.issues.includes(id);
        set({ issues: has ? form.issues.filter(i => i !== id) : [...form.issues, id] });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const found = validateSmartPreClient(form);
        setErrors(found);
        if (found.length === 0) onSave(form);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            title={isEditing ? 'Editar cliente Smart Pre' : 'Novo cliente Smart Pre'}
            description="Registre a entrada do cliente na base e, quando ele entrar em contato, o problema relatado e o tratamento dado."
            footer={(
                <>
                    <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button type="submit" form="smart-pre-form" icon={Save} loading={saving}>
                        {isEditing ? 'Salvar alterações' : 'Cadastrar cliente'}
                    </Button>
                </>
            )}
        >
            <form id="smart-pre-form" onSubmit={handleSubmit} className="space-y-5">
                {errors.length > 0 && (
                    <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-400 space-y-1">
                        {errors.map(msg => (
                            <p key={msg} className="flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />{msg}</p>
                        ))}
                    </div>
                )}

                <section className="space-y-3">
                    <h3 className="text-xs font-bold text-primary-hub">Dados do cliente</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                            <label className={labelCls} htmlFor="sp-name">Nome do cliente *</label>
                            <input id="sp-name" className={inputCls} value={form.clientName} onChange={e => set({ clientName: e.target.value })} maxLength={120} autoFocus />
                        </div>
                        <div>
                            <label className={labelCls} htmlFor="sp-erp">Código / contrato</label>
                            <input id="sp-erp" className={inputCls} value={form.erpCode} onChange={e => set({ erpCode: e.target.value })} maxLength={40} />
                        </div>
                        <div>
                            <label className={labelCls} htmlFor="sp-phone">Telefone</label>
                            <input id="sp-phone" className={inputCls} value={form.phone} onChange={e => set({ phone: e.target.value })} maxLength={30} />
                        </div>
                        <div>
                            <label className={labelCls} htmlFor="sp-city">Cidade / bairro</label>
                            <input id="sp-city" className={inputCls} value={form.city} onChange={e => set({ city: e.target.value })} maxLength={80} />
                        </div>
                        <div>
                            <label className={labelCls} htmlFor="sp-installed">Data da instalação *</label>
                            <input id="sp-installed" type="date" max={todayKey()} className={inputCls} value={form.installedAt} onChange={e => set({ installedAt: e.target.value })} />
                        </div>
                    </div>
                </section>

                <section className="space-y-3">
                    <h3 className="text-xs font-bold text-primary-hub">O cliente entrou em contato após a instalação?</h3>
                    <div className="flex gap-2">
                        <Chip active={!form.contacted} onClick={() => toggleContacted(false)}>Não, sem contato</Chip>
                        <Chip active={form.contacted} onClick={() => toggleContacted(true)}>Sim, entrou em contato</Chip>
                    </div>

                    {form.contacted && (
                        <div className="space-y-4 rounded-2xl border border-subtle bg-subtle/40 p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls} htmlFor="sp-first">Data do primeiro contato *</label>
                                    <input id="sp-first" type="date" min={form.installedAt || undefined} max={todayKey()} className={inputCls} value={form.firstContactAt} onChange={e => set({ firstContactAt: e.target.value })} />
                                </div>
                                <div>
                                    <label className={labelCls} htmlFor="sp-channel">Canal do contato</label>
                                    <select id="sp-channel" className={inputCls} value={form.contactChannel} onChange={e => set({ contactChannel: e.target.value })}>
                                        {SMART_PRE_CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <span className={labelCls}>Problema relatado *</span>
                                <div className="flex flex-wrap gap-2">
                                    {SMART_PRE_ISSUES.map(i => (
                                        <Chip key={i.id} active={form.issues.includes(i.id)} onClick={() => toggleIssue(i.id)}>{i.label}</Chip>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className={labelCls} htmlFor="sp-desc">Descrição do problema</label>
                                <textarea id="sp-desc" rows={3} className={cn(inputCls, 'resize-none')} value={form.issueDescription} onChange={e => set({ issueDescription: e.target.value })} maxLength={1000} placeholder="O que o cliente relatou e o que foi verificado" />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className={labelCls} htmlFor="sp-status">Situação</label>
                                    <select id="sp-status" className={inputCls} value={form.status} onChange={e => set({ status: e.target.value })}>
                                        {SMART_PRE_STATUSES.filter(s => s.id !== 'monitoring').map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls} htmlFor="sp-resolution">Tratativa {form.status === 'resolved' ? '*' : ''}</label>
                                    <select id="sp-resolution" className={inputCls} value={form.resolutionType} onChange={e => set({ resolutionType: e.target.value })}>
                                        <option value="">Ainda não definida</option>
                                        {SMART_PRE_RESOLUTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </form>
        </Modal>
    );
}

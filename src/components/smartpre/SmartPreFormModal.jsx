import React, { useState } from 'react';
import { Save, AlertCircle } from 'lucide-react';
import { Modal, Button } from '../ui';
import { validateSmartPreClient, toDateKey } from '../../utils/smartPre';

const inputCls = 'w-full px-3 py-2 rounded-xl bg-surface border border-subtle text-sm text-primary-hub placeholder:text-muted-hub focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 transition-colors';
const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-secondary-hub mb-1';

const todayKey = () => toDateKey(new Date());

const initialForm = (client) => ({
    clientName: client?.clientName || '',
    erpCode: client?.erpCode || '',
    phone: client?.phone || '',
    city: client?.city || '',
    installedAt: toDateKey(client?.installedAt) || todayKey()
});

/**
 * Cadastro do cliente (apenas dados da instalação). Os atendimentos entram depois, como protocolos.
 * Remontado a cada abertura (o pai usa `key`), então o estado inicial vem das props.
 */
export default function SmartPreFormModal({ isOpen, onClose, client, onSave, saving }) {
    const [form, setForm] = useState(() => initialForm(client));
    const [errors, setErrors] = useState([]);
    const isEditing = Boolean(client);

    const set = (patch) => setForm(prev => ({ ...prev, ...patch }));

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
            size="md"
            title={isEditing ? 'Editar cliente Smart Pre' : 'Novo cliente Smart Pre'}
            description={isEditing
                ? 'Atualize os dados do cadastro. Os atendimentos são registrados no detalhe do cliente.'
                : 'Cadastre o cliente que entrou na base. Depois, registre os protocolos de atendimento no detalhe dele.'}
            footer={(
                <>
                    <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
                    <Button type="submit" form="smart-pre-form" icon={Save} loading={saving}>
                        {isEditing ? 'Salvar alterações' : 'Cadastrar cliente'}
                    </Button>
                </>
            )}
        >
            <form id="smart-pre-form" onSubmit={handleSubmit} className="space-y-4">
                {errors.length > 0 && (
                    <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-400 space-y-1">
                        {errors.map(msg => (
                            <p key={msg} className="flex items-start gap-1.5"><AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" />{msg}</p>
                        ))}
                    </div>
                )}

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
            </form>
        </Modal>
    );
}

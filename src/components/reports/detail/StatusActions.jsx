import React, { useState, useRef, useEffect } from 'react';
import { Play, PauseCircle, CheckCircle2, XCircle, RotateCcw, Undo2, Loader2, AlertCircle, X } from 'lucide-react';
import { normalizeStatus, isClosedStatus } from '../../../utils/reportTimeline';

/** Status em que o comentário é obrigatório (motivo ou solução). */
const REQUIRES_COMMENT = ['Resolvido', 'Cancelado', 'Suspenso'];

const TONE = {
    Resolvido: { btn: 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent', ring: 'border-emerald-500/40 bg-emerald-500/5' },
    Cancelado: { btn: 'bg-surface text-rose-600 dark:text-rose-400 border-subtle hover:border-rose-500/50', ring: 'border-rose-500/40 bg-rose-500/5' },
    Suspenso: { btn: 'bg-surface text-purple-600 dark:text-purple-400 border-subtle hover:border-purple-500/50', ring: 'border-purple-500/40 bg-purple-500/5' },
    'Em Andamento': { btn: 'bg-surface text-sky-600 dark:text-sky-400 border-subtle hover:border-sky-500/50', ring: 'border-sky-500/40 bg-sky-500/5' },
    Pendente: { btn: 'bg-surface text-amber-600 dark:text-amber-400 border-subtle hover:border-amber-500/50', ring: 'border-amber-500/40 bg-amber-500/5' }
};

const buildActions = (current) => {
    const closed = isClosedStatus(current);
    const list = [
        { target: 'Em Andamento', label: closed ? 'Reabrir tarefa' : 'Iniciar atendimento', Icon: closed ? RotateCcw : Play },
        { target: 'Pendente', label: 'Voltar para pendente', Icon: Undo2 },
        { target: 'Suspenso', label: 'Suspender', Icon: PauseCircle },
        { target: 'Cancelado', label: 'Cancelar tarefa', Icon: XCircle },
        { target: 'Resolvido', label: 'Encerrar tarefa', Icon: CheckCircle2 }
    ];
    return list.filter(a => a.target !== current && !(closed && ['Suspenso', 'Cancelado'].includes(a.target)));
};

const confirmText = (action) => (action.target === 'Resolvido'
    ? 'Tenho certeza de que quero marcar esta tarefa como resolvida.'
    : `Confirmo que quero alterar o status desta tarefa (${action.label.toLowerCase()}).`);

const placeholderFor = (target) => ({
    Resolvido: 'Comentário de encerramento: descreva a solução aplicada',
    Cancelado: 'Informe o motivo do cancelamento',
    Suspenso: 'Informe o motivo da suspensão',
    'Em Andamento': 'Comentário (opcional)',
    Pendente: 'Comentário (opcional)'
}[target] || 'Comentário (opcional)');

/**
 * Única porta de entrada para mudar o status da tarefa.
 * Cada botão abre o mesmo painel: comentário + checkbox de confirmação.
 * @param status status atual do chamado
 * @param onSubmit ({ target, text }) => Promise<boolean>
 */
export default function StatusActions({ status, sending, onSubmit }) {
    const current = normalizeStatus(status);
    const [selected, setSelected] = useState(null); // alvo escolhido
    const [text, setText] = useState('');
    const [confirmed, setConfirmed] = useState(false);
    const [error, setError] = useState('');
    const areaRef = useRef(null);

    const actions = buildActions(current);
    const action = actions.find(a => a.target === selected) || null;

    useEffect(() => { if (selected) areaRef.current?.focus(); }, [selected]);

    const open = (target) => {
        setSelected(prev => (prev === target ? null : target));
        setConfirmed(false);
        setError('');
    };
    const close = () => { setSelected(null); setText(''); setConfirmed(false); setError(''); };

    const submit = async () => {
        if (!action) return;
        if (REQUIRES_COMMENT.includes(action.target) && !text.trim()) {
            setError(action.target === 'Resolvido' ? 'Escreva o comentário de encerramento.' : 'Escreva o comentário para continuar.');
            return;
        }
        if (!confirmed) { setError('Marque a caixa de confirmação.'); return; }
        const ok = await onSubmit({ target: action.target, text: text.trim() });
        if (ok) close();
    };

    if (!actions.length) return null;

    return (
        <section aria-label="Alterar status da tarefa" className="rounded-2xl border border-strong bg-surface p-3 space-y-3">
            <h4 className="text-xs font-bold text-secondary-hub uppercase tracking-wider">Status da tarefa</h4>

            <div className="flex flex-wrap gap-1.5">
                {actions.map(({ target, label, Icon }) => (
                    <button
                        key={target}
                        type="button"
                        aria-pressed={selected === target}
                        onClick={() => open(target)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${TONE[target].btn} ${selected === target ? 'ring-2 ring-offset-1 ring-offset-surface ring-current' : ''}`}
                    >
                        <Icon className="w-3.5 h-3.5" aria-hidden="true" />{label}
                    </button>
                ))}
            </div>

            {action && (
                <div className={`rounded-xl border p-3 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150 ${TONE[action.target].ring}`}>
                    <label className="block text-xs font-semibold text-secondary-hub" htmlFor="status-action-comment">
                        {action.target === 'Resolvido' ? 'Comentário de encerramento' : 'Comentário'}
                        {REQUIRES_COMMENT.includes(action.target) && <span className="text-rose-500"> *</span>}
                    </label>
                    <textarea
                        id="status-action-comment"
                        ref={areaRef}
                        rows={3}
                        value={text}
                        onChange={e => { setText(e.target.value); if (error) setError(''); }}
                        placeholder={placeholderFor(action.target)}
                        className="w-full p-3 border border-subtle rounded-xl text-sm text-primary-hub placeholder:text-muted-hub focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none bg-canvas resize-y leading-relaxed"
                    />

                    <label className="flex items-start gap-2 text-xs font-medium text-primary-hub cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={confirmed}
                            onChange={e => { setConfirmed(e.target.checked); if (error) setError(''); }}
                            className="mt-0.5 w-4 h-4 accent-rose-600 cursor-pointer"
                        />
                        <span>{confirmText(action)}</span>
                    </label>

                    {error && (
                        <p role="alert" className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                            <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />{error}
                        </p>
                    )}

                    <div className="flex items-center justify-end gap-2">
                        <button type="button" onClick={close} disabled={sending}
                            className="px-3 py-2 rounded-xl text-xs font-semibold text-secondary-hub hover:text-primary-hub border border-subtle bg-surface cursor-pointer inline-flex items-center gap-1.5">
                            <X className="w-3.5 h-3.5" aria-hidden="true" />Cancelar
                        </button>
                        <button type="button" onClick={submit} disabled={sending || !confirmed}
                            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${action.target === 'Resolvido' ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent' : 'bg-rose-600 hover:bg-rose-500 text-white border-transparent'}`}>
                            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <action.Icon className="w-3.5 h-3.5" aria-hidden="true" />}
                            {sending ? 'Salvando…' : action.target === 'Resolvido' ? 'Confirmar encerramento' : `Confirmar: ${action.label.toLowerCase()}`}
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}

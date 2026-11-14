import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
    STATUS_OPTIONS, normalizeStatus, getStatusLabel, validateComposer, getDraftKey
} from '../../../utils/reportTimeline';

const QUICK_STAFF = [
    'Faltam dados ou protocolo para análise.',
    'Em análise pela equipe técnica.',
    'Ajuste aplicado com sucesso.',
    'Aguardando retorno do solicitante.'
];
const QUICK_USER = [
    'Informações adicionadas conforme solicitado.',
    'Segue o protocolo de atendimento.',
    'Testado e confirmado o funcionamento.',
    'Gostaria de um retorno sobre o andamento.'
];

const readDraft = (reportId) => {
    try { return JSON.parse(sessionStorage.getItem(getDraftKey(reportId)) || 'null') || {}; } catch { return {}; }
};

/**
 * Campo único de envio: aba "Comentário" para todos e aba "Parecer e encerramento" para quem despacha.
 * O rascunho fica na sessão do navegador, então fechar ou trocar de chamado não perde o texto.
 * @param request { nonce, tab, status, placeholder } vindo dos atalhos da barra lateral
 * @param onSubmit ({ tab, text, status }) => Promise<boolean>
 */
export default function Composer({ report, canDispatch, canManageTickets, sending, request, onSubmit }) {
    const [initial] = useState(() => readDraft(report.id));
    const [tab, setTab] = useState(canDispatch && initial.tab === 'opinion' ? 'opinion' : 'comment');
    const [text, setText] = useState(initial.text || '');
    const [status, setStatus] = useState(initial.status || '');
    const [errors, setErrors] = useState([]);
    const [hint, setHint] = useState('');
    const areaRef = useRef(null);

    useEffect(() => {
        try {
            if (text.trim() || status) sessionStorage.setItem(getDraftKey(report.id), JSON.stringify({ tab, text, status }));
            else sessionStorage.removeItem(getDraftKey(report.id));
        } catch { /* sem acesso ao armazenamento */ }
    }, [report.id, tab, text, status]);

    // Atalhos da barra lateral (Suspender, Resolver...) preparam o campo; o estado é ajustado durante a renderização
    const [appliedRequest, setAppliedRequest] = useState(null);
    if (request && request !== appliedRequest && canDispatch) {
        setAppliedRequest(request);
        setTab(request.tab);
        setStatus(request.status || '');
        setHint(request.placeholder || '');
        setErrors([]);
    }
    useEffect(() => {
        if (!request || !canDispatch) return;
        areaRef.current?.focus();
        areaRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }, [request, canDispatch]);

    const current = normalizeStatus(report.status);
    const effective = status || current;
    const quick = canManageTickets ? QUICK_STAFF : QUICK_USER;

    const submit = async () => {
        const found = validateComposer({ tab, text, status: effective, currentStatus: current });
        setErrors(found);
        if (found.length) return;
        const ok = await onSubmit({ tab, text: text.trim(), status: effective });
        if (ok) {
            setText(''); setStatus(''); setHint('');
            try { sessionStorage.removeItem(getDraftKey(report.id)); } catch { /* ignora */ }
        }
    };

    const tabCls = (on) => `px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${on ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/40' : 'bg-surface text-secondary-hub border-subtle hover:border-strong'}`;
    const isOpinion = tab === 'opinion';

    return (
        <section aria-label="Responder" className="rounded-2xl border border-strong bg-surface p-3 space-y-2.5">
            {canDispatch && (
                <div className="flex gap-1.5" role="tablist" aria-label="Tipo de envio">
                    <button type="button" role="tab" aria-selected={!isOpinion} className={tabCls(!isOpinion)} onClick={() => { setTab('comment'); setErrors([]); }}>Comentário</button>
                    <button type="button" role="tab" aria-selected={isOpinion} className={tabCls(isOpinion)} onClick={() => { setTab('opinion'); setErrors([]); }}>Parecer e encerramento</button>
                </div>
            )}

            <div className="flex flex-wrap gap-1.5">
                {quick.map(chip => (
                    <button key={chip} type="button" onClick={() => setText(prev => (prev ? `${prev} ${chip}` : chip))}
                        className="text-xs text-secondary-hub bg-canvas hover:bg-subtle border border-subtle px-2.5 py-1 rounded-full transition-colors cursor-pointer">
                        {chip}
                    </button>
                ))}
            </div>

            <textarea
                ref={areaRef}
                rows={3}
                value={text}
                onChange={e => { setText(e.target.value); if (errors.length) setErrors([]); }}
                aria-label={isOpinion ? 'Parecer da liderança' : 'Mensagem'}
                placeholder={hint || (isOpinion
                    ? 'Descreva a ação tomada, as orientações ou a justificativa do encerramento'
                    : (canManageTickets ? 'Escreva uma orientação técnica ou resposta ao colaborador' : 'Escreva uma resposta, informe o protocolo ou complemente os dados'))}
                className="w-full p-3 border border-subtle rounded-xl text-sm text-primary-hub placeholder:text-muted-hub focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none bg-canvas resize-y leading-relaxed"
            />

            {errors.length > 0 && (
                <p role="alert" className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />{errors[0]}
                </p>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {canDispatch ? (
                    <label className="flex items-center gap-2 text-xs font-semibold text-secondary-hub">
                        Status
                        <select
                            value={status}
                            onChange={e => { setStatus(e.target.value); setErrors([]); }}
                            className="text-xs px-2.5 py-1.5 border border-subtle rounded-xl bg-surface text-primary-hub font-semibold focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none cursor-pointer"
                        >
                            <option value="">Manter atual ({getStatusLabel(current)})</option>
                            {STATUS_OPTIONS.filter(o => o.id !== current).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                    </label>
                ) : (
                    <span className="text-xs text-muted-hub">Sua resposta atualiza o chamado sem precisar editá-lo.</span>
                )}

                <button
                    type="button"
                    onClick={submit}
                    disabled={sending}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : (isOpinion ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : <Send className="w-3.5 h-3.5" aria-hidden="true" />)}
                    <span>{sending ? 'Enviando…' : (isOpinion ? 'Salvar parecer' : 'Enviar comentário')}</span>
                </button>
            </div>
        </section>
    );
}

import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, AlertCircle } from 'lucide-react';
import { getDraftKey } from '../../../utils/reportTimeline';

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
 * Campo de comentários: apenas comenta, nunca altera o status (isso é feito em "Status da tarefa").
 * O rascunho fica na sessão do navegador, então fechar ou trocar de chamado não perde o texto.
 * @param onSubmit ({ text }) => Promise<boolean>
 */
export default function Composer({ report, canManageTickets, sending, onSubmit }) {
    const [initial] = useState(() => readDraft(report.id));
    const [text, setText] = useState(initial.text || '');
    const [error, setError] = useState('');
    const areaRef = useRef(null);

    useEffect(() => {
        try {
            if (text.trim()) sessionStorage.setItem(getDraftKey(report.id), JSON.stringify({ text }));
            else sessionStorage.removeItem(getDraftKey(report.id));
        } catch { /* sem acesso ao armazenamento */ }
    }, [report.id, text]);

    const quick = canManageTickets ? QUICK_STAFF : QUICK_USER;

    const submit = async () => {
        if (!text.trim()) { setError('Escreva a mensagem antes de enviar.'); return; }
        setError('');
        const ok = await onSubmit({ text: text.trim() });
        if (ok) {
            setText('');
            try { sessionStorage.removeItem(getDraftKey(report.id)); } catch { /* ignora */ }
        }
    };

    return (
        <section aria-label="Comentários" className="rounded-2xl border border-strong bg-surface p-3 space-y-2.5">
            <h4 className="text-xs font-bold text-secondary-hub uppercase tracking-wider">Comentar</h4>

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
                onChange={e => { setText(e.target.value); if (error) setError(''); }}
                aria-label="Mensagem"
                placeholder={canManageTickets ? 'Escreva uma orientação técnica ou resposta ao colaborador' : 'Escreva uma resposta, informe o protocolo ou complemente os dados'}
                className="w-full p-3 border border-subtle rounded-xl text-sm text-primary-hub placeholder:text-muted-hub focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none bg-canvas resize-y leading-relaxed"
            />

            {error && (
                <p role="alert" className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
                    <AlertCircle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />{error}
                </p>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className="text-xs text-muted-hub">Comentar não altera o status da tarefa.</span>
                <button
                    type="button"
                    onClick={submit}
                    disabled={sending}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Send className="w-3.5 h-3.5" aria-hidden="true" />}
                    <span>{sending ? 'Enviando…' : 'Enviar comentário'}</span>
                </button>
            </div>
        </section>
    );
}

import React, { useState } from 'react';
import { 
    CheckCheck, FileText, Calendar, User, 
    ShieldCheck, Sparkles, Loader2, Award
} from 'lucide-react';
import { 
    getMarkdownContent, 
    formatFeedbackReadStatus, 
    formatReferenceMonth,
    buildMarkAsReadPayload 
} from '../../types/feedback.types';
import MarkdownRenderer from '../common/MarkdownRenderer';

export default function MarkdownFeedbackView({
    evaluation,
    onMarkAsRead,
    currentUser,
    readOnly = false
}) {
    const [marking, setMarking] = useState(false);

    if (!evaluation) return null;

    const markdownText = getMarkdownContent(evaluation);
    const isRead = Boolean(evaluation.read);

    const handleConfirmRead = async () => {
        if (!onMarkAsRead || isRead || marking) return;
        setMarking(true);
        try {
            const auditPayload = buildMarkAsReadPayload(currentUser);
            await onMarkAsRead(evaluation.id, auditPayload);
        } finally {
            setMarking(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* CABEÇALHO CONTEXTUAL DO FEEDBACK MARKDOWN */}
            <div className="bg-gradient-to-r from-rose-950 via-zinc-950 to-zinc-900 text-white rounded-3xl p-5 sm:p-6 border border-subtle shadow-md">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 shadow-inner">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                                    {evaluation.title || 'Alinhamento 1:1 Consolidado'}
                                </h3>
                                <span className="text-[10px] uppercase font-mono font-bold bg-rose-500/20 text-rose-300 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                                    Markdown Format
                                </span>
                            </div>
                            <p className="text-xs text-rose-200/70 mt-1 flex items-center gap-2 flex-wrap">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 opacity-70" />
                                    Mês de Referência: <strong className="text-white">{formatReferenceMonth(evaluation.referenceMonth)}</strong>
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <User className="w-3.5 h-3.5 opacity-70" />
                                    Líder / Avaliador: <strong className="text-white">{evaluation.evaluatorName || 'Gestão HubDesk'}</strong>
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* STATUS DE LEITURA (BADGE NO TOPO) */}
                    <div>
                        {isRead ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-2xs">
                                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                                Confirmado
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-2xs">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                Leitura Pendente
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* DOCUMENTO MARKDOWN RENDERIZADO */}
            <div className="bg-surface rounded-3xl p-6 sm:p-8 border border-subtle shadow-xs overflow-hidden text-primary-hub">
                <MarkdownRenderer content={markdownText || '*Nenhum conteúdo de feedback informado.*'} />
            </div>

            {/* SEÇÃO FINAL: FLUXO DE CIÊNCIA (MARK AS READ) */}
            <div className="bg-surface rounded-3xl p-5 sm:p-6 border border-subtle shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-hub block">
                            Auditoria & Confirmação de Ciência
                        </span>
                        <div className="flex items-center gap-2">
                            <ShieldCheck className={`w-5 h-5 ${isRead ? 'text-emerald-500' : 'text-amber-500'}`} />
                            <p className="text-xs sm:text-sm font-bold text-primary-hub">
                                {formatFeedbackReadStatus(evaluation)}
                            </p>
                        </div>
                        <p className="text-[11px] text-muted-hub">
                            A confirmação registra data, hora e usuário para alinhamento entre colaborador e liderança.
                        </p>
                    </div>

                    {/* BOTÃO DE CONFIRMAÇÃO OU BADGE DEFINITIVO */}
                    <div className="w-full sm:w-auto shrink-0">
                        {isRead ? (
                            <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-xs font-black shadow-2xs">
                                <CheckCheck className="w-4 h-4" />
                                <span>Você já confirmou a ciência deste alinhamento</span>
                            </div>
                        ) : !readOnly && onMarkAsRead ? (
                            <button
                                type="button"
                                onClick={handleConfirmRead}
                                disabled={marking}
                                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-bold text-xs uppercase tracking-wider transition-all duration-150 shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-95"
                            >
                                {marking ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Confirmando...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCheck className="w-4 h-4" />
                                        <span>Estou Ciente / Marcar como Lido</span>
                                    </>
                                )}
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}

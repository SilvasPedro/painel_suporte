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
            <div className="bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 text-white rounded-2xl p-5 sm:p-6 border border-zinc-800 shadow-md">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0 shadow-inner">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                                    {evaluation.title || 'Alinhamento 1:1 Consolidado'}
                                </h3>
                                <span className="text-[10px] uppercase font-mono font-bold bg-red-500/20 text-red-300 px-2.5 py-0.5 rounded-full border border-red-500/30">
                                    Markdown Format
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-2 flex-wrap">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                                    Mês de Referência: <strong className="text-zinc-200">{formatReferenceMonth(evaluation.referenceMonth)}</strong>
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <User className="w-3.5 h-3.5 text-zinc-400" />
                                    Líder / Avaliador: <strong className="text-zinc-200">{evaluation.evaluatorName || 'Gestão Hubdesk'}</strong>
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
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-2xs animate-pulse">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                Leitura Pendente
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* DOCUMENTO MARKDOWN RENDERIZADO COM TABELAS VISUAIS COMPLETAS E TIPOGRAFIA FLUIDA */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 sm:p-8 border border-gray-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                <MarkdownRenderer content={markdownText || '*Nenhum conteúdo de feedback informado.*'} />
            </div>

            {/* SEÇÃO FINAL: FLUXO DE CIÊNCIA (MARK AS READ) & AUDITORIA DE COMPLIANCE */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 sm:p-6 border border-gray-200 dark:border-zinc-800 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-zinc-500 block">
                            Auditoria & Confirmação de Ciência
                        </span>
                        <div className="flex items-center gap-2">
                            <ShieldCheck className={`w-5 h-5 ${isRead ? 'text-emerald-500' : 'text-amber-500'}`} />
                            <p className="text-xs sm:text-sm font-bold text-gray-900 dark:text-zinc-100">
                                {formatFeedbackReadStatus(evaluation)}
                            </p>
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                            A confirmação registra data, hora e usuário para alinhamento entre colaborador e liderança.
                        </p>
                    </div>

                    {/* BOTÃO DE CONFIRMAÇÃO OU BADGE DEFINITIVO */}
                    <div className="w-full sm:w-auto shrink-0">
                        {isRead ? (
                            <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-black shadow-2xs">
                                <CheckCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                <span>Você já confirmou a ciência deste alinhamento</span>
                            </div>
                        ) : !readOnly && onMarkAsRead ? (
                            <button
                                type="button"
                                onClick={handleConfirmRead}
                                disabled={marking}
                                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-150 shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 active:scale-95"
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

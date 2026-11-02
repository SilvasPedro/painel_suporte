import React, { useState } from 'react';
import { 
    X, CalendarDays, ThumbsUp, Minus, ThumbsDown, 
    Printer, Maximize2, Minimize2, Sparkles, Archive
} from 'lucide-react';
import { 
    isLegacy4PillarsFeedback, 
    formatReferenceMonth,
    FEEDBACK_FORMATS 
} from '../../types/feedback.types';
import LegacyFeedbackView from './LegacyFeedbackView';
import MarkdownFeedbackView from './MarkdownFeedbackView';
import { BorderBeam } from '../magicui';

const getClassificationBadge = (classification) => {
    switch (classification) {
        case 'Positiva': 
            return (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 shadow-2xs">
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-500"/> Positiva
                </span>
            );
        case 'Neutra': 
            return (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5 shadow-2xs">
                    <Minus className="w-3.5 h-3.5 text-amber-500"/> Neutra
                </span>
            );
        case 'Negativa': 
            return (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1.5 shadow-2xs">
                    <ThumbsDown className="w-3.5 h-3.5 text-rose-500"/> Negativa
                </span>
            );
        default: 
            return (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-subtle text-muted-hub border border-subtle flex items-center gap-1.5">
                    <Minus className="w-3.5 h-3.5 opacity-70"/> {classification || 'N/A'}
                </span>
            );
    }
};

export default function MonthlyEvaluationDetailModal({
    isOpen,
    onClose,
    evaluation,
    onMarkAsRead,
    currentUser
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!isOpen || !evaluation) return null;

    const isLegacy = isLegacy4PillarsFeedback(evaluation);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div 
            id="monthly-evaluation-detail-backdrop"
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 sm:p-5 z-[85] backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto"
            onClick={onClose}
        >
            <div 
                id="monthly-evaluation-detail-modal"
                onClick={(e) => e.stopPropagation()}
                className={`relative bg-canvas rounded-3xl shadow-2xl w-full ${
                    isExpanded ? 'max-w-6xl h-[94vh]' : 'max-w-4xl max-h-[92vh]'
                } overflow-hidden flex flex-col border border-subtle animate-in zoom-in-95 duration-150 transition-all text-primary-hub`}
            >
                <BorderBeam 
                    size={260} 
                    duration={8} 
                    colorFrom={isLegacy ? '#f59e0b' : '#f43f5e'} 
                    colorTo="#e11d48" 
                    borderWidth={1.5} 
                />

                {/* CABEÇALHO COM TEMA CONTEXTUAL */}
                <div className="p-5 sm:p-6 bg-gradient-to-r from-rose-950 via-zinc-950 to-zinc-900 text-white flex justify-between items-center shrink-0 border-b border-subtle">
                    <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner border ${
                            isLegacy 
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        }`}>
                            {isLegacy ? (
                                <Archive className="w-6 h-6" />
                            ) : (
                                <CalendarDays className="w-6 h-6" />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                                    {isLegacy ? 'Relatório de Avaliação Mensal (Modo Legado)' : 'Alinhamento & Feedback Mensal (1:1)'}
                                </h2>
                                {getClassificationBadge(evaluation.classification)}
                                <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                                    isLegacy 
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                }`}>
                                    {isLegacy ? 'Legado (4 Pilares)' : 'Markdown Consolidado'}
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2 flex-wrap">
                                <span>Colaborador: <strong className="text-zinc-200">{evaluation.colabName}</strong></span>
                                <span>•</span>
                                <span>Mês: <strong className="text-zinc-200 font-mono">{formatReferenceMonth(evaluation.referenceMonth)}</strong></span>
                                <span>•</span>
                                <span>Avaliador: <strong className="text-zinc-200">{evaluation.evaluatorName || 'Gestão'}</strong></span>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                        {/* BOTÃO EXPANDIR / RECOLHER */}
                        <button
                            type="button"
                            onClick={() => setIsExpanded(prev => !prev)}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer hidden md:flex"
                            title={isExpanded ? "Reduzir janela" : "Expandir janela"}
                        >
                            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>

                        {/* BOTÃO IMPRIMIR */}
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer hidden sm:flex"
                            title="Imprimir Avaliação"
                        >
                            <Printer className="w-4 h-4" />
                        </button>

                        {/* FECHAR */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                            title="Fechar janela"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* CONTEÚDO COM SCROLL: CONDICIONAL ENTRE LEGACY E MARKDOWN */}
                <div className="overflow-y-auto flex-1 p-5 sm:p-7 bg-canvas">
                    {isLegacy ? (
                        <LegacyFeedbackView 
                            evaluation={evaluation} 
                            onMarkAsRead={onMarkAsRead}
                            currentUser={currentUser}
                        />
                    ) : (
                        <MarkdownFeedbackView 
                            evaluation={evaluation} 
                            onMarkAsRead={onMarkAsRead}
                            currentUser={currentUser}
                        />
                    )}
                </div>

                {/* RODAPÉ DO MODAL */}
                <div className="p-4 bg-surface border-t border-subtle flex justify-between items-center shrink-0">
                    <span className="text-[11px] text-muted-hub font-mono">
                        HubDesk v4.0.0 • Módulo Feedbacks 1:1
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 bg-subtle hover:bg-surface text-primary-hub border border-subtle rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}

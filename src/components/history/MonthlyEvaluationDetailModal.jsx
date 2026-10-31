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

const getClassificationBadge = (classification) => {
    switch (classification) {
        case 'Positiva': 
            return (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-2xs">
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-600"/> Positiva
                </span>
            );
        case 'Neutra': 
            return (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5 shadow-2xs">
                    <Minus className="w-3.5 h-3.5 text-amber-600"/> Neutra
                </span>
            );
        case 'Negativa': 
            return (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5 shadow-2xs">
                    <ThumbsDown className="w-3.5 h-3.5 text-rose-600"/> Negativa
                </span>
            );
        default: 
            return (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200 flex items-center gap-1.5">
                    <Minus className="w-3.5 h-3.5 text-gray-500"/> {classification || 'N/A'}
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
            className="fixed inset-0 bg-zinc-950/85 flex items-center justify-center p-3 sm:p-5 z-[85] backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
            onClick={onClose}
        >
            <div 
                id="monthly-evaluation-detail-modal"
                onClick={(e) => e.stopPropagation()}
                className={`bg-gray-50 dark:bg-zinc-950 rounded-2xl shadow-2xl w-full ${
                    isExpanded ? 'max-w-6xl h-[94vh]' : 'max-w-4xl max-h-[92vh]'
                } overflow-hidden flex flex-col border border-gray-200 dark:border-zinc-800 animate-in zoom-in-95 duration-150 transition-all`}
            >
                {/* CABEÇALHO COM TEMA CONTEXTUAL */}
                <div className="p-5 sm:p-6 bg-zinc-950 text-white flex justify-between items-center shrink-0 border-b border-zinc-800">
                    <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner border ${
                            isLegacy 
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                                : 'bg-red-500/20 text-red-400 border-red-500/30'
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
                                        ? 'bg-amber-950/70 text-amber-300 border-amber-700/60' 
                                        : 'bg-red-950/70 text-red-300 border-red-700/60'
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
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer hidden md:flex"
                            title={isExpanded ? "Reduzir janela" : "Expandir janela"}
                        >
                            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                        </button>

                        {/* BOTÃO IMPRIMIR */}
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer hidden sm:flex"
                            title="Imprimir Avaliação"
                        >
                            <Printer className="w-4 h-4" />
                        </button>

                        {/* FECHAR */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                            title="Fechar janela"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* CONTEÚDO COM SCROLL: CONDICIONAL ENTRE LEGACY E MARKDOWN */}
                <div className="overflow-y-auto flex-1 p-5 sm:p-7">
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
                <div className="p-4 bg-white dark:bg-zinc-950 border-t border-gray-200 dark:border-zinc-800 flex justify-between items-center shrink-0">
                    <span className="text-[11px] text-gray-400 dark:text-zinc-500 font-mono">
                        Hubdesk v3.11.0 • Módulo Feedbacks 1:1
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}

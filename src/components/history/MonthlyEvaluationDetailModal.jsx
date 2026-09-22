import React from 'react';
import { 
    X, CalendarDays, Star, ShieldCheck, User, Clock, 
    MessageSquare, ThumbsUp, Minus, ThumbsDown, Printer, Award
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const formatMonth = (yyyyMm) => {
    if (!yyyyMm) return '--';
    const parts = yyyyMm.split('-');
    if (parts.length === 2) {
        return `${parts[1]}/${parts[0]}`;
    }
    return yyyyMm;
};

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
    evaluation
}) {
    if (!isOpen || !evaluation) return null;

    const handlePrint = () => {
        window.print();
    };

    // Cálculo da média das 4 notas se existirem
    const scores = [
        evaluation.performanceScore,
        evaluation.qualityScore,
        evaluation.behaviorScore,
        evaluation.punctualityScore
    ].filter(s => s !== undefined && s !== null && s !== '' && !isNaN(Number(s))).map(Number);

    const averageScore = scores.length > 0 
        ? (scores.reduce((acc, curr) => acc + curr, 0) / scores.length).toFixed(1)
        : null;

    return (
        <div 
            id="monthly-evaluation-detail-backdrop"
            className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center p-3 sm:p-5 z-[85] backdrop-blur-xs animate-in fade-in duration-150"
        >
            <div 
                id="monthly-evaluation-detail-modal"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-200"
            >
                {/* CABEÇALHO */}
                <div className="p-5 sm:p-6 bg-zinc-950 text-white flex justify-between items-center shrink-0 border-b border-zinc-800">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0 shadow-inner">
                            <CalendarDays className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                                    Relatório de Avaliação Mensal (1:1)
                                </h2>
                                {getClassificationBadge(evaluation.classification)}
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Mês de Referência: <strong className="text-zinc-200 font-mono">{formatMonth(evaluation.referenceMonth)}</strong> • Avaliador: <strong className="text-zinc-200">{evaluation.evaluatorName || 'Gestão'}</strong>
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer hidden sm:flex"
                            title="Imprimir Avaliação"
                        >
                            <Printer className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* CONTEÚDO COM SCROLL */}
                <div className="overflow-y-auto flex-1 p-5 sm:p-6 bg-gray-50/70 space-y-6">
                    
                    {/* RESUMO DOS PILARES & MÉDIA GERAL */}
                    {averageScore && (
                        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">
                                    Média dos 4 Pilares de Desempenho
                                </span>
                                <h3 className="text-base font-extrabold text-gray-900">
                                    Índice Geral de Competências
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Consolidado entre Produtividade, Qualidade Técnica, Comportamento e Pontualidade.
                                </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-4xl font-black font-mono text-gray-900">
                                    {averageScore}
                                </span>
                                <span className="text-xs font-bold text-gray-400">/ 10</span>
                            </div>
                        </div>
                    )}

                    {/* OS 4 PILARES AVALIADOS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* PILAR 1: Produtividade */}
                        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs space-y-3 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center pb-2.5 border-b border-gray-100">
                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                        <Star className="w-4 h-4 text-amber-500" />
                                        1. Desempenho & Produtividade
                                    </h4>
                                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                                        {evaluation.performanceScore || '-'} / 10
                                    </span>
                                </div>
                                <div className="text-xs text-gray-700 leading-relaxed mt-3 prose prose-xs max-w-none">
                                    <ReactMarkdown>
                                        {evaluation.performance || '*Sem observações registradas.*'}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>

                        {/* PILAR 2: Qualidade e Processos */}
                        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs space-y-3 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center pb-2.5 border-b border-gray-100">
                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                        2. Qualidade & Processos
                                    </h4>
                                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                                        {evaluation.qualityScore || '-'} / 10
                                    </span>
                                </div>
                                <div className="text-xs text-gray-700 leading-relaxed mt-3 prose prose-xs max-w-none">
                                    <ReactMarkdown>
                                        {evaluation.quality || '*Sem observações registradas.*'}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>

                        {/* PILAR 3: Comportamento */}
                        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs space-y-3 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center pb-2.5 border-b border-gray-100">
                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                        <User className="w-4 h-4 text-blue-500" />
                                        3. Comportamento & Postura
                                    </h4>
                                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                                        {evaluation.behaviorScore || '-'} / 10
                                    </span>
                                </div>
                                <div className="text-xs text-gray-700 leading-relaxed mt-3 prose prose-xs max-w-none">
                                    <ReactMarkdown>
                                        {evaluation.behavior || '*Sem observações registradas.*'}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>

                        {/* PILAR 4: Assiduidade */}
                        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs space-y-3 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-center pb-2.5 border-b border-gray-100">
                                    <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-purple-500" />
                                        4. Assiduidade & Pontualidade
                                    </h4>
                                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200">
                                        {evaluation.punctualityScore || '-'} / 10
                                    </span>
                                </div>
                                <div className="text-xs text-gray-700 leading-relaxed mt-3 prose prose-xs max-w-none">
                                    <ReactMarkdown>
                                        {evaluation.punctuality || '*Sem observações registradas.*'}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* CONSIDERAÇÕES FINAIS & PDI */}
                    {evaluation.generalComments && (
                        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs space-y-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-red-600" />
                                Considerações Finais & Plano de Ação (PDI)
                            </span>
                            <div className="bg-gray-50 p-4 sm:p-5 rounded-xl border border-gray-200 text-xs sm:text-sm text-gray-800 leading-relaxed prose prose-sm max-w-none">
                                <ReactMarkdown>
                                    {evaluation.generalComments}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}

                </div>

                {/* RODAPÉ */}
                <div className="p-4 bg-white border-t border-gray-200 flex justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}

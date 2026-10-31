import React from 'react';
import { 
    Archive, Star, ShieldCheck, User, Clock, 
    MessageSquare, AlertCircle, CheckCircle2, Shield
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { formatFeedbackReadStatus } from '../../types/feedback.types';

export default function LegacyFeedbackView({ evaluation, onMarkAsRead, currentUser }) {
    if (!evaluation) return null;

    // Cálculo da média dos 4 pilares se existirem
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
        <div className="space-y-6">
            {/* BANNER MANDATÓRIO: AVISO VISUAL DE MODO LEGADO */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 shadow-2xs">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                    <Archive className="w-5 h-5" />
                </div>
                <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
                            Visualização em Modo Legado
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-300/60">
                            4 Pilares (Read-only)
                        </span>
                    </div>
                    <p className="text-xs text-amber-900/80 dark:text-amber-200/80 mt-1 leading-relaxed">
                        Este feedback foi registrado na estrutura anterior de <strong>4 Pilares de Desempenho</strong>. Os dados originais foram integralmente preservados para consulta histórica e compliance.
                    </p>
                </div>
            </div>

            {/* MÉDIA DOS PILARES */}
            {averageScore && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-200 dark:border-zinc-800 shadow-2xs flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest block mb-0.5">
                            Média dos 4 Pilares de Desempenho
                        </span>
                        <h3 className="text-base font-extrabold text-gray-900 dark:text-zinc-100">
                            Índice Geral de Competências
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                            Consolidado entre Produtividade, Qualidade Técnica, Comportamento e Pontualidade.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-4xl font-black font-mono text-gray-900 dark:text-zinc-100">
                            {averageScore}
                        </span>
                        <span className="text-xs font-bold text-gray-400 dark:text-zinc-500">/ 10</span>
                    </div>
                </div>
            )}

            {/* OS 4 PILARES AVALIADOS (READ-ONLY) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* PILAR 1: Produtividade */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-200 dark:border-zinc-800 shadow-2xs space-y-3 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center pb-2.5 border-b border-gray-100 dark:border-zinc-800">
                            <h4 className="text-xs font-black text-gray-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                                <Star className="w-4 h-4 text-amber-500" />
                                1. Desempenho & Produtividade
                            </h4>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40">
                                {evaluation.performanceScore !== undefined && evaluation.performanceScore !== '' ? evaluation.performanceScore : '-'} / 10
                            </span>
                        </div>
                        <div className="text-xs text-gray-700 dark:text-zinc-300 leading-relaxed mt-3 prose prose-xs dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                                {evaluation.performance || '*Sem observações registradas.*'}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>

                {/* PILAR 2: Qualidade e Processos */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-200 dark:border-zinc-800 shadow-2xs space-y-3 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center pb-2.5 border-b border-gray-100 dark:border-zinc-800">
                            <h4 className="text-xs font-black text-gray-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                2. Qualidade & Processos
                            </h4>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40">
                                {evaluation.qualityScore !== undefined && evaluation.qualityScore !== '' ? evaluation.qualityScore : '-'} / 10
                            </span>
                        </div>
                        <div className="text-xs text-gray-700 dark:text-zinc-300 leading-relaxed mt-3 prose prose-xs dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                                {evaluation.quality || '*Sem observações registradas.*'}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>

                {/* PILAR 3: Comportamento */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-200 dark:border-zinc-800 shadow-2xs space-y-3 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center pb-2.5 border-b border-gray-100 dark:border-zinc-800">
                            <h4 className="text-xs font-black text-gray-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                                <User className="w-4 h-4 text-blue-500" />
                                3. Comportamento & Postura
                            </h4>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40">
                                {evaluation.behaviorScore !== undefined && evaluation.behaviorScore !== '' ? evaluation.behaviorScore : '-'} / 10
                            </span>
                        </div>
                        <div className="text-xs text-gray-700 dark:text-zinc-300 leading-relaxed mt-3 prose prose-xs dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                                {evaluation.behavior || '*Sem observações registradas.*'}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>

                {/* PILAR 4: Assiduidade */}
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-200 dark:border-zinc-800 shadow-2xs space-y-3 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center pb-2.5 border-b border-gray-100 dark:border-zinc-800">
                            <h4 className="text-xs font-black text-gray-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                                <Clock className="w-4 h-4 text-purple-500" />
                                4. Assiduidade & Pontualidade
                            </h4>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40">
                                {evaluation.punctualityScore !== undefined && evaluation.punctualityScore !== '' ? evaluation.punctualityScore : '-'} / 10
                            </span>
                        </div>
                        <div className="text-xs text-gray-700 dark:text-zinc-300 leading-relaxed mt-3 prose prose-xs dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                                {evaluation.punctuality || '*Sem observações registradas.*'}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>

            </div>

            {/* CONSIDERAÇÕES FINAIS & PDI */}
            {evaluation.generalComments && (
                <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-gray-200 dark:border-zinc-800 shadow-2xs space-y-2">
                    <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-red-600" />
                        Considerações Finais & Plano de Ação (PDI)
                    </span>
                    <div className="bg-gray-50 dark:bg-zinc-950 p-4 sm:p-5 rounded-xl border border-gray-200 dark:border-zinc-800 text-xs sm:text-sm text-gray-800 dark:text-zinc-200 leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                            {evaluation.generalComments}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            {/* STATUS DE LEITURA AUDITORIA */}
            <div className="bg-gray-100/70 dark:bg-zinc-950 p-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 text-xs flex items-center justify-between flex-wrap gap-2">
                <span className="text-gray-600 dark:text-zinc-400 flex items-center gap-1.5">
                    <CheckCircle2 className={`w-4 h-4 ${evaluation.read ? 'text-emerald-600' : 'text-gray-400'}`} />
                    Status: <strong className="text-gray-900 dark:text-zinc-100">{formatFeedbackReadStatus(evaluation)}</strong>
                </span>
                {!evaluation.read && onMarkAsRead && (
                    <button
                        type="button"
                        onClick={() => onMarkAsRead(evaluation.id)}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                        Confirmar Ciência
                    </button>
                )}
            </div>
        </div>
    );
}

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
                        <span className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                            Visualização em Modo Legado
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                            4 Pilares (Read-only)
                        </span>
                    </div>
                    <p className="text-xs text-secondary-hub mt-1 leading-relaxed">
                        Este feedback foi registrado na estrutura anterior de <strong>4 Pilares de Desempenho</strong>. Os dados originais foram integralmente preservados para consulta histórica e compliance.
                    </p>
                </div>
            </div>

            {/* MÉDIA DOS PILARES */}
            {averageScore && (
                <div className="bg-surface rounded-2xl p-5 border border-subtle shadow-xs flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div>
                        <span className="text-[10px] font-bold text-muted-hub uppercase tracking-widest block mb-0.5">
                            Média dos 4 Pilares de Desempenho
                        </span>
                        <h3 className="text-base font-extrabold text-primary-hub">
                            Índice Geral de Competências
                        </h3>
                        <p className="text-xs text-muted-hub mt-0.5">
                            Consolidado entre Produtividade, Qualidade Técnica, Comportamento e Pontualidade.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-4xl font-black font-mono text-primary-hub">
                            {averageScore}
                        </span>
                        <span className="text-xs font-bold text-muted-hub">/ 10</span>
                    </div>
                </div>
            )}

            {/* OS 4 PILARES AVALIADOS (READ-ONLY) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* PILAR 1: Produtividade */}
                <div className="bg-surface rounded-2xl p-5 border border-subtle shadow-xs space-y-3 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center pb-2.5 border-b border-subtle">
                            <h4 className="text-xs font-black text-primary-hub uppercase tracking-wider flex items-center gap-2">
                                <Star className="w-4 h-4 text-amber-500" />
                                1. Desempenho & Produtividade
                            </h4>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                {evaluation.performanceScore !== undefined && evaluation.performanceScore !== '' ? evaluation.performanceScore : '-'} / 10
                            </span>
                        </div>
                        <div className="text-xs text-secondary-hub leading-relaxed mt-3 prose prose-xs dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                                {evaluation.performance || '*Sem observações registradas.*'}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>

                {/* PILAR 2: Qualidade */}
                <div className="bg-surface rounded-2xl p-5 border border-subtle shadow-xs space-y-3 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center pb-2.5 border-b border-subtle">
                            <h4 className="text-xs font-black text-primary-hub uppercase tracking-wider flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                                2. Qualidade Técnica & Processos
                            </h4>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                {evaluation.qualityScore !== undefined && evaluation.qualityScore !== '' ? evaluation.qualityScore : '-'} / 10
                            </span>
                        </div>
                        <div className="text-xs text-secondary-hub leading-relaxed mt-3 prose prose-xs dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                                {evaluation.quality || '*Sem observações registradas.*'}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>

                {/* PILAR 3: Comportamento */}
                <div className="bg-surface rounded-2xl p-5 border border-subtle shadow-xs space-y-3 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center pb-2.5 border-b border-subtle">
                            <h4 className="text-xs font-black text-primary-hub uppercase tracking-wider flex items-center gap-2">
                                <User className="w-4 h-4 text-blue-500" />
                                3. Comportamento & Postura
                            </h4>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                                {evaluation.behaviorScore !== undefined && evaluation.behaviorScore !== '' ? evaluation.behaviorScore : '-'} / 10
                            </span>
                        </div>
                        <div className="text-xs text-secondary-hub leading-relaxed mt-3 prose prose-xs dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                                {evaluation.behavior || '*Sem observações registradas.*'}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>

                {/* PILAR 4: Assiduidade */}
                <div className="bg-surface rounded-2xl p-5 border border-subtle shadow-xs space-y-3 flex flex-col justify-between">
                    <div>
                        <div className="flex justify-between items-center pb-2.5 border-b border-subtle">
                            <h4 className="text-xs font-black text-primary-hub uppercase tracking-wider flex items-center gap-2">
                                <Clock className="w-4 h-4 text-purple-500" />
                                4. Assiduidade & Pontualidade
                            </h4>
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                                {evaluation.punctualityScore !== undefined && evaluation.punctualityScore !== '' ? evaluation.punctualityScore : '-'} / 10
                            </span>
                        </div>
                        <div className="text-xs text-secondary-hub leading-relaxed mt-3 prose prose-xs dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                                {evaluation.punctuality || '*Sem observações registradas.*'}
                            </ReactMarkdown>
                        </div>
                    </div>
                </div>

            </div>

            {/* CONSIDERAÇÕES FINAIS & PDI */}
            {evaluation.generalComments && (
                <div className="bg-surface rounded-2xl p-5 border border-subtle shadow-xs space-y-2">
                    <span className="text-xs font-bold text-muted-hub uppercase tracking-wider flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-rose-500" />
                        Considerações Finais & Plano de Ação (PDI)
                    </span>
                    <div className="bg-subtle p-4 sm:p-5 rounded-xl border border-subtle text-xs sm:text-sm text-primary-hub leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
                            {evaluation.generalComments}
                        </ReactMarkdown>
                    </div>
                </div>
            )}

            {/* STATUS DE LEITURA AUDITORIA */}
            <div className="bg-subtle p-3.5 rounded-xl border border-subtle text-xs flex items-center justify-between flex-wrap gap-2">
                <span className="text-secondary-hub flex items-center gap-1.5">
                    <CheckCircle2 className={`w-4 h-4 ${evaluation.read ? 'text-emerald-500' : 'text-muted-hub'}`} />
                    Status: <strong className="text-primary-hub">{formatFeedbackReadStatus(evaluation)}</strong>
                </span>
                {!evaluation.read && onMarkAsRead && (
                    <button
                        type="button"
                        onClick={() => onMarkAsRead(evaluation.id)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
                    >
                        Confirmar Ciência
                    </button>
                )}
            </div>
        </div>
    );
}

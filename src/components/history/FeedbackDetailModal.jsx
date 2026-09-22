import React from 'react';
import { 
    X, MessageSquare, ThumbsUp, AlertCircle, Sparkles, 
    Calendar, User, CheckCircle2, Award, Lightbulb, 
    Share2, Compass, Tag, CheckCheck, Clock
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export default function FeedbackDetailModal({
    isOpen,
    onClose,
    feedback,
    onMarkAsRead
}) {
    if (!isOpen || !feedback) return null;

    const isPraise = feedback.type === 'Elogio';
    const isImprovement = feedback.type === 'Ponto de Melhoria';

    const formattedDate = feedback.date 
        ? (feedback.date.includes('-') 
            ? feedback.date.split('-').reverse().join('/') 
            : feedback.date)
        : (feedback.createdAt?.toDate ? feedback.createdAt.toDate().toLocaleDateString('pt-BR') : '--');

    return (
        <div 
            id="feedback-detail-backdrop"
            className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center p-3 sm:p-5 z-[85] backdrop-blur-xs animate-in fade-in duration-150"
        >
            <div 
                id="feedback-detail-modal"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200"
            >
                {/* CABEÇALHO COM TEMA CONTEXTUAL */}
                <div className={`p-5 sm:p-6 text-white flex justify-between items-center shrink-0 border-b ${
                    isPraise 
                        ? 'bg-gradient-to-r from-emerald-950 via-zinc-950 to-emerald-950 border-emerald-900/50' 
                        : isImprovement 
                        ? 'bg-gradient-to-r from-amber-950 via-zinc-950 to-amber-950 border-amber-900/50' 
                        : 'bg-zinc-950 border-zinc-800'
                }`}>
                    <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                            isPraise 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : isImprovement 
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                            {isPraise ? <Award className="w-6 h-6" /> : isImprovement ? <Lightbulb className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black tracking-tight text-white">
                                    Registro de Feedback
                                </h2>
                                <span className={`text-xs font-black px-2.5 py-0.5 rounded-full border ${
                                    isPraise 
                                        ? 'bg-emerald-950 text-emerald-300 border-emerald-700/60' 
                                        : isImprovement 
                                        ? 'bg-amber-950 text-amber-300 border-amber-700/60' 
                                        : 'bg-blue-950 text-blue-300 border-blue-700/60'
                                }`}>
                                    {feedback.type || 'Feedback Geral'}
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Enviado em {formattedDate} {feedback.createdBy ? `por ${feedback.createdBy}` : ''}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* CONTEÚDO COM SCROLL */}
                <div className="overflow-y-auto flex-1 p-5 sm:p-6 bg-gray-50/70 space-y-5">
                    
                    {/* Metadados rápidos */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-2xs text-xs">
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Meio / Canal
                            </span>
                            <span className="font-bold text-gray-800 mt-0.5 block">
                                {feedback.method || 'Alinhamento Direto'}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Protocolo Associado
                            </span>
                            <span className="font-mono font-bold text-gray-800 mt-0.5 block">
                                {feedback.protocol && feedback.protocol !== 'N/A' ? feedback.protocol : 'Sem protocolo'}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Status de Leitura
                            </span>
                            <span className="mt-0.5 inline-flex items-center gap-1 font-bold text-gray-800">
                                {feedback.read ? (
                                    <span className="text-emerald-600 flex items-center gap-1"><CheckCheck className="w-3.5 h-3.5" /> Lido</span>
                                ) : (
                                    <span className="text-fuchsia-600 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Pendente</span>
                                )}
                            </span>
                        </div>
                    </div>

                    {/* Mensagem Principal do Feedback */}
                    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs space-y-3">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-red-600" />
                            Conteúdo do Feedback
                        </span>

                        <div className="bg-gray-50/80 p-4 sm:p-5 rounded-xl border border-gray-200 text-sm text-gray-800 leading-relaxed prose prose-sm max-w-none">
                            <ReactMarkdown>
                                {feedback.comment || '*Sem mensagem descritiva fornecida.*'}
                            </ReactMarkdown>
                        </div>
                    </div>

                    {/* Dica de Desenvolvimento e Orientação */}
                    <div className={`p-4 rounded-xl border text-xs leading-relaxed flex items-start gap-3 ${
                        isPraise 
                            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950' 
                            : isImprovement 
                            ? 'bg-amber-50/60 border-amber-200 text-amber-950' 
                            : 'bg-blue-50/60 border-blue-200 text-blue-950'
                    }`}>
                        <Sparkles className={`w-4 h-4 shrink-0 mt-0.5 ${
                            isPraise ? 'text-emerald-600' : isImprovement ? 'text-amber-600' : 'text-blue-600'
                        }`} />
                        <div>
                            <strong className="block font-bold mb-0.5">
                                {isPraise 
                                    ? 'Continue com esse excelente padrão!' 
                                    : isImprovement 
                                    ? 'Oportunidade de Crescimento Profissional:' 
                                    : 'Diretriz de Atendimento:'}
                            </strong>
                            <span>
                                {isPraise 
                                    ? 'Feedbacks positivos consolidam seus pontos fortes e inspiram o time. Mantenha essa dedicação nos próximos atendimentos!' 
                                    : isImprovement 
                                    ? 'Aproveite este apontamento para calibrar sua abordagem técnica ou operacional. Em caso de dúvidas, converse com seu líder imediato.' 
                                    : 'Orientações servem para alinhar expectativas e boas práticas da equipe de suporte.'}
                            </span>
                        </div>
                    </div>

                </div>

                {/* RODAPÉ */}
                <div className="p-4 bg-white border-t border-gray-200 flex justify-between items-center gap-3 shrink-0">
                    {!feedback.read && onMarkAsRead ? (
                        <button
                            type="button"
                            onClick={() => onMarkAsRead(feedback.id)}
                            className="px-4 py-2 bg-fuchsia-50 text-fuchsia-700 hover:bg-fuchsia-100 rounded-xl font-bold text-xs transition-colors cursor-pointer border border-fuchsia-200 flex items-center gap-1.5"
                        >
                            <CheckCheck className="w-3.5 h-3.5" /> Marcar como Lido
                        </button>
                    ) : (
                        <span className="text-xs text-gray-400">Feedback arquivado</span>
                    )}

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}

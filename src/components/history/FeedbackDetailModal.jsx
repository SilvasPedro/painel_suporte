import React from 'react';
import { 
    X, MessageSquare, ThumbsUp, AlertTriangle, HelpCircle, 
    Calendar, User, CheckCircle2, Award, Clock, 
    Tag, CheckCheck, Hash, Monitor, Phone, MessageCircle, 
    Building2, Compass, ShieldAlert, Sparkles, AlertOctagon
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { resolveUserName } from '../../utils/userResolvers';

export default function FeedbackDetailModal({
    isOpen,
    onClose,
    feedback,
    onMarkAsRead
}) {
    if (!isOpen || !feedback) return null;

    const isPraise = feedback.type === 'Elogio';
    const isImprovement = feedback.type === 'Ponto de Melhoria';
    const isGuidance = feedback.type === 'Orientação';

    const formattedDate = feedback.date 
        ? (feedback.date.includes('-') 
            ? feedback.date.split('-').reverse().join('/') 
            : feedback.date)
        : (feedback.createdAt?.toDate ? feedback.createdAt.toDate().toLocaleDateString('pt-BR') : '--');

    // Helper para ícone do canal
    const renderMethodIcon = (methodStr) => {
        switch (methodStr) {
            case 'Telefonia':
                return <Phone className="w-3.5 h-3.5" />;
            case 'Chat':
                return <MessageCircle className="w-3.5 h-3.5" />;
            case 'Sistema (ERP)':
            case 'Sistema':
                return <Monitor className="w-3.5 h-3.5" />;
            case 'Presencial':
            default:
                return <Building2 className="w-3.5 h-3.5" />;
        }
    };

    // Identifica se possui campos estruturados da v3.8.4
    const hasStructuredFields = Boolean(
        feedback.praiseReason || 
        feedback.guidanceText || 
        feedback.improvementError || 
        feedback.improvementCorrect || 
        feedback.improvementDeadline
    );

    const hasProtocol = Boolean(
        feedback.hasProtocol || 
        (feedback.protocol && feedback.protocol !== 'N/A' && feedback.protocol !== 'Sem protocolo')
    );

    const tagsList = Array.isArray(feedback.tags) ? feedback.tags : [];

    return (
        <div 
            id="feedback-detail-backdrop"
            className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center p-3 sm:p-5 z-[85] backdrop-blur-xs animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div 
                id="feedback-detail-modal"
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-200 animate-in zoom-in-95 duration-150"
            >
                {/* CABEÇALHO COM TEMA CONTEXTUAL */}
                <div className={`p-5 sm:p-6 text-white flex justify-between items-center shrink-0 border-b ${
                    isPraise 
                        ? 'bg-gradient-to-r from-emerald-950 via-zinc-950 to-emerald-950 border-emerald-900/60' 
                        : isImprovement 
                        ? 'bg-gradient-to-r from-amber-950 via-zinc-950 to-amber-950 border-amber-900/60' 
                        : 'bg-gradient-to-r from-blue-950 via-zinc-950 to-blue-950 border-blue-900/60'
                }`}>
                    <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                            isPraise 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : isImprovement 
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        }`}>
                            {isPraise ? (
                                <Award className="w-6 h-6" />
                            ) : isImprovement ? (
                                <AlertTriangle className="w-6 h-6" />
                            ) : (
                                <HelpCircle className="w-6 h-6" />
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg font-black tracking-tight text-white">
                                    {isPraise ? 'Reconhecimento & Elogio' : isImprovement ? 'Ponto de Melhoria' : 'Orientação de Atendimento'}
                                </h2>
                                <span className={`text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                                    isPraise 
                                        ? 'bg-emerald-900/80 text-emerald-300 border-emerald-600/50' 
                                        : isImprovement 
                                        ? 'bg-amber-900/80 text-amber-300 border-amber-600/50' 
                                        : 'bg-blue-900/80 text-blue-300 border-blue-600/50'
                                }`}>
                                    {feedback.type || 'Feedback'}
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1.5 flex-wrap">
                                <span>Enviado em <strong>{formattedDate}</strong></span>
                                <span>•</span>
                                <span>Líder: <strong className="text-zinc-200">{resolveUserName(feedback.createdBy)}</strong></span>
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer shrink-0"
                        title="Fechar janela"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* CONTEÚDO COM SCROLL */}
                <div className="overflow-y-auto flex-1 p-5 sm:p-6 bg-gray-50/70 space-y-5">
                    
                    {/* METADADOS RÁPIDOS */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-2xs text-xs">
                        {/* Canal / Meio */}
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Canal / Meio de Observação
                            </span>
                            <span className="font-bold text-gray-800 mt-1 flex items-center gap-1.5">
                                <span className="p-1 rounded-md bg-gray-100 text-gray-700">
                                    {renderMethodIcon(feedback.method)}
                                </span>
                                <span>{feedback.method || 'Presencial'}</span>
                            </span>
                        </div>

                        {/* Protocolo / ID */}
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Protocolo ou ID
                            </span>
                            <span className="mt-1 block">
                                {hasProtocol ? (
                                    <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200 inline-flex items-center gap-1">
                                        <Hash className="w-3 h-3 text-red-600" />
                                        {feedback.protocol}
                                    </span>
                                ) : (
                                    <span className="text-gray-400 italic">Sem protocolo associado</span>
                                )}
                            </span>
                        </div>

                        {/* Status de Leitura */}
                        <div className="col-span-2 sm:col-span-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Status de Leitura
                            </span>
                            <div className="mt-1 flex items-center gap-2">
                                {feedback.read ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Lido</span>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Pendente</span>
                                    </span>
                                )}

                                {!feedback.read && onMarkAsRead && (
                                    <button
                                        type="button"
                                        onClick={() => onMarkAsRead(feedback.id)}
                                        className="text-[10px] font-bold text-red-600 hover:text-red-700 underline cursor-pointer"
                                    >
                                        Marcar lido
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* TAGS DO FEEDBACK (se houver) */}
                    {tagsList.length > 0 && (
                        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5 text-red-600" />
                                Competências & Tags Associadas
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {tagsList.map((tag) => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 text-red-700 border border-red-200/80 shadow-2xs"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* CONTEÚDO ESTRUTURADO (v3.8.4) OU MENSAGEM PADRÃO LEGADA */}
                    {/* ============================================================== */}

                    {/* CASO 1: SE FOR ELOGIO */}
                    {isPraise && (
                        <div className="bg-white rounded-2xl p-5 border border-emerald-200/80 shadow-2xs space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                    <ThumbsUp className="w-3.5 h-3.5" />
                                </div>
                                <span>Motivo do Reconhecimento</span>
                            </div>

                            <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100 text-sm text-emerald-950 leading-relaxed font-medium">
                                <ReactMarkdown>
                                    {feedback.praiseReason || feedback.comment || '*Sem descrição fornecida.*'}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}

                    {/* CASO 2: SE FOR ORIENTAÇÃO */}
                    {isGuidance && (
                        <div className="bg-white rounded-2xl p-5 border border-blue-200/80 shadow-2xs space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-blue-800 uppercase tracking-wider">
                                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                                    <HelpCircle className="w-3.5 h-3.5" />
                                </div>
                                <span>Orientação Transmitida pela Liderança</span>
                            </div>

                            <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-100 text-sm text-blue-950 leading-relaxed font-medium">
                                <ReactMarkdown>
                                    {feedback.guidanceText || feedback.comment || '*Sem descrição fornecida.*'}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}

                    {/* CASO 3: SE FOR PONTO DE MELHORIA (3 CARDS SEPARADOS) */}
                    {isImprovement && (
                        <div className="space-y-3">
                            {/* Card 1: Erro / Oportunidade observada */}
                            <div className="bg-white rounded-2xl p-5 border border-amber-200/90 shadow-2xs space-y-2.5">
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                                    <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                    </div>
                                    <span>Qual foi o erro / oportunidade identificada?</span>
                                </div>
                                <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 text-sm text-amber-950 leading-relaxed font-medium">
                                    <ReactMarkdown>
                                        {feedback.improvementError || feedback.comment || '*Sem descrição informada.*'}
                                    </ReactMarkdown>
                                </div>
                            </div>

                            {/* Card 2: Forma correta de proceder */}
                            {feedback.improvementCorrect && (
                                <div className="bg-white rounded-2xl p-5 border border-emerald-200/90 shadow-2xs space-y-2.5">
                                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                                        <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                        </div>
                                        <span>Conduta e Forma Correta de Proceder</span>
                                    </div>
                                    <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100 text-sm text-emerald-950 leading-relaxed font-medium">
                                        <ReactMarkdown>
                                            {feedback.improvementCorrect}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            )}

                            {/* Card 3: Prazo para aplicação da solução */}
                            {feedback.improvementDeadline && (
                                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-2xs flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                                Prazo para Aplicação da Solução
                                            </span>
                                            <span className="text-sm font-black text-gray-900">
                                                {feedback.improvementDeadline}
                                            </span>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                                        Plano de Ação
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Caso legado (onde não há campos da v3.8.4 e apenas comment genérico) */}
                    {!hasStructuredFields && feedback.comment && (
                        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs space-y-3">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-red-600" />
                                Conteúdo do Feedback
                            </span>

                            <div className="bg-gray-50/80 p-4 sm:p-5 rounded-xl border border-gray-200 text-sm text-gray-800 leading-relaxed prose prose-sm max-w-none">
                                <ReactMarkdown>
                                    {feedback.comment}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}

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
                                    ? 'Parabéns! Continue com esse excelente padrão!' 
                                    : isImprovement 
                                    ? 'Oportunidade de Calibração e Aprendizado:' 
                                    : 'Diretriz de Atendimento:'}
                            </strong>
                            <span>
                                {isPraise 
                                    ? 'Feedbacks positivos fortalecem a confiança, valorizam a sua dedicação e servem de modelo para toda a equipe.' 
                                    : isImprovement 
                                    ? 'Utilize este direcionamento para ajustar a rotina técnica e operacional. Converse com seu gestor em caso de dúvidas para acelerar seu desenvolvimento.' 
                                    : 'Orientações servem para manter os padrões técnicos e de comunicação sempre alinhados.'}
                            </span>
                        </div>
                    </div>

                </div>

                {/* RODAPÉ */}
                <div className="p-4 bg-white border-t border-gray-200 flex justify-between items-center gap-3 shrink-0">
                    <div>
                        {!feedback.read && onMarkAsRead ? (
                            <button
                                type="button"
                                onClick={() => onMarkAsRead(feedback.id)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                            >
                                <CheckCheck className="w-4 h-4" /> Marcar como Lido
                            </button>
                        ) : (
                            <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                                <CheckCheck className="w-4 h-4 text-emerald-600" />
                                Feedback visualizado pelo colaborador
                            </span>
                        )}
                    </div>

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

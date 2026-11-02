import React from 'react';
import { 
    X, MessageSquare, ThumbsUp, AlertTriangle, HelpCircle, 
    Calendar, User, CheckCircle2, Award, Clock, 
    Tag, CheckCheck, Hash, Monitor, Phone, MessageCircle, 
    Building2, Compass, ShieldAlert, Sparkles, AlertOctagon
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { resolveUserName } from '../../utils/userResolvers';
import { BorderBeam } from '../magicui';

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

    const renderMethodIcon = (method) => {
        switch (method) {
            case 'Ligação': 
            case 'Telefonia': 
                return <Phone className="w-3.5 h-3.5" />;
            case 'Chat': 
            case 'WhatsApp': 
                return <MessageCircle className="w-3.5 h-3.5" />;
            case 'Remoto': 
            case 'Acesso Remoto': 
                return <Monitor className="w-3.5 h-3.5" />;
            case 'Presencial': 
            default: 
                return <Building2 className="w-3.5 h-3.5" />;
        }
    };

    // Identifica se possui campos estruturados
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
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 sm:p-5 z-[85] backdrop-blur-md animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div 
                id="feedback-detail-modal"
                onClick={(e) => e.stopPropagation()}
                className="relative bg-surface rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] border border-subtle animate-in zoom-in-95 duration-150"
            >
                <BorderBeam 
                    size={220} 
                    duration={8} 
                    colorFrom={isPraise ? '#10b981' : isImprovement ? '#f59e0b' : '#3b82f6'} 
                    colorTo="#e11d48" 
                    borderWidth={1.5} 
                />

                {/* CABEÇALHO COM TEMA CONTEXTUAL */}
                <div className={`p-5 sm:p-6 text-white flex justify-between items-center shrink-0 border-b border-subtle ${
                    isPraise 
                        ? 'bg-gradient-to-r from-emerald-950 via-zinc-950 to-emerald-950' 
                        : isImprovement 
                        ? 'bg-gradient-to-r from-amber-950 via-zinc-950 to-amber-950' 
                        : 'bg-gradient-to-r from-blue-950 via-zinc-950 to-blue-950'
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
                        className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer shrink-0"
                        title="Fechar janela"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* CONTEÚDO COM SCROLL */}
                <div className="overflow-y-auto flex-1 p-5 sm:p-6 bg-canvas space-y-5 text-primary-hub">
                    
                    {/* METADADOS RÁPIDOS */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-surface p-4 rounded-2xl border border-subtle shadow-2xs text-xs">
                        {/* Canal / Meio */}
                        <div>
                            <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">
                                Canal / Meio de Observação
                            </span>
                            <span className="font-bold text-primary-hub mt-1 flex items-center gap-1.5">
                                <span className="p-1 rounded-lg bg-subtle text-secondary-hub">
                                    {renderMethodIcon(feedback.method)}
                                </span>
                                <span>{feedback.method || 'Presencial'}</span>
                            </span>
                        </div>

                        {/* Protocolo / ID */}
                        <div>
                            <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">
                                Protocolo ou ID
                            </span>
                            <span className="mt-1 block">
                                {hasProtocol ? (
                                    <span className="font-mono font-bold text-primary-hub bg-subtle px-2 py-0.5 rounded-lg border border-subtle inline-flex items-center gap-1">
                                        <Hash className="w-3 h-3 text-rose-500" />
                                        {feedback.protocol}
                                    </span>
                                ) : (
                                    <span className="text-muted-hub italic">Sem protocolo associado</span>
                                )}
                            </span>
                        </div>

                        {/* Status de Leitura */}
                        <div className="col-span-2 sm:col-span-1">
                            <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">
                                Status de Leitura
                            </span>
                            <div className="mt-1 flex items-center gap-2">
                                {feedback.read ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                                        <span>Lido</span>
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                                        <span>Pendente</span>
                                    </span>
                                )}

                                {!feedback.read && onMarkAsRead && (
                                    <button
                                        type="button"
                                        onClick={() => onMarkAsRead(feedback.id)}
                                        className="text-[10px] font-bold text-rose-500 hover:text-rose-600 underline cursor-pointer"
                                    >
                                        Marcar lido
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* TAGS DO FEEDBACK (se houver) */}
                    {tagsList.length > 0 && (
                        <div className="bg-surface p-4 rounded-2xl border border-subtle shadow-2xs space-y-2">
                            <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider flex items-center gap-1.5">
                                <Tag className="w-3.5 h-3.5 text-rose-500" />
                                Competências & Tags Associadas
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {tagsList.map((tag) => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-2xs"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* CASO 1: SE FOR ELOGIO */}
                    {isPraise && (
                        <div className="bg-surface rounded-2xl p-5 border border-emerald-500/30 shadow-2xs space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                    <ThumbsUp className="w-3.5 h-3.5" />
                                </div>
                                <span>Motivo do Reconhecimento</span>
                            </div>

                            <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/20 text-sm text-primary-hub leading-relaxed font-medium">
                                <ReactMarkdown>
                                    {feedback.praiseReason || feedback.comment || '*Sem descrição fornecida.*'}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}

                    {/* CASO 2: SE FOR ORIENTAÇÃO */}
                    {isGuidance && (
                        <div className="bg-surface rounded-2xl p-5 border border-blue-500/30 shadow-2xs space-y-3">
                            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                                    <HelpCircle className="w-3.5 h-3.5" />
                                </div>
                                <span>Orientação Transmitida pela Liderança</span>
                            </div>

                            <div className="bg-blue-500/5 p-4 rounded-xl border border-blue-500/20 text-sm text-primary-hub leading-relaxed font-medium">
                                <ReactMarkdown>
                                    {feedback.guidanceText || feedback.comment || '*Sem descrição fornecida.*'}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}

                    {/* CASO 3: SE FOR PONTO DE MELHORIA */}
                    {isImprovement && (
                        <div className="space-y-3">
                            {/* Card 1: Erro / Oportunidade observada */}
                            <div className="bg-surface rounded-2xl p-5 border border-amber-500/30 shadow-2xs space-y-2.5">
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                    <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                    </div>
                                    <span>Qual foi o erro / oportunidade identificada?</span>
                                </div>
                                <div className="bg-amber-500/5 p-4 rounded-xl border border-amber-500/20 text-sm text-primary-hub leading-relaxed font-medium">
                                    <ReactMarkdown>
                                        {feedback.improvementError || feedback.comment || '*Sem descrição informada.*'}
                                    </ReactMarkdown>
                                </div>
                            </div>

                            {/* Card 2: Forma correta de proceder */}
                            {feedback.improvementCorrect && (
                                <div className="bg-surface rounded-2xl p-5 border border-emerald-500/30 shadow-2xs space-y-2.5">
                                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                                        <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                        </div>
                                        <span>Conduta e Forma Correta de Proceder</span>
                                    </div>
                                    <div className="bg-emerald-500/5 p-4 rounded-xl border border-emerald-500/20 text-sm text-primary-hub leading-relaxed font-medium">
                                        <ReactMarkdown>
                                            {feedback.improvementCorrect}
                                        </ReactMarkdown>
                                    </div>
                                </div>
                            )}

                            {/* Card 3: Prazo para aplicação da solução */}
                            {feedback.improvementDeadline && (
                                <div className="bg-surface rounded-2xl p-4 border border-subtle shadow-2xs flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                                            <Clock className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">
                                                Prazo para Aplicação da Solução
                                            </span>
                                            <span className="text-xs font-bold text-primary-hub">
                                                {feedback.improvementDeadline}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Caso legado (onde não há campos da v3.8.4 e apenas comment genérico) */}
                    {!hasStructuredFields && feedback.comment && (
                        <div className="bg-surface rounded-2xl p-5 border border-subtle shadow-2xs space-y-3">
                            <span className="text-xs font-bold text-muted-hub uppercase tracking-wider flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-rose-500" />
                                Conteúdo do Feedback
                            </span>

                            <div className="bg-subtle p-4 sm:p-5 rounded-xl border border-subtle text-sm text-primary-hub leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                                <ReactMarkdown>
                                    {feedback.comment}
                                </ReactMarkdown>
                            </div>
                        </div>
                    )}

                    {/* Dica de Desenvolvimento e Orientação */}
                    <div className={`p-4 rounded-2xl border text-xs leading-relaxed flex items-start gap-3 ${
                        isPraise 
                            ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-300' 
                            : isImprovement 
                            ? 'bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-300' 
                            : 'bg-blue-500/5 border-blue-500/20 text-blue-700 dark:text-blue-300'
                    }`}>
                        <Sparkles className={`w-4 h-4 shrink-0 mt-0.5 ${
                            isPraise ? 'text-emerald-500' : isImprovement ? 'text-amber-500' : 'text-blue-500'
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
                <div className="p-4 bg-surface border-t border-subtle flex justify-between items-center gap-3 shrink-0">
                    <div>
                        {!feedback.read && onMarkAsRead ? (
                            <button
                                type="button"
                                onClick={() => onMarkAsRead(feedback.id)}
                                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
                            >
                                <CheckCheck className="w-4 h-4" /> Marcar como Lido
                            </button>
                        ) : (
                            <span className="text-xs text-muted-hub font-medium flex items-center gap-1.5">
                                <CheckCheck className="w-4 h-4 text-emerald-500" />
                                Feedback visualizado pelo colaborador
                            </span>
                        )}
                    </div>

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

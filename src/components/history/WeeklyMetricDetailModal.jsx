import React from 'react';
import { 
    X, TrendingUp, Phone, MessageSquare, AlertTriangle, 
    CheckCircle2, Clock, Calculator, ShieldCheck, Target, Award
} from 'lucide-react';
import { BorderBeam } from '../magicui';
import { getHuggyStats } from '../../utils/scoringCalculations';

export default function WeeklyMetricDetailModal({
    isOpen,
    onClose,
    metrics
}) {
    if (!isOpen || !metrics) return null;

    const ligAtendidas = Number(metrics.Ligacoes_Atendidas || 0);
    const ligPerdidas = Number(metrics.Ligacoes_Perdidas || 0);
    const ligRealizadas = Number(metrics.Ligacoes_Realizadas || 0);
    const huggy = getHuggyStats(metrics);
    const atendFinalizados = Number(metrics.Atendimentos_Finalizados || 0);

    const calculatedScore = metrics.pontuacao !== undefined 
        ? Number(metrics.pontuacao)
        : (ligAtendidas * 2 + ligRealizadas * 1 + atendFinalizados * 1 + huggy.pontos - ligPerdidas * 5);

    const totalLigacoes = ligAtendidas + ligPerdidas;
    const taxaAtendimentoTelefonia = totalLigacoes > 0 
        ? Math.round((ligAtendidas / totalLigacoes) * 100) 
        : 100;

    const formattedDate = metrics.date 
        ? (metrics.date.includes('-') 
            ? metrics.date.split('-').reverse().join('/') 
            : metrics.date)
        : (metrics.createdAt?.toDate ? metrics.createdAt.toDate().toLocaleDateString('pt-BR') : '--');

    return (
        <div 
            id="weekly-metric-detail-backdrop"
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-3 sm:p-5 z-[85] backdrop-blur-md animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div 
                id="weekly-metric-detail-modal"
                onClick={(e) => e.stopPropagation()}
                className="relative bg-surface rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] border border-subtle"
            >
                <BorderBeam size={220} duration={8} colorFrom="#f59e0b" colorTo="#e11d48" borderWidth={1.5} />

                {/* CABEÇALHO */}
                <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-950 via-zinc-950 to-zinc-900 text-white flex justify-between items-center shrink-0 border-b border-subtle">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black tracking-tight text-white">
                                    Desempenho Semanal Detalhado
                                </h2>
                                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                                    {calculatedScore} pts
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Semana de referência: <strong className="text-zinc-200">{formattedDate}</strong>
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* CONTEÚDO COM SCROLL */}
                <div className="overflow-y-auto flex-1 p-5 sm:p-6 bg-canvas space-y-6 text-primary-hub">
                    
                    {/* HERO SCORE BANNER */}
                    <div className="bg-surface rounded-3xl p-5 border border-amber-500/30 shadow-xs flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="space-y-1 text-center sm:text-left">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full inline-block">
                                Score Consolidado
                            </span>
                            <h3 className="text-lg font-extrabold text-primary-hub">
                                Rendimento da Semana
                            </h3>
                            <p className="text-xs text-muted-hub max-w-md">
                                Pontuação calculada através do volume de chamadas telefônicas, atendimentos no Huggy e taxa de perda.
                            </p>
                        </div>

                        <div className="text-center sm:text-right shrink-0">
                            <span className="text-4xl sm:text-5xl font-black font-mono text-amber-500 tracking-tight block">
                                {calculatedScore}
                            </span>
                            <span className="text-xs font-bold text-muted-hub">pontos apurados</span>
                        </div>
                    </div>

                    {/* GRIDS DE METRICAS OPERACIONAIS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        
                        {/* CARD TELEFONIA */}
                        <div className="bg-surface rounded-2xl p-5 border border-subtle shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-subtle pb-3">
                                <h4 className="text-xs font-black text-primary-hub uppercase tracking-wider flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-rose-500" />
                                    Métricas de Telefonia
                                </h4>
                                <span className="text-[10px] font-mono font-bold text-muted-hub">VOIP</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 text-xs">
                                <div className="bg-subtle rounded-xl p-3 border border-subtle">
                                    <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">
                                        Atendidas
                                    </span>
                                    <span className="text-xl font-black text-primary-hub mt-1 block">
                                        {ligAtendidas}
                                    </span>
                                </div>

                                <div className={`rounded-xl p-3 border ${
                                    ligPerdidas > 0 
                                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400' 
                                        : 'bg-subtle border-subtle text-primary-hub'
                                }`}>
                                    <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                                        Perdidas
                                    </span>
                                    <span className="text-xl font-black mt-1 block">
                                        {ligPerdidas}
                                    </span>
                                </div>

                                <div className="bg-subtle rounded-xl p-3 border border-subtle">
                                    <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">
                                        Realizadas
                                    </span>
                                    <span className="text-xl font-black text-primary-hub mt-1 block">
                                        {ligRealizadas}
                                    </span>
                                </div>

                                <div className="bg-subtle rounded-xl p-3 border border-subtle">
                                    <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">
                                        Taxa de Atendimento
                                    </span>
                                    <span className="font-mono font-bold text-primary-hub text-sm mt-1 block">
                                        {taxaAtendimentoTelefonia}%
                                    </span>
                                </div>

                                <div className="bg-subtle rounded-xl p-3 border border-subtle">
                                    <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">
                                        TMA Telefonia
                                    </span>
                                    <span className="font-mono font-bold text-primary-hub text-sm mt-1 block">
                                        {metrics.TMA_Telefonia || '00:00:00'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* CARD HUGGY / CHAT */}
                        <div className="bg-surface rounded-2xl p-5 border border-subtle shadow-xs space-y-4">
                            <div className="flex items-center justify-between border-b border-subtle pb-3">
                                <h4 className="text-xs font-black text-primary-hub uppercase tracking-wider flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-blue-500" />
                                    Métricas de Chat (Huggy)
                                </h4>
                                <span className="text-[10px] font-mono font-bold text-muted-hub">DIGITAL</span>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 text-xs">
                                {huggy.legado ? (
                                    <div className="bg-subtle rounded-xl p-3 border border-subtle">
                                        <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">
                                            Atendimentos Huggy
                                        </span>
                                        <span className="text-xl font-black text-primary-hub mt-1 block">
                                            {huggy.volume}
                                        </span>
                                    </div>
                                ) : (
                                    <>
                                        <div className="bg-subtle rounded-xl p-3 border border-subtle">
                                            <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">
                                                Huggy Iniciados
                                            </span>
                                            <span className="text-xl font-black text-primary-hub mt-1 block">
                                                {huggy.iniciados}
                                            </span>
                                        </div>
                                        <div className="bg-subtle rounded-xl p-3 border border-subtle">
                                            <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">
                                                Huggy Finalizados
                                            </span>
                                            <span className="text-xl font-black text-primary-hub mt-1 block">
                                                {huggy.finalizados}
                                            </span>
                                        </div>
                                        <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/30 text-blue-600 dark:text-blue-400">
                                            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                                                % Aproveitamento
                                            </span>
                                            <span className="text-xl font-black mt-1 block">
                                                {huggy.percentual}%
                                            </span>
                                        </div>
                                    </>
                                )}

                                <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                                    <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                                        Finalizados
                                    </span>
                                    <span className="text-xl font-black mt-1 block">
                                        {atendFinalizados}
                                    </span>
                                </div>

                                <div className="bg-subtle rounded-xl p-3 border border-subtle col-span-2">
                                    <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">
                                        TMA Huggy (Tempo Médio Atendimento)
                                    </span>
                                    <span className="font-mono font-bold text-primary-hub text-sm mt-1 block">
                                        {metrics.TMA_Huggy || '00:00:00'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* EXTRATO MATEMÁTICO TRANSPARENTE DA PONTUAÇÃO */}
                    <div className="bg-surface rounded-2xl p-5 border border-subtle shadow-xs space-y-3">
                        <h4 className="text-xs font-black text-primary-hub uppercase tracking-wider flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-rose-500" />
                            Extrato da Fórmula de Cálculo
                        </h4>
                        
                        <div className="divide-y divide-subtle text-xs">
                            <div className="py-2.5 flex justify-between items-center">
                                <span className="text-secondary-hub">Ligações Atendidas ({ligAtendidas} &times; 2 pts)</span>
                                <span className="font-mono font-bold text-emerald-500">+{ligAtendidas * 2} pts</span>
                            </div>
                            <div className="py-2.5 flex justify-between items-center">
                                <span className="text-secondary-hub">Ligações Realizadas ({ligRealizadas} &times; 1 pt)</span>
                                <span className="font-mono font-bold text-emerald-500">+{ligRealizadas * 1} pts</span>
                            </div>
                            <div className="py-2.5 flex justify-between items-center">
                                <span className="text-secondary-hub">
                                    {huggy.legado
                                        ? `Atendimentos Huggy (${huggy.volume} \u00d7 1 pt)`
                                        : `Aproveitamento Huggy (${huggy.percentual}% \u00d7 0,5 pt)`}
                                </span>
                                <span className="font-mono font-bold text-emerald-500">+{huggy.pontos} pts</span>
                            </div>
                            <div className="py-2.5 flex justify-between items-center">
                                <span className="text-secondary-hub">Atendimentos Finalizados ({atendFinalizados} &times; 1 pt)</span>
                                <span className="font-mono font-bold text-emerald-500">+{atendFinalizados * 1} pts</span>
                            </div>
                            {ligPerdidas > 0 && (
                                <div className="py-2.5 flex justify-between items-center">
                                    <span className="text-rose-500 font-medium">Ligações Perdidas ({ligPerdidas} &times; -5 pts)</span>
                                    <span className="font-mono font-bold text-rose-500">-{ligPerdidas * 5} pts</span>
                                </div>
                            )}
                            <div className="pt-3 flex justify-between items-center font-bold text-sm">
                                <span className="text-primary-hub">Total Apurado</span>
                                <span className="font-mono font-black text-amber-500 text-base">{calculatedScore} pts</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* RODAPÉ */}
                <div className="p-4 bg-surface border-t border-subtle flex justify-end shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2 bg-subtle hover:bg-surface text-primary-hub border border-subtle rounded-xl font-bold text-xs transition-colors cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}

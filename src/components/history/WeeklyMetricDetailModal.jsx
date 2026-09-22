import React from 'react';
import { 
    X, TrendingUp, Phone, MessageSquare, AlertTriangle, 
    CheckCircle2, Clock, Calculator, ShieldCheck, Target, Award
} from 'lucide-react';

export default function WeeklyMetricDetailModal({
    isOpen,
    onClose,
    metrics
}) {
    if (!isOpen || !metrics) return null;

    const ligAtendidas = Number(metrics.Ligacoes_Atendidas || 0);
    const ligPerdidas = Number(metrics.Ligacoes_Perdidas || 0);
    const atendHuggy = Number(metrics.Atendimentos_Huggy || 0);
    const atendFinalizados = Number(metrics.Atendimentos_Finalizados || 0);

    const calculatedScore = metrics.pontuacao !== undefined 
        ? Number(metrics.pontuacao)
        : (ligAtendidas * 2 + atendFinalizados * 1 + atendHuggy * 1 - ligPerdidas * 5);

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
            className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center p-3 sm:p-5 z-[85] backdrop-blur-xs animate-in fade-in duration-150"
        >
            <div 
                id="weekly-metric-detail-modal"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-200"
            >
                {/* CABEÇALHO */}
                <div className="p-5 sm:p-6 bg-zinc-950 text-white flex justify-between items-center shrink-0 border-b border-zinc-800">
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg font-black tracking-tight text-white">
                                    Desempenho Semanal Detalhado
                                </h2>
                                <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/60 font-mono">
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
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* CONTEÚDO COM SCROLL */}
                <div className="overflow-y-auto flex-1 p-5 sm:p-6 bg-gray-50/70 space-y-6">
                    
                    {/* HERO SCORE BANNER */}
                    <div className="bg-gradient-to-br from-amber-500/10 via-white to-amber-500/5 rounded-2xl p-5 border-2 border-amber-200/80 shadow-2xs flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="space-y-1 text-center sm:text-left">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-100 px-2.5 py-0.5 rounded-full inline-block">
                                Score Consolidado
                            </span>
                            <h3 className="text-lg font-extrabold text-gray-900">
                                Rendimento da Semana
                            </h3>
                            <p className="text-xs text-gray-500 max-w-md">
                                Pontuação calculada através do volume de chamadas telefônicas, atendimentos no Huggy e taxa de perda.
                            </p>
                        </div>

                        <div className="text-center sm:text-right shrink-0">
                            <span className="text-4xl sm:text-5xl font-black font-mono text-amber-600 tracking-tight block">
                                {calculatedScore}
                            </span>
                            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                                Pontos Totais
                            </span>
                        </div>
                    </div>

                    {/* PILARES OPERACIONAIS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* PILAR 1: VOZ & TELEFONIA */}
                        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-red-600" />
                                    Canal de Voz (Telefonia)
                                </h4>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                                    taxaAtendimentoTelefonia >= 90 
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                    {taxaAtendimentoTelefonia}% atendidas
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                        Ligações Atendidas
                                    </span>
                                    <span className="text-xl font-black text-gray-900 mt-1 block">
                                        {ligAtendidas}
                                    </span>
                                </div>

                                <div className={`rounded-xl p-3 border ${
                                    ligPerdidas > 0 
                                        ? 'bg-rose-50/70 border-rose-200 text-rose-900' 
                                        : 'bg-gray-50 border-gray-100 text-gray-900'
                                }`}>
                                    <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                                        Ligações Perdidas
                                    </span>
                                    <span className="text-xl font-black mt-1 block">
                                        {ligPerdidas}
                                    </span>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                        TME (Espera Média)
                                    </span>
                                    <span className="font-mono font-bold text-gray-800 text-sm mt-1 block">
                                        {metrics.TME_Telefonia || '00:00:00'}
                                    </span>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                        TMA (Tempo Médio)
                                    </span>
                                    <span className="font-mono font-bold text-gray-800 text-sm mt-1 block">
                                        {metrics.TMA_Telefonia || '00:00:00'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* PILAR 2: CHAT & HUGGY */}
                        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                    <MessageSquare className="w-4 h-4 text-blue-600" />
                                    Canal Digital (Huggy)
                                </h4>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                                    Chat & Tickets
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                        Atendimentos Huggy
                                    </span>
                                    <span className="text-xl font-black text-gray-900 mt-1 block">
                                        {atendHuggy}
                                    </span>
                                </div>

                                <div className="bg-emerald-50/70 rounded-xl p-3 border border-emerald-200 text-emerald-900">
                                    <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                                        Finalizados
                                    </span>
                                    <span className="text-xl font-black mt-1 block">
                                        {atendFinalizados}
                                    </span>
                                </div>

                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 col-span-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                        TMA Huggy (Tempo Médio Atendimento)
                                    </span>
                                    <span className="font-mono font-bold text-gray-800 text-sm mt-1 block">
                                        {metrics.TMA_Huggy || '00:00:00'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* EXTRATO MATEMÁTICO TRANSPARENTE DA PONTUAÇÃO */}
                    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs space-y-3">
                        <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                            <Calculator className="w-4 h-4 text-gray-500" />
                            Extrato da Fórmula de Cálculo
                        </h4>
                        
                        <div className="divide-y divide-gray-100 text-xs">
                            <div className="py-2.5 flex justify-between items-center">
                                <span className="text-gray-600">Ligações Atendidas ({ligAtendidas} &times; 2 pts)</span>
                                <span className="font-mono font-bold text-emerald-600">+{ligAtendidas * 2} pts</span>
                            </div>
                            <div className="py-2.5 flex justify-between items-center">
                                <span className="text-gray-600">Atendimentos Huggy ({atendHuggy} &times; 1 pt)</span>
                                <span className="font-mono font-bold text-emerald-600">+{atendHuggy * 1} pts</span>
                            </div>
                            <div className="py-2.5 flex justify-between items-center">
                                <span className="text-gray-600">Atendimentos Finalizados ({atendFinalizados} &times; 1 pt)</span>
                                <span className="font-mono font-bold text-emerald-600">+{atendFinalizados * 1} pts</span>
                            </div>
                            {ligPerdidas > 0 && (
                                <div className="py-2.5 flex justify-between items-center">
                                    <span className="text-rose-700 font-medium">Ligações Perdidas ({ligPerdidas} &times; -5 pts)</span>
                                    <span className="font-mono font-bold text-rose-600">-{ligPerdidas * 5} pts</span>
                                </div>
                            )}
                            <div className="pt-3 flex justify-between items-center font-bold text-sm">
                                <span className="text-gray-900">Total Apurado</span>
                                <span className="font-mono font-black text-amber-600 text-base">{calculatedScore} pts</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* RODAPÉ */}
                <div className="p-4 bg-white border-t border-gray-200 flex justify-end shrink-0">
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

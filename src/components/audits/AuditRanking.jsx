import React, { useState, useMemo } from 'react';
import { 
    Award, Trophy, Search, ChevronRight, CheckCircle2, 
    XCircle, ShieldCheck, Flame, User
} from 'lucide-react';

export default function AuditRanking({ rankingData = [], targetRate = 80 }) {
    const [rankingSearch, setRankingSearch] = useState('');
    const [viewAll, setViewAll] = useState(false);

    const filteredRanking = useMemo(() => {
        if (!rankingSearch.trim()) return rankingData;
        const query = rankingSearch.toLowerCase();
        return rankingData.filter(r => r.name.toLowerCase().includes(query));
    }, [rankingData, rankingSearch]);

    const displayedList = viewAll ? filteredRanking : filteredRanking.slice(0, 6);

    const getRankBadge = (index) => {
        if (index === 0) {
            return (
                <div className="w-6 h-6 rounded-full bg-amber-400 text-amber-950 font-black text-xs flex items-center justify-center shadow-xs">
                    1º
                </div>
            );
        }
        if (index === 1) {
            return (
                <div className="w-6 h-6 rounded-full bg-slate-300 text-slate-900 font-black text-xs flex items-center justify-center shadow-xs">
                    2º
                </div>
            );
        }
        if (index === 2) {
            return (
                <div className="w-6 h-6 rounded-full bg-amber-700 text-amber-100 font-black text-xs flex items-center justify-center shadow-xs">
                    3º
                </div>
            );
        }
        return (
            <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 font-bold text-xs flex items-center justify-center">
                {index + 1}º
            </div>
        );
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs flex flex-col h-full overflow-hidden">
            {/* Cabeçalho do Ranking */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                        <Trophy className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                            Ranking de Conformidade QA
                        </h3>
                        <p className="text-[11px] text-gray-500">
                            Aproveitamento dos colaboradores avaliados (Meta: {targetRate}%)
                        </p>
                    </div>
                </div>

                {/* Busca no Ranking */}
                <div className="relative w-full sm:w-48">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar colaborador..."
                        value={rankingSearch}
                        onChange={(e) => setRankingSearch(e.target.value)}
                        className="w-full pl-8 pr-2.5 py-1 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-red-500"
                    />
                </div>
            </div>

            {/* Lista do Ranking */}
            <div className="overflow-y-auto flex-1 p-3 divide-y divide-gray-100">
                {displayedList.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-xs">
                        <User className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        Nenhum colaborador avaliado no período.
                    </div>
                ) : (
                    displayedList.map((colab, index) => {
                        const numTaxa = parseFloat(colab.taxa || 0);
                        const isHit = numTaxa >= targetRate;

                        return (
                            <div 
                                key={colab.id} 
                                className="py-2.5 px-2 flex items-center gap-3 hover:bg-gray-50/80 rounded-xl transition-colors"
                            >
                                {/* Posição */}
                                <div className="shrink-0">
                                    {getRankBadge(index)}
                                </div>

                                {/* Dados do Colaborador */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-xs font-bold text-gray-900 truncate">
                                            {colab.name}
                                        </span>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <span className={`text-xs font-mono font-black px-2 py-0.5 rounded-md ${
                                                isHit 
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                    : numTaxa >= 70
                                                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        : 'bg-red-50 text-red-700 border border-red-200'
                                            }`}>
                                                {colab.taxa}%
                                            </span>
                                        </div>
                                    </div>

                                    {/* Barra de Progresso e Métricas */}
                                    <div className="mt-1.5 flex items-center gap-3">
                                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-300 ${
                                                    isHit ? 'bg-emerald-500' : numTaxa >= 70 ? 'bg-amber-500' : 'bg-red-500'
                                                }`}
                                                style={{ width: `${Math.min(100, Math.max(0, numTaxa))}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-gray-400 shrink-0 font-medium">
                                            {colab.conformes}/{colab.total} conformes
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Rodapé / Botão Ver Mais */}
            {filteredRanking.length > 6 && (
                <div className="p-2.5 bg-gray-50/80 border-t border-gray-100 text-center">
                    <button
                        type="button"
                        onClick={() => setViewAll(!viewAll)}
                        className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors cursor-pointer"
                    >
                        {viewAll ? 'Mostrar Apenas Top 6' : `Ver Todos (${filteredRanking.length} avaliados)`}
                    </button>
                </div>
            )}
        </div>
    );
}

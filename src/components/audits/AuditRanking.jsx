import React, { useState, useMemo } from 'react';
import { Trophy, Search, CalendarClock, User, Target, ChevronDown } from 'lucide-react';

const MEDALS = [
    { grad: 'linear-gradient(145deg, #fde68a, #f59e0b 60%, #b45309)', text: '#451a03', glow: 'rgba(245,158,11,0.45)' },
    { grad: 'linear-gradient(145deg, #f1f5f9, #94a3b8 60%, #475569)', text: '#0f172a', glow: 'rgba(148,163,184,0.4)' },
    { grad: 'linear-gradient(145deg, #fdba74, #c2692b 60%, #7c3a12)', text: '#fff7ed', glow: 'rgba(194,105,43,0.4)' }
];

const BAND = {
    hit: { pill: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', bar: 'from-emerald-500 to-emerald-400', glow: 'rgba(16,185,129,0.45)' },
    near: { pill: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30', bar: 'from-amber-500 to-amber-400', glow: 'rgba(245,158,11,0.45)' },
    low: { pill: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30', bar: 'from-rose-500 to-rose-400', glow: 'rgba(244,63,94,0.45)' }
};

const DAY_MS = 86400000;
const startOfDay = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** Tag da última análise: data + tempo decorrido, em âmbar quando passa de 30 dias. */
const lastAuditInfo = (ts) => {
    if (!ts) return null;
    const days = Math.max(0, Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY_MS));
    const date = new Date(ts).toLocaleDateString('pt-BR');
    const rel = days === 0 ? 'hoje' : days === 1 ? 'ontem' : `há ${days} dias`;
    return { date, rel, stale: days > 30 };
};

const initials = (name = '') => name.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';

/** Foto do perfil do colaborador (com relevo 3D); cai para as iniciais se não houver foto ou ela falhar. */
function Avatar({ name, photoUrl }) {
    const [failed, setFailed] = useState(false);
    const showPhoto = photoUrl && !failed;
    return (
        <div
            className="icon-3d w-10 h-10 rounded-xl bg-subtle text-secondary-hub border border-subtle relative flex items-center justify-center text-xs font-black shrink-0 overflow-hidden"
            aria-hidden={showPhoto ? undefined : true}
        >
            {showPhoto ? (
                <>
                    <img src={photoUrl} alt={name} onError={() => setFailed(true)} className="w-full h-full object-cover" loading="lazy" />
                    {/* Película de relevo por cima da foto: brilho no topo e sombra na base */}
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-[inherit]"
                        style={{
                            backgroundImage: 'linear-gradient(145deg, rgba(255,255,255,0.28), rgba(255,255,255,0) 45%, rgba(0,0,0,0.25))',
                            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -3px 5px rgba(0,0,0,0.35)'
                        }}
                    />
                </>
            ) : (
                initials(name)
            )}
        </div>
    );
}

export default function AuditRanking({ rankingData = [], targetRate = 80 }) {
    const [rankingSearch, setRankingSearch] = useState('');
    const [viewAll, setViewAll] = useState(false);

    const filteredRanking = useMemo(() => {
        if (!rankingSearch.trim()) return rankingData;
        const query = rankingSearch.toLowerCase();
        return rankingData.filter(r => r.name.toLowerCase().includes(query));
    }, [rankingData, rankingSearch]);

    const displayedList = viewAll ? filteredRanking : filteredRanking.slice(0, 6);
    const hits = rankingData.filter(r => parseFloat(r.taxa || 0) >= targetRate).length;

    const renderPosition = (index) => {
        const medal = MEDALS[index];
        if (medal) {
            return (
                <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black"
                    style={{
                        backgroundImage: medal.grad,
                        color: medal.text,
                        boxShadow: `inset 0 1px 1px rgba(255,255,255,0.6), inset 0 -2px 3px rgba(0,0,0,0.3), 0 3px 8px ${medal.glow}`
                    }}
                    aria-label={`${index + 1}º lugar`}
                >
                    {index + 1}º
                </div>
            );
        }
        return (
            <div className="w-8 h-8 rounded-full bg-subtle border border-subtle text-secondary-hub flex items-center justify-center text-[11px] font-bold">
                {index + 1}º
            </div>
        );
    };

    return (
        <div className="bg-surface rounded-3xl border border-subtle shadow-xs flex flex-col h-full overflow-hidden">
            {/* Cabeçalho */}
            <div className="p-4 sm:p-5 border-b border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="icon-3d w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/25 flex items-center justify-center shrink-0">
                        <Trophy className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-primary-hub font-brand tracking-tight">Ranking de Conformidade QA</h3>
                        <p className="text-[11px] text-muted-hub mt-0.5 flex flex-wrap items-center gap-x-2">
                            <span className="inline-flex items-center gap-1"><Target className="w-3 h-3" aria-hidden="true" />Meta {targetRate}%</span>
                            <span aria-hidden="true">·</span>
                            <span><strong className="text-emerald-600 dark:text-emerald-400 font-bold">{hits}</strong> de {rankingData.length} na meta</span>
                        </p>
                    </div>
                </div>

                <div className="relative w-full sm:w-52 shrink-0">
                    <Search className="w-3.5 h-3.5 text-muted-hub absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Buscar colaborador..."
                        value={rankingSearch}
                        onChange={(e) => setRankingSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-subtle border border-subtle rounded-xl outline-none text-primary-hub placeholder:text-muted-hub focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all"
                    />
                </div>
            </div>

            {/* Lista */}
            <div className="overflow-y-auto flex-1 p-3 sm:p-4 space-y-2">
                {displayedList.length === 0 ? (
                    <div className="text-center py-12 text-muted-hub text-xs">
                        <User className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        Nenhum colaborador avaliado no período.
                    </div>
                ) : (
                    displayedList.map((colab, index) => {
                        const numTaxa = parseFloat(colab.taxa || 0);
                        const band = numTaxa >= targetRate ? BAND.hit : numTaxa >= 70 ? BAND.near : BAND.low;
                        const last = lastAuditInfo(colab.lastAuditAt);
                        const top = index === 0 && !rankingSearch.trim();

                        return (
                            <div
                                key={colab.id}
                                className={`group flex items-center gap-3 p-3 rounded-2xl border transition-all hover:-translate-y-px hover:shadow-md ${
                                    top ? 'bg-amber-500/5 border-amber-500/25' : 'bg-canvas/60 border-subtle hover:border-strong'
                                }`}
                            >
                                <div className="shrink-0">{renderPosition(index)}</div>

                                <Avatar name={colab.name} photoUrl={colab.photoUrl} />

                                <div className="flex-1 min-w-0 space-y-1.5">
                                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                                            <span className="text-sm font-bold text-primary-hub truncate">{colab.name}</span>
                                            {last ? (
                                                <span
                                                    title={`Última análise em ${last.date}`}
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                                        last.stale
                                                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                                                            : 'bg-subtle text-secondary-hub border-subtle'
                                                    }`}
                                                >
                                                    <CalendarClock className="w-3 h-3" aria-hidden="true" />
                                                    Última análise: {last.date}
                                                    <span className="opacity-70">· {last.rel}</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-subtle text-muted-hub border-subtle">
                                                    <CalendarClock className="w-3 h-3" aria-hidden="true" />Sem análise registrada
                                                </span>
                                            )}
                                        </div>
                                        <span className={`text-xs font-mono font-black px-2.5 py-1 rounded-lg border ${band.pill}`}>
                                            {colab.taxa}%
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-1 h-2 bg-subtle rounded-full overflow-visible">
                                            <div
                                                className={`h-full rounded-full bg-gradient-to-r ${band.bar} transition-all duration-500`}
                                                style={{ width: `${Math.min(100, Math.max(0, numTaxa))}%`, boxShadow: `0 0 10px ${band.glow}` }}
                                            />
                                            <span
                                                className="absolute -top-0.5 w-0.5 h-3 rounded bg-primary-hub/50"
                                                style={{ left: `${targetRate}%` }}
                                                title={`Meta ${targetRate}%`}
                                                aria-hidden="true"
                                            />
                                        </div>
                                        <span className="text-[10px] text-muted-hub shrink-0 font-medium tabular-nums">
                                            {colab.conformes}/{colab.total} conformes
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Rodapé */}
            {filteredRanking.length > 6 && (
                <div className="p-3 border-t border-subtle text-center">
                    <button
                        type="button"
                        onClick={() => setViewAll(!viewAll)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-500 transition-colors cursor-pointer"
                    >
                        {viewAll ? 'Mostrar apenas Top 6' : `Ver todos (${filteredRanking.length} avaliados)`}
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${viewAll ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            )}
        </div>
    );
}

import React, { useId } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/** Paleta por acento: cores sólidas + brilho sutil, pensadas para o fundo escuro dos cartões. */
const ACCENTS = {
    purple: { text: 'text-purple-300', solid: '#a855f7', glow: 'rgba(168,85,247,0.22)', chip: 'bg-purple-500/15 text-purple-300 border-purple-400/25', ring: 'hover:border-purple-400/50' },
    emerald: { text: 'text-emerald-300', solid: '#10b981', glow: 'rgba(16,185,129,0.22)', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/25', ring: 'hover:border-emerald-400/50' },
    blue: { text: 'text-sky-300', solid: '#38bdf8', glow: 'rgba(56,189,248,0.22)', chip: 'bg-sky-500/15 text-sky-300 border-sky-400/25', ring: 'hover:border-sky-400/50' },
    red: { text: 'text-rose-300', solid: '#fb7185', glow: 'rgba(251,113,133,0.22)', chip: 'bg-rose-500/15 text-rose-300 border-rose-400/25', ring: 'hover:border-rose-400/50' },
};

const STATUS = {
    ok: { dot: 'bg-emerald-400', pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30' },
    warn: { dot: 'bg-amber-400', pill: 'bg-amber-500/15 text-amber-300 border-amber-400/30' },
    bad: { dot: 'bg-rose-400', pill: 'bg-rose-500/15 text-rose-300 border-rose-400/30' },
};

/** Sparkline em área, com último ponto destacado. */
const Spark = ({ values, color }) => {
    const gid = useId().replace(/:/g, '');
    const pts = (values || []).filter((v) => Number.isFinite(v));
    const W = 200;
    const H = 40;
    if (pts.length < 2) return <div style={{ height: H }} />;
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const span = max - min || 1;
    const step = W / (pts.length - 1);
    const xy = pts.map((v, i) => [i * step, H - 5 - ((v - min) / span) * (H - 12)]);
    const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return (
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible" aria-hidden>
            <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.35" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={`${line} L${W},${H} L0,${H} Z`} fill={`url(#${gid})`} />
            <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

/**
 * Cartão de KPI do cockpit.
 * - progress: 0..100 (barra de atingimento da meta) | segments: [{label, ok}] (alternativa à barra)
 * - delta: { text, good, dir: 'up' | 'down' | 'flat' } (já interpretado pelo chamador)
 */
export const KpiHeroCard = ({
    accent = 'purple', label, icon, status, statusLabel, value, valueSuffix, caption,
    goalLabel, goalValue, delta, progress, progressLabel, segments, footer, spark, compact = false,
}) => {
    const Icon = icon;
    const a = ACCENTS[accent] || ACCENTS.purple;
    const s = STATUS[status] || STATUS.ok;
    const DeltaIcon = delta?.dir === 'down' ? TrendingDown : delta?.dir === 'flat' ? Minus : TrendingUp;

    return (
        <div
            className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black ${compact ? "p-3.5" : "p-5"} text-white shadow-lg shadow-black/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${a.ring}`}
        >
            {/* brilho de acento + linha superior */}
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-2xl transition-opacity duration-300 group-hover:opacity-100 opacity-80" style={{ background: a.glow }} />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${a.solid}, transparent)` }} />

            <div className={`relative flex h-full flex-col ${compact ? "gap-2" : "gap-4"}`}>
                {/* topo: rótulo + status + ícone */}
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-2">
                        <span className={`block text-[11px] font-bold uppercase tracking-[0.12em] ${a.text}`}>{label}</span>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${s.pill}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${status === 'ok' ? '' : 'animate-pulse'}`} />
                            {statusLabel}
                        </span>
                    </div>
                    <div className="shrink-0 [perspective:400px]">
                        <div
                            className={`depth-chip relative rounded-xl border ${compact ? "p-1.5" : "p-2.5"} backdrop-blur-sm transition-transform duration-300 ease-out [transform-style:preserve-3d] group-hover:[transform:translateZ(6px)_scale(1.08)] ${a.chip}`}
                            style={{
                                backgroundImage: `linear-gradient(145deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 55%), linear-gradient(315deg, ${a.glow}, transparent)`,
                                boxShadow: `inset 0 1px 1px rgba(255,255,255,0.45), inset 0 -3px 5px rgba(0,0,0,0.4), 4px 7px 14px rgba(0,0,0,0.5), 0 0 16px ${a.glow}`,
                            }}
                        >
                            <Icon
                                className={`depth-fx ${compact ? "h-4 w-4" : "h-5 w-5"} [transform:translateZ(10px)]`}
                                style={{ filter: `drop-shadow(0 2px 2px rgba(0,0,0,0.55)) drop-shadow(0 0 5px ${a.solid}88)` }}
                            />
                        </div>
                    </div>
                </div>

                {/* valor + sparkline */}
                <div className="space-y-2">
                    <div className="min-w-0">
                        <p className={`font-brand ${compact ? "text-2xl" : "text-4xl"} font-black leading-none tracking-tight tabular-nums`}>
                            {value}
                            {valueSuffix && <span className="ml-1 text-xl font-semibold text-zinc-500">{valueSuffix}</span>}
                        </p>
                        <p className={`${compact ? "mt-1" : "mt-2"} text-xs leading-snug text-zinc-400`}>{caption}</p>
                    </div>
                    {spark && <Spark values={spark} color={a.solid} />}
                </div>

                {/* progresso até a meta ou segmentos */}
                {typeof progress === 'number' && (
                    <div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.max(2, Math.min(100, progress))}%`, background: `linear-gradient(90deg, ${a.solid}99, ${a.solid})` }} />
                        </div>
                        {progressLabel && <p className="mt-1 text-[10px] font-medium text-zinc-500">{progressLabel}</p>}
                    </div>
                )}
                {segments && (
                    <div className="grid grid-cols-3 gap-1.5">
                        {segments.map((seg) => (
                            <div key={seg.label} className={`rounded-lg border px-2 py-1.5 text-center text-[10px] font-bold ${seg.ok ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' : 'border-rose-400/30 bg-rose-500/10 text-rose-300'}`}>
                                {seg.label}
                            </div>
                        ))}
                    </div>
                )}

                {/* rodapé */}
                <div className={`mt-auto flex items-center justify-between gap-2 border-t border-white/10 ${compact ? "pt-2" : "pt-3"} text-xs text-zinc-400`}>
                    {footer ? (
                        footer
                    ) : (
                        <span>
                            {goalLabel} <strong className={`font-bold ${a.text}`}>{goalValue}</strong>
                        </span>
                    )}
                    {delta && (
                        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${delta.dir === 'flat' ? 'bg-white/5 text-zinc-400' : delta.good ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                            <DeltaIcon className="h-3 w-3" />
                            {delta.text}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default KpiHeroCard;

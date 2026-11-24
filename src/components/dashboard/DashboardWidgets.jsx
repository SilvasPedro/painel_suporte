import React from 'react';
import { TrendingUp, TrendingDown, Minus, Lightbulb, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { Card } from '../ui';
import { cn } from '../../utils/cn';

import { CHART, fmt, fmtInt } from './chartTheme';

/** Tooltip padrão dos gráficos. `formatter(value, name)` opcional. */
export const ChartTooltip = ({ active, payload, label, formatter }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="rounded-xl border border-subtle bg-surface px-3 py-2 shadow-lg text-xs">
            {label !== undefined && <p className="font-bold text-primary-hub mb-1">{label}</p>}
            {payload
                .filter((p) => p.value !== null && p.value !== undefined)
                .map((p) => (
                    <p key={p.dataKey || p.name} className="flex items-center gap-2 text-secondary-hub">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.fill || p.stroke }} />
                        <span>{p.name}:</span>
                        <span className="font-mono font-bold text-primary-hub tabular-nums">{formatter ? formatter(p.value, p.name) : fmt(p.value)}</span>
                    </p>
                ))}
        </div>
    );
};

export const ChartCard = ({ title, subtitle, action, children, className }) => (
    <Card className={cn('p-4 sm:p-5 flex flex-col min-w-0', className)}>
        <div className="flex items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
                <h3 className="text-sm font-bold text-primary-hub font-brand truncate">{title}</h3>
                {subtitle && <p className="text-[11px] text-muted-hub mt-0.5">{subtitle}</p>}
            </div>
            {action}
        </div>
        <div className="flex-1 min-h-0">{children}</div>
    </Card>
);

export const EmptyChart = ({ message = 'Sem dados no período selecionado.' }) => (
    <div className="h-full min-h-[120px] flex items-center justify-center text-xs text-muted-hub text-center px-4">{message}</div>
);

/** Indicador de variação. `inverse` = menor é melhor (TMA, perdidas, reincidência). */
export const DeltaBadge = ({ delta, inverse = false, suffix = '%' }) => {
    if (delta === null || delta === undefined || Number.isNaN(delta)) {
        return <span className="text-[11px] text-muted-hub">sem comparativo</span>;
    }
    const flat = Math.abs(delta) < 0.5;
    const good = inverse ? delta < 0 : delta > 0;
    const Icon = flat ? Minus : delta > 0 ? TrendingUp : TrendingDown;
    const tone = flat ? 'text-muted-hub' : good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
    return (
        <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold tabular-nums', tone)}>
            <Icon className="w-3 h-3" />
            {delta > 0 ? '+' : ''}
            {fmt(delta)}
            {suffix} <span className="font-medium text-muted-hub">vs sem. anterior</span>
        </span>
    );
};

/** Mini sparkline em SVG (sem dependência de Recharts, leve para os cards). */
export const Sparkline = ({ values, color = CHART.brand, height = 28, width = 90 }) => {
    const pts = values.filter((v) => v !== null && v !== undefined);
    if (pts.length < 2) return <div style={{ height, width }} />;
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const span = max - min || 1;
    const step = width / (pts.length - 1);
    const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`).join(' ');
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0" aria-hidden>
            <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

/** Card de KPI: valor, meta, variação semanal e sparkline. */
export const KpiTile = ({ label, value, unit, icon: Icon, delta, inverse, goalText, status = 'neutral', spark, sparkColor, onClick }) => {
    const ring = {
        success: 'border-emerald-500/30',
        warning: 'border-amber-500/30',
        danger: 'border-rose-500/30',
        neutral: 'border-subtle',
    }[status];
    const chip = {
        success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
        neutral: 'bg-subtle text-secondary-hub',
    }[status];
    return (
        <Card hover={Boolean(onClick)} onClick={onClick} className={cn('group p-4 flex flex-col gap-2', ring)}>
            <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-secondary-hub truncate">{label}</span>
                {Icon && (
                    <span className={cn('icon-3d w-8 h-8 rounded-xl flex items-center justify-center shrink-0', chip)}>
                        <Icon className="w-4 h-4" />
                    </span>
                )}
            </div>
            <div className="flex items-end justify-between gap-2">
                <div className="flex items-baseline gap-1 min-w-0">
                    <span className="font-brand text-2xl sm:text-3xl font-black text-primary-hub tabular-nums tracking-tight truncate">{value}</span>
                    {unit && <span className="text-xs font-semibold text-muted-hub">{unit}</span>}
                </div>
                {spark && <Sparkline values={spark} color={sparkColor} />}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 min-h-[18px]">
                <DeltaBadge delta={delta} inverse={inverse} />
                {goalText && <span className="text-[10px] font-semibold text-muted-hub">{goalText}</span>}
            </div>
        </Card>
    );
};

/** Barras horizontais leves para rankings. */
export const RankBars = ({ items, color = CHART.brand, suffix = '', empty }) => {
    if (!items.length) return <EmptyChart message={empty} />;
    const max = Math.max(...items.map((i) => i.value), 1);
    return (
        <ul className="space-y-2.5">
            {items.map((it, i) => (
                <li key={`${it.name}-${i}`} className="min-w-0">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="truncate font-semibold text-primary-hub" title={it.name}>
                            <span className="text-muted-hub font-mono mr-1.5">{i + 1}º</span>
                            {it.name}
                        </span>
                        <span className="font-mono font-bold text-primary-hub tabular-nums shrink-0">
                            {fmtInt(it.value)}
                            {suffix}
                        </span>
                    </div>
                    <div className="h-1.5 mt-1 rounded-full bg-subtle overflow-hidden">
                        <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(it.value / max) * 100}%`, background: color }} />
                    </div>
                    {it.sub && <p className="text-[10px] text-muted-hub mt-0.5 truncate">{it.sub}</p>}
                </li>
            ))}
        </ul>
    );
};

/** Heatmap colaborador × semana. Cor proporcional à pontuação (min..max do período). */
export const ScoreHeatmap = ({ data }) => {
    const { labels, matrix, min, max } = data;
    if (!matrix.length || !labels.length) return <EmptyChart />;
    const span = max - min || 1;
    const bg = (v) => {
        if (v === null) return 'transparent';
        const t = (v - min) / span; // 0..1
        // vermelho (baixo) → âmbar → verde (alto)
        const hue = Math.round(t * 140);
        return `hsl(${hue} 70% 45% / ${0.22 + t * 0.5})`;
    };
    return (
        <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-xs border-separate border-spacing-1">
                <thead>
                    <tr>
                        <th className="text-left font-semibold text-muted-hub pr-2 sticky left-0 bg-surface">Colaborador</th>
                        {labels.map((l, i) => (
                            <th key={`${l}-${i}`} className="font-semibold text-muted-hub text-center min-w-[44px]">
                                {l}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {matrix.map((row) => (
                        <tr key={row.id}>
                            <td className="pr-2 font-semibold text-primary-hub whitespace-nowrap sticky left-0 bg-surface max-w-[160px] truncate" title={row.name}>
                                {row.name}
                            </td>
                            {row.cells.map((v, i) => (
                                <td
                                    key={i}
                                    className="text-center rounded-md font-mono font-bold tabular-nums text-primary-hub h-7"
                                    style={{ background: bg(v) }}
                                    title={v === null ? 'Sem avaliação' : `${row.name} · ${labels[i]}: ${v} pts`}
                                >
                                    {v === null ? <span className="text-muted-hub font-normal">·</span> : v}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const toneMap = {
    good: { icon: CheckCircle2, cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    warn: { icon: AlertTriangle, cls: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20' },
    bad: { icon: AlertTriangle, cls: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20' },
    info: { icon: Info, cls: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20' },
};

/** Lista de insights automáticos. */
export const InsightsPanel = ({ insights }) => (
    <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-primary-hub font-brand">Destaques automáticos</h3>
        </div>
        {insights.length === 0 ? (
            <p className="text-xs text-muted-hub">Ainda não há dados suficientes para gerar destaques.</p>
        ) : (
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {insights.map((it, i) => {
                    const { icon: Icon, cls } = toneMap[it.tone] || toneMap.info;
                    return (
                        <li key={i} className={cn('flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-snug', cls)}>
                            <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span className="text-primary-hub">{it.text}</span>
                        </li>
                    );
                })}
            </ul>
        )}
    </Card>
);

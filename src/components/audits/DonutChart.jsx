import React, { useId, useState } from 'react';

const W = 240;
const H = 200;
const CX = 120;
const CY = 96;
const R_OUT = 84;
const R_IN = 60;       // anel fino e minimalista
const GAP_DEG = 3;     // espaço entre fatias
const POP = 5;         // deslocamento da fatia em hover

const pt = (deg, r) => {
    const a = (deg * Math.PI) / 180;
    return [r * Math.cos(a), r * Math.sin(a)];
};

const slicePath = (start, end) => {
    const large = end - start > 180 ? 1 : 0;
    const [x1, y1] = pt(start, R_OUT);
    const [x2, y2] = pt(end, R_OUT);
    const [x3, y3] = pt(end, R_IN);
    const [x4, y4] = pt(start, R_IN);
    return `M${x1},${y1} A${R_OUT},${R_OUT} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${R_IN},${R_IN} 0 ${large} 0 ${x4},${y4} Z`;
};

/**
 * Donut 2.5D minimalista: anel plano com sombra suave projetada e brilho sutil.
 * @param data [{ name, value, color }]
 * @param centerValue texto grande no centro (padrão)
 * @param centerLabel legenda pequena no centro (padrão)
 */
export default function DonutChart({ data = [], centerValue = '', centerLabel = '' }) {
    const uid = useId().replace(/:/g, '');
    const [active, setActive] = useState(null);

    const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
    const visible = data.filter(d => d.value > 0);
    const gap = visible.length > 1 ? GAP_DEG : 0;

    const starts = visible.reduce((acc, d, i) => {
        acc.push(i === 0 ? -90 : acc[i - 1] + (visible[i - 1].value / total) * 360);
        return acc;
    }, []);
    const slices = visible.map((d, i) => {
        const span = (d.value / total) * 360;
        const start = starts[i] + gap / 2;
        const end = Math.min(starts[i] + span - gap / 2, starts[i] + 359.99);
        const mid = (start + end) / 2;
        const rad = (mid * Math.PI) / 180;
        return { ...d, path: slicePath(start, end), pct: (d.value / total) * 100, popX: Math.cos(rad) * POP, popY: Math.sin(rad) * POP };
    });

    const hovered = slices.find(s => s.name === active) || null;
    const popOf = (s) => (active === s.name ? `translate(${s.popX} ${s.popY})` : 'translate(0 0)');

    return (
        <div className="w-full flex flex-col items-center">
            <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full max-w-[300px] overflow-visible"
                role="img"
                aria-label={`Distribuição: ${slices.map(s => `${s.name} ${s.pct.toFixed(1)}%`).join(', ')}`}
            >
                <defs>
                    <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="150%">
                        <feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000" floodOpacity="0.28" />
                    </filter>
                    <linearGradient id={`${uid}-gloss`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
                        <stop offset="60%" stopColor="#fff" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* trilho de fundo */}
                <circle cx={CX} cy={CY} r={(R_OUT + R_IN) / 2} fill="none" stroke="currentColor" className="text-subtle" strokeOpacity="0.5" strokeWidth={R_OUT - R_IN} />

                <g className="depth-shadow" transform={`translate(${CX} ${CY})`} filter={`url(#${uid}-shadow)`}>
                    {slices.map((s) => (
                        <g
                            key={s.name}
                            transform={popOf(s)}
                            style={{ transition: 'transform 200ms ease', cursor: 'pointer' }}
                            onMouseEnter={() => setActive(s.name)}
                            onMouseLeave={() => setActive(null)}
                            onFocus={() => setActive(s.name)}
                            onBlur={() => setActive(null)}
                            tabIndex={0}
                        >
                            <path d={s.path} fill={s.color} opacity={active && active !== s.name ? 0.55 : 1} style={{ transition: 'opacity 200ms ease' }} />
                            <path className="depth-gloss" d={s.path} fill={`url(#${uid}-gloss)`} />
                        </g>
                    ))}
                </g>

                {/* centro */}
                <g style={{ pointerEvents: 'none' }}>
                    <text x={CX} y={CY + 4} textAnchor="middle" className="fill-current text-primary-hub" style={{ fontSize: 26, fontWeight: 900 }}>
                        {hovered ? `${hovered.pct.toFixed(1)}%` : centerValue}
                    </text>
                    <text x={CX} y={CY + 20} textAnchor="middle" className="fill-current text-muted-hub" style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {hovered ? `${hovered.name} · ${hovered.value}` : centerLabel}
                    </text>
                </g>
            </svg>

            {/* legenda */}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
                {data.map((d) => (
                    <span
                        key={d.name}
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${active === d.name ? 'text-primary-hub' : 'text-secondary-hub'}`}
                        onMouseEnter={() => d.value > 0 && setActive(d.name)}
                        onMouseLeave={() => setActive(null)}
                    >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} aria-hidden="true" />
                        {d.name}
                        <span className="font-mono text-muted-hub">{d.value}</span>
                    </span>
                ))}
            </div>
        </div>
    );
}

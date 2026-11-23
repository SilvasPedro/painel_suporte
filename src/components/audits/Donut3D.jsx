import React, { useId, useState } from 'react';

const W = 260;
const H = 204;
const CX = 130;
const CY = 88;
const R_OUT = 92;
const R_IN = 60;
const TILT = 0.56;     // achatamento vertical do anel (perspectiva)
const DEPTH = 20;      // espessura do anel
const LAYERS = 18;     // camadas empilhadas para formar a lateral
const GAP_DEG = 2.5;   // espaço entre fatias
const POP = 9;         // deslocamento da fatia em hover

/** Escurece/clareia uma cor #rrggbb multiplicando os canais. */
const shade = (hex, f) => {
    const n = parseInt(hex.replace('#', ''), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
    return `rgb(${ch((n >> 16) & 255)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
};

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
 * Donut 3D em SVG: anel extrudado, brilho na face superior e sombra no chão.
 * @param data [{ name, value, color }]  (cores #rrggbb)
 * @param centerValue texto grande no centro (padrão)
 * @param centerLabel legenda pequena no centro (padrão)
 */
export default function Donut3D({ data = [], centerValue = '', centerLabel = '' }) {
    const uid = useId().replace(/:/g, '');
    const [active, setActive] = useState(null);

    const total = data.reduce((sum, d) => sum + (d.value || 0), 0);
    const visible = data.filter(d => d.value > 0);
    const gap = visible.length > 1 ? GAP_DEG : 0;

    // Ângulo inicial acumulado de cada fatia (começa no topo, sentido horário)
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
        return {
            ...d,
            path: slicePath(start, end),
            pct: (d.value / total) * 100,
            popX: Math.cos(rad) * POP,
            popY: Math.sin(rad) * POP * TILT
        };
    });

    const hovered = slices.find(s => s.name === active) || null;
    const step = DEPTH / LAYERS;
    const popOf = (s) => (active === s.name ? `translate(${s.popX} ${s.popY - 3})` : 'translate(0 0)');
    const popStyle = { transition: 'transform 220ms cubic-bezier(0.3, 1.4, 0.5, 1)' };

    return (
        <div className="w-full flex flex-col items-center">
            <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full max-w-[330px] overflow-visible"
                role="img"
                aria-label={`Distribuição: ${slices.map(s => `${s.name} ${s.pct.toFixed(1)}%`).join(', ')}`}
            >
                <defs>
                    <filter id={`${uid}-blur`} x="-30%" y="-60%" width="160%" height="220%">
                        <feGaussianBlur stdDeviation="7" />
                    </filter>
                    <linearGradient id={`${uid}-gloss`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
                        <stop offset="45%" stopColor="#fff" stopOpacity="0.05" />
                        <stop offset="100%" stopColor="#000" stopOpacity="0.22" />
                    </linearGradient>
                </defs>

                {/* sombra projetada no chão */}
                <ellipse cx={CX} cy={CY + DEPTH + 14} rx={R_OUT * 0.95} ry={R_OUT * TILT * 0.8} fill="#000" opacity="0.38" filter={`url(#${uid}-blur)`} />

                {/* lateral (camadas empilhadas, da mais baixa para a mais alta) */}
                {Array.from({ length: LAYERS }, (_, i) => LAYERS - i).map((layer) => (
                    <g key={layer} transform={`translate(${CX} ${CY + layer * step})`}>
                        <g transform={`scale(1 ${TILT})`}>
                            {slices.map((s) => (
                                <g key={s.name} transform={popOf(s)} style={popStyle}>
                                    <path d={s.path} fill={shade(s.color, 0.55 - (layer / LAYERS) * 0.12)} />
                                </g>
                            ))}
                        </g>
                    </g>
                ))}

                {/* face superior */}
                <g transform={`translate(${CX} ${CY})`}>
                    <g transform={`scale(1 ${TILT})`}>
                        {slices.map((s) => (
                            <g
                                key={s.name}
                                transform={popOf(s)}
                                style={{ ...popStyle, cursor: 'pointer' }}
                                onMouseEnter={() => setActive(s.name)}
                                onMouseLeave={() => setActive(null)}
                                onFocus={() => setActive(s.name)}
                                onBlur={() => setActive(null)}
                                tabIndex={0}
                            >
                                <path d={s.path} fill={s.color} />
                                <path d={s.path} fill={`url(#${uid}-gloss)`} />
                                <path d={s.path} fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                            </g>
                        ))}
                    </g>
                </g>

                {/* centro */}
                <g transform="translate(0 -2)" style={{ pointerEvents: 'none' }}>
                    <text x={CX} y={CY + 3} textAnchor="middle" className="fill-current text-primary-hub" style={{ fontSize: 21, fontWeight: 900 }}>
                        {hovered ? `${hovered.pct.toFixed(1)}%` : centerValue}
                    </text>
                    <text x={CX} y={CY + 14} textAnchor="middle" className="fill-current text-muted-hub" style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {hovered ? `${hovered.name} · ${hovered.value}` : centerLabel}
                    </text>
                </g>
            </svg>

            {/* legenda */}
            <div className="mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
                {data.map((d) => (
                    <span
                        key={d.name}
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors ${active === d.name ? 'text-primary-hub' : 'text-secondary-hub'}`}
                        onMouseEnter={() => d.value > 0 && setActive(d.name)}
                        onMouseLeave={() => setActive(null)}
                    >
                        <span
                            className="w-3 h-3 rounded-full"
                            style={{
                                backgroundImage: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.7), rgba(255,255,255,0) 55%), linear-gradient(${d.color}, ${d.color})`,
                                boxShadow: `inset 0 -2px 3px rgba(0,0,0,0.3), 0 2px 5px ${d.color}66`
                            }}
                            aria-hidden="true"
                        />
                        {d.name}
                        <span className="font-mono text-muted-hub">{d.value}</span>
                    </span>
                ))}
            </div>
        </div>
    );
}

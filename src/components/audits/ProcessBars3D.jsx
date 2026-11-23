import React from 'react';

const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

/**
 * Barras horizontais para "Demandas por processo".
 * @param data [{ name, quantidade, percent }] já ordenado do maior para o menor
 * @param limit quantos processos mostrar (padrão 5)
 */
export default function ProcessBars3D({ data = [], limit = 5 }) {
    const rows = data.slice(0, limit);
    const max = Math.max(1, ...rows.map(d => d.quantidade));

    return (
        <div className="space-y-3 pb-1" role="list" aria-label="Demandas por processo">
            {rows.map((d, i) => {
                const color = COLORS[i % COLORS.length];
                const width = d.quantidade === 0 ? 0 : Math.max(3, (d.quantidade / max) * 100);
                return (
                    <div key={d.name} role="listitem" className="grid grid-cols-[24px_minmax(110px,190px)_minmax(0,1fr)_auto] items-center gap-x-3 group" title={`${d.name}: ${d.quantidade} atendimento(s) · ${d.percent}%`}>
                        <span className="w-6 h-6 rounded-full bg-subtle border border-subtle text-secondary-hub text-[10px] font-black flex items-center justify-center">
                            {i + 1}
                        </span>
                        <span className="text-xs font-bold text-primary-hub truncate">{d.name}</span>

                        {/* trilho + barra */}
                        <div className="relative h-5 rounded-md bg-subtle overflow-hidden">
                            <div
                                className="absolute left-0 top-0 h-full rounded-md origin-left"
                                style={{
                                    width: `${width}%`,
                                    backgroundColor: color,
                                    animation: 'bar3d-grow 700ms cubic-bezier(0.22, 1, 0.36, 1) both',
                                    animationDelay: `${i * 70}ms`
                                }}
                            />
                        </div>

                        <span className="text-right min-w-[78px]">
                            <span className="text-sm font-black text-primary-hub tabular-nums">{d.quantidade}</span>
                            <span className="ml-1.5 text-[11px] font-bold text-muted-hub tabular-nums">{d.percent}%</span>
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

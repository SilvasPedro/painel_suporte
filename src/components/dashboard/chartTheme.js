/** Paleta dos gráficos (funciona nos temas claro/escuro/quente via variáveis CSS). */
export const CHART = {
    axis: 'var(--text-muted)',
    grid: 'var(--border-subtle)',
    brand: '#e11d48',
    sky: '#0ea5e9',
    emerald: '#10b981',
    amber: '#f59e0b',
    violet: '#8b5cf6',
    slate: '#64748b',
};
export const SERIES = [CHART.brand, CHART.sky, CHART.emerald, CHART.amber, CHART.violet, CHART.slate];

export const axisProps = {
    stroke: CHART.axis,
    tick: { fill: CHART.axis, fontSize: 11 },
    tickLine: false,
    axisLine: { stroke: CHART.grid },
};

export const fmt = (v, digits = 1) => (v === null || v === undefined ? '--' : Number(v).toFixed(digits).replace('.', ','));
export const fmtInt = (v) => (v === null || v === undefined ? '--' : Number(v).toLocaleString('pt-BR'));



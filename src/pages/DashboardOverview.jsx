import React, { useState, useEffect, useMemo } from 'react';
import {
    Activity, Clock, CheckCircle2, ChevronRight, Loader2, Filter, RotateCcw, LayoutDashboard, Users,
    PhoneCall, ShieldCheck, Target, Trophy, MessageCircle, PhoneMissed, Gauge, Timer, Repeat, Star, Layers
} from 'lucide-react';
import {
    ComposedChart, Area, Line, Bar, BarChart, LineChart, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { subscribeSharedCollection, subscribeSharedDocument } from '../services/dataCache';
import { formatTime, parseDateSort } from '../utils/timeCalculations';
import { Card, Tabs, Badge } from '../components/ui';
import {
    OFFICIAL_SHIFTS, normalizeEvals, weeklySeries, withMovingAverage, shiftSeries, shiftSummary,
    colabRanking, scoreHeatmap, scoreDistribution, kpiSeries, normalizeGoals, inGoal, goalAdherence,
    qaSeries, filterByDays, weekOverWeek, buildInsights, deltaPct
} from '../utils/dashboardAnalytics';
import {
    ChartTooltip, ChartCard, EmptyChart, KpiTile, RankBars, ScoreHeatmap, InsightsPanel
} from '../components/dashboard/DashboardWidgets';
import { CHART, SERIES, axisProps, fmt, fmtInt } from '../components/dashboard/chartTheme';

const PERIODS = [
    { id: 28, label: '4 semanas' },
    { id: 56, label: '8 semanas' },
    { id: 84, label: '12 semanas' },
    { id: 0, label: 'Todo histórico' },
];

const TABS = [
    { id: 'overview', label: 'Visão Geral', icon: LayoutDashboard },
    { id: 'team', label: 'Equipe', icon: Users },
    { id: 'channels', label: 'Canais & Ligações', icon: PhoneCall },
    { id: 'quality', label: 'Qualidade', icon: ShieldCheck },
    { id: 'goals', label: 'Metas', icon: Target },
];

const minTick = (v) => `${fmt(v, 0)}m`;
const compact = (arr, n = 6) => arr.slice(0, n);

/**
 * DashboardOverview (v5 – Analítica)
 * Cockpit com avaliações semanais, KPIs do setor, QA e terceirizada, com
 * comparativos semana a semana, ranking, heatmap, distribuições e insights automáticos.
 */
const DashboardOverview = ({ onNavigate }) => {
    const go = (tab) => {
        if (typeof onNavigate === 'function') onNavigate(tab);
        else if (typeof window !== 'undefined' && window.__hubdeskNavigate) window.__hubdeskNavigate(tab);
    };

    const [view, setView] = useState('overview');
    const [periodDays, setPeriodDays] = useState(56);
    const [shiftFilter, setShiftFilter] = useState('all');

    const [kpisRaw, setKpisRaw] = useState([]);
    const [goalsRaw, setGoalsRaw] = useState({});
    const [evalsRaw, setEvalsRaw] = useState([]);
    const [colabsFull, setColabsFull] = useState({});
    const [auditsRaw, setAuditsRaw] = useState([]);
    const [thirdParty, setThirdParty] = useState([]);
    const [reportStats, setReportStats] = useState({ pending: 0, inProgress: 0, resolved: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubs = [
            subscribeSharedDocument('system_settings', 'sector_goals', (d) => d && setGoalsRaw(d)),
            subscribeSharedCollection('sector_kpis', (items) => {
                setKpisRaw([...items]);
                setLoading(false);
            }),
            subscribeSharedCollection('collaborators', (items) => {
                const map = {};
                items.forEach((d) => {
                    map[d.id] = d;
                    if (d.firestoreId) map[d.firestoreId] = d;
                    if (d.uid) map[d.uid] = d;
                    if (d.name) map[d.name.trim().toLowerCase()] = d;
                });
                setColabsFull(map);
            }),
            subscribeSharedCollection('weekly_evaluations', (items) => setEvalsRaw([...items])),
            subscribeSharedCollection('critical_reports', (items) => {
                const s = { pending: 0, inProgress: 0, resolved: 0 };
                items.forEach((r) => {
                    if (r.status === 'Pendente') s.pending++;
                    else if (r.status === 'Em Andamento') s.inProgress++;
                    else if (r.status === 'Resolvido') s.resolved++;
                });
                setReportStats(s);
            }),
            subscribeSharedCollection('qa_audits', (items) => setAuditsRaw([...items])),
            subscribeSharedCollection('third_party_audits', (items) => setThirdParty([...items]), { where: [['company', '==', 'ATSOC']] }),
        ];
        return () => unsubs.forEach((u) => u && u());
    }, []);

    const goals = useMemo(() => normalizeGoals({ tmr: '00:20:00', fcr: 80, recurrence: 20, qa: 85, ...goalsRaw }), [goalsRaw]);

    // Âncora temporal = data mais recente com dado (evita período "vazio" quando o lançamento atrasa)
    const anchorTs = useMemo(() => {
        const all = [...evalsRaw.map((e) => parseDateSort(e.date)), ...kpisRaw.map((k) => parseDateSort(k.date))];
        return all.length ? Math.max(...all) : 0;
    }, [evalsRaw, kpisRaw]);

    // ── Dados filtrados ──────────────────────────────────────────
    const allEvals = useMemo(() => normalizeEvals(evalsRaw, colabsFull), [evalsRaw, colabsFull]);
    const evals = useMemo(() => {
        let rows = periodDays ? allEvals.filter((r) => !r.ts || r.ts >= anchorTs - periodDays * 86400000) : allEvals;
        if (shiftFilter !== 'all') rows = rows.filter((r) => r.shift === shiftFilter);
        return rows;
    }, [allEvals, periodDays, shiftFilter, anchorTs]);

    const kpis = useMemo(() => kpiSeries(filterByDays(kpisRaw, (k) => k.date, periodDays, anchorTs)), [kpisRaw, periodDays, anchorTs]);

    const audits = useMemo(() => {
        let rows = filterByDays(auditsRaw, (a) => a.date || a.createdAt, periodDays, anchorTs);
        rows = rows.filter((a) => {
            const c = colabsFull[a.colabId];
            return !c || c.active !== false;
        });
        if (shiftFilter !== 'all') rows = rows.filter((a) => (colabsFull[a.colabId]?.shift || '') === shiftFilter);
        return rows;
    }, [auditsRaw, periodDays, anchorTs, colabsFull, shiftFilter]);

    const thirdPartyRows = useMemo(() => filterByDays(thirdParty, (a) => a.date || a.createdAt, periodDays, anchorTs), [thirdParty, periodDays, anchorTs]);

    // ── Métricas derivadas ───────────────────────────────────────
    const series = useMemo(() => withMovingAverage(weeklySeries(evals), 'avgScore', 3, 'scoreMA'), [evals]);
    const ranking = useMemo(() => colabRanking(evals), [evals]);
    const heatmap = useMemo(() => scoreHeatmap(evals, 8), [evals]);
    const distribution = useMemo(() => scoreDistribution(evals), [evals]);
    const shiftRows = useMemo(() => shiftSummary(evals), [evals]);
    const shiftLines = useMemo(() => shiftSeries(evals), [evals]);
    const adherence = useMemo(() => goalAdherence(kpis, goals), [kpis, goals]);
    const qaTrend = useMemo(() => qaSeries(audits), [audits]);

    const qaTotals = useMemo(() => {
        const total = audits.length;
        const ok = audits.filter((a) => a.status === 'Conforme').length;
        return { total, ok, nok: total - ok, taxa: total ? Math.round((ok / total) * 1000) / 10 : 0 };
    }, [audits]);

    const tp = useMemo(() => {
        const done = thirdPartyRows.filter((a) => a.procedures || a.outcome || a.clientName || a.operatorName);
        const count = (fn) => done.filter(fn).length;
        const pct = (n) => (done.length ? Math.round((n / done.length) * 100) : 0);
        const pos = count((a) => a.quality === 'Positiva');
        const neg = count((a) => a.quality === 'Negativa');
        return {
            total: thirdPartyRows.length,
            done: done.length,
            fcr: pct(count((a) => a.outcome === 'Resolvido')),
            compliance: pct(count((a) => a.procedures === 'Conforme')),
            quality: pos + neg > 0 ? Math.round((pos / (pos + neg)) * 100) : done.length ? 100 : 0,
            qualityMix: [
                { name: 'Positiva', value: pos, color: CHART.emerald },
                { name: 'Neutra', value: count((a) => a.quality === 'Neutra'), color: CHART.amber },
                { name: 'Negativa', value: neg, color: CHART.brand },
            ].filter((d) => d.value > 0),
        };
    }, [thirdPartyRows]);

    const wow = {
        score: weekOverWeek(series, 'avgScore'),
        vol: weekOverWeek(series, 'finalizados'),
        tmaTel: weekOverWeek(series, 'tmaTel'),
        tmaHuggy: weekOverWeek(series, 'tmaHuggy'),
        lost: weekOverWeek(series, 'lostRate'),
        huggy: weekOverWeek(series, 'huggyPct'),
    };
    const lastKpi = kpis[kpis.length - 1];
    const prevKpi = kpis[kpis.length - 2];
    const kpiDelta = (key) => (lastKpi && prevKpi ? deltaPct(lastKpi[key], prevKpi[key]) : null);
    const status = (kind, v) => (v === undefined ? 'neutral' : inGoal(kind, v, goals) ? 'success' : 'danger');

    const insights = useMemo(
        () => buildInsights({ series, ranking, kpis, goals, adherence, qa: qaTotals }),
        [series, ranking, kpis, goals, adherence, qaTotals]
    );

    // Volume por canal (telefonia x chat) e mix total
    const channelSeries = useMemo(() => series.map((s) => ({ ...s, telefonia: s.atendidas + s.realizadas })), [series]);
    const totals = useMemo(() => {
        const t = series.reduce(
            (a, s) => ({ fin: a.fin + s.finalizados, att: a.att + s.atendidas, lost: a.lost + s.perdidas, out: a.out + s.realizadas, chat: a.chat + s.huggyFin }),
            { fin: 0, att: 0, lost: 0, out: 0, chat: 0 }
        );
        return { ...t, lostRate: t.att + t.lost ? (t.lost / (t.att + t.lost)) * 100 : 0 };
    }, [series]);

    const hasFilters = shiftFilter !== 'all' || periodDays !== 56;
    const reset = () => { setShiftFilter('all'); setPeriodDays(56); };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-canvas h-full p-8 text-primary-hub">
                <Loader2 className="w-10 h-10 text-rose-500 animate-spin mb-3" />
                <p className="text-sm font-medium text-secondary-hub">Carregando indicadores e avaliações...</p>
            </div>
        );
    }

    const gridCls = 'grid grid-cols-1 lg:grid-cols-2 gap-4';
    const chartH = 'h-64';

    return (
        <div className="flex-1 p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-canvas text-primary-hub flex flex-col gap-5 transition-colors">
            {/* Cabeçalho */}
            <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
                <div>
                    <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-rose-500 uppercase tracking-wider">
                        <Activity className="w-3.5 h-3.5" />
                        <span>Dashboard Analítica</span>
                    </div>
                    <h1 className="font-brand text-2xl sm:text-3xl font-bold tracking-tight">Visão Geral da Operação</h1>
                    <p className="text-xs sm:text-sm text-secondary-hub mt-1">
                        Avaliações semanais, KPIs do setor e qualidade — {series.length} semana(s) apurada(s), {ranking.length} colaborador(es).
                    </p>
                </div>
                <Tabs tabs={TABS} activeTab={view} onChange={setView} id="dash-analytics-tabs" />
            </header>

            {/* Filtros */}
            <div className="bg-surface p-3 sm:p-3.5 rounded-2xl border border-subtle flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-rose-500" /> Filtros
                    </span>
                    <div className="flex flex-wrap items-center gap-1 bg-canvas p-1 rounded-xl border border-subtle">
                        {[{ id: 'all', label: 'Todos turnos' }, ...OFFICIAL_SHIFTS.map((s) => ({ id: s, label: s }))].map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => setShiftFilter(s.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${shiftFilter === s.id ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30' : 'text-muted-hub hover:text-primary-hub border border-transparent'}`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 bg-canvas p-1 rounded-xl border border-subtle">
                        {PERIODS.map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setPeriodDays(p.id)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${periodDays === p.id ? 'bg-surface text-primary-hub shadow-xs border border-subtle' : 'text-muted-hub hover:text-primary-hub border border-transparent'}`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {hasFilters && (
                        <button type="button" onClick={reset} className="px-3 py-1.5 rounded-xl border border-subtle bg-canvas hover:bg-subtle text-secondary-hub text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                            <RotateCcw className="w-3.5 h-3.5" /> Limpar
                        </button>
                    )}
                    <span className="text-[11px] text-muted-hub hidden sm:inline">{evals.length} avaliações</span>
                </div>
            </div>

            {/* Fila de demandas (resumo compacto) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
                <Card hover onClick={() => go('reports')} className="p-3.5 border-amber-500/30 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400"><Clock className="w-4 h-4" /> Pendentes</span>
                    <span className="flex items-center gap-2 font-brand text-2xl font-black tabular-nums">{reportStats.pending}<ChevronRight className="w-4 h-4 text-amber-500" /></span>
                </Card>
                <Card className="p-3.5 border-sky-500/30 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400"><Activity className="w-4 h-4" /> Em andamento</span>
                    <span className="font-brand text-2xl font-black tabular-nums">{reportStats.inProgress}</span>
                </Card>
                <Card className="p-3.5 border-emerald-500/30 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-4 h-4" /> Resolvidas</span>
                    <span className="font-brand text-2xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">{reportStats.resolved}</span>
                </Card>
            </div>

            {/* ================= VISÃO GERAL ================= */}
            {view === 'overview' && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <KpiTile label="TMR Setor" icon={Timer} value={lastKpi ? lastKpi.tmrRaw || formatTime(lastKpi.tmr) : '--'} delta={kpiDelta('tmr')} inverse
                            status={lastKpi ? status('tmr', lastKpi.tmr) : 'neutral'} goalText={`Meta ≤ ${goals.tmrRaw}`} spark={kpis.map((k) => k.tmr)} sparkColor={CHART.sky} onClick={() => go('sector_kpis')} />
                        <KpiTile label="FCR (1º contato)" icon={CheckCircle2} value={lastKpi ? fmt(lastKpi.fcr) : '--'} unit="%" delta={kpiDelta('fcr')}
                            status={lastKpi ? status('fcr', lastKpi.fcr) : 'neutral'} goalText={`Meta ≥ ${goals.fcr}%`} spark={kpis.map((k) => k.fcr)} sparkColor={CHART.emerald} onClick={() => go('sector_kpis')} />
                        <KpiTile label="Reincidência" icon={Repeat} value={lastKpi ? fmt(lastKpi.recurrence) : '--'} unit="%" delta={kpiDelta('recurrence')} inverse
                            status={lastKpi ? status('recurrence', lastKpi.recurrence) : 'neutral'} goalText={`Meta ≤ ${goals.recurrence}%`} spark={kpis.map((k) => k.recurrence)} sparkColor={CHART.amber} onClick={() => go('sector_kpis')} />
                        <KpiTile label="Conformidade QA" icon={ShieldCheck} value={qaTotals.total ? fmt(qaTotals.taxa) : '--'} unit="%" delta={weekOverWeek(qaTrend, 'taxa').delta}
                            status={qaTotals.total ? status('qa', qaTotals.taxa) : 'neutral'} goalText={`Meta ≥ ${goals.qa}%`} spark={qaTrend.map((q) => q.taxa)} sparkColor={CHART.violet} onClick={() => go('audits')} />
                        <KpiTile label="Pontuação média" icon={Star} value={fmt(wow.score.current)} unit="pts" delta={wow.score.delta} spark={series.map((s) => s.avgScore)} sparkColor={CHART.brand} />
                        <KpiTile label="Atend. finalizados" icon={Layers} value={fmtInt(wow.vol.current)} delta={wow.vol.delta} spark={series.map((s) => s.finalizados)} sparkColor={CHART.sky} />
                        <KpiTile label="TMA telefonia" icon={PhoneCall} value={wow.tmaTel.current ? formatTime(wow.tmaTel.current) : '--'} delta={wow.tmaTel.delta} inverse spark={series.map((s) => s.tmaTel)} sparkColor={CHART.violet} />
                        <KpiTile label="Ligações perdidas" icon={PhoneMissed} value={fmt(wow.lost.current)} unit="%" delta={wow.lost.delta} inverse
                            status={wow.lost.current > 5 ? 'danger' : 'neutral'} spark={series.map((s) => s.lostRate)} sparkColor={CHART.brand} />
                    </div>

                    <InsightsPanel insights={insights} />

                    <div className={gridCls}>
                        <ChartCard title="Pontuação da equipe por semana" subtitle="Média por colaborador e tendência (média móvel de 3 semanas)">
                            <div className={chartH}>
                                {series.length ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor={CHART.brand} stopOpacity={0.35} />
                                                    <stop offset="100%" stopColor={CHART.brand} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="label" {...axisProps} />
                                            <YAxis {...axisProps} />
                                            <Tooltip content={<ChartTooltip formatter={(v) => `${fmt(v)} pts`} />} />
                                            <Area type="monotone" dataKey="avgScore" name="Média" stroke={CHART.brand} strokeWidth={2.5} fill="url(#gScore)" dot={{ r: 3 }} />
                                            <Line type="monotone" dataKey="scoreMA" name="Tendência" stroke={CHART.slate} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                ) : <EmptyChart />}
                            </div>
                        </ChartCard>

                        <ChartCard title="KPIs do setor × metas" subtitle="FCR e Reincidência (%) com linhas de meta">
                            <div className={chartH}>
                                {kpis.length ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={kpis} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="label" {...axisProps} />
                                            <YAxis {...axisProps} domain={[0, 100]} />
                                            <Tooltip content={<ChartTooltip formatter={(v) => `${fmt(v)}%`} />} />
                                            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                                            <ReferenceLine y={goals.fcr} stroke={CHART.emerald} strokeDasharray="4 4" />
                                            <ReferenceLine y={goals.recurrence} stroke={CHART.amber} strokeDasharray="4 4" />
                                            <Line type="monotone" dataKey="fcr" name="FCR" stroke={CHART.emerald} strokeWidth={2.5} dot={{ r: 3 }} />
                                            <Line type="monotone" dataKey="recurrence" name="Reincidência" stroke={CHART.amber} strokeWidth={2.5} dot={{ r: 3 }} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : <EmptyChart />}
                            </div>
                        </ChartCard>

                        <ChartCard title="TMR do setor" subtitle={`Minutos — meta ≤ ${goals.tmrRaw}`}>
                            <div className={chartH}>
                                {kpis.length ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={kpis} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="label" {...axisProps} />
                                            <YAxis {...axisProps} tickFormatter={minTick} />
                                            <Tooltip content={<ChartTooltip formatter={(v) => formatTime(v)} />} />
                                            <ReferenceLine y={goals.tmr} stroke={CHART.emerald} strokeDasharray="4 4" label={{ value: 'meta', fill: CHART.emerald, fontSize: 10, position: 'insideTopRight' }} />
                                            <Bar dataKey="tmr" name="TMR" radius={[6, 6, 0, 0]}>
                                                {kpis.map((k, i) => <Cell key={i} fill={inGoal('tmr', k.tmr, goals) ? CHART.sky : CHART.brand} />)}
                                            </Bar>
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                ) : <EmptyChart />}
                            </div>
                        </ChartCard>

                        <ChartCard title="Volume semanal" subtitle="Atendimentos finalizados na equipe">
                            <div className={chartH}>
                                {series.length ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="label" {...axisProps} />
                                            <YAxis {...axisProps} />
                                            <Tooltip content={<ChartTooltip formatter={(v) => fmtInt(v)} />} />
                                            <Bar dataKey="finalizados" name="Finalizados" fill={CHART.sky} radius={[6, 6, 0, 0]} />
                                            <Line type="monotone" dataKey="volumePerColab" name="Média/colab." stroke={CHART.brand} strokeWidth={2} dot={{ r: 3 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                ) : <EmptyChart />}
                            </div>
                        </ChartCard>
                    </div>
                </>
            )}

            {/* ================= EQUIPE ================= */}
            {view === 'team' && (
                <>
                    <div className={gridCls}>
                        <ChartCard title="Ranking por pontuação média" subtitle="Top 8 do período" action={<Trophy className="w-4 h-4 text-amber-500" />}>
                            <RankBars items={compact(ranking, 8).map((r) => ({ name: r.name, value: r.avgScore, sub: `${r.shift || '—'} · ${r.evals} aval. · melhor ${r.bestScore} pts` }))} suffix=" pts" />
                        </ChartCard>
                        <ChartCard title="Distribuição das pontuações" subtitle="Quantas avaliações caíram em cada faixa de pontos">
                            <div className={chartH}>
                                {distribution.length ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={distribution} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="range" {...axisProps} />
                                            <YAxis {...axisProps} allowDecimals={false} />
                                            <Tooltip content={<ChartTooltip formatter={(v) => `${v} avaliação(ões)`} />} />
                                            <Bar dataKey="count" name="Avaliações" fill={CHART.violet} radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : <EmptyChart />}
                            </div>
                        </ChartCard>
                    </div>

                    <ChartCard title="Mapa de calor — pontuação por colaborador × semana" subtitle="Últimas 8 semanas · verde = alta, vermelho = baixa">
                        <ScoreHeatmap data={heatmap} />
                    </ChartCard>

                    <ChartCard title="Detalhamento individual" subtitle="Tendência = variação da última avaliação sobre a anterior; consistência = desvio-padrão (menor é mais estável)">
                        {ranking.length ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="text-left text-muted-hub uppercase tracking-wider text-[10px]">
                                            {['Colaborador', 'Turno', 'Aval.', 'Média', 'Última', 'Tendência', 'Consist.', 'Vol. médio', 'Perdidas', 'TMA Tel.', 'TMA Chat'].map((h) => (
                                                <th key={h} className="py-2 pr-3 font-bold whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ranking.map((r) => (
                                            <tr key={r.id} className="border-t border-subtle">
                                                <td className="py-2 pr-3 font-semibold whitespace-nowrap">{r.name}</td>
                                                <td className="pr-3 text-secondary-hub whitespace-nowrap">{r.shift || '—'}</td>
                                                <td className="pr-3 tabular-nums">{r.evals}</td>
                                                <td className="pr-3 font-bold tabular-nums">{r.avgScore}</td>
                                                <td className="pr-3 tabular-nums">{r.lastScore}</td>
                                                <td className={`pr-3 font-bold tabular-nums ${r.trend === null ? 'text-muted-hub' : r.trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                    {r.trend === null ? '—' : `${r.trend > 0 ? '+' : ''}${r.trend}`}
                                                </td>
                                                <td className="pr-3 tabular-nums">{fmt(r.consistency)}</td>
                                                <td className="pr-3 tabular-nums">{r.avgVol}</td>
                                                <td className="pr-3 tabular-nums">{r.totalLost}</td>
                                                <td className="pr-3 font-mono tabular-nums">{r.tmaTel ? formatTime(r.tmaTel) : '—'}</td>
                                                <td className="pr-3 font-mono tabular-nums">{r.tmaHuggy ? formatTime(r.tmaHuggy) : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <EmptyChart />}
                    </ChartCard>

                    <div className={gridCls}>
                        <ChartCard title="Pontuação média por turno" subtitle="Evolução semanal comparando os turnos">
                            <div className={chartH}>
                                {shiftLines.length ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={shiftLines} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="label" {...axisProps} />
                                            <YAxis {...axisProps} />
                                            <Tooltip content={<ChartTooltip formatter={(v) => `${fmt(v)} pts`} />} />
                                            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                                            {OFFICIAL_SHIFTS.map((s, i) => (
                                                <Line key={s} type="monotone" dataKey={s} name={s} stroke={SERIES[i]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                                            ))}
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : <EmptyChart />}
                            </div>
                        </ChartCard>
                        <ChartCard title="Resumo por turno" subtitle="Médias no período filtrado">
                            {shiftRows.length ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {shiftRows.map((s) => (
                                        <div key={s.shift} className="rounded-xl border border-subtle bg-canvas p-3">
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className="text-xs font-bold">{s.shift}</span>
                                                <Badge size="sm" variant="default">{s.colabs} colab.</Badge>
                                            </div>
                                            <p className="font-brand text-xl font-black tabular-nums">{fmt(s.avgScore)} <span className="text-[11px] font-semibold text-muted-hub">pts</span></p>
                                            <p className="text-[11px] text-secondary-hub mt-1">Vol. médio {fmt(s.avgVol, 0)} · perdidas {fmt(s.lostRate)}%</p>
                                            <p className="text-[11px] text-muted-hub">TMA tel. {s.tmaTel ? formatTime(s.tmaTel) : '—'}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : <EmptyChart />}
                        </ChartCard>
                    </div>
                </>
            )}

            {/* ================= CANAIS ================= */}
            {view === 'channels' && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <KpiTile label="Ligações atendidas" icon={PhoneCall} value={fmtInt(totals.att)} spark={series.map((s) => s.atendidas)} sparkColor={CHART.sky} />
                        <KpiTile label="Ligações realizadas" icon={PhoneCall} value={fmtInt(totals.out)} spark={series.map((s) => s.realizadas)} sparkColor={CHART.violet} />
                        <KpiTile label="Perdidas (taxa)" icon={PhoneMissed} value={fmt(totals.lostRate)} unit="%" status={totals.lostRate > 5 ? 'danger' : 'success'} goalText={`${fmtInt(totals.lost)} perdidas`} spark={series.map((s) => s.lostRate)} sparkColor={CHART.brand} />
                        <KpiTile label="Chat finalizados" icon={MessageCircle} value={fmtInt(totals.chat)} spark={series.map((s) => s.huggyFin)} sparkColor={CHART.emerald} />
                    </div>
                    <div className={gridCls}>
                        <ChartCard title="Volume por canal" subtitle="Telefonia (atendidas + realizadas) × Chat (Huggy finalizados)">
                            <div className={chartH}>
                                {channelSeries.length ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={channelSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="label" {...axisProps} />
                                            <YAxis {...axisProps} />
                                            <Tooltip content={<ChartTooltip formatter={(v) => fmtInt(v)} />} />
                                            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                                            <Bar dataKey="telefonia" name="Telefonia" stackId="c" fill={CHART.sky} />
                                            <Bar dataKey="huggyFin" name="Chat" stackId="c" fill={CHART.emerald} radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : <EmptyChart />}
                            </div>
                        </ChartCard>
                        <ChartCard title="Ligações perdidas" subtitle="Quantidade (barras) e taxa % sobre o total recebido (linha)">
                            <div className={chartH}>
                                {series.length ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={series} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
                                            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="label" {...axisProps} />
                                            <YAxis yAxisId="l" {...axisProps} allowDecimals={false} />
                                            <YAxis yAxisId="r" orientation="right" {...axisProps} tickFormatter={(v) => `${v}%`} />
                                            <Tooltip content={<ChartTooltip formatter={(v, n) => (n === 'Taxa' ? `${fmt(v)}%` : fmtInt(v))} />} />
                                            <Bar yAxisId="l" dataKey="perdidas" name="Perdidas" fill={CHART.brand} radius={[6, 6, 0, 0]} />
                                            <Line yAxisId="r" type="monotone" dataKey="lostRate" name="Taxa" stroke={CHART.amber} strokeWidth={2.5} dot={{ r: 3 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                ) : <EmptyChart />}
                            </div>
                        </ChartCard>
                        <ChartCard title="Tempos médios (TMA / TME)" subtitle="Minutos — telefonia, chat e espera na telefonia">
                            <div className={chartH}>
                                {series.length ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="label" {...axisProps} />
                                            <YAxis {...axisProps} tickFormatter={minTick} />
                                            <Tooltip content={<ChartTooltip formatter={(v) => formatTime(v)} />} />
                                            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                                            <Line type="monotone" dataKey="tmaTel" name="TMA Telefonia" stroke={CHART.violet} strokeWidth={2.5} dot={{ r: 3 }} />
                                            <Line type="monotone" dataKey="tmaHuggy" name="TMA Chat" stroke={CHART.emerald} strokeWidth={2.5} dot={{ r: 3 }} />
                                            <Line type="monotone" dataKey="tmeTel" name="TME Telefonia" stroke={CHART.amber} strokeWidth={2} strokeDasharray="5 4" dot={false} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : <EmptyChart />}
                            </div>
                        </ChartCard>
                        <ChartCard title="Aproveitamento do Chat (Huggy)" subtitle="% de finalizados sobre iniciados (média da equipe)">
                            <div className={chartH}>
                                {series.some((s) => s.huggyPct !== null) ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="gHuggy" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor={CHART.emerald} stopOpacity={0.35} />
                                                    <stop offset="100%" stopColor={CHART.emerald} stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="label" {...axisProps} />
                                            <YAxis {...axisProps} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                            <Tooltip content={<ChartTooltip formatter={(v) => `${fmt(v)}%`} />} />
                                            <Area type="monotone" dataKey="huggyPct" name="Aproveitamento" stroke={CHART.emerald} strokeWidth={2.5} fill="url(#gHuggy)" dot={{ r: 3 }} connectNulls />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                ) : <EmptyChart message="Sem registros no formato Iniciados/Finalizados neste período." />}
                            </div>
                        </ChartCard>
                    </div>
                    <ChartCard title="Maiores volumes e mais ligações perdidas" subtitle="Comparativo individual no período">
                        <div className={gridCls}>
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-hub mb-2">Volume médio por avaliação</p>
                                <RankBars color={CHART.sky} items={compact([...ranking].sort((a, b) => b.avgVol - a.avgVol), 6).map((r) => ({ name: r.name, value: r.avgVol, sub: r.shift }))} />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-hub mb-2">Ligações perdidas (total)</p>
                                <RankBars color={CHART.brand} items={compact([...ranking].filter((r) => r.totalLost > 0).sort((a, b) => b.totalLost - a.totalLost), 6).map((r) => ({ name: r.name, value: r.totalLost, sub: `${fmt(r.lostRate)}% das ligações recebidas` }))} empty="Nenhuma ligação perdida no período. 🎉" />
                            </div>
                        </div>
                    </ChartCard>
                </>
            )}

            {/* ================= QUALIDADE ================= */}
            {view === 'quality' && (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <KpiTile label="QA interno" icon={ShieldCheck} value={qaTotals.total ? fmt(qaTotals.taxa) : '--'} unit="%" status={qaTotals.total ? status('qa', qaTotals.taxa) : 'neutral'} goalText={`${qaTotals.total} auditorias`} spark={qaTrend.map((q) => q.taxa)} sparkColor={CHART.violet} />
                        <KpiTile label="Terceirizada · FCR" icon={CheckCircle2} value={tp.done ? tp.fcr : '--'} unit="%" goalText={`${tp.done}/${tp.total} apuradas`} />
                        <KpiTile label="Terceirizada · Procedimentos" icon={Gauge} value={tp.done ? tp.compliance : '--'} unit="%" />
                        <KpiTile label="Terceirizada · Qualidade" icon={Star} value={tp.done ? tp.quality : '--'} unit="%" />
                    </div>
                    <div className={gridCls}>
                        <ChartCard title="Conformidade de QA por data" subtitle="Taxa (%) e auditorias conformes × não conformes">
                            <div className={chartH}>
                                {qaTrend.length ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <ComposedChart data={qaTrend} margin={{ top: 8, right: 0, left: -12, bottom: 0 }}>
                                            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                                            <XAxis dataKey="label" {...axisProps} />
                                            <YAxis yAxisId="l" {...axisProps} allowDecimals={false} />
                                            <YAxis yAxisId="r" orientation="right" {...axisProps} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                                            <Tooltip content={<ChartTooltip formatter={(v, n) => (n === 'Taxa' ? `${fmt(v)}%` : fmtInt(v))} />} />
                                            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                                            <ReferenceLine yAxisId="r" y={goals.qa} stroke={CHART.emerald} strokeDasharray="4 4" />
                                            <Bar yAxisId="l" dataKey="conformes" name="Conformes" stackId="q" fill={CHART.emerald} />
                                            <Bar yAxisId="l" dataKey="naoConformes" name="Não conformes" stackId="q" fill={CHART.brand} radius={[6, 6, 0, 0]} />
                                            <Line yAxisId="r" type="monotone" dataKey="taxa" name="Taxa" stroke={CHART.violet} strokeWidth={2.5} dot={{ r: 3 }} />
                                        </ComposedChart>
                                    </ResponsiveContainer>
                                ) : <EmptyChart message="Nenhuma auditoria de QA no período." />}
                            </div>
                        </ChartCard>
                        <ChartCard title="Terceirizada — qualidade do atendimento" subtitle="Distribuição das avaliações apuradas (ATSOC)">
                            {tp.qualityMix.length ? (
                                <div className="flex flex-col sm:flex-row items-center gap-4">
                                    <div className="w-44 h-44 shrink-0 relative">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={tp.qualityMix} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                                                    {tp.qualityMix.map((d) => <Cell key={d.name} fill={d.color} />)}
                                                </Pie>
                                                <Tooltip content={<ChartTooltip formatter={(v) => fmtInt(v)} />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="font-brand text-2xl font-black tabular-nums">{tp.done}</span>
                                            <span className="text-[9px] uppercase tracking-wider text-muted-hub">apuradas</span>
                                        </div>
                                    </div>
                                    <ul className="space-y-1.5 text-xs">
                                        {tp.qualityMix.map((d) => (
                                            <li key={d.name} className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                                                <span className="text-secondary-hub">{d.name}</span>
                                                <span className="font-mono font-bold tabular-nums">{d.value}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : <EmptyChart message="Sem auditorias da terceirizada apuradas no período." />}
                        </ChartCard>
                    </div>
                </>
            )}

            {/* ================= METAS ================= */}
            {view === 'goals' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                            { k: 'tmr', label: 'TMR', goal: `≤ ${goals.tmrRaw}`, current: lastKpi ? lastKpi.tmrRaw || formatTime(lastKpi.tmr) : '--', ok: lastKpi && inGoal('tmr', lastKpi.tmr, goals) },
                            { k: 'fcr', label: 'FCR', goal: `≥ ${goals.fcr}%`, current: lastKpi ? `${fmt(lastKpi.fcr)}%` : '--', ok: lastKpi && inGoal('fcr', lastKpi.fcr, goals) },
                            { k: 'recurrence', label: 'Reincidência', goal: `≤ ${goals.recurrence}%`, current: lastKpi ? `${fmt(lastKpi.recurrence)}%` : '--', ok: lastKpi && inGoal('recurrence', lastKpi.recurrence, goals) },
                        ].map((g) => {
                            const a = adherence[g.k];
                            return (
                                <Card key={g.k} className={`p-4 ${lastKpi ? (g.ok ? 'border-emerald-500/30' : 'border-rose-500/30') : ''}`}>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wider text-secondary-hub">{g.label}</span>
                                        {lastKpi && <Badge size="sm" variant={g.ok ? 'success' : 'danger'}>{g.ok ? 'Na meta' : 'Fora da meta'}</Badge>}
                                    </div>
                                    <p className="font-brand text-3xl font-black tabular-nums mt-2">{g.current}</p>
                                    <p className="text-[11px] text-muted-hub">Meta {g.goal}</p>
                                    <div className="mt-3">
                                        <div className="flex justify-between text-[11px] font-semibold text-secondary-hub mb-1">
                                            <span>Aderência no período</span>
                                            <span className="tabular-nums">{a.hits}/{a.total} · {a.pct}%</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-subtle overflow-hidden">
                                            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${a.pct}%`, background: a.pct >= 70 ? CHART.emerald : a.pct >= 40 ? CHART.amber : CHART.brand }} />
                                        </div>
                                        <p className="text-[11px] text-muted-hub mt-1.5">
                                            {a.streak > 0 ? `${a.streak} apuração(ões) seguidas na meta` : a.missStreak > 0 ? `${a.missStreak} apuração(ões) seguidas fora da meta` : 'Sem histórico'}
                                        </p>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                    <ChartCard title="Histórico de metas (semáforo)" subtitle="Cada coluna é uma apuração de KPI: verde = dentro da meta, vermelho = fora">
                        {kpis.length ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-separate border-spacing-1">
                                    <thead>
                                        <tr>
                                            <th className="text-left text-muted-hub font-semibold pr-2">Indicador</th>
                                            {kpis.map((k, i) => <th key={i} className="text-muted-hub font-semibold text-center min-w-[52px]">{k.label}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[
                                            { k: 'tmr', label: 'TMR', show: (k) => k.tmrRaw || formatTime(k.tmr) },
                                            { k: 'fcr', label: 'FCR', show: (k) => `${fmt(k.fcr, 0)}%` },
                                            { k: 'recurrence', label: 'Reincid.', show: (k) => `${fmt(k.recurrence, 0)}%` },
                                        ].map((row) => (
                                            <tr key={row.k}>
                                                <td className="font-semibold pr-2">{row.label}</td>
                                                {kpis.map((k, i) => {
                                                    const ok = inGoal(row.k, k[row.k], goals);
                                                    return (
                                                        <td key={i} className={`text-center rounded-md h-7 font-mono font-bold tabular-nums ${ok ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'}`}>
                                                            {row.show(k)}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : <EmptyChart message="Nenhum KPI lançado no período." />}
                    </ChartCard>
                </>
            )}
        </div>
    );
};

export default DashboardOverview;

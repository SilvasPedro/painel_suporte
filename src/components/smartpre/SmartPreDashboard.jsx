import React, { useMemo } from 'react';
import {
    Users, PhoneIncoming, Timer, Wrench, CheckCircle2, AlertTriangle, TrendingUp,
    ShieldCheck, Activity, ChevronRight
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie, Legend
} from 'recharts';
import { Card, StatCard, EmptyState } from '../ui';
import { cn } from '../../utils/cn';
import {
    computeSmartPreStats, getServiceHealth, buildMonthlyTimeline, SMART_PRE_RESOLUTIONS,
    getDaysToFirstContact, normalizeIssues, getIssueLabel
} from '../../utils/smartPre';

const TOOLTIP_STYLE = { backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', color: '#fff', fontSize: '11px' };
const AXIS_TICK = { fontSize: 11, fill: '#a1a1aa' };

const HEALTH_STYLES = {
    good: { box: 'bg-emerald-500/10 border-emerald-500/25', icon: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', title: 'text-emerald-700 dark:text-emerald-400', Icon: ShieldCheck },
    attention: { box: 'bg-amber-500/10 border-amber-500/25', icon: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', title: 'text-amber-700 dark:text-amber-400', Icon: AlertTriangle },
    critical: { box: 'bg-rose-500/10 border-rose-500/25', icon: 'bg-rose-500/15 text-rose-600 dark:text-rose-400', title: 'text-rose-700 dark:text-rose-400', Icon: AlertTriangle },
    empty: { box: 'bg-subtle border-subtle', icon: 'bg-surface text-muted-hub', title: 'text-secondary-hub', Icon: Activity }
};

const ChartCard = ({ title, subtitle, children, className }) => (
    <Card className={cn('p-5', className)}>
        <div className="mb-3">
            <h3 className="font-brand text-sm font-bold text-primary-hub tracking-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-hub mt-0.5">{subtitle}</p>}
        </div>
        {children}
    </Card>
);

const NoData = ({ text = 'Sem dados no período.' }) => (
    <div className="h-48 flex items-center justify-center text-xs text-muted-hub">{text}</div>
);

export default function SmartPreDashboard({ clients, allClients, onOpenClient }) {
    const stats = useMemo(() => computeSmartPreStats(clients), [clients]);
    const health = useMemo(() => getServiceHealth(stats), [stats]);
    const timeline = useMemo(() => buildMonthlyTimeline(allClients, 6), [allClients]);
    const hs = HEALTH_STYLES[health.level] || HEALTH_STYLES.empty;

    const resolutionData = SMART_PRE_RESOLUTIONS
        .map(r => ({ name: r.short, value: stats.resolutionCounts[r.id], color: r.color }))
        .filter(d => d.value > 0);

    // Clientes em tratativa há mais tempo primeiro (fila de atenção)
    const attentionList = useMemo(() => clients
        .filter(c => c.status === 'in_progress')
        .sort((a, b) => String(a.firstContactAt || a.installedAt).localeCompare(String(b.firstContactAt || b.installedAt)))
        .slice(0, 6), [clients]);

    if (stats.total === 0) {
        return (
            <EmptyState
                icon={Activity}
                title="Nenhum cliente no período"
                description="Cadastre os clientes que entram na base com o Smart Pre para acompanhar contatos, problemas e o tempo até o primeiro contato."
            />
        );
    }

    return (
        <div className="space-y-4 sm:space-y-5">
            {/* Saúde do serviço */}
            <div className={cn('rounded-2xl border p-4 sm:p-5 flex items-start gap-4', hs.box)}>
                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', hs.icon)}>
                    <hs.Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-hub">Saúde do serviço</p>
                    <h2 className={cn('font-brand text-xl font-bold tracking-tight', hs.title)}>{health.label}</h2>
                    <p className="text-xs text-secondary-hub mt-1 leading-relaxed">{health.hint}</p>
                </div>
            </div>

            {/* Indicadores principais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
                <StatCard
                    title="Clientes na base"
                    value={stats.total}
                    icon={Users}
                    subtitle={`${stats.noContact} sem contato após instalar`}
                />
                <StatCard
                    title="Entraram em contato"
                    value={stats.contacted}
                    unit={`(${stats.contactRate}%)`}
                    icon={PhoneIncoming}
                    status={stats.contactRate <= 25 ? 'success' : stats.contactRate <= 45 ? 'warning' : 'danger'}
                    subtitle="após a instalação"
                />
                <StatCard
                    title="Tempo médio até o contato"
                    value={stats.avgDaysToContact ?? '—'}
                    unit={stats.avgDaysToContact !== null ? (stats.avgDaysToContact === 1 ? 'dia' : 'dias') : ''}
                    icon={Timer}
                    subtitle={stats.medianDaysToContact !== null ? `Mediana: ${stats.medianDaysToContact} dias` : 'Sem contatos registrados'}
                />
                <StatCard
                    title="Resolvidos"
                    value={stats.resolvedCount}
                    unit={`(${stats.resolvedRate}% dos contatos)`}
                    icon={CheckCircle2}
                    status={stats.openCount > 0 ? 'warning' : 'success'}
                    subtitle={`${stats.openCount} em tratativa agora`}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                <ChartCard title="Tempo até o primeiro contato" subtitle="Quantos dias após a instalação o cliente acionou o suporte">
                    {stats.contacted === 0 ? <NoData text="Nenhum cliente entrou em contato ainda." /> : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={stats.buckets} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#71717a30" vertical={false} />
                                <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                                <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: '#71717a15' }} contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, 'Clientes']} />
                                <Bar dataKey="count" fill="#f43f5e" radius={[8, 8, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>

                <ChartCard title="O que os clientes estão solicitando" subtitle="Problemas relatados (um cliente pode ter mais de um)">
                    {stats.issues.length === 0 ? <NoData text="Nenhuma solicitação registrada." /> : (
                        <ResponsiveContainer width="100%" height={Math.max(220, stats.issues.length * 34)}>
                            <BarChart data={stats.issues} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#71717a30" horizontal={false} />
                                <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="label" width={150} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: '#71717a15' }} contentStyle={TOOLTIP_STYLE} formatter={(v) => [v, 'Clientes']} />
                                <Bar dataKey="count" fill="#3b82f6" radius={[0, 8, 8, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </ChartCard>

                <ChartCard title="Como os problemas foram tratados" subtitle="Solução remota, visita técnica ou acionamento do TI">
                    {resolutionData.length === 0 ? <NoData text="Nenhuma forma de tratativa registrada." /> : (
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="w-full sm:w-1/2">
                                <ResponsiveContainer width="100%" height={210}>
                                    <PieChart>
                                        <Pie data={resolutionData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={82} paddingAngle={3} stroke="none">
                                            {resolutionData.map(d => <Cell key={d.name} fill={d.color} />)}
                                        </Pie>
                                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [v, n]} />
                                        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="w-full sm:w-1/2 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-2 text-secondary-hub"><Wrench className="w-3.5 h-3.5" /> Resolvidos remotamente</span>
                                    <strong className="text-primary-hub tabular-nums">{stats.remoteRate}%</strong>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-2 text-secondary-hub"><TrendingUp className="w-3.5 h-3.5" /> Encaminhados (visita ou TI)</span>
                                    <strong className="text-primary-hub tabular-nums">{stats.escalationRate}%</strong>
                                </div>
                                {stats.resolutionCounts.undefined > 0 && (
                                    <p className="text-[11px] text-muted-hub pt-1">{stats.resolutionCounts.undefined} contato(s) ainda sem forma de tratativa definida.</p>
                                )}
                            </div>
                        </div>
                    )}
                </ChartCard>

                <ChartCard title="Entradas x contatos por mês" subtitle="Clientes instalados em cada mês e quantos já entraram em contato (todos os períodos)">
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={timeline} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#71717a30" vertical={false} />
                            <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                            <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                            <Tooltip cursor={{ fill: '#71717a15' }} contentStyle={TOOLTIP_STYLE} />
                            <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="entered" name="Instalados" fill="#10b981" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="contacted" name="Entraram em contato" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>

            {/* Fila de atenção */}
            <Card className="p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                        <h3 className="font-brand text-sm font-bold text-primary-hub tracking-tight">Em tratativa agora</h3>
                        <p className="text-[11px] text-muted-hub mt-0.5">Clientes com problema em aberto, do contato mais antigo para o mais recente</p>
                    </div>
                    <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-subtle text-secondary-hub border border-subtle">{stats.openCount}</span>
                </div>
                {attentionList.length === 0 ? (
                    <p className="text-xs text-muted-hub py-4 text-center">Nenhum cliente com problema em aberto.</p>
                ) : (
                    <ul className="divide-y divide-zinc-500/15">
                        {attentionList.map(c => (
                            <li key={c.id}>
                                <button
                                    type="button"
                                    onClick={() => onOpenClient(c.id)}
                                    className="w-full flex items-center justify-between gap-3 py-2.5 px-1 text-left hover:bg-subtle/60 rounded-lg transition-colors cursor-pointer"
                                >
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-primary-hub truncate">{c.clientName}</p>
                                        <p className="text-[11px] text-muted-hub truncate">
                                            {normalizeIssues(c).map(getIssueLabel).join(' • ') || 'Sem problema informado'}
                                            {getDaysToFirstContact(c) !== null && ` • contato após ${getDaysToFirstContact(c)} dia(s)`}
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-muted-hub shrink-0" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </div>
    );
}

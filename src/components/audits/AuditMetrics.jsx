import React from 'react';
import { BarChart2, CheckCircle2, XCircle, ShieldCheck, Users, Target } from 'lucide-react';

const pct = (part, total) => (total > 0 ? Math.round((part / total) * 100) : 0);

const TONES = {
    gray: { chip: 'bg-subtle text-secondary-hub', bar: 'bg-gray-400', hover: 'hover:border-gray-300' },
    emerald: { chip: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500', hover: 'hover:border-emerald-300' },
    red: { chip: 'bg-red-50 text-red-600', bar: 'bg-red-500', hover: 'hover:border-red-300' },
    blue: { chip: 'bg-blue-50 text-blue-600', bar: 'bg-blue-500', hover: 'hover:border-blue-300' }
};

// Card base: chip de ícone, valor grande e barra de progresso opcional
function StatCard({ icon: Icon, tone, label, badge, value, suffix, progress, footer }) {
    const tones = TONES[tone];

    return (
        <div className={`bg-surface p-5 rounded-3xl border border-subtle shadow-xs hover:shadow-md ${tones.hover} transition-all flex flex-col gap-4`}>
            <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${tones.chip}`}>
                    <Icon className="w-5 h-5" />
                </div>
                {badge && (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-subtle text-secondary-hub">
                        {badge}
                    </span>
                )}
            </div>
            <div>
                <p className="text-[11px] font-bold text-muted-hub uppercase tracking-widest">{label}</p>
                <p className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-primary-hub tracking-tight">{value}</span>
                    <span className="text-xs text-secondary-hub font-medium">{suffix}</span>
                </p>
            </div>
            {progress !== undefined ? (
                <div className="w-full h-1.5 bg-subtle rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${tones.bar}`} style={{ width: `${progress}%` }} />
                </div>
            ) : (
                <p className="text-[11px] text-muted-hub">{footer}</p>
            )}
        </div>
    );
}

export default function AuditMetrics({ stats, targetRate = 80 }) {
    const isAboveTarget = parseFloat(stats.taxa || 0) >= targetRate;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 shrink-0">
            <StatCard
                icon={BarChart2} tone="gray" label="Total auditado" badge="Geral"
                value={stats.total} suffix="auditorias" footer="Registros no período filtrado"
            />
            <StatCard
                icon={CheckCircle2} tone="emerald" label="Conformes" badge={`${pct(stats.conformes, stats.total)}%`}
                value={stats.conformes} suffix="atendimentos" progress={pct(stats.conformes, stats.total)}
            />
            <StatCard
                icon={XCircle} tone="red" label="Não conformes" badge={`${pct(stats.naoConformes, stats.total)}%`}
                value={stats.naoConformes} suffix="desvios" progress={pct(stats.naoConformes, stats.total)}
            />

            {/* Destaque: Taxa Global de QA */}
            <div className="bg-zinc-950 text-white p-5 rounded-3xl border border-zinc-800 shadow-md flex flex-col gap-4 relative overflow-hidden">
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-red-600/20 blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between relative">
                    <div className="w-10 h-10 rounded-2xl bg-white/10 text-red-400 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5" />
                    </div>
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                        isAboveTarget ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' : 'bg-red-950/80 text-red-400 border-red-800'
                    }`}>
                        Meta {targetRate}%
                    </span>
                </div>
                <div className="relative">
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">Taxa global QA</p>
                    <p className="mt-1 flex items-baseline gap-1.5">
                        <span className={`text-4xl font-black tracking-tight ${isAboveTarget ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {stats.taxa}%
                        </span>
                        <span className="text-xs text-zinc-400 font-medium">conformidade</span>
                    </p>
                </div>
                <p className="text-[11px] flex items-center gap-1 relative">
                    <Target className="w-3.5 h-3.5 text-zinc-400" />
                    <span className={`font-medium ${isAboveTarget ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {isAboveTarget ? 'Dentro da meta de qualidade' : 'Abaixo da meta recomendada'}
                    </span>
                </p>
            </div>

            <StatCard
                icon={Users} tone="blue" label="Colaboradores" badge="Avaliados"
                value={stats.evaluatedColabsCount || 0} suffix={`de ${stats.totalColabsCount || 0} ativos`}
                progress={pct(stats.evaluatedColabsCount || 0, stats.totalColabsCount || 0)}
            />
        </div>
    );
}

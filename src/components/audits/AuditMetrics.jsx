import React from 'react';
import { 
    BarChart2, CheckCircle2, XCircle, ShieldCheck, 
    Users, Target, Award
} from 'lucide-react';

export default function AuditMetrics({ stats, targetRate = 80 }) {
    const isAboveTarget = parseFloat(stats.taxa || 0) >= targetRate;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 shrink-0">
            {/* 1. Total Auditado */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-all">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <BarChart2 className="w-4 h-4 text-gray-400" />
                        Total Auditado
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">
                        Geral
                    </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-gray-900 tracking-tight">
                        {stats.total}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">auditorias</span>
                </div>
                <div className="text-[11px] text-gray-400 mt-2">
                    Registros salvos no sistema
                </div>
            </div>

            {/* 2. Conformes */}
            <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs flex flex-col justify-between hover:border-emerald-200 transition-all">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Conformes
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-100">
                        {stats.total > 0 ? Math.round((stats.conformes / stats.total) * 100) : 0}%
                    </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-emerald-600 tracking-tight">
                        {stats.conformes}
                    </span>
                    <span className="text-xs text-emerald-600/70 font-medium">atendimentos</span>
                </div>
                <div className="w-full h-1.5 bg-emerald-100 rounded-full mt-2 overflow-hidden">
                    <div 
                        className="h-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${stats.total > 0 ? (stats.conformes / stats.total) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* 3. Não Conformes */}
            <div className="bg-white p-5 rounded-2xl border border-red-100 shadow-xs flex flex-col justify-between hover:border-red-200 transition-all">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                        <XCircle className="w-4 h-4 text-red-500" />
                        Não Conformes
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-bold border border-red-100">
                        {stats.total > 0 ? Math.round((stats.naoConformes / stats.total) * 100) : 0}%
                    </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-red-600 tracking-tight">
                        {stats.naoConformes}
                    </span>
                    <span className="text-xs text-red-600/70 font-medium">falhas / desvios</span>
                </div>
                <div className="w-full h-1.5 bg-red-100 rounded-full mt-2 overflow-hidden">
                    <div 
                        className="h-full bg-red-500 transition-all duration-500"
                        style={{ width: `${stats.total > 0 ? (stats.naoConformes / stats.total) * 100 : 0}%` }}
                    />
                </div>
            </div>

            {/* 4. Taxa Global de QA */}
            <div className="bg-zinc-950 text-white p-5 rounded-2xl border border-zinc-800 shadow-sm flex flex-col justify-between hover:border-zinc-700 transition-all relative overflow-hidden">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-red-500" />
                        Taxa Global QA
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                        isAboveTarget 
                            ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' 
                            : 'bg-red-950/80 text-red-400 border-red-800'
                    }`}>
                        Meta: {targetRate}%
                    </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                    <span className={`text-3xl font-black tracking-tight ${
                        isAboveTarget ? 'text-emerald-400' : 'text-amber-400'
                    }`}>
                        {stats.taxa}%
                    </span>
                    <span className="text-xs text-zinc-400 font-medium">conformidade</span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-2 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-zinc-400" />
                    {isAboveTarget ? (
                        <span className="text-emerald-400 font-medium">Dentro da meta de qualidade</span>
                    ) : (
                        <span className="text-amber-400 font-medium">Abaixo da meta recomendada</span>
                    )}
                </div>
            </div>

            {/* 5. Colaboradores Avaliados */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex flex-col justify-between hover:border-gray-300 transition-all">
                <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-red-600" />
                        Colaboradores
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-bold">
                        Avaliados
                    </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-3xl font-black text-gray-900 tracking-tight">
                        {stats.evaluatedColabsCount || 0}
                    </span>
                    <span className="text-xs text-gray-500 font-medium">de {stats.totalColabsCount || 0} ativos</span>
                </div>
                <div className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5 text-amber-500" />
                    <span>Alcance de avaliação da equipe</span>
                </div>
            </div>
        </div>
    );
}

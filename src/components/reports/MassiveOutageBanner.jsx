import React, { useMemo } from 'react';
import { AlertOctagon, Radio, Filter, ExternalLink, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function MassiveOutageBanner({ reports = [], onFilterByRegion, activeRegionFilter }) {
    // Detecta agrupamentos de chamados por região ou bairro nas últimas 24 horas
    const detectedOutages = useMemo(() => {
        const activeTickets = reports.filter(r => 
            ['Pendente', 'Em Andamento'].includes(r.status) &&
            (r.region || r.neighborhood || r.affectedClient === 'Sim' || r.type?.includes('Massiva'))
        );

        // Agrupador por localização extraída
        const counts = {};
        activeTickets.forEach(t => {
            // Tenta pegar campo explícito ou detectar menção no título/descrição
            const region = t.region || t.neighborhood || (t.title?.match(/\[(.*?)\]/)?.[1]) || 'Circuito Geral';
            if (!counts[region]) {
                counts[region] = {
                    region,
                    count: 0,
                    tickets: [],
                    hasCritical: false
                };
            }
            counts[region].count += 1;
            counts[region].tickets.push(t);
            if (t.priority === 'Crítica' || t.type?.includes('Massiva')) {
                counts[region].hasCritical = true;
            }
        });

        // Considera incidente se houver 3 ou mais chamados ou 1 marcado explicitamente como falha massiva
        return Object.values(counts)
            .filter(item => item.count >= 3 || item.hasCritical)
            .sort((a, b) => b.count - a.count);
    }, [reports]);

    if (!detectedOutages || detectedOutages.length === 0) {
        return null;
    }

    const primaryOutage = detectedOutages[0];
    const isFilteringThis = activeRegionFilter === primaryOutage.region;

    return (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-900 p-4 text-slate-100 shadow-lg shadow-rose-950/20 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                        <Radio className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] uppercase tracking-wider font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                Alerta de Falha Massiva / Rompimento
                            </span>
                            <span className="text-xs text-slate-400">
                                {primaryOutage.count} chamados ativos concentrados
                            </span>
                        </div>
                        <h4 className="text-sm font-semibold text-white mt-1">
                            Concentração atípica de quedas em: <span className="text-rose-300 font-bold">{primaryOutage.region}</span>
                        </h4>
                        <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                            Aviso para o time de atendimento: Evite abrir novos chamados individuais para este mesmo circuito/bairro. Oriente clientes sobre equipe de campo em atuação.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                        type="button"
                        onClick={() => onFilterByRegion?.(isFilteringThis ? '' : primaryOutage.region)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                            isFilteringThis
                                ? 'bg-rose-600 text-white border-rose-500 shadow-sm'
                                : 'bg-slate-800/80 hover:bg-slate-800 text-rose-300 border-rose-500/30 hover:border-rose-500/60'
                        }`}
                    >
                        <Filter className="w-3.5 h-3.5" />
                        {isFilteringThis ? 'Limpar Filtro da Região' : `Isolar ${primaryOutage.count} Chamados`}
                    </button>
                </div>
            </div>
        </div>
    );
}

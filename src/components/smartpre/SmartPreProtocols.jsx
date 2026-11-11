import React, { useState, useMemo } from 'react';
import { Search, FileText, User, Calendar, CheckCircle2, Clock } from 'lucide-react';
import { Button, Badge, EmptyState } from '../ui';
import { cn } from '../../utils/cn';
import {
    SMART_PRE_ISSUES, SMART_PRE_RESOLUTIONS, flattenProtocols, matchesProtocolSearch,
    getProtocolStatusMeta, getResolutionMeta, getProtocolIssueLabel, getProtocolDuration, toDateKey
} from '../../utils/smartPre';

const PAGE_SIZE = 50;
const selectCls = 'h-9 px-3 rounded-xl bg-surface border border-subtle text-xs font-medium text-primary-hub focus:outline-none focus:ring-2 focus:ring-rose-500/30 cursor-pointer';

const formatDate = (value) => {
    const key = toDateKey(value);
    if (!key) return '—';
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y}`;
};

const STATUS_PILLS = [
    { id: 'all', label: 'Todos' },
    { id: 'open', label: 'Em aberto' },
    { id: 'closed', label: 'Finalizados' }
];

/**
 * Consolidado de todos os atendimentos (protocolos) registrados, de todos os clientes.
 * @param clients todos os clientes (sem filtro de período)
 * @param onOpenClient abre o detalhe do cliente dono do protocolo
 */
export default function SmartPreProtocols({ clients, onOpenClient }) {
    const [status, setStatus] = useState('all');
    const [search, setSearch] = useState('');
    const [issue, setIssue] = useState('all');
    const [resolution, setResolution] = useState('all');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const all = useMemo(() => flattenProtocols(clients), [clients]);
    const counts = useMemo(() => ({
        all: all.length,
        open: all.filter(p => p.status !== 'closed').length,
        closed: all.filter(p => p.status === 'closed').length
    }), [all]);

    const filtered = useMemo(() => all
        .filter(p => status === 'all' || (status === 'open' ? p.status !== 'closed' : p.status === 'closed'))
        .filter(p => issue === 'all' || p.classification === issue)
        .filter(p => resolution === 'all' || getResolutionMeta(p.resolutionType)?.id === resolution)
        .filter(p => matchesProtocolSearch(p, search)),
    [all, status, issue, resolution, search]);

    const reset = (fn) => (e) => { fn(e.target.value); setVisibleCount(PAGE_SIZE); };
    const hasFilters = status !== 'all' || search || issue !== 'all' || resolution !== 'all';
    const clear = () => { setStatus('all'); setSearch(''); setIssue('all'); setResolution('all'); setVisibleCount(PAGE_SIZE); };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                {[
                    { id: 'all', label: 'Total de atendimentos', value: counts.all, icon: FileText, tone: 'text-primary-hub' },
                    { id: 'open', label: 'Em aberto', value: counts.open, icon: Clock, tone: 'text-amber-600 dark:text-amber-400' },
                    { id: 'closed', label: 'Finalizados', value: counts.closed, icon: CheckCircle2, tone: 'text-emerald-600 dark:text-emerald-400' }
                ].map(card => (
                    <button
                        key={card.id}
                        type="button"
                        onClick={() => { setStatus(card.id); setVisibleCount(PAGE_SIZE); }}
                        className={cn(
                            'text-left rounded-2xl border bg-surface p-3 sm:p-4 transition-colors cursor-pointer',
                            status === card.id ? 'border-rose-500/40' : 'border-subtle hover:border-strong'
                        )}
                    >
                        <p className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wide text-muted-hub">
                            <card.icon className="w-3.5 h-3.5" />{card.label}
                        </p>
                        <p className={cn('mt-1 text-2xl font-bold font-brand', card.tone)}>{card.value}</p>
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1.5" role="group" aria-label="Situação do atendimento">
                    {STATUS_PILLS.map(s => (
                        <button
                            key={s.id}
                            type="button"
                            aria-pressed={status === s.id}
                            onClick={() => { setStatus(s.id); setVisibleCount(PAGE_SIZE); }}
                            className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer',
                                status === s.id ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/40' : 'bg-surface text-secondary-hub border-subtle hover:border-strong'
                            )}
                        >
                            {s.label} <span className="font-mono opacity-70">{counts[s.id]}</span>
                        </button>
                    ))}
                </div>
                <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-hub" />
                    <input
                        value={search}
                        onChange={reset(setSearch)}
                        placeholder="Buscar por protocolo, cliente ou descrição"
                        className="w-full h-9 pl-8 pr-3 rounded-xl bg-surface border border-subtle text-xs text-primary-hub placeholder:text-muted-hub focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                    />
                </div>
                <select aria-label="Classificação" className={selectCls} value={issue} onChange={reset(setIssue)}>
                    <option value="all">Todas as classificações</option>
                    {SMART_PRE_ISSUES.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
                </select>
                <select aria-label="Encerramento" className={selectCls} value={resolution} onChange={reset(setResolution)}>
                    <option value="all">Todos os encerramentos</option>
                    {SMART_PRE_RESOLUTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
                {hasFilters && <Button variant="ghost" size="sm" onClick={clear}>Limpar filtros</Button>}
            </div>

            {filtered.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title={all.length === 0 ? 'Nenhum atendimento registrado' : 'Nenhum atendimento encontrado'}
                    description={all.length === 0
                        ? 'Os protocolos registrados nos clientes aparecem aqui, em um consolidado único.'
                        : 'Ajuste os filtros para ver outros atendimentos.'}
                />
            ) : (
                <>
                    <p className="text-[11px] text-muted-hub">
                        {filtered.length} {filtered.length === 1 ? 'atendimento' : 'atendimentos'} • considera todos os clientes, sem o filtro de período
                    </p>
                    <ul className="space-y-2">
                        {filtered.slice(0, visibleCount).map(p => {
                            const statusMeta = getProtocolStatusMeta(p.status);
                            const resolutionMeta = getResolutionMeta(p.resolutionType);
                            const duration = getProtocolDuration(p);
                            return (
                                <li key={`${p.clientId}_${p.id}`}>
                                    <button
                                        type="button"
                                        onClick={() => onOpenClient(p.clientId)}
                                        className="w-full text-left rounded-2xl border border-subtle bg-surface hover:border-strong hover:shadow-xs p-3.5 transition-all cursor-pointer"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-primary-hub truncate">
                                                    {p.protocol ? `#${p.protocol}` : 'Sem nº'} <span className="font-normal text-secondary-hub">• {getProtocolIssueLabel(p)}</span>
                                                </p>
                                                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-hub truncate">
                                                    <User className="w-3 h-3 shrink-0" />
                                                    <span className="truncate">{p.clientName}{p.clientErpCode ? ` • ${p.clientErpCode}` : ''}</span>
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
                                                <Badge variant={statusMeta.variant} size="sm" dot>{statusMeta.label}</Badge>
                                                {resolutionMeta && <Badge variant="purple" size="sm">{resolutionMeta.short}</Badge>}
                                            </div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-secondary-hub">
                                            <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3 text-muted-hub" />Aberto em {formatDate(p.openedAt)}</span>
                                            {p.status === 'closed' && (
                                                <span className="flex items-center gap-1.5">
                                                    <CheckCircle2 className="w-3 h-3 text-muted-hub" />
                                                    Finalizado em {formatDate(p.closedAt)}
                                                    {duration !== null && ` (${duration === 0 ? 'no mesmo dia' : `${duration} dia${duration > 1 ? 's' : ''}`})`}
                                                </span>
                                            )}
                                            {p.channel && <span>{p.channel}</span>}
                                        </div>
                                        {p.description && <p className="mt-1.5 text-[11px] text-muted-hub line-clamp-2">{p.description}</p>}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                    {filtered.length > visibleCount && (
                        <div className="flex justify-center">
                            <Button variant="secondary" size="sm" onClick={() => setVisibleCount(n => n + PAGE_SIZE)}>
                                Mostrar mais ({filtered.length - visibleCount} restantes)
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

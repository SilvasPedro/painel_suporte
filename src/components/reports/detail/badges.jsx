import React from 'react';
import { CheckCircle, Clock, Hourglass, X } from 'lucide-react';
import { normalizeStatus, getStatusLabel } from '../../../utils/reportTimeline';

const STATUS_STYLE = {
    'Resolvido': { cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', Icon: CheckCircle },
    'Em Andamento': { cls: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30', Icon: Clock },
    'Suspenso': { cls: 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/35', Icon: Hourglass },
    'Cancelado': { cls: 'bg-subtle text-muted-hub border-subtle', Icon: X },
    'Pendente': { cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30', Icon: Clock }
};

export function StatusPill({ status, className = '' }) {
    const key = normalizeStatus(status);
    const { cls, Icon } = STATUS_STYLE[key];
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 whitespace-nowrap ${cls} ${className}`}>
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            {getStatusLabel(key)}
        </span>
    );
}

const PRIORITY_STYLE = {
    'Crítica': 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
    'Alta': 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    'Baixa': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    'Normal': 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
};

export function PriorityPill({ priority }) {
    const key = PRIORITY_STYLE[priority] ? priority : 'Normal';
    return (
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 ${PRIORITY_STYLE[key]}`}>
            <span className={`w-1.5 h-1.5 rounded-full bg-current ${key === 'Crítica' ? 'animate-pulse' : ''}`} aria-hidden="true" />
            {key}
        </span>
    );
}

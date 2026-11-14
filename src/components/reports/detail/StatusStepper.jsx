import React from 'react';
import { Check, Hourglass, X } from 'lucide-react';
import { normalizeStatus, formatShortDateTime } from '../../../utils/reportTimeline';

/** Passo a passo: Registrado → Em andamento (ou Em pausa) → Concluído (ou Cancelado), com data de cada etapa. */
export default function StatusStepper({ status, stages }) {
    const s = normalizeStatus(status);
    const reachedProgress = s !== 'Pendente';
    const done = s === 'Resolvido';
    const canceled = s === 'Cancelado';

    const steps = [
        { key: 'reg', label: 'Registrado', date: stages.registered, state: 'done', icon: <Check className="w-3.5 h-3.5" /> },
        s === 'Suspenso'
            ? { key: 'prog', label: 'Em pausa', date: stages.paused, state: 'paused', icon: <Hourglass className="w-3.5 h-3.5" /> }
            : { key: 'prog', label: 'Em andamento', date: stages.progress, state: s === 'Em Andamento' ? 'current' : (reachedProgress ? 'done' : 'todo'), icon: reachedProgress && s !== 'Em Andamento' ? <Check className="w-3.5 h-3.5" /> : <span>2</span> },
        canceled
            ? { key: 'end', label: 'Cancelado', date: stages.closed, state: 'canceled', icon: <X className="w-3.5 h-3.5" /> }
            : { key: 'end', label: 'Concluído', date: stages.closed, state: done ? 'done' : 'todo', icon: done ? <Check className="w-3.5 h-3.5" /> : <span>3</span> }
    ];

    const dot = {
        done: 'bg-emerald-600 text-white border-emerald-600',
        current: 'bg-sky-600 text-white border-sky-600',
        paused: 'bg-purple-600 text-white border-purple-600',
        canceled: 'bg-subtle text-muted-hub border-strong',
        todo: 'bg-surface text-muted-hub border-subtle'
    };
    const text = {
        done: 'text-emerald-600 dark:text-emerald-400',
        current: 'text-sky-600 dark:text-sky-400',
        paused: 'text-purple-600 dark:text-purple-300',
        canceled: 'text-muted-hub',
        todo: 'text-muted-hub'
    };
    const line = (i) => {
        const next = steps[i + 1].state;
        if (next === 'todo') return 'bg-subtle';
        if (next === 'paused') return 'bg-purple-500';
        if (next === 'current') return 'bg-sky-500';
        if (next === 'canceled') return 'bg-strong';
        return 'bg-emerald-600';
    };

    return (
        <ol className="flex items-start" aria-label="Andamento do chamado">
            {steps.map((step, i) => (
                <React.Fragment key={step.key}>
                    <li className="flex flex-col items-center gap-1 min-w-[84px]" aria-current={step.state === 'current' || step.state === 'paused' ? 'step' : undefined}>
                        <span className={`w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold ${dot[step.state]}`}>{step.icon}</span>
                        <span className={`text-xs font-bold text-center ${text[step.state]}`}>{step.label}</span>
                        <span className="text-xs text-muted-hub h-4">{step.date ? formatShortDateTime(step.date) : ''}</span>
                    </li>
                    {i < steps.length - 1 && <div className={`flex-1 h-0.5 mt-3.5 mx-1 rounded ${line(i)}`} aria-hidden="true" />}
                </React.Fragment>
            ))}
        </ol>
    );
}

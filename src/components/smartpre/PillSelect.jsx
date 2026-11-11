import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Lista suspensa no estilo da plataforma: gatilho arredondado e opções em mini pílulas.
 * @param options [{ id, label }]
 * @param value id selecionado ('' = nada)
 * @param onChange recebe o id escolhido
 */
export default function PillSelect({ id, value, onChange, options, placeholder = 'Selecione', ariaLabel }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const listId = useId();
    const selected = options.find(o => o.id === value);

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey, true);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey, true);
        };
    }, [open]);

    return (
        <div ref={rootRef} className="relative">
            <button
                id={id}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                aria-label={ariaLabel}
                onClick={() => setOpen(o => !o)}
                className={cn(
                    'w-full flex items-center justify-between gap-2 px-3.5 py-2 rounded-2xl bg-surface border text-sm text-left transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-500/30',
                    open ? 'border-rose-500/50' : 'border-subtle hover:border-strong'
                )}
            >
                <span className={cn('truncate', selected ? 'text-primary-hub font-medium' : 'text-muted-hub')}>{selected ? selected.label : placeholder}</span>
                <ChevronDown className={cn('w-4 h-4 shrink-0 text-muted-hub transition-transform', open && 'rotate-180')} />
            </button>

            {open && (
                <div
                    id={listId}
                    role="listbox"
                    aria-label={ariaLabel}
                    className="absolute z-30 left-0 right-0 mt-1.5 rounded-3xl border border-subtle bg-surface shadow-xl p-2.5 flex flex-wrap gap-1.5"
                >
                    {options.map(o => {
                        const active = o.id === value;
                        return (
                            <button
                                key={o.id}
                                type="button"
                                role="option"
                                aria-selected={active}
                                onClick={() => { onChange(o.id); setOpen(false); }}
                                className={cn(
                                    'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer',
                                    active
                                        ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/40'
                                        : 'bg-subtle/60 text-secondary-hub border-subtle hover:border-rose-500/30 hover:text-primary-hub'
                                )}
                            >
                                {active && <Check className="w-3 h-3" />}
                                {o.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

import React from 'react';
import { Inbox } from 'lucide-react';
import { cn } from '../../utils/cn';
import Button from './Button';

export const EmptyState = ({
  icon: Icon = Inbox,
  title = 'Nenhum registro encontrado',
  description = 'Não há dados disponíveis para exibir no momento com os filtros selecionados.',
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'w-full py-12 px-6 flex flex-col items-center justify-center text-center rounded-2xl border border-dashed border-subtle bg-subtle/30',
        className
      )}
    >
      <div className="w-12 h-12 rounded-2xl bg-surface border border-subtle flex items-center justify-center text-muted-hub shadow-xs mb-3.5">
        <Icon className="w-6 h-6 stroke-[1.6]" />
      </div>

      <h3 className="font-brand text-sm font-semibold text-primary-hub tracking-tight">
        {title}
      </h3>

      {description && (
        <p className="text-xs text-secondary-hub max-w-sm mt-1 leading-relaxed">
          {description}
        </p>
      )}

      {actionLabel && onAction && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onAction}
          className="mt-4"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;

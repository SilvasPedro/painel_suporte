import React from 'react';
import { cn } from '../../utils/cn';

const badgeVariants = {
  default: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
  warning: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25',
  danger: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30',
  info: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/25',
  purple: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/25',
  neutral: 'bg-subtle text-secondary-hub border-subtle',
  outline: 'bg-transparent text-secondary-hub border-subtle',
};

const badgeSizes = {
  sm: 'text-[10px] px-2 py-0.5 font-medium gap-1',
  md: 'text-xs px-2.5 py-0.5 font-semibold gap-1.5',
  lg: 'text-xs px-3 py-1 font-semibold gap-2',
};

export const Badge = ({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  dotColor,
  icon: Icon,
  className,
  ...props
}) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border transition-colors select-none whitespace-nowrap',
        badgeVariants[variant] || badgeVariants.default,
        badgeSizes[size] || badgeSizes.md,
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full shrink-0',
            dotColor || 'bg-current'
          )}
        />
      )}
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      <span>{children}</span>
    </span>
  );
};

export default Badge;

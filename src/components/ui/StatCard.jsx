import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '../../utils/cn';
import Card from './Card';
import Badge from './Badge';

export const StatCard = ({
  title,
  value,
  goal,
  unit = '',
  icon: Icon,
  trend, // 'up' | 'down' | 'neutral'
  trendLabel,
  isGood, // boolean para definir se o status é positivo
  status = 'neutral', // 'success' | 'warning' | 'danger' | 'neutral'
  subtitle,
  className,
  onClick,
}) => {
  const statusStyles = {
    success: 'border-emerald-500/30 hover:border-emerald-500/50',
    warning: 'border-amber-500/30 hover:border-amber-500/50',
    danger: 'border-rose-500/30 hover:border-rose-500/50',
    neutral: 'border-subtle hover:border-strong',
  };

  const iconBgStyles = {
    success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    neutral: 'bg-subtle text-secondary-hub border-subtle',
  };

  return (
    <Card
      onClick={onClick}
      hover={Boolean(onClick)}
      className={cn(
        'relative overflow-hidden p-5 flex flex-col justify-between transition-all duration-200',
        statusStyles[status] || statusStyles.neutral,
        className
      )}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-secondary-hub tracking-wide uppercase">
          {title}
        </span>
        {Icon && (
          <div className={cn(
            'w-9 h-9 rounded-xl flex items-center justify-center border shrink-0',
            iconBgStyles[status] || iconBgStyles.neutral
          )}>
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      {/* Main Metric Value */}
      <div className="my-3">
        <div className="flex items-baseline gap-1.5">
          <span className="font-brand text-2xl lg:text-3xl font-bold text-primary-hub tracking-tight tabular-nums">
            {value}
          </span>
          {unit && (
            <span className="text-xs font-medium text-secondary-hub">
              {unit}
            </span>
          )}
        </div>

        {goal !== undefined && (
          <p className="text-[11px] text-muted-hub mt-1">
            Meta: <span className="font-medium text-secondary-hub">{goal}</span>
          </p>
        )}
      </div>

      {/* Footer / Trend Indicator */}
      {(trend || subtitle || trendLabel) && (
        <div className="pt-2 border-t border-subtle flex items-center justify-between text-xs">
          {trendLabel && (
            <Badge
              size="sm"
              variant={isGood ? 'success' : isGood === false ? 'danger' : 'neutral'}
              icon={trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus}
            >
              {trendLabel}
            </Badge>
          )}

          {subtitle && (
            <span className="text-[11px] text-muted-hub truncate ml-auto">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </Card>
  );
};

export default StatCard;

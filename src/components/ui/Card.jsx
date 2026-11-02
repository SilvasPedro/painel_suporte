import React from 'react';
import { cn } from '../../utils/cn';

export const Card = ({
  children,
  className,
  hover = false,
  glass = false,
  bordered = true,
  onClick,
  ...props
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-2xl transition-all duration-200',
        glass ? 'glass-panel' : 'bg-surface',
        bordered ? 'border border-subtle shadow-xs' : '',
        hover && 'hover:border-strong hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className, ...props }) => (
  <div className={cn('p-5 pb-3 flex flex-col space-y-1.5', className)} {...props}>
    {children}
  </div>
);

export const CardTitle = ({ children, className, ...props }) => (
  <h3 className={cn('font-brand text-base font-semibold text-primary-hub tracking-tight', className)} {...props}>
    {children}
  </h3>
);

export const CardDescription = ({ children, className, ...props }) => (
  <p className={cn('text-xs text-secondary-hub leading-relaxed', className)} {...props}>
    {children}
  </p>
);

export const CardContent = ({ children, className, ...props }) => (
  <div className={cn('p-5 pt-0', className)} {...props}>
    {children}
  </div>
);

export const CardFooter = ({ children, className, ...props }) => (
  <div className={cn('p-5 pt-0 flex items-center', className)} {...props}>
    {children}
  </div>
);

export default Card;

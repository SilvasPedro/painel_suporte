import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

const variants = {
  primary: 'bg-rose-600 hover:bg-rose-500 text-white shadow-sm shadow-rose-950/20 border border-rose-500/30 active:bg-rose-700',
  secondary: 'bg-surface hover:bg-surface-hover text-primary-hub border border-subtle shadow-xs active:opacity-90',
  outline: 'bg-transparent border border-subtle text-primary-hub hover:border-strong hover:bg-subtle active:opacity-80',
  ghost: 'bg-transparent text-secondary-hub hover:text-primary-hub hover:bg-subtle active:opacity-80',
  danger: 'bg-red-600/90 hover:bg-red-600 text-white border border-red-500/40 shadow-xs active:bg-red-700',
  success: 'bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30 shadow-xs active:bg-emerald-700',
  shimmer: 'relative overflow-hidden bg-rose-600 text-white shadow-md shadow-rose-600/25 border border-rose-400/40 hover:bg-rose-500 active:bg-rose-700',
};

const sizes = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-11 px-6 text-base gap-2.5 rounded-xl font-medium',
  icon: 'h-9 w-9 p-0 rounded-xl justify-center items-center',
};

export const Button = forwardRef(({
  children,
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  iconRight: IconRight,
  onClick,
  type = 'button',
  ...props
}, ref) => {
  const isShimmer = variant === 'shimmer';

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      whileHover={disabled || loading ? undefined : { scale: 1.01 }}
      whileTap={disabled || loading ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center justify-center font-medium transition-colors select-none cursor-pointer',
        'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500/40 focus-visible:ring-offset-1',
        'disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed',
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className
      )}
      {...props}
    >
      {isShimmer && !loading && (
        <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
      )}

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current shrink-0" />
      ) : Icon ? (
        <Icon className="w-4 h-4 shrink-0 text-current" />
      ) : null}

      {children && <span className="truncate">{children}</span>}

      {!loading && IconRight && (
        <IconRight className="w-4 h-4 shrink-0 text-current" />
      )}
    </motion.button>
  );
});

Button.displayName = 'Button';
export default Button;

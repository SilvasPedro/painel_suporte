import React, { forwardRef } from 'react';
import { cn } from '../../utils/cn';

export const Input = forwardRef(({
  label,
  error,
  hint,
  icon: Icon,
  iconRight,
  className,
  containerClassName,
  id,
  type = 'text',
  disabled,
  ...props
}, ref) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={cn('w-full flex flex-col space-y-1.5', containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-medium text-secondary-hub flex items-center justify-between"
        >
          <span>{label}</span>
          {hint && <span className="text-[11px] text-muted-hub font-normal">{hint}</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 pointer-events-none text-muted-hub flex items-center justify-center">
            <Icon className="w-4 h-4" />
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          className={cn(
            'w-full h-10 px-3.5 text-sm rounded-xl transition-all duration-150',
            'bg-surface border border-subtle text-primary-hub placeholder:text-muted-hub',
            'focus:outline-hidden focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15',
            'disabled:opacity-50 disabled:bg-subtle disabled:cursor-not-allowed',
            Icon && 'pl-10',
            iconRight && 'pr-10',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500/15',
            className
          )}
          {...props}
        />

        {iconRight && (
          <div className="absolute right-3.5 flex items-center justify-center">
            {iconRight}
          </div>
        )}
      </div>

      {error && (
        <span className="text-[11px] font-medium text-red-500 mt-1 animate-in fade-in-50">
          {error}
        </span>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;

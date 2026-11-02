import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';

export const Tabs = ({
  tabs,
  activeTab,
  onChange,
  className,
  tabClassName,
  pillClassName,
  id = 'hubdesk-tab',
}) => {
  return (
    <div
      className={cn(
        'inline-flex items-center p-1 rounded-xl bg-subtle border border-subtle select-none',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2 z-10',
              isActive
                ? 'text-primary-hub'
                : 'text-secondary-hub hover:text-primary-hub',
              tabClassName
            )}
          >
            {isActive && (
              <motion.div
                layoutId={`active-pill-${id}`}
                className={cn(
                  'absolute inset-0 bg-surface rounded-lg border border-subtle shadow-xs z-[-1]',
                  pillClassName
                )}
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}

            {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={cn(
                'ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                isActive ? 'bg-rose-500/10 text-rose-600' : 'bg-subtle text-secondary-hub'
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default Tabs;

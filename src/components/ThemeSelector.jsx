import React from 'react';
import { useTheme, THEMES } from '../context/ThemeContext';
import { Check, Sun, Moon, Coffee } from 'lucide-react';

export default function ThemeSelector({ variant = 'compact', showLabels = true, className = '' }) {
  const { theme, setTheme } = useTheme();

  // 1. Variante COMPACTA (Ideal para Topbars, cabeçalhos de páginas e menus rápidos)
  if (variant === 'compact') {
    return (
      <div 
        id="theme-selector-compact"
        className={`inline-flex items-center p-1 rounded-xl bg-gray-200/80 border border-gray-300/80 shadow-2xs gap-0.5 transition-colors ${className}`}
        role="group"
        aria-label="Selecionar modo de visualização"
      >
        {Object.values(THEMES).map((item) => {
          const Icon = item.icon;
          const isActive = theme === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTheme(item.id)}
              title={`${item.name}: ${item.description}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer ${
                isActive
                  ? 'bg-white text-gray-900 shadow-xs scale-100 font-bold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? (item.id === 'light' ? 'text-amber-500' : item.id === 'warm' ? 'text-amber-700' : 'text-red-500') : 'text-gray-400'}`} />
              {showLabels && <span className="whitespace-nowrap">{item.shortName}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  // 2. Variante SIDEBAR (Adaptável para menu lateral recolhido ou expandido)
  if (variant === 'sidebar') {
    const isCollapsed = !showLabels;

    if (isCollapsed) {
      return (
        <div className="flex flex-col items-center gap-1 py-1">
          {Object.values(THEMES).map((item) => {
            const Icon = item.icon;
            const isActive = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id)}
                title={`${item.name} (${item.badge})`}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  isActive
                    ? 'bg-zinc-800 text-white border border-zinc-700 shadow-2xs'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? (item.id === 'light' ? 'text-amber-400' : item.id === 'warm' ? 'text-amber-600' : 'text-red-400') : ''}`} />
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div className={`p-2 rounded-xl bg-zinc-900/90 border border-zinc-800/90 space-y-1.5 ${className}`}>
        <div className="flex items-center justify-between px-1 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          <span>Modo Visual</span>
          <span className="text-[10px] font-mono text-zinc-500">{THEMES[theme].shortName}</span>
        </div>
        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-zinc-950/80 border border-zinc-800/60">
          {Object.values(THEMES).map((item) => {
            const Icon = item.icon;
            const isActive = theme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTheme(item.id)}
                title={item.description}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-zinc-800 text-white shadow-2xs border border-zinc-700'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? (item.id === 'light' ? 'text-amber-400' : item.id === 'warm' ? 'text-amber-600' : 'text-red-400') : 'text-zinc-500'}`} />
                <span className="truncate">{item.shortName}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // 3. Variante COMPLETA (Cards com visualização e descrição detalhada na página de Configurações)
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 ${className}`}>
      {Object.values(THEMES).map((item) => {
        const Icon = item.icon;
        const isActive = theme === item.id;
        return (
          <div
            key={item.id}
            onClick={() => setTheme(item.id)}
            className={`relative rounded-2xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between overflow-hidden group ${
              isActive
                ? 'border-red-600 shadow-md ring-2 ring-red-600/20'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-xs'
            }`}
            style={{
              backgroundColor: item.swatchCard
            }}
          >
            {/* Indicador de Seleção Ativa no Topo */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center border transition-transform group-hover:scale-105"
                  style={{
                    backgroundColor: item.swatchBg,
                    borderColor: item.swatchBorder
                  }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={{ color: item.id === 'light' ? '#f59e0b' : item.id === 'warm' ? '#b45309' : '#ef4444' }}
                  />
                </div>
                <div>
                  <h4 
                    className="text-base font-bold tracking-tight"
                    style={{ color: item.swatchText }}
                  >
                    {item.name}
                  </h4>
                  <span
                    className="inline-block text-[11px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-md border mt-0.5"
                    style={{
                      backgroundColor: item.swatchBg,
                      borderColor: item.swatchBorder,
                      color: item.id === 'dark' ? '#d4d4d8' : item.id === 'warm' ? '#785f4e' : '#4b5563'
                    }}
                  >
                    {item.badge}
                  </span>
                </div>
              </div>

              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                  isActive ? 'bg-red-600 text-white shadow-xs' : 'border border-gray-300 bg-transparent'
                }`}
              >
                {isActive && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              </div>
            </div>

            {/* Simulação Visual do Tema em Miniatura */}
            <div
              className="rounded-xl p-3 border mb-4 shadow-2xs space-y-2"
              style={{
                backgroundColor: item.swatchBg,
                borderColor: item.swatchBorder
              }}
            >
              <div className="flex items-center justify-between">
                <div
                  className="h-3 w-16 rounded"
                  style={{ backgroundColor: item.swatchBorder }}
                />
                <div
                  className="h-2.5 w-8 rounded-full"
                  style={{
                    backgroundColor: item.id === 'dark' ? '#ef4444' : item.id === 'warm' ? '#b45309' : '#dc2626'
                  }}
                />
              </div>
              <div
                className="rounded-lg p-2 border flex items-center gap-2"
                style={{
                  backgroundColor: item.swatchCard,
                  borderColor: item.swatchBorder
                }}
              >
                <div
                  className="w-5 h-5 rounded-md shrink-0"
                  style={{ backgroundColor: item.swatchBorder }}
                />
                <div className="space-y-1 flex-1">
                  <div
                    className="h-2 w-3/4 rounded"
                    style={{ backgroundColor: item.swatchText, opacity: 0.7 }}
                  />
                  <div
                    className="h-1.5 w-1/2 rounded"
                    style={{ backgroundColor: item.swatchBorder }}
                  />
                </div>
              </div>
            </div>

            {/* Descrição Funcional */}
            <p
              className="text-xs leading-relaxed"
              style={{
                color: item.id === 'dark' ? '#a1a1aa' : item.id === 'warm' ? '#6b594d' : '#6b7280'
              }}
            >
              {item.description}
            </p>

            {/* Botão de Ativação / Status */}
            <div className="mt-4 pt-3 border-t flex justify-end" style={{ borderColor: item.swatchBorder }}>
              <span
                className={`text-xs font-bold transition-colors ${
                  isActive ? 'text-red-600' : 'text-gray-400 group-hover:text-gray-600'
                }`}
              >
                {isActive ? '✓ Tema Ativo' : 'Clique para Ativar'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, ArrowRight, Sparkles, Sun, Moon, Coffee, 
  Lock, LogOut, FileText, CornerDownLeft, X 
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useTheme } from '../../context/ThemeContext';

export const CommandPalette = ({
  isOpen,
  onClose,
  menus = [],
  onSelectTab,
  onOpenPasswordModal,
  onOpenChangelogModal,
  onOpenLogoutModal,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const { theme, setTheme } = useTheme();

  // Foco automático ao abrir
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Lista plana de itens navegáveis
  const allItems = useMemo(() => {
    const list = [];

    // Módulos e telas dos menus do usuário
    menus.forEach(menu => {
      menu.items.forEach(item => {
        list.push({
          id: `tab-${item.id}`,
          title: item.label,
          category: menu.title,
          icon: item.icon,
          action: () => {
            onSelectTab(item.id);
            onClose();
          }
        });
      });
    });

    // Ações rápidas do sistema
    list.push({
      id: 'action-password',
      title: 'Alterar Senha de Acesso',
      category: 'Segurança & Conta',
      icon: Lock,
      action: () => {
        onOpenPasswordModal?.();
        onClose();
      }
    });

    list.push({
      id: 'action-changelog',
      title: 'Ver Novidades & Versões (Changelog)',
      category: 'Ajuda & Sistema',
      icon: FileText,
      action: () => {
        onOpenChangelogModal?.();
        onClose();
      }
    });

    list.push({
      id: 'action-theme-dark',
      title: 'Ativar Modo Escuro',
      category: 'Aparência',
      icon: Moon,
      action: () => {
        setTheme('dark');
        onClose();
      }
    });

    list.push({
      id: 'action-theme-warm',
      title: 'Ativar Modo Morno (Conforto Ocular)',
      category: 'Aparência',
      icon: Coffee,
      action: () => {
        setTheme('warm');
        onClose();
      }
    });

    list.push({
      id: 'action-theme-light',
      title: 'Ativar Modo Claro',
      category: 'Aparência',
      icon: Sun,
      action: () => {
        setTheme('light');
        onClose();
      }
    });

    list.push({
      id: 'action-logout',
      title: 'Encerrar Sessão (Sair do Sistema)',
      category: 'Conta',
      icon: LogOut,
      action: () => {
        onOpenLogoutModal?.();
        onClose();
      }
    });

    return list;
  }, [menus, onSelectTab, onOpenPasswordModal, onOpenChangelogModal, onOpenLogoutModal, setTheme, onClose]);

  // Itens filtrados pela busca
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase().trim();
    return allItems.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.category.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  // Navegação por teclado (Cima, Baixo, Enter, Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredItems, selectedIndex, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 sm:p-6">
          {/* Backdrop Fosco */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          />

          {/* Container do Command Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-xl z-10 bg-surface border border-subtle rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Input de Busca com Ícone */}
            <div className="p-4 border-b border-subtle flex items-center gap-3">
              <Search className="w-5 h-5 text-muted-hub shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Buscar módulo, relatório ou ação rápida... (ex: Auditoria, Folias, Senha)"
                className="w-full bg-transparent text-sm text-primary-hub placeholder:text-muted-hub focus:outline-hidden"
              />
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-subtle text-muted-hub border border-subtle shrink-0">
                ESC
              </span>
            </div>

            {/* Lista de Resultados */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filteredItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-hub">
                  Nenhum comando ou módulo encontrado para "<span className="text-primary-hub font-medium">{query}</span>"
                </div>
              ) : (
                filteredItems.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  const Icon = item.icon || Sparkles;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-xs transition-colors cursor-pointer',
                        isSelected 
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium' 
                          : 'text-secondary-hub hover:bg-subtle hover:text-primary-hub'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center border shrink-0',
                          isSelected 
                            ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400' 
                            : 'bg-subtle border-subtle text-muted-hub'
                        )}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate">
                          <span className="block truncate text-primary-hub">{item.title}</span>
                          <span className="block text-[10px] text-muted-hub">{item.category}</span>
                        </div>
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-1 text-[11px] text-rose-500 shrink-0">
                          <span>Acessar</span>
                          <CornerDownLeft className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Rodapé com Dicas de Atalhos */}
            <div className="p-3 border-t border-subtle bg-subtle/40 flex items-center justify-between text-[11px] text-muted-hub">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-surface border border-subtle font-mono text-[9px]">↑</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-surface border border-subtle font-mono text-[9px]">↓</kbd>
                  Navegar
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-surface border border-subtle font-mono text-[9px]">↵</kbd>
                  Confirmar
                </span>
              </div>
              <span className="text-[10px]">Hubdesk Spotlight</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CommandPalette;

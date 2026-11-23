import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Phone, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';
import { canUseAiChat } from '../../utils/floatingHub';
import ExtensionsPanel from './ExtensionsPanel';
import ChatPanel from './ChatPanel';

/**
 * Botão flutuante único, no canto inferior direito. Ao clicar, abre duas bolinhas:
 * "Ramais" (todos os usuários) e "Chat IA" (somente a gestão). Sem acesso ao chat, o botão abre os ramais direto.
 *
 * panel: 'extensions' | 'chat' | null — qual janela está aberta.
 * Os dois painéis ficam montados para a conversa e a busca continuarem ao minimizar.
 */
// Efeito 3D: brilho no topo, sombra interna na base e sombra projetada (sem inclinar)
const BTN_3D = {
    backgroundImage: 'linear-gradient(160deg, rgba(255,255,255,0.28), rgba(255,255,255,0) 55%), linear-gradient(340deg, rgba(0,0,0,0.28), transparent 60%)',
    boxShadow: 'inset 0 2px 2px rgba(255,255,255,0.4), inset 0 -4px 6px rgba(0,0,0,0.35), 0 8px 16px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.3)',
};
const ICON_3D = { filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))' };

export default function FloatingHub() {
    const { currentUser } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [panel, setPanel] = useState(null);
    const rootRef = useRef(null);

    const aiAllowed = canUseAiChat(currentUser);
    const active = Boolean(panel) || menuOpen;

    // Esc fecha a janela aberta (ou o menu); clicar fora fecha o menu e os ramais (o chat só minimiza no botão)
    useEffect(() => {
        if (!active) return undefined;
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            if (panel) setPanel(null);
            else setMenuOpen(false);
        };
        const onDown = (e) => {
            if (rootRef.current && !rootRef.current.contains(e.target)) {
                setMenuOpen(false);
                setPanel(prev => (prev === 'extensions' ? null : prev));
            }
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onDown);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onDown);
        };
    }, [active, panel]);

    if (!currentUser || currentUser.isInactive) return null;

    const openPanel = (name) => {
        setPanel(name);
        setMenuOpen(false);
    };

    const handleMainClick = () => {
        if (panel) { setPanel(null); return; }
        if (!aiAllowed) { openPanel('extensions'); return; }
        setMenuOpen(open => !open);
    };

    const options = [
        { id: 'chat', label: 'Chat IA', icon: Sparkles, show: aiAllowed, tone: 'bg-rose-600 text-white hover:bg-rose-500' },
        { id: 'extensions', label: 'Ramais', icon: Phone, show: true, tone: 'bg-surface text-sky-600 dark:text-sky-400 border border-subtle hover:border-sky-500/40' }
    ].filter(o => o.show);

    return (
        <div ref={rootRef}>
            <ExtensionsPanel isOpen={panel === 'extensions'} onClose={() => setPanel(null)} />
            {aiAllowed && <ChatPanel isOpen={panel === 'chat'} onClose={() => setPanel(null)} />}

            {/* Bolinhas de escolha (aparecem acima do botão) */}
            <div
                className="fixed bottom-24 right-4 sm:right-6 z-50 flex flex-col items-end gap-3"
                role="menu"
                aria-label="Atalhos flutuantes"
                aria-hidden={!menuOpen}
            >
                {options.map((option, index) => {
                    const Icon = option.icon;
                    return (
                        <div
                            key={option.id}
                            className={cn(
                                'flex items-center gap-2.5 transition-all duration-200',
                                menuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none invisible'
                            )}
                            style={{ transitionDelay: menuOpen ? `${(options.length - 1 - index) * 40}ms` : '0ms' }}
                        >
                            <span className="px-3 py-1.5 rounded-full bg-surface border border-subtle shadow-md text-xs font-semibold text-primary-hub whitespace-nowrap">
                                {option.label}
                            </span>
                            <button
                                type="button"
                                role="menuitem"
                                tabIndex={menuOpen ? 0 : -1}
                                onClick={() => openPanel(option.id)}
                                style={BTN_3D}
                                className={cn('w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 cursor-pointer', option.tone)}
                                aria-label={option.id === 'chat' ? 'Abrir chat com a IA' : 'Abrir lista de ramais'}
                                title={option.label}
                            >
                                <Icon className="w-5 h-5" style={ICON_3D} aria-hidden="true" />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Botão principal */}
            <button
                type="button"
                id="floating-hub-btn"
                onClick={handleMainClick}
                style={BTN_3D}
                aria-expanded={active}
                aria-haspopup={aiAllowed ? 'menu' : 'dialog'}
                className={cn(
                    'fixed bottom-6 right-4 sm:right-6 w-14 h-14 rounded-full text-white shadow-xl z-50 flex items-center justify-center transition-all duration-200 cursor-pointer',
                    active ? 'bg-zinc-800 hover:bg-zinc-700 rotate-0' : 'bg-rose-600 hover:bg-rose-500 hover:scale-105'
                )}
                aria-label={active ? 'Fechar' : (aiAllowed ? 'Abrir atalhos: Ramais e Chat IA' : 'Abrir ramais')}
                title={active ? 'Fechar' : (aiAllowed ? 'Ramais e Chat IA' : 'Ramais')}
            >
                {active ? <X className="w-6 h-6" style={ICON_3D} aria-hidden="true" /> : <MessageCircle className="w-6 h-6" style={ICON_3D} aria-hidden="true" />}
            </button>
        </div>
    );
}

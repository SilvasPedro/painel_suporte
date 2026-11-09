import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, Compass } from 'lucide-react';

const SPOT_PADDING = 8;   // folga entre o alvo e o retângulo de destaque
const CARD_GAP = 16;      // distância entre o retângulo e o cartão explicativo
const VIEW_MARGIN = 12;
const CARD_WIDTH = 360;
const MAX_FIND_TRIES = 14;

// Calcula onde o cartão explicativo fica, sem sair da tela
const placeCard = (rect, cardHeight) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(CARD_WIDTH, vw - VIEW_MARGIN * 2);
    const height = cardHeight || 220;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

    if (!rect) {
        return { top: Math.max(VIEW_MARGIN, (vh - height) / 2), left: Math.max(VIEW_MARGIN, (vw - width) / 2), width };
    }

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let top;
    let left;

    if (rect.right + CARD_GAP + width <= vw - VIEW_MARGIN) {            // à direita (menu lateral)
        left = rect.right + CARD_GAP;
        top = cy - height / 2;
    } else if (rect.bottom + CARD_GAP + height <= vh - VIEW_MARGIN) {   // abaixo (barra superior)
        top = rect.bottom + CARD_GAP;
        left = cx - width / 2;
    } else if (rect.top - CARD_GAP - height >= VIEW_MARGIN) {           // acima
        top = rect.top - CARD_GAP - height;
        left = cx - width / 2;
    } else if (rect.left - CARD_GAP - width >= VIEW_MARGIN) {           // à esquerda
        left = rect.left - CARD_GAP - width;
        top = cy - height / 2;
    } else {
        top = (vh - height) / 2;
        left = (vw - width) / 2;
    }

    return {
        top: clamp(top, VIEW_MARGIN, Math.max(VIEW_MARGIN, vh - height - VIEW_MARGIN)),
        left: clamp(left, VIEW_MARGIN, Math.max(VIEW_MARGIN, vw - width - VIEW_MARGIN)),
        width
    };
};

/**
 * Tour guiado: escurece a tela, destaca um elemento com um retângulo e explica sua função.
 * O componente deve ser montado apenas enquanto o tour estiver aberto.
 *
 * @param {Array}    steps         [{ id, target?, title, body, menu? }]
 * @param {Function} onFinish      (completed:boolean) => void  (false quando o usuário pula)
 * @param {Function} onBeforeStep  (step) => void  prepara a tela (ex.: expandir o menu do alvo)
 */
const ProductTour = ({ steps, onFinish, onBeforeStep }) => {
    const [index, setIndex] = useState(0);
    const [layout, setLayout] = useState({ rect: null, card: null });
    const cardRef = useRef(null);
    const targetRef = useRef(null);
    const nextBtnRef = useRef(null);

    const step = steps[index];
    const isFirst = index === 0;
    const isLast = index === steps.length - 1;

    const measure = useCallback(() => {
        const el = targetRef.current;
        const r = el && el.isConnected ? el.getBoundingClientRect() : null;
        const rect = r && r.width > 0 && r.height > 0
            ? { top: r.top - SPOT_PADDING, left: r.left - SPOT_PADDING, width: r.width + SPOT_PADDING * 2, height: r.height + SPOT_PADDING * 2, right: r.right + SPOT_PADDING, bottom: r.bottom + SPOT_PADDING }
            : null;
        setLayout({ rect, card: placeCard(rect, cardRef.current?.offsetHeight) });
    }, []);

    // Localiza o alvo do passo atual (com novas tentativas, pois o menu pode estar abrindo)
    useEffect(() => {
        if (!step) return undefined;
        onBeforeStep?.(step);

        let cancelled = false;
        let tries = 0;
        let timer;

        const find = () => {
            if (cancelled) return;
            if (!step.target) {
                targetRef.current = null;
                measure();
                return;
            }
            const el = document.querySelector(step.target);
            const r = el?.getBoundingClientRect();
            if (el && r.width > 0 && r.height > 0) {
                targetRef.current = el;
                el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                measure();
                timer = setTimeout(measure, 320); // reposiciona após animações do menu
            } else if (tries++ < MAX_FIND_TRIES) {
                timer = setTimeout(find, 60);
            } else {
                // Alvo indisponível (ex.: permissão ou tela pequena): mostra o passo centralizado
                targetRef.current = null;
                measure();
            }
        };

        timer = setTimeout(find, 0);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [index, step, measure, onBeforeStep]);

    // Reposiciona ao redimensionar ou rolar
    useEffect(() => {
        window.addEventListener('resize', measure);
        window.addEventListener('scroll', measure, true);
        return () => {
            window.removeEventListener('resize', measure);
            window.removeEventListener('scroll', measure, true);
        };
    }, [measure]);

    const goNext = useCallback(() => {
        if (index >= steps.length - 1) onFinish(true);
        else setIndex(i => i + 1);
    }, [index, steps.length, onFinish]);

    const goPrev = useCallback(() => setIndex(i => Math.max(0, i - 1)), []);

    // Teclado: setas navegam, Enter avança, Esc pula o tour
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); goNext(); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev(); }
            else if (e.key === 'Escape') { e.preventDefault(); onFinish(false); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [goNext, goPrev, onFinish]);

    useEffect(() => {
        nextBtnRef.current?.focus({ preventScroll: true });
    }, [index]);

    if (!step) return null;
    const { rect, card } = layout;
    const cardStyle = card
        ? { top: card.top, left: card.left, width: card.width }
        : { top: '50%', left: '50%', width: CARD_WIDTH, transform: 'translate(-50%, -50%)' };

    return createPortal(
        <div className="fixed inset-0 z-[300]" role="dialog" aria-modal="true" aria-labelledby="product-tour-title">
            {/* Camada que bloqueia cliques na página durante o tour */}
            <div className="absolute inset-0" />

            {/* Fundo apagado + retângulo de destaque (o box-shadow gigante escurece todo o resto) */}
            {rect ? (
                <div
                    aria-hidden="true"
                    className="absolute rounded-2xl pointer-events-none transition-all duration-300 ease-out"
                    style={{
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height,
                        boxShadow: '0 0 0 9999px rgba(12, 10, 9, 0.72)',
                        outline: '2px solid rgb(244 63 94)',
                        outlineOffset: 2
                    }}
                />
            ) : (
                <div aria-hidden="true" className="absolute inset-0 pointer-events-none transition-opacity duration-300" style={{ background: 'rgba(12, 10, 9, 0.72)' }} />
            )}

            {/* Cartão explicativo */}
            <div
                ref={cardRef}
                className="absolute bg-surface border border-subtle rounded-2xl shadow-2xl p-5 text-left transition-all duration-300 ease-out"
                style={cardStyle}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center shrink-0">
                            <Compass className="w-4 h-4" />
                        </div>
                        <h3 id="product-tour-title" className="font-brand text-base font-bold text-primary-hub leading-tight">
                            {step.title}
                        </h3>
                    </div>
                    <button
                        type="button"
                        onClick={() => onFinish(false)}
                        className="p-1 -mr-1 -mt-1 rounded-lg text-muted-hub hover:text-primary-hub hover:bg-subtle cursor-pointer"
                        aria-label="Pular tour"
                        title="Pular tour (Esc)"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <p className="mt-3 text-sm text-secondary-hub leading-relaxed whitespace-pre-line">
                    {step.body}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-mono font-bold text-muted-hub">
                        {index + 1} de {steps.length}
                    </span>
                    <div className="flex items-center gap-2">
                        {!isLast && (
                            <button
                                type="button"
                                onClick={() => onFinish(false)}
                                className="px-2.5 py-1.5 text-xs font-bold text-muted-hub hover:text-primary-hub cursor-pointer"
                            >
                                Pular
                            </button>
                        )}
                        {!isFirst && (
                            <button
                                type="button"
                                onClick={goPrev}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-strong text-xs font-bold text-secondary-hub hover:bg-subtle cursor-pointer"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" /> Voltar
                            </button>
                        )}
                        <button
                            ref={nextBtnRef}
                            type="button"
                            onClick={goNext}
                            className="inline-flex items-center gap-1 px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer"
                        >
                            {isLast ? 'Concluir' : isFirst ? 'Começar' : 'Próximo'}
                            {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>

                {/* Barra de progresso */}
                <div className="mt-3 h-1 rounded-full bg-subtle overflow-hidden">
                    <div
                        className="h-full rounded-full bg-rose-500 transition-all duration-300"
                        style={{ width: `${((index + 1) / steps.length) * 100}%` }}
                    />
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ProductTour;

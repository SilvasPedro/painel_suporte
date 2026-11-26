import React from 'react';

// Cor da marca Claude (laranja terracota)
const CLAUDE_ORANGE = '#D97757';

// Raios do símbolo: 12 hastes de comprimentos alternados saindo do centro
const RAYS = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 - 90) * (Math.PI / 180);
    const outer = i % 2 === 0 ? 10.5 : 8.2;
    const inner = 2.6;
    return {
        x1: 12 + Math.cos(angle) * inner,
        y1: 12 + Math.sin(angle) * inner,
        x2: 12 + Math.cos(angle) * outer,
        y2: 12 + Math.sin(angle) * outer
    };
});

/** Símbolo em estrela da Claude, em SVG (não depende de arquivo de imagem). */
export function ClaudeLogo({ className = 'w-3.5 h-3.5' }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
            {RAYS.map((ray, i) => (
                <line key={i} {...ray} stroke={CLAUDE_ORANGE} strokeWidth="2.2" strokeLinecap="round" />
            ))}
        </svg>
    );
}

/** Selo "Powered by Claude AI" do cabeçalho do chat (estático, sem animação). */
export default function ClaudeBadge() {
    return (
        <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-subtle bg-canvas px-2 py-0.5 text-[11px] font-semibold leading-tight text-secondary-hub"
            title="Respostas geradas pela Claude, da Anthropic"
        >
            <ClaudeLogo />
            Powered by Claude AI
        </span>
    );
}

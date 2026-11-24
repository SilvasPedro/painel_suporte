// Marca automaticamente todo <button> com fundo sólido com a classe `btn-gloss`
// (efeito 3D brilhoso leve definido em index.css). Botões transparentes/ghost,
// cards clicáveis grandes e botões que já usam .btn-3d/.btn-excel ficam de fora.
const MAX_HEIGHT = 80;

function parseAlpha(color) {
    if (!color || color === 'transparent') return 0;
    const m = color.match(/rgba?\(([^)]+)\)/) || color.match(/color\(.+\/\s*([\d.]+%?)\)/);
    if (!m) return 1;
    const parts = m[1].split(/[,\s/]+/).filter(Boolean);
    if (parts.length >= 4) {
        const a = parts[3];
        return a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
    }
    return 1;
}

function evaluate(btn) {
    if (btn.classList.contains('btn-3d') || btn.classList.contains('btn-excel')) return;
    const cs = getComputedStyle(btn);
    const solid = parseAlpha(cs.backgroundColor) >= 0.6 || cs.backgroundImage.includes('gradient');
    const small = btn.offsetHeight > 0 && btn.offsetHeight <= MAX_HEIGHT;
    btn.classList.toggle('btn-gloss', solid && small);
}

export function initButtonGloss() {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;
    const pending = new Set();
    let scheduled = false;

    const flush = () => {
        scheduled = false;
        pending.forEach(b => { if (b.isConnected) evaluate(b); });
        pending.clear();
    };
    const queue = (btn) => {
        pending.add(btn);
        if (!scheduled) { scheduled = true; requestAnimationFrame(flush); }
    };
    const scan = (root) => {
        if (root.nodeType !== 1) return;
        if (root.tagName === 'BUTTON') queue(root);
        root.querySelectorAll?.('button').forEach(queue);
    };

    new MutationObserver(muts => {
        for (const m of muts) {
            if (m.type === 'childList') m.addedNodes.forEach(scan);
            else if (m.target.tagName === 'BUTTON') queue(m.target);
        }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'disabled'] });

    scan(document.body);
}

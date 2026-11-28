// Preferência de profundidade visual: ícones e botões em relevo (3D) ou planos e refinados (flat).
// Fica no localStorage e vira o atributo data-depth no <html>, que o index.css usa para trocar o visual.
export const DEPTH_STORAGE_KEY = 'hubdesk_depth';
export const DEPTH_MODES = {
    '3d': { id: '3d', name: 'Efeito 3D', description: 'Ícones e botões com relevo, brilho e sombra.' },
    flat: { id: 'flat', name: 'Flat', description: 'Visual plano: cores chapadas, contornos finos e realce suave.' }
};

export const DEFAULT_DEPTH = '3d';

export const normalizeDepth = (value) => (value === 'flat' || value === '3d' ? value : DEFAULT_DEPTH);

export function readSavedDepth() {
    try {
        return normalizeDepth(localStorage.getItem(DEPTH_STORAGE_KEY));
    } catch {
        return DEFAULT_DEPTH;
    }
}

export function applyDepth(depth, root = typeof document !== 'undefined' ? document.documentElement : null) {
    if (root) root.setAttribute('data-depth', normalizeDepth(depth));
}

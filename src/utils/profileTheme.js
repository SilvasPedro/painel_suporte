/**
 * Tema personalizado do perfil (funções puras, sem React/Firebase).
 *
 * Modelo gravado em `collaborators/{id}.profileTheme`:
 *   {
 *     bg:      { preset: 'aurora' | ..., imageUrl: 'https://...', dim: 0-80 },
 *     pattern: { id: 'dots' | ... | 'none', color: '#rrggbb', opacity: 5-60, size: 60-200 },
 *     accent:  '#rrggbb',
 *     glass:   boolean,           // cartões translúcidos sobre o fundo
 *     tagline: 'frase de status'  // até 80 caracteres
 *   }
 */

export const TAGLINE_MAX = 80;

export const PAGE_BG_PRESETS = [
    { id: 'none', name: 'Padrão do tema', css: '' },
    { id: 'aurora', name: 'Aurora', css: 'linear-gradient(135deg, #0f766e 0%, #1d4ed8 50%, #7c3aed 100%)' },
    { id: 'por-do-sol', name: 'Pôr do sol', css: 'linear-gradient(135deg, #f97316 0%, #e11d48 55%, #7e22ce 100%)' },
    { id: 'oceano', name: 'Oceano', css: 'linear-gradient(160deg, #0ea5e9 0%, #1e3a8a 100%)' },
    { id: 'floresta', name: 'Floresta', css: 'linear-gradient(160deg, #16a34a 0%, #064e3b 100%)' },
    { id: 'carmim', name: 'Carmim', css: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)' },
    { id: 'neon', name: 'Neon', css: 'linear-gradient(135deg, #db2777 0%, #4f46e5 50%, #06b6d4 100%)' },
    { id: 'noturno', name: 'Noturno', css: 'linear-gradient(160deg, #1e293b 0%, #020617 100%)' },
    { id: 'grafite', name: 'Grafite', css: 'linear-gradient(135deg, #52525b 0%, #18181b 100%)' },
    { id: 'areia', name: 'Areia', css: 'linear-gradient(135deg, #fde68a 0%, #fdba74 100%)' }
];

export const ACCENT_COLORS = [
    '#e11d48', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#64748b'
];

// Cada padrão devolve { backgroundImage, backgroundSize, backgroundPosition? } a partir de uma cor rgba pronta
export const PROFILE_PATTERNS = [
    { id: 'none', name: 'Sem padrão', build: () => null },
    {
        id: 'dots', name: 'Pontos',
        build: (c, s) => ({ backgroundImage: `radial-gradient(${c} 1.5px, transparent 1.5px)`, backgroundSize: `${s * 0.2}px ${s * 0.2}px` })
    },
    {
        id: 'grid', name: 'Grade',
        build: (c, s) => ({
            backgroundImage: `linear-gradient(${c} 1px, transparent 1px), linear-gradient(90deg, ${c} 1px, transparent 1px)`,
            backgroundSize: `${s * 0.3}px ${s * 0.3}px`
        })
    },
    {
        id: 'blueprint', name: 'Blueprint',
        build: (c, s) => ({
            backgroundImage: `linear-gradient(${c} 2px, transparent 2px), linear-gradient(90deg, ${c} 2px, transparent 2px), linear-gradient(${c} 1px, transparent 1px), linear-gradient(90deg, ${c} 1px, transparent 1px)`,
            backgroundSize: `${s}px ${s}px, ${s}px ${s}px, ${s / 5}px ${s / 5}px, ${s / 5}px ${s / 5}px`
        })
    },
    {
        id: 'stripes', name: 'Listras',
        build: (c, s) => ({ backgroundImage: `repeating-linear-gradient(45deg, ${c} 0, ${c} 2px, transparent 2px, transparent ${s * 0.14}px)` })
    },
    {
        id: 'lines', name: 'Linhas',
        build: (c, s) => ({ backgroundImage: `repeating-linear-gradient(0deg, ${c} 0, ${c} 1px, transparent 1px, transparent ${s * 0.12}px)` })
    },
    {
        id: 'checker', name: 'Xadrez',
        build: (c, s) => ({
            backgroundImage: `conic-gradient(${c} 25%, transparent 25% 50%, ${c} 50% 75%, transparent 75%)`,
            backgroundSize: `${s * 0.4}px ${s * 0.4}px`
        })
    },
    {
        id: 'diamonds', name: 'Losangos',
        build: (c, s) => ({
            backgroundImage: `linear-gradient(135deg, ${c} 25%, transparent 25%), linear-gradient(225deg, ${c} 25%, transparent 25%), linear-gradient(45deg, ${c} 25%, transparent 25%), linear-gradient(315deg, ${c} 25%, transparent 25%)`,
            backgroundSize: `${s * 0.3}px ${s * 0.3}px`,
            backgroundPosition: `${s * 0.15}px 0, ${s * 0.15}px 0, 0 0, 0 0`
        })
    },
    {
        id: 'zigzag', name: 'Zigue-zague',
        build: (c, s) => ({
            backgroundImage: `linear-gradient(135deg, ${c} 25%, transparent 25%), linear-gradient(225deg, ${c} 25%, transparent 25%)`,
            backgroundSize: `${s * 0.3}px ${s * 0.3}px`
        })
    },
    {
        id: 'circles', name: 'Círculos',
        build: (c, s) => ({
            backgroundImage: `radial-gradient(circle at center, transparent 0, transparent ${s * 0.1}px, ${c} ${s * 0.1}px, ${c} ${s * 0.11}px, transparent ${s * 0.11}px)`,
            backgroundSize: `${s * 0.3}px ${s * 0.3}px`
        })
    },
    {
        id: 'waves', name: 'Ondas',
        build: (c, s) => ({
            backgroundImage: `radial-gradient(circle at 100% 50%, transparent 20%, ${c} 21%, ${c} 34%, transparent 35%), radial-gradient(circle at 0% 50%, transparent 20%, ${c} 21%, ${c} 34%, transparent 35%)`,
            backgroundSize: `${s * 0.3}px ${s * 0.4}px`
        })
    }
];

export const DEFAULT_PROFILE_THEME = Object.freeze({
    bg: { preset: 'none', imageUrl: '', dim: 35 },
    pattern: { id: 'none', color: '#ffffff', opacity: 25, size: 100 },
    accent: '',
    glass: false,
    tagline: ''
});

const HEX = /^#[0-9a-fA-F]{6}$/;
const clamp = (n, min, max, fallback) => {
    const v = Number(n);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
};

/** Aceita só HTTPS e remove aspas/parênteses que quebrariam o `url("...")` do CSS. */
export const sanitizeImageUrl = (value) => {
    const url = String(value || '').trim();
    if (!/^https:\/\//i.test(url)) return '';
    if (/["'()\\\s<>]/.test(url)) return '';
    return url.slice(0, 600);
};

/** Normaliza qualquer valor vindo do banco ou do formulário para um tema válido e completo. */
export const sanitizeProfileTheme = (raw) => {
    const t = raw && typeof raw === 'object' ? raw : {};
    const bgPreset = PAGE_BG_PRESETS.some(p => p.id === t.bg?.preset) ? t.bg.preset : DEFAULT_PROFILE_THEME.bg.preset;
    const patternId = PROFILE_PATTERNS.some(p => p.id === t.pattern?.id) ? t.pattern.id : 'none';
    return {
        bg: {
            preset: bgPreset,
            imageUrl: sanitizeImageUrl(t.bg?.imageUrl),
            dim: clamp(t.bg?.dim, 0, 80, DEFAULT_PROFILE_THEME.bg.dim)
        },
        pattern: {
            id: patternId,
            color: HEX.test(t.pattern?.color || '') ? t.pattern.color : DEFAULT_PROFILE_THEME.pattern.color,
            opacity: clamp(t.pattern?.opacity, 5, 60, DEFAULT_PROFILE_THEME.pattern.opacity),
            size: clamp(t.pattern?.size, 60, 200, DEFAULT_PROFILE_THEME.pattern.size)
        },
        accent: HEX.test(t.accent || '') ? t.accent : '',
        glass: t.glass === true,
        tagline: String(t.tagline || '').replace(/\s+/g, ' ').trim().slice(0, TAGLINE_MAX)
    };
};

export const hexToRgba = (hex, opacityPct) => {
    const h = HEX.test(hex || '') ? hex : '#ffffff';
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${(clamp(opacityPct, 0, 100, 25) / 100).toFixed(2)})`;
};

/** Estilo CSS do padrão (ou null quando não há padrão). */
export const buildPatternStyle = (theme) => {
    const t = sanitizeProfileTheme(theme);
    const pattern = PROFILE_PATTERNS.find(p => p.id === t.pattern.id);
    if (!pattern || pattern.id === 'none') return null;
    return pattern.build(hexToRgba(t.pattern.color, t.pattern.opacity), t.pattern.size);
};

/** Estilo CSS da camada de fundo (imagem tem prioridade sobre o preset). */
export const buildBackgroundStyle = (theme) => {
    const t = sanitizeProfileTheme(theme);
    if (t.bg.imageUrl) {
        return { backgroundImage: `url("${t.bg.imageUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center' };
    }
    const preset = PAGE_BG_PRESETS.find(p => p.id === t.bg.preset);
    return preset?.css ? { backgroundImage: preset.css } : null;
};

/** O tema altera alguma coisa visível? (evita criar camadas à toa) */
export const hasProfileTheme = (theme) => {
    const t = sanitizeProfileTheme(theme);
    return Boolean(t.bg.imageUrl || t.bg.preset !== 'none' || t.pattern.id !== 'none' || t.accent);
};

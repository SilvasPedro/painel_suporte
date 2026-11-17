import { describe, it, expect } from 'vitest';
import {
    sanitizeProfileTheme, sanitizeImageUrl, buildPatternStyle, buildBackgroundStyle,
    hasProfileTheme, hexToRgba, PROFILE_PATTERNS, TAGLINE_MAX
} from './profileTheme';

describe('sanitizeImageUrl', () => {
    it('aceita só https e recusa caracteres que quebram o url() do CSS', () => {
        expect(sanitizeImageUrl('https://site.com/a.jpg')).toBe('https://site.com/a.jpg');
        expect(sanitizeImageUrl('http://site.com/a.jpg')).toBe('');
        expect(sanitizeImageUrl('javascript:alert(1)')).toBe('');
        expect(sanitizeImageUrl('https://site.com/a.jpg")')).toBe('');
        expect(sanitizeImageUrl('https://site.com/a b.jpg')).toBe('');
        expect(sanitizeImageUrl('https://x.com/a.jpg"); background:url(')).toBe('');
        expect(sanitizeImageUrl(null)).toBe('');
    });
});

describe('sanitizeProfileTheme', () => {
    it('entrada vazia ou inválida vira o tema padrão completo', () => {
        const t = sanitizeProfileTheme(undefined);
        expect(t.bg.preset).toBe('none');
        expect(t.pattern.id).toBe('none');
        expect(t.accent).toBe('');
        expect(t.glass).toBe(false);
        expect(hasProfileTheme(t)).toBe(false);
    });

    it('descarta ids, cores e números inválidos e limita os intervalos', () => {
        const t = sanitizeProfileTheme({
            bg: { preset: 'inexistente', imageUrl: 'ftp://x', dim: 999 },
            pattern: { id: 'xxx', color: 'red', opacity: -5, size: 5000 },
            accent: 'rgb(1,2,3)',
            glass: 'sim',
            tagline: ''
        });
        expect(t.bg).toEqual({ preset: 'none', imageUrl: '', dim: 80 });
        expect(t.pattern).toEqual({ id: 'none', color: '#ffffff', opacity: 5, size: 200 });
        expect(t.accent).toBe('');
        expect(t.glass).toBe(false);
    });

    it('mantém valores válidos e corta a frase de status', () => {
        const t = sanitizeProfileTheme({
            bg: { preset: 'aurora', imageUrl: 'https://img.com/x.png', dim: 50 },
            pattern: { id: 'dots', color: '#112233', opacity: 40, size: 120 },
            accent: '#a855f7',
            glass: true,
            tagline: `  ${'a'.repeat(200)}  `
        });
        expect(t.bg.preset).toBe('aurora');
        expect(t.pattern.id).toBe('dots');
        expect(t.accent).toBe('#a855f7');
        expect(t.glass).toBe(true);
        expect(t.tagline).toHaveLength(TAGLINE_MAX);
        expect(hasProfileTheme(t)).toBe(true);
    });
});

describe('estilos', () => {
    it('hexToRgba converte e limita a opacidade', () => {
        expect(hexToRgba('#ff0000', 50)).toBe('rgba(255, 0, 0, 0.50)');
        expect(hexToRgba('invalido', 25)).toBe('rgba(255, 255, 255, 0.25)');
    });

    it('todo padrão (exceto "none") gera backgroundImage', () => {
        PROFILE_PATTERNS.filter(p => p.id !== 'none').forEach(p => {
            const style = buildPatternStyle({ pattern: { id: p.id, color: '#ffffff', opacity: 30, size: 100 } });
            expect(style?.backgroundImage, p.id).toMatch(/gradient/);
        });
        expect(buildPatternStyle({})).toBeNull();
    });

    it('imagem tem prioridade sobre o preset de fundo', () => {
        const withImg = buildBackgroundStyle({ bg: { preset: 'aurora', imageUrl: 'https://img.com/x.png' } });
        expect(withImg.backgroundImage).toBe('url("https://img.com/x.png")');
        expect(buildBackgroundStyle({ bg: { preset: 'aurora' } }).backgroundImage).toMatch(/linear-gradient/);
        expect(buildBackgroundStyle({})).toBeNull();
    });
});

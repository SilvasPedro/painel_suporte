import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import ProfileThemeModal from './ProfileThemeModal';
import ProfileThemeLayer from './ProfileThemeLayer';

describe('ProfileThemeLayer', () => {
    it('não renderiza nada quando o tema não altera o visual', () => {
        expect(renderToString(<ProfileThemeLayer theme={{}} />)).toBe('');
    });

    it('renderiza fundo, escurecimento da imagem e pattern', () => {
        const html = renderToString(<ProfileThemeLayer theme={{
            bg: { imageUrl: 'https://img.com/fundo.png', dim: 40 },
            pattern: { id: 'dots', color: '#ff0000', opacity: 30, size: 100 }
        }} />);
        expect(html).toContain('https://img.com/fundo.png');
        expect(html).toContain('radial-gradient');
        expect(html).toContain('opacity:0.4');
    });

    it('ignora URL de imagem insegura', () => {
        const html = renderToString(<ProfileThemeLayer theme={{ bg: { imageUrl: 'javascript:alert(1)' } }} />);
        expect(html).not.toContain('javascript');
    });
});

describe('ProfileThemeModal', () => {
    it('mostra as abas, os presets de fundo e a pré-visualização', () => {
        const html = renderToString(<ProfileThemeModal initialTheme={{ tagline: 'Café e chamados' }} onConfirm={() => {}} onClose={() => {}} />);
        expect(html).toContain('Personalizar Perfil');
        ['Fundo da tela', 'Patterns', 'Destaque', 'Frase'].forEach(label => expect(html).toContain(label));
        expect(html).toContain('Aurora');
        expect(html).toContain('Café e chamados');
        expect(html).toContain('Aplicar ao perfil');
    });
});

import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AtlasAvatar from './AtlasAvatar';
import { ATLAS_NAME, ATLAS_TITLE, trefoilPetals } from '../../utils/atlasBot';

describe('trefoilPetals (marca do Hubdesk)', () => {
    it('gera três pétalas a 120 graus, cada uma com as elipses em leque', () => {
        const petals = trefoilPetals({ radius: 40, steps: 12, fan: 80 });
        expect(petals.map(p => p.rotate)).toEqual([0, 120, 240]);
        for (const petal of petals) {
            expect(petal.ellipses).toHaveLength(12);
            expect(petal.ellipses[0].rotate).toBe(-40);
            expect(petal.ellipses[11].rotate).toBe(40);
        }
    });

    it('o tamanho acompanha o raio e passos inválidos viram o mínimo', () => {
        const small = trefoilPetals({ radius: 10 })[0].ellipses[0];
        const big = trefoilPetals({ radius: 100 })[0].ellipses[0];
        expect(big.ry).toBeCloseTo(small.ry * 10, 1);
        expect(trefoilPetals({ steps: 0 })[0].ellipses).toHaveLength(2);
    });
});

describe('AtlasAvatar', () => {
    it('é decorativo por padrão (oculto para leitores de tela, sem <title>)', () => {
        const html = renderToStaticMarkup(<AtlasAvatar />);
        expect(html).toContain('aria-hidden="true"');
        expect(html).not.toContain('<title>');
        expect(html).toContain('viewBox="0 0 256 256"');
    });

    it('com decorative=false vira imagem com o nome acessível', () => {
        const html = renderToStaticMarkup(<AtlasAvatar decorative={false} />);
        expect(html).toContain('role="img"');
        expect(html).toContain(`aria-label="${ATLAS_NAME}"`);
        expect(html).toContain(`<title>${ATLAS_NAME}</title>`);
    });

    it('formato "circle" arredonda o fundo por inteiro e "tile" usa quadrado arredondado', () => {
        expect(renderToStaticMarkup(<AtlasAvatar shape="circle" />)).toContain('rx="128"');
        expect(renderToStaticMarkup(<AtlasAvatar />)).toContain('rx="56"');
    });

    it('desenha a marca do Hubdesk no peito (36 elipses) e usa o tamanho pedido', () => {
        const html = renderToStaticMarkup(<AtlasAvatar size={64} />);
        expect(html).toContain('width="64"');
        // 3 pétalas x 12 elipses
        expect((html.match(/<ellipse/g) || []).length).toBeGreaterThanOrEqual(36);
    });

    it('dois avatares na mesma tela não dividem ids de gradiente', () => {
        const html = renderToStaticMarkup(<><AtlasAvatar /><AtlasAvatar /></>);
        const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
        expect(ids.length).toBeGreaterThan(0);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.every(id => !id.includes(':'))).toBe(true); // ":" quebra url(#...)
    });

    it('nome e título do personagem', () => {
        expect(ATLAS_NAME).toBe('Atlas Bot');
        expect(ATLAS_TITLE).toBe('Agente de IA Hubdesk');
    });
});

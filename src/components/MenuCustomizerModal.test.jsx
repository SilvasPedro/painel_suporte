import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import MenuCustomizerModal from './MenuCustomizerModal';

const Icon = () => <svg />;
const DEFAULTS = [
    { id: 'a', title: 'Alfa', icon: Icon, items: [{ id: 'a1', label: 'Tela A1', icon: Icon }, { id: 'a2', label: 'Tela A2', icon: Icon }] },
    { id: 'b', title: 'Beta', icon: Icon, items: [{ id: 'b1', label: 'Tela B1', icon: Icon }] }
];
const render = (props = {}) => renderToString(
    <MenuCustomizerModal isOpen onClose={() => {}} defaults={DEFAULTS} layout={null} canViewItem={() => true} onSave={() => {}} {...props} />
);

describe('MenuCustomizerModal', () => {
    it('lista seções com campo de nome e as telas de cada uma', () => {
        const html = render();
        expect(html).toContain('Personalizar menu');
        expect(html).toContain('Nome da seção Alfa');
        expect(html).toContain('Tela A1');
        expect(html).toContain('Tela B1');
        expect(html).toContain('Mover Tela A1 para outra seção');
        expect(html).toContain('Restaurar padrão');
    });

    it('reflete a personalização salva (nome e posição)', () => {
        const html = render({ layout: { titles: { a: 'Meus favoritos' }, items: { a: ['a2', 'a1'] } } });
        expect(html).toContain('value="Meus favoritos"');
        expect(html.indexOf('Tela A2')).toBeLessThan(html.indexOf('Tela A1'));
    });

    it('não lista telas sem permissão para o usuário', () => {
        const html = render({ canViewItem: (id) => id !== 'a2' });
        expect(html).toContain('Tela A1');
        expect(html).not.toContain('Tela A2');
    });

    it('seção sem telas visíveis avisa que fica oculta', () => {
        const html = render({ canViewItem: (id) => id !== 'b1' });
        expect(html).toContain('Nenhuma tela nesta seção');
    });
});

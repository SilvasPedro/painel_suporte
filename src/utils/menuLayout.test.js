import { describe, it, expect } from 'vitest';
import {
    cleanSectionTitle, normalizeLayout, buildDraft, applyMenuLayout, draftToLayout, isCustomLayout,
    moveSection, moveItem, moveItemToSection, renameSection, findSectionOfItem
} from './menuLayout';

const DEFAULTS = [
    { id: 'a', title: 'Alfa', icon: 'IA', items: [{ id: 'a1', label: 'A1' }, { id: 'a2', label: 'A2' }] },
    { id: 'b', title: 'Beta', icon: 'IB', items: [{ id: 'b1', label: 'B1' }] },
    { id: 'c', title: 'Gama', icon: 'IC', items: [{ id: 'c1', label: 'C1' }, { id: 'c2', label: 'C2' }] }
];
const ids = (menus) => menus.map(m => `${m.id}:${m.items.map(i => i.id).join(',')}`);

describe('cleanSectionTitle / normalizeLayout', () => {
    it('limpa espaços, caracteres de controle e limita o tamanho', () => {
        expect(cleanSectionTitle('  Minha\n  seção\t ')).toBe('Minha seção');
        expect(cleanSectionTitle('x'.repeat(100))).toHaveLength(28);
        expect(cleanSectionTitle(null)).toBe('');
    });

    it('aceita texto JSON e descarta lixo', () => {
        expect(normalizeLayout('{"order":["a"],"titles":{"a":"Novo"}}')).toEqual({ order: ['a'], titles: { a: 'Novo' }, items: {} });
        expect(normalizeLayout('não é json')).toEqual({ order: [], titles: {}, items: {} });
        expect(normalizeLayout(null)).toEqual({ order: [], titles: {}, items: {} });
        expect(normalizeLayout({ order: 'x', titles: [], items: { a: [1, 'a1', ''] } })).toEqual({ order: [], titles: {}, items: { a: ['a1'] } });
    });
});

describe('applyMenuLayout', () => {
    it('sem personalização devolve o menu padrão', () => {
        expect(ids(applyMenuLayout(DEFAULTS, null))).toEqual(['a:a1,a2', 'b:b1', 'c:c1,c2']);
    });

    it('aplica ordem das seções, nomes e posição dos itens, mantendo ícones e rótulos', () => {
        const layout = { order: ['c', 'a', 'b'], titles: { a: 'Minhas telas' }, items: { c: ['c2', 'c1'], a: ['a2', 'b1', 'a1'] } };
        const menus = applyMenuLayout(DEFAULTS, layout);
        expect(ids(menus)).toEqual(['c:c2,c1', 'a:a2,b1,a1', 'b:']);
        expect(menus[1]).toMatchObject({ title: 'Minhas telas', icon: 'IA' });
        expect(menus[1].items[1]).toMatchObject({ id: 'b1', label: 'B1' });
        expect(menus[0].title).toBe('Gama');
    });

    it('ignora seções e itens que não existem mais e não duplica itens', () => {
        const layout = { order: ['zzz', 'b'], items: { b: ['b1', 'fantasma', 'a1'], a: ['a1', 'a2'] } };
        const menus = applyMenuLayout(DEFAULTS, layout);
        expect(ids(menus)).toEqual(['b:b1,a1', 'a:a2', 'c:c1,c2']);
    });

    it('telas novas (sem posição salva) aparecem na seção padrão delas', () => {
        const withNew = DEFAULTS.map(s => (s.id === 'b' ? { ...s, items: [...s.items, { id: 'b2', label: 'B2' }] } : s));
        const menus = applyMenuLayout(withNew, { order: ['a', 'b', 'c'], items: { b: ['b1'] } });
        expect(ids(menus)).toContain('b:b1,b2');
    });

    it('título vazio volta ao nome padrão', () => {
        expect(applyMenuLayout(DEFAULTS, { titles: { a: '   ' } })[0].title).toBe('Alfa');
    });
});

describe('edição do rascunho', () => {
    const draft = () => buildDraft(DEFAULTS, null);

    it('moveSection sobe e desce, sem sair dos limites', () => {
        expect(moveSection(draft(), 'b', -1).map(s => s.id)).toEqual(['b', 'a', 'c']);
        expect(moveSection(draft(), 'c', 1).map(s => s.id)).toEqual(['a', 'b', 'c']);
        expect(moveSection(draft(), 'a', -1).map(s => s.id)).toEqual(['a', 'b', 'c']);
    });

    it('moveItem troca de lugar dentro da seção e respeita as pontas', () => {
        expect(moveItem(draft(), 'a2', -1)[0].items).toEqual(['a2', 'a1']);
        expect(moveItem(draft(), 'a2', 1)[0].items).toEqual(['a1', 'a2']);
    });

    it('moveItem pula itens invisíveis para a seta ter efeito', () => {
        const d = [{ id: 'x', title: 'X', items: ['i1', 'oculto', 'i2'] }];
        expect(moveItem(d, 'i2', -1, id => id !== 'oculto')[0].items).toEqual(['i2', 'oculto', 'i1']);
        expect(moveItem(d, 'i1', -1, id => id !== 'oculto')[0].items).toEqual(['i1', 'oculto', 'i2']);
    });

    it('moveItemToSection leva o item para o fim de outra seção', () => {
        const moved = moveItemToSection(draft(), 'a1', 'c');
        expect(moved.map(s => s.items.join(','))).toEqual(['a2', 'b1', 'c1,c2,a1']);
        expect(moveItemToSection(draft(), 'a1', 'inexistente')).toEqual(draft());
    });

    it('renameSection limita o tamanho', () => {
        expect(renameSection(draft(), 'a', 'Novo nome')[0].title).toBe('Novo nome');
        expect(renameSection(draft(), 'a', 'y'.repeat(50))[0].title).toHaveLength(28);
    });

    it('draftToLayout grava um resultado que reproduz exatamente o rascunho', () => {
        let d = moveSection(draft(), 'c', -1);
        d = moveItemToSection(d, 'a1', 'b');
        d = renameSection(d, 'b', 'Favoritos');
        const layout = draftToLayout(d);
        expect(buildDraft(DEFAULTS, layout)).toEqual(d);
        expect(JSON.parse(JSON.stringify(layout))).toEqual(layout); // pode ser gravado como JSON
    });
});

describe('isCustomLayout / findSectionOfItem', () => {
    it('detecta quando há personalização', () => {
        expect(isCustomLayout(DEFAULTS, null)).toBe(false);
        expect(isCustomLayout(DEFAULTS, draftToLayout(buildDraft(DEFAULTS, null)))).toBe(false);
        expect(isCustomLayout(DEFAULTS, { titles: { a: 'Outro' } })).toBe(true);
    });

    it('encontra a seção atual de um item', () => {
        const menus = applyMenuLayout(DEFAULTS, { items: { c: ['a1', 'c1', 'c2'] } });
        expect(findSectionOfItem(menus, 'a1')).toBe('c');
        expect(findSectionOfItem(menus, 'nao-existe')).toBeNull();
    });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { normalizeDepth, readSavedDepth, applyDepth, DEPTH_STORAGE_KEY } from './depthMode';

describe('depthMode', () => {
    beforeEach(() => {
        const store = {};
        vi.stubGlobal('localStorage', {
            getItem: (k) => (k in store ? store[k] : null),
            setItem: (k, v) => { store[k] = String(v); }
        });
    });

    it('aceita só 3d e flat; o resto vira 3d', () => {
        expect(normalizeDepth('flat')).toBe('flat');
        expect(normalizeDepth('3d')).toBe('3d');
        expect(normalizeDepth('xyz')).toBe('3d');
        expect(normalizeDepth(null)).toBe('3d');
    });

    it('lê a preferência salva e usa 3d quando não há nada', () => {
        expect(readSavedDepth()).toBe('3d');
        localStorage.setItem(DEPTH_STORAGE_KEY, 'flat');
        expect(readSavedDepth()).toBe('flat');
    });

    it('aplica o atributo data-depth no elemento raiz', () => {
        const root = { value: null, setAttribute(k, v) { this.value = [k, v]; } };
        applyDepth('flat', root);
        expect(root.value).toEqual(['data-depth', 'flat']);
        applyDepth('lixo', root);
        expect(root.value).toEqual(['data-depth', '3d']);
    });
});

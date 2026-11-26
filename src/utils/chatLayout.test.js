import { describe, it, expect } from 'vitest';
import {
    CHAT_SIZE, maxChatSize, clampChatSize, defaultChatSize, resizeFromCorner, resizeByKey,
    loadChatSize, saveChatSize, clearChatSize
} from './chatLayout';

const screen = { w: 1440, h: 900 };
const memoryStorage = (initial = {}) => {
    const data = { ...initial };
    return {
        data,
        getItem: (k) => (k in data ? data[k] : null),
        setItem: (k, v) => { data[k] = String(v); },
        removeItem: (k) => { delete data[k]; }
    };
};

describe('limites do tamanho', () => {
    it('o máximo é o que cabe na tela, descontando as folgas', () => {
        expect(maxChatSize(screen)).toEqual({ w: 1440 - CHAT_SIZE.marginX, h: 900 - CHAT_SIZE.marginY });
    });

    it('tela pequena nunca deixa o máximo abaixo do mínimo', () => {
        expect(maxChatSize({ w: 300, h: 300 })).toEqual({ w: CHAT_SIZE.minW, h: CHAT_SIZE.minH });
    });

    it('clampChatSize respeita mínimo e máximo e arredonda', () => {
        expect(clampChatSize({ w: 10, h: 10 }, screen)).toEqual({ w: CHAT_SIZE.minW, h: CHAT_SIZE.minH });
        expect(clampChatSize({ w: 99999, h: 99999 }, screen)).toEqual(maxChatSize(screen));
        expect(clampChatSize({ w: 500.6, h: 600.4 }, screen)).toEqual({ w: 501, h: 600 });
    });

    it('valores inválidos viram o tamanho padrão', () => {
        expect(clampChatSize({ w: 'abc', h: undefined }, screen)).toEqual({ w: CHAT_SIZE.defaultW, h: CHAT_SIZE.defaultH });
        expect(clampChatSize(null, screen)).toEqual({ w: CHAT_SIZE.defaultW, h: CHAT_SIZE.defaultH });
    });

    it('o padrão também é limitado pela tela', () => {
        expect(defaultChatSize(screen)).toEqual({ w: 416, h: 576 });
        expect(defaultChatSize({ w: 700, h: 600 })).toEqual({ w: 416, h: 472 });
    });
});

describe('redimensionar pela alça do canto superior esquerdo', () => {
    const start = { w: 416, h: 576, x: 1000, y: 400 };

    it('arrastar para a esquerda e para cima aumenta o painel', () => {
        expect(resizeFromCorner(start, { x: 900, y: 350 }, screen)).toEqual({ w: 516, h: 626 });
    });

    it('arrastar para a direita e para baixo diminui, até o mínimo', () => {
        expect(resizeFromCorner(start, { x: 1030, y: 420 }, screen)).toEqual({ w: 386, h: 556 });
        expect(resizeFromCorner(start, { x: 1500, y: 900 }, screen)).toEqual({ w: CHAT_SIZE.minW, h: CHAT_SIZE.minH });
    });

    it('não passa do que cabe na tela', () => {
        expect(resizeFromCorner(start, { x: -5000, y: -5000 }, screen)).toEqual(maxChatSize(screen));
    });
});

describe('redimensionar pelo teclado', () => {
    const size = { w: 416, h: 576 };

    it('setas para a esquerda/cima aumentam; direita/baixo diminuem', () => {
        expect(resizeByKey(size, 'ArrowLeft', screen)).toEqual({ w: 440, h: 576 });
        expect(resizeByKey(size, 'ArrowUp', screen)).toEqual({ w: 416, h: 600 });
        expect(resizeByKey(size, 'ArrowRight', screen)).toEqual({ w: 392, h: 576 });
        expect(resizeByKey(size, 'ArrowDown', screen)).toEqual({ w: 416, h: 552 });
    });

    it('outras teclas devolvem o mesmo objeto', () => {
        expect(resizeByKey(size, 'a', screen)).toBe(size);
    });
});

describe('tamanho salvo no navegador', () => {
    it('salva e lê de volta', () => {
        const storage = memoryStorage();
        saveChatSize(storage, { w: 500, h: 640 });
        expect(loadChatSize(storage, screen)).toEqual({ w: 500, h: 640 });
    });

    it('sem nada salvo usa o padrão', () => {
        expect(loadChatSize(memoryStorage(), screen)).toEqual(defaultChatSize(screen));
    });

    it('valor salvo maior que a tela atual é reduzido', () => {
        const storage = memoryStorage();
        saveChatSize(storage, { w: 1400, h: 880 });
        expect(loadChatSize(storage, { w: 800, h: 600 })).toEqual(maxChatSize({ w: 800, h: 600 }));
    });

    it('JSON quebrado ou campos inválidos voltam ao padrão', () => {
        expect(loadChatSize(memoryStorage({ [CHAT_SIZE.storageKey]: '{quebrado' }), screen)).toEqual(defaultChatSize(screen));
        expect(loadChatSize(memoryStorage({ [CHAT_SIZE.storageKey]: '{"w":"x","h":1}' }), screen)).toEqual(defaultChatSize(screen));
    });

    it('armazenamento indisponível não derruba nada', () => {
        const broken = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); }, removeItem: () => { throw new Error('bloqueado'); } };
        expect(loadChatSize(broken, screen)).toEqual(defaultChatSize(screen));
        expect(() => saveChatSize(broken, { w: 1, h: 1 })).not.toThrow();
        expect(() => clearChatSize(broken)).not.toThrow();
        expect(loadChatSize(null, screen)).toEqual(defaultChatSize(screen));
    });

    it('clearChatSize apaga o valor salvo', () => {
        const storage = memoryStorage();
        saveChatSize(storage, { w: 500, h: 640 });
        clearChatSize(storage);
        expect(storage.getItem(CHAT_SIZE.storageKey)).toBeNull();
    });
});

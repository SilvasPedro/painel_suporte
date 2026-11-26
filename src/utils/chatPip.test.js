import { describe, it, expect, vi } from 'vitest';
import { supportsDocumentPip, copyDocumentStyles, syncTheme, watchTheme, openChatPip } from './chatPip';

// Documentos de mentira: só o que o código usa
const makeDoc = ({ head = [], theme = null, className = '', colorScheme = '' } = {}) => {
    const attrs = theme ? { 'data-theme': theme } : {};
    const bodyAttrs = {};
    const appended = [];
    return {
        baseURI: 'https://hubdesk.test/app/',
        appended,
        head: {
            appendChild: (node) => { appended.push(node); },
            querySelectorAll: () => head
        },
        body: { style: {}, className: '', setAttribute: (k, v) => { bodyAttrs[k] = v; }, attrs: bodyAttrs },
        documentElement: {
            className, style: { colorScheme }, attrs,
            getAttribute: (k) => attrs[k] ?? null,
            setAttribute: (k, v) => { attrs[k] = v; }
        },
        createElement: (tag) => ({ tagName: tag.toUpperCase() })
    };
};

describe('supportsDocumentPip', () => {
    it('só aceita navegador com a Document Picture-in-Picture API', () => {
        expect(supportsDocumentPip({ documentPictureInPicture: { requestWindow: () => {} } })).toBe(true);
        expect(supportsDocumentPip({ documentPictureInPicture: {} })).toBe(false);
        expect(supportsDocumentPip({})).toBe(false);
        expect(supportsDocumentPip(undefined)).toBe(false);
    });
});

describe('copyDocumentStyles', () => {
    it('copia links (com endereço completo) e blocos de estilo, e fixa o endereço-base', () => {
        const src = makeDoc({
            head: [
                { tagName: 'LINK', href: 'https://hubdesk.test/assets/index-abc.css' },
                { tagName: 'STYLE', textContent: '.x{color:red}' }
            ]
        });
        const dest = makeDoc();
        copyDocumentStyles(src, dest);
        expect(dest.appended).toEqual([
            { tagName: 'BASE', href: 'https://hubdesk.test/app/' },
            { tagName: 'LINK', rel: 'stylesheet', href: 'https://hubdesk.test/assets/index-abc.css' },
            { tagName: 'STYLE', textContent: '.x{color:red}' }
        ]);
    });
});

describe('syncTheme', () => {
    it('repete o tema, as classes e o esquema de cores', () => {
        const src = makeDoc({ theme: 'dark', className: 'theme-dark dark', colorScheme: 'dark' });
        const dest = makeDoc();
        syncTheme(src, dest);
        expect(dest.documentElement.attrs['data-theme']).toBe('dark');
        expect(dest.body.attrs['data-theme']).toBe('dark');
        expect(dest.documentElement.className).toBe('theme-dark dark');
        expect(dest.documentElement.style.colorScheme).toBe('dark');
    });

    it('sem tema definido só copia classes e esquema de cores', () => {
        const src = makeDoc({ className: 'theme-light', colorScheme: 'light' });
        const dest = makeDoc();
        syncTheme(src, dest);
        expect(dest.documentElement.attrs['data-theme']).toBeUndefined();
        expect(dest.documentElement.className).toBe('theme-light');
    });
});

describe('watchTheme', () => {
    it('reaplica o tema quando o painel muda e para de observar ao fechar', () => {
        let notify;
        const disconnect = vi.fn();
        const observe = vi.fn();
        class FakeObserver {
            constructor(callback) { notify = callback; }
            observe(...args) { observe(...args); }
            disconnect() { disconnect(); }
        }
        const src = makeDoc({ theme: 'light' });
        const dest = makeDoc();
        const stop = watchTheme(src, dest, FakeObserver);
        expect(observe).toHaveBeenCalledWith(src.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });

        src.documentElement.attrs['data-theme'] = 'warm';
        notify();
        expect(dest.documentElement.attrs['data-theme']).toBe('warm');

        stop();
        expect(disconnect).toHaveBeenCalled();
    });

    it('sem MutationObserver devolve uma função vazia', () => {
        expect(() => watchTheme(makeDoc(), makeDoc(), undefined)()).not.toThrow();
    });
});

describe('openChatPip', () => {
    it('pede a janela com o tamanho, copia estilos e tema e zera a margem', async () => {
        const pipDoc = makeDoc();
        const requestWindow = vi.fn(async () => ({ document: pipDoc }));
        const mainDoc = makeDoc({ head: [{ tagName: 'STYLE', textContent: 'a{}' }], theme: 'warm', className: 'theme-warm' });
        mainDoc.body.className = 'font-sans';
        const win = { document: mainDoc, documentPictureInPicture: { requestWindow } };

        const pip = await openChatPip(win, { width: 420, height: 620 });
        expect(requestWindow).toHaveBeenCalledWith({ width: 420, height: 620 });
        expect(pip.document).toBe(pipDoc);
        expect(pipDoc.appended.map(n => n.tagName)).toEqual(['BASE', 'STYLE']);
        expect(pipDoc.documentElement.attrs['data-theme']).toBe('warm');
        expect(pipDoc.body.style.margin).toBe('0');
        expect(pipDoc.body.className).toBe('font-sans');
    });

    it('sem suporte do navegador, recusa com uma mensagem clara', async () => {
        await expect(openChatPip({ document: makeDoc() }, { width: 1, height: 1 })).rejects.toThrow(/não é suportado/);
    });
});

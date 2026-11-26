/**
 * Janela flutuante (Picture-in-Picture) do chat, pela Document Picture-in-Picture API.
 * Ela abre uma janela pequena que fica sempre por cima das outras, até de outros programas, e o React desenha
 * o chat dentro dela. Só existe em navegadores baseados no Chromium (Chrome e Edge 116+); nos demais o botão
 * fica desativado e o chat continua no painel normal.
 *
 * A janela nova começa sem estilos: aqui copiamos as folhas de estilo e o tema (claro, papel ou escuro)
 * e acompanhamos as trocas de tema enquanto ela estiver aberta.
 */

export const supportsDocumentPip = (win = typeof window === 'undefined' ? undefined : window) =>
    Boolean(win && win.documentPictureInPicture && typeof win.documentPictureInPicture.requestWindow === 'function');

const STYLE_SELECTOR = 'link[rel="stylesheet"], style';

/** Copia links e blocos <style> do documento principal para a janela flutuante. */
export const copyDocumentStyles = (srcDoc, destDoc) => {
    const base = destDoc.createElement('base');
    base.href = srcDoc.baseURI; // urls relativas (fontes, imagens) continuam valendo
    destDoc.head.appendChild(base);

    srcDoc.head.querySelectorAll(STYLE_SELECTOR).forEach((node) => {
        if (node.tagName === 'LINK') {
            const link = destDoc.createElement('link');
            link.rel = 'stylesheet';
            link.href = node.href; // já resolvido para endereço completo
            destDoc.head.appendChild(link);
        } else {
            const style = destDoc.createElement('style');
            style.textContent = node.textContent;
            destDoc.head.appendChild(style);
        }
    });
};

/** Repete o tema do painel (data-theme, classes e esquema de cores) na janela flutuante. */
export const syncTheme = (srcDoc, destDoc) => {
    const src = srcDoc.documentElement;
    const dest = destDoc.documentElement;
    const theme = src.getAttribute('data-theme');
    if (theme) {
        dest.setAttribute('data-theme', theme);
        destDoc.body?.setAttribute('data-theme', theme);
    }
    dest.className = src.className;
    dest.style.colorScheme = src.style.colorScheme;
};

/** Acompanha trocas de tema no painel enquanto a janela flutuante existir. Devolve a função que para de observar. */
export const watchTheme = (srcDoc, destDoc, Observer = typeof MutationObserver === 'undefined' ? undefined : MutationObserver) => {
    if (!Observer) return () => {};
    const observer = new Observer(() => syncTheme(srcDoc, destDoc));
    observer.observe(srcDoc.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    return () => observer.disconnect();
};

/**
 * Abre a janela flutuante já com estilos e tema.
 * Precisa ser chamada a partir de um clique (exigência do navegador).
 * @returns {Promise<Window>}
 */
export const openChatPip = async (win, { width, height }) => {
    if (!supportsDocumentPip(win)) throw new Error('Picture-in-Picture não é suportado neste navegador.');
    const pip = await win.documentPictureInPicture.requestWindow({ width, height });
    copyDocumentStyles(win.document, pip.document);
    syncTheme(win.document, pip.document);
    pip.document.body.style.margin = '0';
    pip.document.body.className = win.document.body.className;
    return pip;
};

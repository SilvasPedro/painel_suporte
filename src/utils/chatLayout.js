/**
 * Tamanho do painel do chat (redimensionável pela alça do canto superior esquerdo).
 * O painel fica ancorado no canto inferior direito, então arrastar para a esquerda e para cima aumenta o painel.
 * Funções puras: o componente só liga o ponteiro e o armazenamento a elas.
 */

export const CHAT_SIZE = {
    minW: 352,
    minH: 420,
    defaultW: 416, // 26rem
    defaultH: 576, // 36rem
    marginX: 48,   // folga lateral (botão flutuante e borda da tela)
    marginY: 128,  // folga vertical (botão flutuante e topo da tela)
    step: 24,      // passo das setas do teclado
    storageKey: 'hubdesk_chat_size'
};

// Abaixo disso o chat ocupa a largura da tela e não é redimensionável
export const WIDE_BREAKPOINT = 640;

// Tamanho inicial da janela flutuante (Picture-in-Picture)
export const PIP_SIZE = { width: 420, height: 620 };

const toNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Maior tamanho que cabe na tela (nunca menor que o mínimo). */
export const maxChatSize = (viewport) => ({
    w: Math.max(CHAT_SIZE.minW, toNumber(viewport?.w, CHAT_SIZE.defaultW) - CHAT_SIZE.marginX),
    h: Math.max(CHAT_SIZE.minH, toNumber(viewport?.h, CHAT_SIZE.defaultH) - CHAT_SIZE.marginY)
});

/** Mantém o tamanho entre o mínimo e o que cabe na tela. */
export const clampChatSize = (size, viewport) => {
    const max = maxChatSize(viewport);
    return {
        w: Math.round(clamp(toNumber(size?.w, CHAT_SIZE.defaultW), CHAT_SIZE.minW, max.w)),
        h: Math.round(clamp(toNumber(size?.h, CHAT_SIZE.defaultH), CHAT_SIZE.minH, max.h))
    };
};

export const defaultChatSize = (viewport) => clampChatSize({ w: CHAT_SIZE.defaultW, h: CHAT_SIZE.defaultH }, viewport);

/**
 * Novo tamanho durante o arrasto da alça do canto superior esquerdo.
 * @param {{ w: number, h: number, x: number, y: number }} start tamanho e posição do ponteiro ao começar
 * @param {{ x: number, y: number }} pointer posição atual do ponteiro
 */
export const resizeFromCorner = (start, pointer, viewport) => clampChatSize({
    w: start.w + (start.x - pointer.x),
    h: start.h + (start.y - pointer.y)
}, viewport);

/** Tamanho pelo teclado: setas para a esquerda/cima aumentam; para a direita/baixo diminuem. */
export const resizeByKey = (size, key, viewport, step = CHAT_SIZE.step) => {
    const delta = { ArrowLeft: { w: step, h: 0 }, ArrowRight: { w: -step, h: 0 }, ArrowUp: { w: 0, h: step }, ArrowDown: { w: 0, h: -step } }[key];
    return delta ? clampChatSize({ w: size.w + delta.w, h: size.h + delta.h }, viewport) : size;
};

/** Lê o tamanho salvo; valor ausente, quebrado ou fora da tela volta ao padrão/limite. */
export const loadChatSize = (storage, viewport) => {
    try {
        const saved = JSON.parse(storage?.getItem(CHAT_SIZE.storageKey) || 'null');
        if (saved && Number.isFinite(Number(saved.w)) && Number.isFinite(Number(saved.h))) return clampChatSize(saved, viewport);
    } catch {
        // armazenamento indisponível ou JSON quebrado: usa o padrão
    }
    return defaultChatSize(viewport);
};

export const saveChatSize = (storage, size) => {
    try {
        storage?.setItem(CHAT_SIZE.storageKey, JSON.stringify({ w: size.w, h: size.h }));
    } catch {
        // sem armazenamento: o tamanho vale só nesta sessão
    }
};

export const clearChatSize = (storage) => {
    try {
        storage?.removeItem(CHAT_SIZE.storageKey);
    } catch {
        // nada a limpar
    }
};

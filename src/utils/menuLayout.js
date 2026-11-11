/**
 * Personalização do menu lateral por usuário: ordem das seções, nome das seções e posição dos itens.
 *
 * O menu padrão (seções, ícones e itens) vem do código. A personalização guarda só o que o usuário mudou:
 *   { order: [idDaSeção], titles: { idDaSeção: 'Nome' }, items: { idDaSeção: [idDoItem] } }
 * Por isso, telas novas aparecem sozinhas na seção padrão delas e seções/itens que deixarem de existir são ignorados.
 */

export const MAX_SECTION_TITLE = 28;
export const MENU_LAYOUT_VERSION = 1;

/** Nome de seção de uma linha, sem caracteres de controle, com tamanho limitado. */
export const cleanSectionTitle = (value) => {
    const flat = Array.from(String(value ?? '')).map(ch => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch)).join('');
    return flat.replace(/\s+/g, ' ').trim().slice(0, MAX_SECTION_TITLE).trim();
};

const isPlainObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const stringList = (v) => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x) : []);

/** Aceita objeto ou texto JSON e devolve sempre uma personalização válida (vazia se inválida). */
export const normalizeLayout = (raw) => {
    let data = raw;
    if (typeof raw === 'string') {
        try { data = JSON.parse(raw); } catch { data = null; }
    }
    if (!isPlainObject(data)) return { order: [], titles: {}, items: {} };

    const titles = {};
    if (isPlainObject(data.titles)) {
        Object.entries(data.titles).forEach(([id, title]) => {
            const clean = cleanSectionTitle(title);
            if (clean) titles[id] = clean;
        });
    }
    const items = {};
    if (isPlainObject(data.items)) {
        Object.entries(data.items).forEach(([id, list]) => { items[id] = stringList(list); });
    }
    return { order: stringList(data.order), titles, items };
};

/**
 * Menu "rascunho" (sem ícones): [{ id, title, items: [idDoItem] }], combinando o padrão com a personalização.
 * @param {Array<{id:string,title:string,items:Array<{id:string}>}>} defaults
 */
export const buildDraft = (defaults, layout) => {
    const L = normalizeLayout(layout);
    const sectionIds = defaults.map(s => s.id);
    const knownItems = new Set(defaults.flatMap(s => s.items.map(i => i.id)));
    const home = {};
    defaults.forEach(s => s.items.forEach(i => { home[i.id] = s.id; }));

    const order = [...new Set(L.order.filter(id => sectionIds.includes(id)))];
    sectionIds.forEach(id => { if (!order.includes(id)) order.push(id); });

    const placed = new Set();
    const draft = order.map(id => {
        const items = (L.items[id] || []).filter(itemId => knownItems.has(itemId) && !placed.has(itemId));
        items.forEach(itemId => placed.add(itemId));
        const base = defaults.find(s => s.id === id);
        return { id, title: L.titles[id] || base.title, items };
    });

    // Itens que o usuário nunca posicionou (ex.: telas novas) vão para a seção padrão deles
    defaults.forEach(s => s.items.forEach(i => {
        if (!placed.has(i.id)) {
            draft.find(d => d.id === home[i.id]).items.push(i.id);
            placed.add(i.id);
        }
    }));
    return draft;
};

/** Menu final para a barra lateral: o padrão (ícones, rótulos) reorganizado pela personalização. */
export const applyMenuLayout = (defaults, layout) => {
    const itemById = {};
    defaults.forEach(s => s.items.forEach(i => { itemById[i.id] = i; }));
    return buildDraft(defaults, layout).map(section => {
        const base = defaults.find(s => s.id === section.id);
        return { ...base, title: section.title, items: section.items.map(id => itemById[id]) };
    });
};

/** Converte o rascunho editado em personalização para gravar. */
export const draftToLayout = (draft) => ({
    v: MENU_LAYOUT_VERSION,
    order: draft.map(s => s.id),
    titles: Object.fromEntries(draft.map(s => [s.id, cleanSectionTitle(s.title)]).filter(([, t]) => t)),
    items: Object.fromEntries(draft.map(s => [s.id, [...s.items]]))
});

/** True quando o resultado difere do menu padrão. */
export const isCustomLayout = (defaults, layout) => {
    const current = JSON.stringify(buildDraft(defaults, layout));
    const standard = JSON.stringify(buildDraft(defaults, null));
    return current !== standard;
};

const swap = (list, from, to) => {
    if (to < 0 || to >= list.length) return list;
    const next = [...list];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
};

/** Sobe (-1) ou desce (+1) uma seção. */
export const moveSection = (draft, sectionId, direction) => {
    const index = draft.findIndex(s => s.id === sectionId);
    return index < 0 ? draft : swap(draft, index, index + direction);
};

/**
 * Sobe (-1) ou desce (+1) um item dentro da própria seção.
 * `isVisible` permite pular itens que o usuário não enxerga (sem permissão), para a seta sempre ter efeito visível.
 */
export const moveItem = (draft, itemId, direction, isVisible = () => true) => draft.map(section => {
    const index = section.items.indexOf(itemId);
    if (index < 0) return section;
    let target = index + direction;
    while (target >= 0 && target < section.items.length && !isVisible(section.items[target])) target += direction;
    return { ...section, items: swap(section.items, index, target) };
});

/** Move um item para o fim de outra seção. */
export const moveItemToSection = (draft, itemId, targetSectionId) => {
    if (!draft.some(s => s.id === targetSectionId)) return draft;
    return draft.map(section => {
        const without = section.items.filter(id => id !== itemId);
        return section.id === targetSectionId ? { ...section, items: [...without, itemId] } : { ...section, items: without };
    });
};

export const renameSection = (draft, sectionId, title) =>
    draft.map(section => (section.id === sectionId ? { ...section, title: String(title ?? '').slice(0, MAX_SECTION_TITLE) } : section));

/** Id da seção que contém o item no menu aplicado (ou null). */
export const findSectionOfItem = (menus, itemId) => menus.find(m => m.items.some(i => i.id === itemId))?.id ?? null;

export const getMenuLayoutStorageKey = (userId) => `hubdesk_menu_layout_${userId}`;

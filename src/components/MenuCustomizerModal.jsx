import React, { useState, useMemo } from 'react';
import { ArrowUp, ArrowDown, RotateCcw, Save, Info } from 'lucide-react';
import { Modal, Button } from './ui';
import {
    buildDraft, draftToLayout, isCustomLayout, moveSection, moveItem, moveItemToSection,
    renameSection, cleanSectionTitle, MAX_SECTION_TITLE
} from '../utils/menuLayout';

const arrowCls = 'p-1.5 rounded-lg text-secondary-hub hover:text-primary-hub hover:bg-subtle disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors';

/**
 * Personalização do menu lateral: nome e ordem das seções e posição dos itens (inclusive entre seções).
 * Remontado a cada abertura (o pai usa `key`), então o rascunho inicial vem das props.
 * @param defaults menu padrão com ícones: [{ id, title, icon, items: [{ id, label, icon }] }]
 * @param canViewItem retorna se o usuário enxerga a tela (itens sem permissão não são listados)
 * @param onSave recebe a personalização, ou null quando voltou ao padrão
 */
export default function MenuCustomizerModal({ isOpen, onClose, defaults, layout, canViewItem, onSave }) {
    const [draft, setDraft] = useState(() => buildDraft(defaults, layout));

    const itemById = useMemo(() => {
        const map = {};
        defaults.forEach(s => s.items.forEach(i => { map[i.id] = i; }));
        return map;
    }, [defaults]);

    const defaultTitle = (sectionId) => defaults.find(s => s.id === sectionId)?.title || '';

    const handleSave = () => {
        const finalDraft = draft.map(s => ({ ...s, title: cleanSectionTitle(s.title) || defaultTitle(s.id) }));
        const next = draftToLayout(finalDraft);
        onSave(isCustomLayout(defaults, next) ? next : null);
    };

    const handleRestore = () => setDraft(buildDraft(defaults, null));
    const isStandard = !isCustomLayout(defaults, draftToLayout(draft));

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            title="Personalizar menu"
            description="Renomeie as seções, mude a ordem delas e escolha a posição de cada tela. A personalização vale só para você."
            footer={(
                <>
                    <Button variant="ghost" icon={RotateCcw} onClick={handleRestore} disabled={isStandard} className="mr-auto">Restaurar padrão</Button>
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button icon={Save} onClick={handleSave}>Salvar menu</Button>
                </>
            )}
        >
            <div className="space-y-4">
                <p className="flex items-start gap-2 text-[11px] text-muted-hub leading-relaxed">
                    <Info className="w-3.5 h-3.5 mt-px shrink-0" />
                    Use as setas para subir e descer. Para levar uma tela a outra seção, escolha o destino na lista ao lado do nome dela.
                </p>

                {draft.map((section, sIndex) => {
                    const visibleItems = section.items.filter(id => canViewItem(id));
                    return (
                        <section key={section.id} className="rounded-2xl border border-subtle bg-subtle/30 p-3">
                            <div className="flex items-center gap-2">
                                <input
                                    aria-label={`Nome da seção ${defaultTitle(section.id)}`}
                                    value={section.title}
                                    maxLength={MAX_SECTION_TITLE}
                                    placeholder={defaultTitle(section.id)}
                                    onChange={e => setDraft(d => renameSection(d, section.id, e.target.value))}
                                    className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-surface border border-subtle text-sm font-bold text-primary-hub focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                                />
                                <button type="button" aria-label="Subir seção" title="Subir seção" className={arrowCls} disabled={sIndex === 0} onClick={() => setDraft(d => moveSection(d, section.id, -1))}><ArrowUp className="w-4 h-4" /></button>
                                <button type="button" aria-label="Descer seção" title="Descer seção" className={arrowCls} disabled={sIndex === draft.length - 1} onClick={() => setDraft(d => moveSection(d, section.id, 1))}><ArrowDown className="w-4 h-4" /></button>
                            </div>

                            <ul className="mt-2 space-y-1">
                                {visibleItems.length === 0 && (
                                    <li className="px-3 py-2 text-[11px] text-muted-hub">Nenhuma tela nesta seção. Ela fica oculta no menu até receber uma.</li>
                                )}
                                {visibleItems.map((itemId, iIndex) => {
                                    const item = itemById[itemId];
                                    if (!item) return null;
                                    const Icon = item.icon;
                                    return (
                                        <li key={itemId} className="flex items-center gap-2 rounded-xl bg-surface border border-subtle px-3 py-1.5">
                                            <Icon className="w-4 h-4 text-secondary-hub shrink-0" />
                                            <span className="flex-1 min-w-0 truncate text-xs font-semibold text-primary-hub">{item.label}</span>
                                            <select
                                                aria-label={`Mover ${item.label} para outra seção`}
                                                value={section.id}
                                                onChange={e => setDraft(d => moveItemToSection(d, itemId, e.target.value))}
                                                className="max-w-[9.5rem] h-7 px-1.5 rounded-lg bg-surface border border-subtle text-[11px] text-secondary-hub focus:outline-none cursor-pointer"
                                            >
                                                {draft.map(s => <option key={s.id} value={s.id}>{s.title || defaultTitle(s.id)}</option>)}
                                            </select>
                                            <button type="button" aria-label={`Subir ${item.label}`} title="Subir" className={arrowCls} disabled={iIndex === 0} onClick={() => setDraft(d => moveItem(d, itemId, -1, canViewItem))}><ArrowUp className="w-3.5 h-3.5" /></button>
                                            <button type="button" aria-label={`Descer ${item.label}`} title="Descer" className={arrowCls} disabled={iIndex === visibleItems.length - 1} onClick={() => setDraft(d => moveItem(d, itemId, 1, canViewItem))}><ArrowDown className="w-3.5 h-3.5" /></button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    );
                })}
            </div>
        </Modal>
    );
}

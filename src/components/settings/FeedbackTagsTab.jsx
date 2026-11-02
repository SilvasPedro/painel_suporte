import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Edit2, Check, X, RotateCcw, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { subscribeFeedbackTags, saveFeedbackTags, DEFAULT_FEEDBACK_TAGS } from '../../services/feedbackTags';
import { useNotification } from '../../context/NotificationContext';
import { usePermissions } from '../../context/PermissionsContext';

export const FeedbackTagsTab = () => {
    const { showToast } = useNotification();
    const { canEdit } = usePermissions();
    const isEditable = canEdit('settings');

    const [tags, setTags] = useState(DEFAULT_FEEDBACK_TAGS);
    const [loading, setLoading] = useState(true);
    const [newTagInput, setNewTagInput] = useState('');
    const [editingIndex, setEditingIndex] = useState(null);
    const [editingValue, setEditingValue] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const unsubscribe = subscribeFeedbackTags((freshTags) => {
            setTags(freshTags);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleAddTag = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const trimmed = newTagInput.trim();
        if (!trimmed) return;

        if (tags.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
            showToast('Esta tag já existe na lista.', 'error');
            return;
        }

        const updated = [...tags, trimmed];
        setSaving(true);
        try {
            await saveFeedbackTags(updated);
            setNewTagInput('');
            showToast(`Tag "${trimmed}" adicionada com sucesso!`, 'success');
        } catch {
            showToast('Erro ao salvar nova tag.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleStartEdit = (index, currentVal) => {
        setEditingIndex(index);
        setEditingValue(currentVal);
    };

    const handleSaveEdit = async (index) => {
        const trimmed = editingValue.trim();
        if (!trimmed) return;

        const updated = [...tags];
        updated[index] = trimmed;

        setSaving(true);
        try {
            await saveFeedbackTags(updated);
            setEditingIndex(null);
            showToast('Tag atualizada com sucesso!', 'success');
        } catch {
            showToast('Erro ao atualizar tag.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTag = async (tagToDelete) => {
        if (!window.confirm(`Deseja realmente excluir a tag "${tagToDelete}"?`)) return;

        const updated = tags.filter(t => t !== tagToDelete);
        setSaving(true);
        try {
            await saveFeedbackTags(updated);
            showToast(`Tag "${tagToDelete}" removida.`, 'success');
        } catch {
            showToast('Erro ao remover tag.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleResetDefaults = async () => {
        if (!window.confirm('Restaurar as tags padrão do sistema (Processo, Agilidade, Conhecimento, Qualidade, Cooperação, Pontualidade, Comportamento)?')) return;

        setSaving(true);
        try {
            await saveFeedbackTags(DEFAULT_FEEDBACK_TAGS);
            showToast('Tags padrão restauradas com sucesso!', 'success');
        } catch {
            showToast('Erro ao restaurar tags.', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="w-full min-w-0 space-y-6">
            {/* Card Principal de Gerenciamento de Tags */}
            <div className="w-full bg-surface rounded-3xl border border-subtle shadow-xs p-6 lg:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-subtle pb-5">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                Gestão de Pessoas
                            </span>
                            <span className="text-xs text-muted-hub">&bull;</span>
                            <span className="text-xs font-semibold text-secondary-hub">Taxonomia de Feedbacks</span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-bold text-primary-hub mt-1 flex items-center gap-2">
                            <Tag className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                            Categorias & Tags de Feedbacks
                        </h2>
                        <p className="text-xs sm:text-sm text-secondary-hub mt-0.5 leading-relaxed">
                            Tags disponíveis para os gestores e supervisores categorizarem os alinhamentos e auditorias da equipe operacional.
                        </p>
                    </div>

                    {isEditable && (
                        <button
                            type="button"
                            onClick={handleResetDefaults}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-subtle bg-subtle text-xs font-semibold text-secondary-hub hover:text-primary-hub hover:bg-surface transition-colors cursor-pointer self-start sm:self-auto active:scale-95 shadow-xs"
                            title="Restaurar lista de tags padrão"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-muted-hub" />
                            <span>Restaurar Padrão</span>
                        </button>
                    )}
                </div>

                {/* Formulário de Adicionar Nova Tag */}
                {isEditable ? (
                    <form onSubmit={handleAddTag} className="flex flex-col sm:flex-row gap-2.5">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Digite o nome de uma nova tag (ex: Empatia, Comunicação, Assertividade, Resolução Rápida)..."
                                value={newTagInput}
                                onChange={(e) => setNewTagInput(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-subtle border border-subtle rounded-xl text-xs sm:text-sm text-primary-hub placeholder:text-muted-hub focus:bg-surface focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all font-medium"
                            />
                            <Tag className="w-4 h-4 text-muted-hub absolute left-3.5 top-3" />
                        </div>
                        <button
                            type="submit"
                            disabled={saving || !newTagInput.trim()}
                            className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-rose-950/20 flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            <span>Adicionar Tag</span>
                        </button>
                    </form>
                ) : (
                    <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/25 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>Seu usuário possui permissão apenas de leitura das configurações de tags.</span>
                    </div>
                )}

                {/* Grid de Tags Ativas (100% Width) */}
                {loading ? (
                    <div className="p-8 text-center text-muted-hub flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm font-medium">Carregando tags de feedback...</span>
                    </div>
                ) : tags.length === 0 ? (
                    <div className="p-8 text-center bg-subtle/50 rounded-2xl border border-dashed border-subtle text-secondary-hub">
                        <Tag className="w-8 h-8 text-muted-hub mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium text-primary-hub">Nenhuma tag cadastrada.</p>
                        <p className="text-xs text-secondary-hub mt-1">Clique em &quot;Restaurar Padrão&quot; ou crie tags personalizadas acima.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-semibold text-secondary-hub">
                            <span>Tags Cadastradas ({tags.length})</span>
                            <span className="text-[11px] text-muted-hub">Clique no lápis para renomear ou lixeira para remover</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {tags.map((tag, index) => {
                                const isEditing = editingIndex === index;

                                return (
                                    <div
                                        key={tag}
                                        className="p-3.5 bg-subtle/60 rounded-2xl border border-subtle flex items-center justify-between gap-2 hover:border-border-hub transition-all group"
                                    >
                                        {isEditing ? (
                                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                                <input
                                                    type="text"
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveEdit(index);
                                                        if (e.key === 'Escape') setEditingIndex(null);
                                                    }}
                                                    autoFocus
                                                    className="w-full px-2.5 py-1 text-xs bg-surface border border-rose-500 rounded-lg outline-none font-bold text-primary-hub"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveEdit(index)}
                                                    className="p-1 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg cursor-pointer"
                                                    title="Confirmar"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingIndex(null)}
                                                    className="p-1 text-muted-hub hover:bg-subtle rounded-lg cursor-pointer"
                                                    title="Cancelar"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                                    <span className="text-xs font-bold text-primary-hub truncate">{tag}</span>
                                                </div>

                                                {isEditable && (
                                                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStartEdit(index, tag)}
                                                            className="p-1.5 text-muted-hub hover:text-blue-500 hover:bg-subtle rounded-lg transition-colors cursor-pointer"
                                                            title="Editar nome da tag"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteTag(tag)}
                                                            className="p-1.5 text-muted-hub hover:text-rose-500 hover:bg-subtle rounded-lg transition-colors cursor-pointer"
                                                            title="Excluir tag"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Dica de Boas Práticas */}
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-3 text-secondary-hub">
                <Sparkles className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed space-y-1">
                    <strong className="block text-primary-hub font-bold">Como as Tags Funcionam nos Feedbacks:</strong>
                    <p>
                        Ao lançar um feedback (Elogio, Orientação ou Ponto de Melhoria), o gestor pode selecionar uma ou mais tags desta lista.
                        Elas facilitam a visualização no histórico do colaborador e na gestão de auditorias, permitindo mapear competências como <em>Qualidade</em>, <em>Processo</em> e <em>Agilidade</em>.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default FeedbackTagsTab;

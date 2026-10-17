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
            setEditingValue('');
            showToast('Tag renomeada com sucesso!', 'success');
        } catch {
            showToast('Erro ao atualizar tag.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTag = async (tagToDelete) => {
        if (!window.confirm(`Deseja remover a tag "${tagToDelete}"?`)) return;

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
        <div className="space-y-6 max-w-4xl">
            {/* Card Principal de Gerenciamento de Tags */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                    <div>
                        <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                            <Tag className="w-5 h-5 text-red-600" />
                            Categorias & Tags de Feedbacks
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Tags disponíveis para os gestores e supervisores categorizarem feedbacks lançados para a equipe.
                        </p>
                    </div>

                    {isEditable && (
                        <button
                            type="button"
                            onClick={handleResetDefaults}
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors cursor-pointer self-start sm:self-auto"
                            title="Restaurar lista de tags padrão"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
                            <span>Restaurar Padrão</span>
                        </button>
                    )}
                </div>

                {/* Formulário de Adicionar Nova Tag */}
                {isEditable ? (
                    <form onSubmit={handleAddTag} className="flex gap-2">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                placeholder="Digite o nome de uma nova tag (ex: Empatia, Comunicação, Assertividade)..."
                                value={newTagInput}
                                onChange={(e) => setNewTagInput(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-red-600 outline-none transition-all"
                            />
                            <Tag className="w-4 h-4 text-gray-400 absolute left-3 top-3.5" />
                        </div>
                        <button
                            type="submit"
                            disabled={saving || !newTagInput.trim()}
                            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            <span>Adicionar Tag</span>
                        </button>
                    </form>
                ) : (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Seu usuário possui permissão apenas de leitura das configurações de tags.</span>
                    </div>
                )}

                {/* Grid / Lista de Tags Ativas */}
                {loading ? (
                    <div className="p-8 text-center text-gray-400 flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Carregando tags de feedback...</span>
                    </div>
                ) : tags.length === 0 ? (
                    <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200 text-gray-500">
                        <Tag className="w-8 h-8 text-gray-400 mx-auto mb-2 opacity-50" />
                        <p className="text-sm font-medium">Nenhuma tag cadastrada.</p>
                        <p className="text-xs text-gray-400 mt-1">Clique em &quot;Restaurar Padrão&quot; ou crie tags personalizadas acima.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs font-semibold text-gray-500">
                            <span>Tags Cadastradas ({tags.length})</span>
                            <span className="text-[11px] text-gray-400">Clique no ícone de lápis para editar ou lixeira para remover</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {tags.map((tag, index) => {
                                const isEditing = editingIndex === index;

                                return (
                                    <div
                                        key={tag}
                                        className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between gap-2 hover:border-gray-300 transition-all group"
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
                                                    className="w-full px-2 py-1 text-xs bg-white border border-red-500 rounded-lg outline-none font-bold"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveEdit(index)}
                                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                                                    title="Confirmar"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingIndex(null)}
                                                    className="p-1 text-gray-400 hover:bg-gray-200 rounded cursor-pointer"
                                                    title="Cancelar"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                                    <span className="text-xs font-bold text-gray-800 truncate">{tag}</span>
                                                </div>

                                                {isEditable && (
                                                    <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleStartEdit(index, tag)}
                                                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                                                            title="Editar nome da tag"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteTag(tag)}
                                                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
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
            <div className="p-4 rounded-2xl bg-red-50/70 border border-red-100 flex items-start gap-3 text-red-950">
                <Sparkles className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed space-y-1">
                    <strong className="block text-red-900 font-bold">Como as Tags Funcionam nos Feedbacks:</strong>
                    <p className="text-red-900/90">
                        Ao lançar um feedback (Elogio, Orientação ou Ponto de Melhoria), o gestor pode selecionar uma ou mais tags desta lista.
                        Elas facilitam a visualização no histórico do colaborador e na gestão de auditorias, permitindo mapear competências como <em>Qualidade</em>, <em>Processo</em> e <em>Agilidade</em>.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default FeedbackTagsTab;

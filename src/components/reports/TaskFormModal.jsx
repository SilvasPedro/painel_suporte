import React, { useState, useEffect, useRef } from 'react';
import { 
    X, Check, AlertTriangle, UserCheck, Eye, Edit3, Plus, 
    Table, Bold, Italic, List, ListOrdered, Code, Link2, 
    Quote, Calendar, Tag, Layers, Flag, Building
} from 'lucide-react';
import { 
    ERROR_DEPARTMENTS,
    TASK_PRIORITIES,
    DEFAULT_TAG_SUGGESTIONS,
    getTaskOriginDepartment,
    getTaskAssignee,
    getTaskWatchers,
    canUserAssignResponsible,
    canUserManageWatchers
} from '../../types/request.types';
import SafeMarkdown from './SafeMarkdown';

/**
 * @typedef {import('../../types/request.types').Task} Task
 * @typedef {import('../../types/request.types').Watcher} Watcher
 * @typedef {import('../../types/request.types').TaskAssignee} TaskAssignee
 */

/**
 * TaskFormModal (Hubdesk v3.10.1)
 * Modal moderno de Criação e Edição de Ordens de Serviço (O.S. / Tarefas)
 * Layout em Grid limpo, acessibilidade por teclado, temas Claro/Escuro/Morno,
 * editor rico Markdown (GFM) com sanitização XSS e omissão estrita de anexos/estimativas.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Se o modal está aberto
 * @param {() => void} props.onClose - Função para fechar o modal
 * @param {(payload: Partial<Task>) => void} props.onSave - Callback com os dados da O.S.
 * @param {Task|null} [props.editingReport] - Tarefa em edição ou null para nova
 * @param {boolean} [props.saving] - Indicador de carregamento ao salvar
 * @param {Object|null} [props.user] - Usuário logado
 * @param {Array<Object>} [props.collaborators] - Lista de colaboradores do sistema
 */
export default function TaskFormModal({
    isOpen,
    onClose,
    onSave,
    editingReport = null,
    saving = false,
    user = null,
    collaborators = []
}) {
    // 1. Referências de Foco e Textarea
    const titleInputRef = useRef(null);
    const textareaRef = useRef(null);

    // 2. Valores Iniciais
    const initialAssignee = getTaskAssignee(editingReport);
    const initialDept = getTaskOriginDepartment(editingReport) || editingReport?.department || '';
    const initialDueDate = editingReport?.due_date || editingReport?.dueDate || editingReport?.date || new Date().toISOString().split('T')[0];
    const initialTags = Array.isArray(editingReport?.tags)
        ? editingReport.tags
        : Array.isArray(editingReport?.metadata?.tags)
        ? editingReport.metadata.tags
        : [];

    // 3. Estados dos Campos da O.S.
    const [title, setTitle] = useState(editingReport?.title || '');
    const [originDepartment, setOriginDepartment] = useState(initialDept);
    const [selectedAssigneeId, setSelectedAssigneeId] = useState(initialAssignee?.id || '');
    const [priority, setPriority] = useState(editingReport?.priority || 'Normal');
    const [dueDate, setDueDate] = useState(initialDueDate);
    const [watchersList, setWatchersList] = useState(() => getTaskWatchers(editingReport));
    const [watcherToAddId, setWatcherToAddId] = useState('');
    const [tags, setTags] = useState(initialTags);
    const [tagInput, setTagInput] = useState('');
    const [description, setDescription] = useState(editingReport?.description || '');
    const [previewMarkdown, setPreviewMarkdown] = useState(false);

    // 4. Estados de Validação e Erros
    const [formErrors, setFormErrors] = useState({});

    // 5. Permissões
    const canAssign = canUserAssignResponsible(editingReport, user);
    const canManageWatchers = canUserManageWatchers(editingReport, user);

    // Foco inicial no campo de Título ao abrir o modal
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                if (titleInputRef.current) {
                    titleInputRef.current.focus();
                }
            }, 60);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Fechar com a tecla Escape
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // Inserção inteligente de sintaxe Markdown no textarea
    const insertMarkdownSyntax = (before, after = '', defaultPlaceholder = '') => {
        const textarea = textareaRef.current;
        if (!textarea) {
            setDescription((prev) => `${prev}${before}${defaultPlaceholder}${after}`);
            setFormErrors((prev) => ({ ...prev, description: '' }));
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentVal = textarea.value;
        const selected = currentVal.substring(start, end) || defaultPlaceholder;
        const replacement = `${before}${selected}${after}`;
        const nextVal = currentVal.substring(0, start) + replacement + currentVal.substring(end);

        setDescription(nextVal);
        setFormErrors((prev) => ({ ...prev, description: '' }));

        setTimeout(() => {
            textarea.focus();
            const cursorStart = start + before.length;
            const cursorEnd = cursorStart + selected.length;
            textarea.setSelectionRange(cursorStart, cursorEnd);
        }, 0);
    };

    const handleInsertTable = () => {
        const tableTemplate = `\n| Item / Recurso | Detalhe / Parâmetro | Status |\n| :--- | :--- | :--- |\n| Exemplo 1 | Configuração OLT | Ativo |\n| Exemplo 2 | Teste de Enlace | Pendente |\n`;
        insertMarkdownSyntax(tableTemplate, '', '');
    };

    // Gerenciamento de Tags
    const handleAddTag = (rawTag) => {
        const clean = String(rawTag || tagInput)
            .replace(/^[#\s]+/, '')
            .trim();
        if (!clean) return;
        const exists = tags.some((t) => t.toLowerCase() === clean.toLowerCase());
        if (!exists) {
            setTags((prev) => [...prev, clean]);
        }
        setTagInput('');
    };

    const handleRemoveTag = (tagToRemove) => {
        setTags((prev) => prev.filter((t) => t !== tagToRemove));
    };

    const handleTagKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            handleAddTag();
        }
    };

    // Gerenciamento de Visualizadores (Watchers)
    const handleAddWatcher = (collabId) => {
        const targetId = collabId || watcherToAddId;
        if (!targetId) return;
        const found = collaborators.find((c) => String(c.id || c.uid) === String(targetId));
        if (!found) return;
        const fId = String(found.id || found.uid || found.email || found.name).trim();
        const exists = watchersList.some(
            (w) =>
                String(w.id).toLowerCase() === fId.toLowerCase() ||
                (found.email && String(w.email || '').toLowerCase() === String(found.email).toLowerCase()) ||
                String(w.name || '').toLowerCase() === String(found.name || '').toLowerCase()
        );
        if (!exists) {
            setWatchersList((prev) => [
                ...prev,
                {
                    id: fId,
                    uid: String(found.uid || fId),
                    name: String(found.name || found.email || fId),
                    email: String(found.email || ''),
                    role: String(found.role || 'Colaborador'),
                    addedAt: new Date().toISOString(),
                    addedBy: user?.name || user?.email || 'Usuário'
                }
            ]);
        }
        setWatcherToAddId('');
    };

    const handleRemoveWatcher = (watcherId) => {
        setWatchersList((prev) => prev.filter((w) => String(w.id) !== String(watcherId)));
    };

    // Submissão e Validação do Formulário
    const handleSubmit = (e) => {
        e.preventDefault();

        const cleanTitle = title.trim();
        const cleanDesc = description.trim();
        const cleanDept = originDepartment.trim();
        const cleanDueDate = dueDate.trim();

        const errors = {};
        if (!cleanTitle) {
            errors.title = 'O título da O.S. é obrigatório.';
        } else if (cleanTitle.length < 3) {
            errors.title = 'O título deve ter no mínimo 3 caracteres.';
        }

        if (!cleanDept) {
            errors.department = 'Selecione o departamento de origem.';
        }

        if (!cleanDueDate) {
            errors.due_date = 'Informe a data de entrega / prazo da O.S.';
        }

        if (!cleanDesc) {
            errors.description = 'A descrição detalhada da O.S. é obrigatória.';
        } else if (cleanDesc.length < 5) {
            errors.description = 'A descrição deve ter no mínimo 5 caracteres.';
        }

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            if (errors.title && titleInputRef.current) {
                titleInputRef.current.focus();
            }
            return;
        }

        // Resolução do colaborador responsável
        let resolvedAssignee = null;
        if (selectedAssigneeId) {
            const matchedCollab = collaborators.find(
                (c) => String(c.id || c.uid) === String(selectedAssigneeId)
            );
            if (matchedCollab) {
                const aId = String(matchedCollab.id || matchedCollab.uid || matchedCollab.email || matchedCollab.name).trim();
                resolvedAssignee = {
                    id: aId,
                    uid: String(matchedCollab.uid || aId),
                    name: String(matchedCollab.name || matchedCollab.email || aId),
                    email: String(matchedCollab.email || ''),
                    role: String(matchedCollab.role || 'Colaborador'),
                    assignedAt: new Date().toISOString(),
                    assignedBy: user?.name || user?.email || 'Liderança'
                };
            } else if (initialAssignee && String(initialAssignee.id) === String(selectedAssigneeId)) {
                resolvedAssignee = initialAssignee;
            }
        }

        // Payload limpo e compatível (SEM anexos e SEM estimativa)
        const payload = {
            title: cleanTitle,
            description: cleanDesc,
            originDepartment: cleanDept,
            department: cleanDept,
            priority,
            due_date: cleanDueDate,
            date: cleanDueDate,
            tags,
            assignedTo: resolvedAssignee,
            assigned_to: resolvedAssignee ? resolvedAssignee.id : null,
            assignedToId: resolvedAssignee ? resolvedAssignee.id : null,
            assignedToName: resolvedAssignee ? resolvedAssignee.name : null,
            assignedToEmail: resolvedAssignee ? resolvedAssignee.email : null,
            watchers: watchersList,
            watcherIds: watchersList.map((w) => w.id),
            category: editingReport?.category || 'service_order',
            type: editingReport?.type || 'Ordem de Serviço',
            metadata: {
                ...(editingReport?.metadata || {}),
                originDepartment: cleanDept,
                department: cleanDept,
                tags,
                due_date: cleanDueDate
            },
            updatedAt: new Date()
        };

        onSave(payload);
    };

    return (
        <div className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-3 sm:p-4 z-[90] backdrop-blur-xs overflow-y-auto">
            <div 
                role="dialog"
                aria-modal="true"
                aria-labelledby="task-form-modal-title"
                className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 animate-in fade-in zoom-in-95 duration-200"
            >
                {/* 1. CABEÇALHO DESTACADO */}
                <div className="px-6 py-4 bg-slate-900 dark:bg-zinc-950 text-white flex justify-between items-center shrink-0 border-b border-slate-800 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-800 dark:bg-zinc-900 border border-slate-700 dark:border-zinc-800 text-indigo-400">
                            <Layers className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 id="task-form-modal-title" className="text-base font-bold text-white flex items-center gap-2">
                                {editingReport ? 'Editar O.S.' : 'Nova Tarefa / O.S.'}
                                {editingReport && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-md font-mono bg-slate-800 border border-slate-700 text-slate-300">
                                        #{String(editingReport.id).slice(0, 8).toUpperCase()}
                                    </span>
                                )}
                            </h3>
                            <p className="text-xs text-slate-400">
                                Central de O.S. e Demandas · Hubdesk
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 hover:bg-slate-800 dark:hover:bg-zinc-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="Fechar (Esc)"
                        aria-label="Fechar modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 2. CORPO DO FORMULÁRIO (SCROLLABLE) */}
                <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-slate-50/70 dark:bg-zinc-900/60 space-y-5">
                    <form id="taskFormModalForm" onSubmit={handleSubmit} className="space-y-5" noValidate>
                        
                        {/* 2.1 METADADOS EM GRID */}
                        <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-4">
                            
                            {/* CAMPO DE TÍTULO (LARGURA TOTAL COM FOCO INICIAL) */}
                            <div>
                                <label htmlFor="task-title" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                                    Título da Tarefa / O.S. <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    id="task-title"
                                    ref={titleInputRef}
                                    type="text"
                                    value={title}
                                    onChange={(e) => {
                                        setTitle(e.target.value);
                                        setFormErrors((prev) => ({ ...prev, title: '' }));
                                    }}
                                    placeholder="Ex: Falha de conexão na OLT..."
                                    aria-invalid={!!formErrors.title}
                                    aria-describedby={formErrors.title ? 'task-title-error' : undefined}
                                    className={`w-full p-2.5 border rounded-xl outline-none font-semibold text-sm transition-all bg-white dark:bg-zinc-800/80 text-slate-900 dark:text-zinc-100 ${
                                        formErrors.title
                                            ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-500'
                                            : 'border-slate-300 dark:border-zinc-700 focus:border-slate-900 dark:focus:border-indigo-400 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-indigo-500/20'
                                    }`}
                                />
                                {formErrors.title && (
                                    <p id="task-title-error" role="alert" className="text-xs text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1 font-medium">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        {formErrors.title}
                                    </p>
                                )}
                            </div>

                            {/* LINHA 1 DA GRADE: DEPARTAMENTO & PESSOA RESPONSÁVEL */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Coluna A: Departamento de Origem */}
                                <div>
                                    <label htmlFor="task-department" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                        <Building className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                                        Departamento de Origem <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        id="task-department"
                                        value={originDepartment}
                                        onChange={(e) => {
                                            setOriginDepartment(e.target.value);
                                            setFormErrors((prev) => ({ ...prev, department: '' }));
                                        }}
                                        aria-invalid={!!formErrors.department}
                                        aria-describedby={formErrors.department ? 'task-department-error' : undefined}
                                        className={`w-full p-2.5 border rounded-xl outline-none text-sm bg-white dark:bg-zinc-800/80 text-slate-900 dark:text-zinc-100 transition-all ${
                                            formErrors.department
                                                ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-500'
                                                : 'border-slate-300 dark:border-zinc-700 focus:border-slate-900 dark:focus:border-indigo-400 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-indigo-500/20'
                                        }`}
                                    >
                                        <option value="">Selecione o setor de origem...</option>
                                        {ERROR_DEPARTMENTS.map((dept) => (
                                            <option key={dept} value={dept}>
                                                {dept}
                                            </option>
                                        ))}
                                    </select>
                                    {formErrors.department && (
                                        <p id="task-department-error" role="alert" className="text-xs text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1 font-medium">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                            {formErrors.department}
                                        </p>
                                    )}
                                </div>

                                {/* Coluna B: Pessoa Responsável (assigned_to) */}
                                <div>
                                    <label htmlFor="task-assignee" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                        <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                        Pessoa Responsável
                                    </label>
                                    {canAssign ? (
                                        <select
                                            id="task-assignee"
                                            value={selectedAssigneeId}
                                            onChange={(e) => setSelectedAssigneeId(e.target.value)}
                                            className="w-full p-2.5 border border-slate-300 dark:border-zinc-700 rounded-xl focus:border-slate-900 dark:focus:border-indigo-400 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-indigo-500/20 outline-none text-sm bg-white dark:bg-zinc-800/80 text-slate-900 dark:text-zinc-100"
                                        >
                                            <option value="">
                                                Sem responsável direto (Direcionar para Gestores e Supervisores)
                                            </option>
                                            {collaborators.map((c) => {
                                                const cid = String(c.id || c.uid || c.email || c.name);
                                                return (
                                                    <option key={cid} value={cid}>
                                                        {c.name} {c.role ? `(${c.role})` : ''}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    ) : (
                                        <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-950 dark:text-amber-200 font-medium">
                                            {initialAssignee
                                                ? `Responsável atribuído: ${initialAssignee.name}`
                                                : 'Sem responsável direto: direcionada automaticamente a Gestores e Supervisores.'}
                                        </div>
                                    )}
                                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-1">
                                        Se deixado em branco, a O.S. será roteada e visibilizada para usuários com perfil de <strong>Gestor</strong> e <strong>Supervisor</strong>.
                                    </p>
                                </div>
                            </div>

                            {/* LINHA 2 DA GRADE: PRIORIDADE & PRAZO (DATA DE ENTREGA) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Coluna A: Prioridade */}
                                <div>
                                    <label htmlFor="task-priority" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                        <Flag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                        Prioridade <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        id="task-priority"
                                        value={priority}
                                        onChange={(e) => setPriority(e.target.value)}
                                        className="w-full p-2.5 border border-slate-300 dark:border-zinc-700 rounded-xl focus:border-slate-900 dark:focus:border-indigo-400 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-indigo-500/20 outline-none text-sm bg-white dark:bg-zinc-800/80 text-slate-900 dark:text-zinc-100 font-semibold"
                                    >
                                        {TASK_PRIORITIES.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Coluna B: Data de Entrega / Prazo */}
                                <div>
                                    <label htmlFor="task-due-date" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                        Data de Entrega / Prazo <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="task-due-date"
                                        type="date"
                                        value={dueDate}
                                        onChange={(e) => {
                                            setDueDate(e.target.value);
                                            setFormErrors((prev) => ({ ...prev, due_date: '' }));
                                        }}
                                        aria-invalid={!!formErrors.due_date}
                                        aria-describedby={formErrors.due_date ? 'task-due-date-error' : undefined}
                                        className={`w-full p-2.5 border rounded-xl outline-none text-sm bg-white dark:bg-zinc-800/80 text-slate-900 dark:text-zinc-100 transition-all ${
                                            formErrors.due_date
                                                ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-500'
                                                : 'border-slate-300 dark:border-zinc-700 focus:border-slate-900 dark:focus:border-indigo-400 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-indigo-500/20'
                                        }`}
                                    />
                                    {formErrors.due_date && (
                                        <p id="task-due-date-error" role="alert" className="text-xs text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1 font-medium">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                            {formErrors.due_date}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* LINHA 3 DA GRADE: VISUALIZADORES & ETIQUETAS (TAGS) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-zinc-800">
                                
                                {/* Coluna A: Visualizadores (watchers - somente leitura) */}
                                <div className="space-y-2">
                                    <label htmlFor="task-watchers-select" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                                        <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                                        Visualizadores (Somente Leitura)
                                    </label>

                                    {canManageWatchers && (
                                        <div className="flex gap-2">
                                            <select
                                                id="task-watchers-select"
                                                value={watcherToAddId}
                                                onChange={(e) => {
                                                    setWatcherToAddId(e.target.value);
                                                    if (e.target.value) {
                                                        handleAddWatcher(e.target.value);
                                                    }
                                                }}
                                                className="flex-1 p-2 border border-slate-300 dark:border-zinc-700 rounded-xl focus:border-slate-900 dark:focus:border-indigo-400 outline-none text-xs bg-white dark:bg-zinc-800/80 text-slate-900 dark:text-zinc-100"
                                            >
                                                <option value="">Adicionar visualizador...</option>
                                                {collaborators.map((c) => {
                                                    const cid = String(c.id || c.uid || c.email || c.name);
                                                    return (
                                                        <option key={cid} value={cid}>
                                                            {c.name} {c.role ? `(${c.role})` : ''}
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => handleAddWatcher(watcherToAddId)}
                                                disabled={!watcherToAddId}
                                                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                Incluir
                                            </button>
                                        </div>
                                    )}

                                    {watchersList.length > 0 ? (
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {watchersList.map((w) => (
                                                <span
                                                    key={w.id}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 text-xs font-semibold"
                                                >
                                                    <Eye className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                                                    <span>{w.name}</span>
                                                    {canManageWatchers && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveWatcher(w.id)}
                                                            className="ml-1 text-indigo-500 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                                                            title="Remover visualizador"
                                                            aria-label={`Remover visualizador ${w.name}`}
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 dark:text-zinc-500 italic">
                                            Nenhum visualizador adicionado.
                                        </p>
                                    )}
                                </div>

                                {/* Coluna B: Etiquetas (Tags) */}
                                <div className="space-y-2">
                                    <label htmlFor="task-tag-input" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                                        <Tag className="w-3.5 h-3.5 text-slate-500 dark:text-zinc-400" />
                                        Etiquetas (Tags)
                                    </label>

                                    <div className="flex gap-2">
                                        <input
                                            id="task-tag-input"
                                            type="text"
                                            value={tagInput}
                                            onChange={(e) => setTagInput(e.target.value)}
                                            onKeyDown={handleTagKeyDown}
                                            placeholder="Ex: Rede, VIP, Hardware..."
                                            className="flex-1 p-2 border border-slate-300 dark:border-zinc-700 rounded-xl focus:border-slate-900 dark:focus:border-indigo-400 outline-none text-xs bg-white dark:bg-zinc-800/80 text-slate-900 dark:text-zinc-100"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleAddTag()}
                                            disabled={!tagInput.trim()}
                                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Adicionar
                                        </button>
                                    </div>

                                    {/* Chips de Tags Ativas */}
                                    {tags.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {tags.map((t) => (
                                                <span
                                                    key={t}
                                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700 text-xs font-semibold"
                                                >
                                                    #{t}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveTag(t)}
                                                        className="ml-0.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                                                        title={`Remover tag #${t}`}
                                                        aria-label={`Remover tag ${t}`}
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {/* Sugestões Rápidas de Tags */}
                                    <div className="flex flex-wrap items-center gap-1 pt-1">
                                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 mr-1">Sugestões:</span>
                                        {DEFAULT_TAG_SUGGESTIONS.map((sug) => {
                                            const isSelected = tags.includes(sug);
                                            return (
                                                <button
                                                    key={sug}
                                                    type="button"
                                                    onClick={() => (isSelected ? handleRemoveTag(sug) : handleAddTag(sug))}
                                                    className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 border-indigo-300 dark:border-indigo-800'
                                                            : 'bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700'
                                                    }`}
                                                >
                                                    +{sug}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2.2 CORPO INFERIOR: EDITOR DE DESCRIÇÃO RICO (MARKDOWN & GFM) */}
                        <div className="bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-200 dark:border-zinc-800 shadow-2xs space-y-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <label htmlFor="task-description" className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                                    Descrição da O.S. <span className="text-rose-500">*</span>
                                </label>

                                {/* Barra de Ferramentas Rica Markdown */}
                                <div className="flex items-center gap-1 flex-wrap bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg border border-slate-200 dark:border-zinc-700">
                                    <button
                                        type="button"
                                        onClick={() => insertMarkdownSyntax('**', '**', 'negrito')}
                                        className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                                        title="Negrito (**texto**)"
                                        aria-label="Inserir negrito"
                                    >
                                        <Bold className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertMarkdownSyntax('*', '*', 'itálico')}
                                        className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                                        title="Itálico (*texto*)"
                                        aria-label="Inserir itálico"
                                    >
                                        <Italic className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertMarkdownSyntax('\n- ', '', 'Item de lista')}
                                        className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                                        title="Lista com marcadores (- item)"
                                        aria-label="Inserir lista com marcadores"
                                    >
                                        <List className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertMarkdownSyntax('\n1. ', '', 'Item numerado')}
                                        className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                                        title="Lista numerada (1. item)"
                                        aria-label="Inserir lista numerada"
                                    >
                                        <ListOrdered className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleInsertTable}
                                        className="px-2 py-0.5 hover:bg-white dark:hover:bg-zinc-700 rounded text-slate-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                        title="Inserir Tabela Markdown (| col | col |)"
                                        aria-label="Inserir tabela markdown"
                                    >
                                        <Table className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline text-[11px]">Tabela</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertMarkdownSyntax('\n```\n', '\n```\n', '// código')}
                                        className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                                        title="Bloco de código (```código```)"
                                        aria-label="Inserir bloco de código"
                                    >
                                        <Code className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertMarkdownSyntax('[', '](https://)', 'Link')}
                                        className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                                        title="Inserir Link ([texto](url))"
                                        aria-label="Inserir link"
                                    >
                                        <Link2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertMarkdownSyntax('\n> ', '', 'Citação')}
                                        className="p-1 hover:bg-white dark:hover:bg-zinc-700 rounded text-slate-700 dark:text-zinc-300 transition-colors cursor-pointer"
                                        title="Citação (> texto)"
                                        aria-label="Inserir citação"
                                    >
                                        <Quote className="w-3.5 h-3.5" />
                                    </button>

                                    <div className="w-px h-4 bg-slate-300 dark:bg-zinc-700 mx-0.5" />

                                    {/* Alternância de Pré-visualização */}
                                    <button
                                        type="button"
                                        onClick={() => setPreviewMarkdown((prev) => !prev)}
                                        className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 cursor-pointer transition-colors ${
                                            previewMarkdown
                                                ? 'bg-slate-900 text-white border-slate-900 dark:bg-indigo-600 dark:border-indigo-600'
                                                : 'bg-white hover:bg-slate-50 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200 border-slate-200 dark:border-zinc-600'
                                        }`}
                                        aria-label={previewMarkdown ? 'Editar texto' : 'Pré-visualizar markdown'}
                                    >
                                        {previewMarkdown ? (
                                            <>
                                                <Edit3 className="w-3 h-3" />
                                                <span>Editar</span>
                                            </>
                                        ) : (
                                            <>
                                                <Eye className="w-3 h-3" />
                                                <span>Visualizar</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Campo Textarea ou Preview Seguro */}
                            {previewMarkdown ? (
                                <div className="p-4 rounded-xl border border-slate-300 dark:border-zinc-700 bg-slate-50/70 dark:bg-zinc-800/50 min-h-[140px] text-sm overflow-x-auto">
                                    <SafeMarkdown content={description} />
                                </div>
                            ) : (
                                <textarea
                                    id="task-description"
                                    ref={textareaRef}
                                    rows={6}
                                    value={description}
                                    onChange={(e) => {
                                        setDescription(e.target.value);
                                        setFormErrors((prev) => ({ ...prev, description: '' }));
                                    }}
                                    placeholder="Descreva detalhadamente a necessidade, o problema observado ou passos da ordem de serviço (suporta formatação Markdown e tabelas | col | col |)..."
                                    aria-invalid={!!formErrors.description}
                                    aria-describedby={formErrors.description ? 'task-description-error' : undefined}
                                    className={`w-full p-3 border rounded-xl outline-none text-sm leading-relaxed transition-all font-sans resize-y bg-white dark:bg-zinc-800/80 text-slate-900 dark:text-zinc-100 ${
                                        formErrors.description
                                            ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-500'
                                            : 'border-slate-300 dark:border-zinc-700 focus:border-slate-900 dark:focus:border-indigo-400 focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-indigo-500/20'
                                    }`}
                                />
                            )}

                            <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-zinc-500 pt-1">
                                <span>
                                    Suporte nativo a <strong>Markdown GFM</strong> (tabelas, negrito, listas e código com sanitização XSS).
                                </span>
                                <span>{description.length} caracteres</span>
                            </div>

                            {formErrors.description && (
                                <p id="task-description-error" role="alert" className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1 font-medium">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    {formErrors.description}
                                </p>
                            )}
                        </div>
                    </form>
                </div>

                {/* 3. RODAPÉ COM AÇÕES */}
                <div className="p-4 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
                    <div className="text-xs text-slate-500 dark:text-zinc-400">
                        {selectedAssigneeId ? (
                            <span>Responsável direto atribuído</span>
                        ) : (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                                Sem responsável direto: visível para todos os Gestores e Supervisores
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 border border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            form="taskFormModalForm"
                            disabled={saving}
                            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {saving ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Salvando...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>{editingReport ? 'Salvar Alterações' : 'Criar Tarefa / O.S.'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

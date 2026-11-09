import React, { useState, useEffect, useRef } from 'react';
import { 
    X, Check, AlertTriangle, UserCheck, Eye, Edit3, Plus, 
    Table, Bold, Italic, List, ListOrdered, Code, Link2, 
    Quote, Calendar, Layers, Flag, Building, Bug, CheckSquare, 
    Monitor, Sparkles, AlertOctagon, Clock, User, ShieldCheck,
    FileText, Zap, ChevronRight, Info
} from 'lucide-react';
import { 
    ERROR_DEPARTMENTS,
    TASK_PRIORITIES,
    TASK_TYPES,
    normalizeCategory,
    getTaskOriginDepartment,
    getTaskAssignee,
    getTaskWatchers,
    canUserAssignResponsible,
    canUserManageWatchers
} from '../../types/request.types';
import SafeMarkdown from './SafeMarkdown';
import { BorderBeam } from '../magicui/BorderBeam';

/**
 * Categorias Operacionais com SLA e Metadados Visuais
 */
const CATEGORIES_CONFIG = [
    {
        id: 'error_analysis',
        label: 'Análise de Erro',
        shortLabel: 'Erro Operacional',
        icon: Bug,
        sla: '48h SLA',
        color: 'rose',
        activeClasses: 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/25',
        badgeClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
        description: 'Falhas de conexão, divergências ou bugs'
    },
    {
        id: 'task',
        label: 'Tarefa',
        shortLabel: 'Tarefa Operacional',
        icon: CheckSquare,
        sla: '48h SLA',
        color: 'sky',
        activeClasses: 'border-sky-500 bg-sky-500/10 text-sky-600 dark:text-sky-400 ring-2 ring-sky-500/25',
        badgeClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30',
        description: 'Ordens de serviço e rotinas técnicas'
    },
    {
        id: 'system_improvement',
        label: 'Melhoria de Sistema',
        shortLabel: 'Sistema & ERP',
        icon: Monitor,
        sla: '120h SLA',
        color: 'indigo',
        activeClasses: 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/25',
        badgeClass: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
        description: 'Automações, novas funções e ERP'
    },
    {
        id: 'facility_improvement',
        label: 'Melhoria de Ambiente',
        shortLabel: 'Infra & Estação',
        icon: Building,
        sla: '72h SLA',
        color: 'emerald',
        activeClasses: 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/25',
        badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        description: 'Ergonomia, mobiliário e infraestrutura'
    },
    {
        id: 'other',
        label: 'Outros',
        shortLabel: 'Geral / Outros',
        icon: Sparkles,
        sla: '72h SLA',
        color: 'purple',
        activeClasses: 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 ring-2 ring-purple-500/25',
        badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
        description: 'Comunicados e demandas não listadas'
    }
];

/**
 * Níveis de Prioridade com Indicadores Cromáticos
 */
const PRIORITIES_CONFIG = [
    {
        id: 'Baixa',
        label: 'Baixa',
        dot: 'bg-emerald-500',
        activeClasses: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold ring-1 ring-emerald-500/30'
    },
    {
        id: 'Normal',
        label: 'Normal',
        dot: 'bg-sky-500',
        activeClasses: 'border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold ring-1 ring-sky-500/30'
    },
    {
        id: 'Alta',
        label: 'Alta',
        dot: 'bg-amber-500',
        activeClasses: 'border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold ring-1 ring-amber-500/30'
    },
    {
        id: 'Crítica',
        label: 'Crítica',
        dot: 'bg-rose-600 animate-pulse',
        activeClasses: 'border-rose-500/60 bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold ring-2 ring-rose-500/40'
    }
];

/**
 * TaskFormModal (Hubdesk v4.0.0)
 * Modal de Nova Solicitação / Ordem de Serviço totalmente repaginado.
 * 
 * Destaques visuais:
 * - Seletor interativo de categorias em Cards com SLA e ícones cromáticos.
 * - Grid Bento 2x2 para Metadados (Origem, Prioridade em Pills, Prazo com Presets rápidos, Responsável).
 * - Visualizadores em Pills com avatar.
 * - Segmented Control para Impacto no Cliente com campo expansivo.
 * - Editor Markdown rico com Abas (Escrever / Prévia GFM) e Barra de Ações.
 * - Borda perimetral viva com BorderBeam.
 * - Total compatibilidade com tema Claro, Âmbar e Escuro (zero fontes sumidas, zero bordas pretas).
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
    const initialDept = getTaskOriginDepartment(editingReport) || editingReport?.department || (user?.department || '');
    const initialType = normalizeCategory(editingReport?.category || editingReport?.type || 'task');
    const initialDueDate = editingReport?.due_date || editingReport?.dueDate || editingReport?.date || new Date().toISOString().split('T')[0];
    const initialAffectedClient = editingReport?.affectedClient || editingReport?.metadata?.affectedClient || 'Não';
    const initialHowAffected = editingReport?.howAffected || editingReport?.metadata?.howAffected || '';

    // 3. Estados dos Campos da O.S.
    const [title, setTitle] = useState(editingReport?.title || '');
    const [originDepartment, setOriginDepartment] = useState(initialDept);
    const [selectedType, setSelectedType] = useState(initialType);
    const [priority, setPriority] = useState(editingReport?.priority || 'Normal');
    const [dueDate, setDueDate] = useState(initialDueDate);
    const [selectedAssigneeId, setSelectedAssigneeId] = useState(initialAssignee?.id || '');
    const [watchersList, setWatchersList] = useState(() => getTaskWatchers(editingReport));
    const [watcherToAddId, setWatcherToAddId] = useState('');
    const [affectedClient, setAffectedClient] = useState(initialAffectedClient);
    const [howAffected, setHowAffected] = useState(initialHowAffected);
    const [description, setDescription] = useState(editingReport?.description || '');
    const [activeTab, setActiveTab] = useState('write'); // 'write' | 'preview'

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

    // Presets rápidos de data de entrega
    const handleApplyDatePreset = (days) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        const iso = d.toISOString().split('T')[0];
        setDueDate(iso);
        setFormErrors((prev) => ({ ...prev, due_date: '' }));
    };

    // Inserção de sintaxe Markdown no cursor do textarea
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
        const tableTemplate = `\n| Parâmetro / Item | Descrição / Detalhe | Status |\n| :--- | :--- | :--- |\n| Exemplo 1 | Configuração OLT / PON | Concluído |\n| Exemplo 2 | Teste de Enlace Óptico | Pendente |\n`;
        insertMarkdownSyntax(tableTemplate, '', '');
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
                    role: String(found.role || 'Operacional'),
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
            errors.title = 'O título da solicitação é obrigatório.';
        } else if (cleanTitle.length < 3) {
            errors.title = 'O título deve ter no mínimo 3 caracteres.';
        }

        if (!cleanDept) {
            errors.department = 'Selecione o departamento de origem.';
        }

        if (!cleanDueDate) {
            errors.due_date = 'Informe o prazo de entrega da solicitação.';
        }

        if (affectedClient === 'Sim' && !howAffected.trim()) {
            errors.howAffected = 'Descreva brevemente como a ocorrência afetou o cliente.';
        }

        if (!cleanDesc) {
            errors.description = 'A descrição detalhada da demanda é obrigatória.';
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
                    role: String(matchedCollab.role || 'Operacional'),
                    assignedAt: new Date().toISOString(),
                    assignedBy: user?.name || user?.email || 'Liderança'
                };
            } else if (initialAssignee && String(initialAssignee.id) === String(selectedAssigneeId)) {
                resolvedAssignee = initialAssignee;
            }
        }

        const typeOption = TASK_TYPES.find((t) => t.id === selectedType);
        const resolvedTypeLabel = typeOption?.label || 'Tarefa';

        // Payload unificado e compatível
        const payload = {
            title: cleanTitle,
            description: cleanDesc,
            originDepartment: cleanDept,
            department: cleanDept,
            category: selectedType,
            type: resolvedTypeLabel,
            priority,
            due_date: cleanDueDate,
            date: cleanDueDate,
            affectedClient,
            howAffected: affectedClient === 'Sim' ? howAffected.trim() : '',
            assignedTo: resolvedAssignee,
            assigned_to: resolvedAssignee ? resolvedAssignee.id : null,
            assignedToId: resolvedAssignee ? resolvedAssignee.id : null,
            assignedToName: resolvedAssignee ? resolvedAssignee.name : null,
            assignedToEmail: resolvedAssignee ? resolvedAssignee.email : null,
            watchers: watchersList,
            watcherIds: watchersList.map((w) => w.id),
            metadata: {
                ...(editingReport?.metadata || {}),
                originDepartment: cleanDept,
                department: cleanDept,
                category: selectedType,
                type: resolvedTypeLabel,
                affectedClient,
                howAffected: affectedClient === 'Sim' ? howAffected.trim() : '',
                due_date: cleanDueDate
            },
            updatedAt: new Date()
        };

        onSave(payload);
    };

    // Objeto da categoria atualmente selecionada
    const currentCategory = CATEGORIES_CONFIG.find(c => c.id === selectedType) || CATEGORIES_CONFIG[0];
    const CategoryIcon = currentCategory.icon;

    return (
        <div className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-2 sm:p-4 z-[90] backdrop-blur-md overflow-y-auto">
            <div 
                role="dialog"
                aria-modal="true"
                aria-labelledby="task-form-modal-title"
                className="relative bg-surface rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-subtle text-primary-hub animate-in fade-in zoom-in-95 duration-200"
            >
                <BorderBeam size={260} duration={8} colorFrom="#f43f5e" colorTo="#e11d48" borderWidth={1.5} />

                {/* 1. CABEÇALHO REVOLUCIONADO V4.0 */}
                <div className="px-6 py-5 bg-surface text-primary-hub flex justify-between items-center shrink-0 border-b border-subtle">
                    <div className="flex items-center gap-3.5">
                        <div className={`p-3 rounded-2xl border ${currentCategory.badgeClass} flex items-center justify-center transition-all duration-300`}>
                            <CategoryIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 id="task-form-modal-title" className="text-base sm:text-lg font-bold text-primary-hub font-brand tracking-tight">
                                    {editingReport ? 'Editar Ordem de Serviço' : 'Nova Solicitação / Ordem de Serviço'}
                                </h3>
                                {editingReport ? (
                                    <span className="text-[11px] px-2 py-0.5 rounded-lg font-mono bg-subtle border border-subtle text-secondary-hub font-bold">
                                        #{String(editingReport.id).slice(0, 8).toUpperCase()}
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                        v4.0 Hubdesk
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-secondary-hub mt-0.5">
                                Central de triagem operacional · Registro estruturado e roteamento de demandas
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 hover:bg-subtle text-muted-hub hover:text-primary-hub rounded-xl transition-colors cursor-pointer border border-transparent hover:border-subtle"
                        title="Fechar (Esc)"
                        aria-label="Fechar modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* 2. CORPO SCROLLABLE */}
                <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-canvas space-y-6">
                    <form id="taskFormModalForm" onSubmit={handleSubmit} className="space-y-6" noValidate>
                        
                        {/* 2.1 SELETOR VISUAL DE CATEGORIA / TIPO DA O.S. (CARDS INTERATIVOS) */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-rose-500" />
                                    Classificação da Demanda <span className="text-rose-500">*</span>
                                </label>
                                <span className="text-[11px] font-medium text-muted-hub">
                                    SLA recomendado: <strong className="text-primary-hub">{currentCategory.sla}</strong>
                                </span>
                            </div>

                            {/* Grid de Cards de Categoria */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                                {CATEGORIES_CONFIG.map((cat) => {
                                    const isSelected = selectedType === cat.id;
                                    const IconComp = cat.icon;
                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setSelectedType(cat.id)}
                                            className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 cursor-pointer relative group ${
                                                isSelected
                                                    ? cat.activeClasses
                                                    : 'border-subtle bg-surface hover:bg-subtle/80 text-secondary-hub'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className={`p-1.5 rounded-xl border ${isSelected ? cat.badgeClass : 'border-subtle bg-subtle text-muted-hub'}`}>
                                                    <IconComp className="w-4 h-4" />
                                                </div>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${isSelected ? cat.badgeClass : 'border-subtle text-muted-hub bg-canvas'}`}>
                                                    {cat.sla.split(' ')[0]}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="text-xs font-bold leading-tight">
                                                    {cat.shortLabel}
                                                </div>
                                                <div className="text-[10px] text-muted-hub line-clamp-1 mt-0.5">
                                                    {cat.description}
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-rose-500" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Fallback acessível e sincronizado para testes e formulários clássicos */}
                            <select
                                id="task-type-select"
                                value={selectedType}
                                onChange={(e) => setSelectedType(e.target.value)}
                                className="sr-only"
                                tabIndex={-1}
                                aria-hidden="true"
                            >
                                {TASK_TYPES.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 2.2 TÍTULO DA SOLICITAÇÃO (DESTAQUE MÁXIMO) */}
                        <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-subtle shadow-xs space-y-2">
                            <label htmlFor="task-title" className="block text-xs font-bold text-secondary-hub uppercase tracking-wider flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-rose-500" />
                                    Título da Solicitação / O.S. <span className="text-rose-500">*</span>
                                </span>
                                <span className="text-[11px] font-normal text-muted-hub lowercase">
                                    mínimo 3 caracteres
                                </span>
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
                                placeholder="Ex: Falha na conexão PON da OLT central / Solicitação de novo headset ergonômico..."
                                aria-invalid={!!formErrors.title}
                                aria-describedby={formErrors.title ? 'task-title-error' : undefined}
                                className={`w-full px-4 py-3 border rounded-xl outline-none font-semibold text-sm transition-all bg-canvas text-primary-hub placeholder:text-muted-hub ${
                                    formErrors.title
                                        ? 'border-rose-400 bg-rose-500/5 focus:ring-2 focus:ring-rose-500'
                                        : 'border-subtle focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                                }`}
                            />
                            {formErrors.title && (
                                <p id="task-title-error" role="alert" className="text-xs text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1 font-medium">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    {formErrors.title}
                                </p>
                            )}
                        </div>

                        {/* 2.3 METADADOS OPERACIONAIS EM BENTO GRID 2x2 */}
                        <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-subtle shadow-xs space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                
                                {/* COLUNA 1: DEPARTAMENTO DE ORIGEM */}
                                <div className="space-y-1.5">
                                    <label htmlFor="task-department" className="block text-xs font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                        <Building className="w-3.5 h-3.5 text-indigo-500" />
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
                                        className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-sm bg-canvas text-primary-hub transition-all font-medium ${
                                            formErrors.department
                                                ? 'border-rose-400 bg-rose-500/5 focus:ring-2 focus:ring-rose-500'
                                                : 'border-subtle focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
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

                                {/* COLUNA 2: NÍVEL DE PRIORIDADE (SELETOR DE PILLS) */}
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                        <Flag className="w-3.5 h-3.5 text-amber-500" />
                                        Nível de Prioridade <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-4 gap-1.5">
                                        {PRIORITIES_CONFIG.map((p) => {
                                            const isSelected = priority === p.id;
                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => setPriority(p.id)}
                                                    className={`py-2 px-1 rounded-xl text-xs flex items-center justify-center gap-1.5 border transition-all cursor-pointer ${
                                                        isSelected
                                                            ? p.activeClasses
                                                            : 'border-subtle bg-canvas text-secondary-hub hover:bg-subtle'
                                                    }`}
                                                >
                                                    <span className={`w-2 h-2 rounded-full ${p.dot} shrink-0`} />
                                                    <span className="truncate">{p.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <select
                                        id="task-priority"
                                        value={priority}
                                        onChange={(e) => setPriority(e.target.value)}
                                        className="sr-only"
                                        tabIndex={-1}
                                        aria-hidden="true"
                                    >
                                        {TASK_PRIORITIES.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* COLUNA 3: DATA DE ENTREGA / PRAZO COM PRESETS */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label htmlFor="task-due-date" className="block text-xs font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5 text-sky-500" />
                                            Prazo de Entrega <span className="text-rose-500">*</span>
                                        </label>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => handleApplyDatePreset(1)}
                                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-subtle hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 text-secondary-hub border border-subtle transition-colors cursor-pointer"
                                                title="Prazo para amanhã"
                                            >
                                                +24h
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleApplyDatePreset(2)}
                                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-subtle hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 text-secondary-hub border border-subtle transition-colors cursor-pointer"
                                                title="Prazo para 48 horas"
                                            >
                                                +48h
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleApplyDatePreset(3)}
                                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-subtle hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 text-secondary-hub border border-subtle transition-colors cursor-pointer"
                                                title="Prazo para 72 horas"
                                            >
                                                +72h
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleApplyDatePreset(5)}
                                                className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-subtle hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 text-secondary-hub border border-subtle transition-colors cursor-pointer"
                                                title="Prazo para 5 dias"
                                            >
                                                +5d
                                            </button>
                                        </div>
                                    </div>
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
                                        className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-sm bg-canvas text-primary-hub transition-all font-medium ${
                                            formErrors.due_date
                                                ? 'border-rose-400 bg-rose-500/5 focus:ring-2 focus:ring-rose-500'
                                                : 'border-subtle focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                                        }`}
                                    />
                                    {formErrors.due_date && (
                                        <p id="task-due-date-error" role="alert" className="text-xs text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1 font-medium">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                            {formErrors.due_date}
                                        </p>
                                    )}
                                </div>

                                {/* COLUNA 4: PESSOA RESPONSÁVEL */}
                                <div className="space-y-1.5">
                                    <label htmlFor="task-assignee" className="block text-xs font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                        <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                                        Pessoa Responsável
                                    </label>
                                    {canAssign ? (
                                        <select
                                            id="task-assignee"
                                            value={selectedAssigneeId}
                                            onChange={(e) => setSelectedAssigneeId(e.target.value)}
                                            className="w-full px-3.5 py-2.5 border border-subtle rounded-xl focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none text-sm bg-canvas text-primary-hub font-medium"
                                        >
                                            <option value="">
                                                Sem responsável direto (Direcionar para Gestores/Supervisores)
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
                                        <div className="px-3.5 py-2.5 rounded-xl bg-subtle border border-subtle text-xs text-secondary-hub font-medium flex items-center gap-2">
                                            <Info className="w-4 h-4 text-muted-hub shrink-0" />
                                            <span className="truncate">
                                                {initialAssignee
                                                    ? `Atribuído a: ${initialAssignee.name}`
                                                    : 'Roteamento automático: Visível para Gestores e Supervisores.'}
                                            </span>
                                        </div>
                                    )}
                                    <p className="text-[11px] text-muted-hub">
                                        {selectedAssigneeId ? 'Notificação direta enviada ao colaborador.' : 'Supervisores farão a triagem e distribuição da demanda.'}
                                    </p>
                                </div>
                            </div>

                            {/* SEÇÃO INTEGRADA: VISUALIZADORES (WATCHERS) */}
                            <div className="pt-3 border-t border-subtle space-y-2">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="task-watchers-select" className="text-xs font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                                        <Eye className="w-3.5 h-3.5 text-indigo-500" />
                                        Visualizadores Adicionais (Acompanhamento)
                                    </label>
                                    <span className="text-[11px] text-muted-hub">
                                        {watchersList.length} {watchersList.length === 1 ? 'incluído' : 'incluídos'}
                                    </span>
                                </div>

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
                                            className="flex-1 px-3 py-2 border border-subtle rounded-xl focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 outline-none text-xs bg-canvas text-primary-hub"
                                        >
                                            <option value="">Selecione um colaborador para acompanhar...</option>
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
                                            className="px-3.5 py-2 bg-subtle hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-40 text-secondary-hub rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors border border-subtle"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Incluir</span>
                                        </button>
                                    </div>
                                )}

                                {watchersList.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {watchersList.map((w) => (
                                            <span
                                                key={w.id}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-subtle text-primary-hub border border-subtle text-xs font-medium"
                                            >
                                                <Eye className="w-3 h-3 text-indigo-500 shrink-0" />
                                                <span className="truncate max-w-[140px]">{w.name}</span>
                                                {canManageWatchers && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveWatcher(w.id)}
                                                        className="ml-1 text-muted-hub hover:text-rose-500 cursor-pointer p-0.5 rounded transition-colors"
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
                                    <p className="text-xs text-muted-hub italic">
                                        Nenhum visualizador adicionado. Somente os envolvidos diretos receberão notificações.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* 2.4 IMPACTO NO CLIENTE (SEGMENTED CONTROL MODERNO) */}
                        <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-subtle shadow-xs space-y-3">
                            <div>
                                <label className="block text-xs font-bold text-secondary-hub uppercase tracking-wider mb-2 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
                                        Houve Impacto no Cliente / Assinante? <span className="text-rose-500">*</span>
                                    </span>
                                    <span className="text-[11px] font-normal text-muted-hub lowercase">
                                        classificação de severidade
                                    </span>
                                </label>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAffectedClient('Não');
                                            setHowAffected('');
                                            setFormErrors((prev) => ({ ...prev, howAffected: '' }));
                                        }}
                                        className={`p-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                                            affectedClient === 'Não'
                                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/30'
                                                : 'bg-canvas text-secondary-hub border-subtle hover:bg-subtle'
                                        }`}
                                    >
                                        <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span>Não · Demanda / Incidente Interno</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAffectedClient('Sim')}
                                        className={`p-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-2 ${
                                            affectedClient === 'Sim'
                                                ? 'bg-rose-500/15 border-rose-500/50 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/30'
                                                : 'bg-canvas text-secondary-hub border-subtle hover:bg-subtle'
                                        }`}
                                    >
                                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                                        <span>Sim · Clientes Foram Afetados</span>
                                    </button>
                                </div>
                            </div>

                            {/* Campo Expansivo: Como afetou o cliente? */}
                            {affectedClient === 'Sim' && (
                                <div className="p-4 bg-rose-500/5 rounded-2xl border border-rose-500/30 animate-in fade-in slide-in-from-top-2 duration-200 space-y-2">
                                    <label htmlFor="task-how-affected" className="block text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                                        Descreva como o cliente foi afetado <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        id="task-how-affected"
                                        type="text"
                                        value={howAffected}
                                        onChange={(e) => {
                                            setHowAffected(e.target.value);
                                            setFormErrors((prev) => ({ ...prev, howAffected: '' }));
                                        }}
                                        placeholder="Ex: Assinantes da região Sul ficaram sem conexão à internet por aproximadamente 40 minutos..."
                                        aria-invalid={!!formErrors.howAffected}
                                        aria-describedby={formErrors.howAffected ? 'task-how-affected-error' : undefined}
                                        className={`w-full px-3.5 py-2.5 border rounded-xl outline-none text-sm text-primary-hub bg-canvas transition-all ${
                                            formErrors.howAffected
                                                ? 'border-rose-400 focus:ring-2 focus:ring-rose-500'
                                                : 'border-rose-300 dark:border-rose-900/60 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                                        }`}
                                    />
                                    {formErrors.howAffected && (
                                        <p id="task-how-affected-error" role="alert" className="text-xs text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1 font-medium">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                            {formErrors.howAffected}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 2.5 EDITOR DE DESCRIÇÃO RICO (MARKDOWN & GFM COM ABAS) */}
                        <div className="bg-surface p-4 sm:p-5 rounded-2xl border border-subtle shadow-xs space-y-3">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <label htmlFor="task-description" className="block text-xs font-bold text-secondary-hub uppercase tracking-wider">
                                    Descrição Técnica & Detalhes da O.S. <span className="text-rose-500">*</span>
                                </label>

                                {/* Abas do Editor: Escrever vs Prévia */}
                                <div className="flex items-center gap-1 bg-canvas p-1 rounded-xl border border-subtle">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('write')}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                            activeTab === 'write'
                                                ? 'bg-surface text-primary-hub shadow-xs border border-subtle'
                                                : 'text-muted-hub hover:text-primary-hub'
                                        }`}
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        <span>Escrever</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('preview')}
                                        className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                            activeTab === 'preview'
                                                ? 'bg-surface text-primary-hub shadow-xs border border-subtle'
                                                : 'text-muted-hub hover:text-primary-hub'
                                        }`}
                                    >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Prévia GFM</span>
                                    </button>
                                </div>
                            </div>

                            {/* Barra de Ferramentas Markdown (Apenas no modo de escrita) */}
                            {activeTab === 'write' && (
                                <div className="flex items-center gap-1 flex-wrap bg-canvas p-1.5 rounded-xl border border-subtle">
                                    <button
                                        type="button"
                                        onClick={() => insertMarkdownSyntax('**', '**', 'negrito')}
                                        className="p-1.5 hover:bg-subtle rounded-lg text-secondary-hub transition-colors cursor-pointer"
                                        title="Negrito (**texto**)"
                                        aria-label="Inserir negrito"
                                    >
                                        <Bold className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertMarkdownSyntax('*', '*', 'itálico')}
                                        className="p-1.5 hover:bg-subtle rounded-lg text-secondary-hub transition-colors cursor-pointer"
                                        title="Itálico (*texto*)"
                                        aria-label="Inserir itálico"
                                    >
                                        <Italic className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertMarkdownSyntax('\n- ', '', 'Item de lista')}
                                        className="p-1.5 hover:bg-subtle rounded-lg text-secondary-hub transition-colors cursor-pointer"
                                        title="Lista com marcadores (- item)"
                                        aria-label="Inserir lista com marcadores"
                                    >
                                        <List className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertMarkdownSyntax('\n1. ', '', 'Item numerado')}
                                        className="p-1.5 hover:bg-subtle rounded-lg text-secondary-hub transition-colors cursor-pointer"
                                        title="Lista numerada (1. item)"
                                        aria-label="Inserir lista numerada"
                                    >
                                        <ListOrdered className="w-3.5 h-3.5" />
                                    </button>
                                    
                                    <div className="w-px h-4 bg-subtle mx-1" />

                                    <button
                                        type="button"
                                        onClick={handleInsertTable}
                                        className="px-2.5 py-1 hover:bg-subtle rounded-lg text-secondary-hub text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                                        title="Inserir Tabela Markdown (| col | col |)"
                                        aria-label="Inserir tabela markdown"
                                    >
                                        <Table className="w-3.5 h-3.5" />
                                        <span className="hidden sm:inline text-[11px]">Tabela</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertMarkdownSyntax('\n```\n', '\n```\n', '// comando ou log')}
                                        className="p-1.5 hover:bg-subtle rounded-lg text-secondary-hub transition-colors cursor-pointer"
                                        title="Bloco de código (```código```)"
                                        aria-label="Inserir bloco de código"
                                    >
                                        <Code className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertMarkdownSyntax('[', '](https://)', 'Link')}
                                        className="p-1.5 hover:bg-subtle rounded-lg text-secondary-hub transition-colors cursor-pointer"
                                        title="Inserir Link ([texto](url))"
                                        aria-label="Inserir link"
                                    >
                                        <Link2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => insertMarkdownSyntax('\n> ', '', 'Citação ou Observação')}
                                        className="p-1.5 hover:bg-subtle rounded-lg text-secondary-hub transition-colors cursor-pointer"
                                        title="Citação (> texto)"
                                        aria-label="Inserir citação"
                                    >
                                        <Quote className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}

                            {activeTab === 'preview' ? (
                                <div className="p-4 rounded-xl border border-subtle bg-canvas min-h-[160px] text-sm overflow-x-auto text-primary-hub">
                                    {description.trim() ? (
                                        <SafeMarkdown content={description} />
                                    ) : (
                                        <span className="text-muted-hub italic">
                                            Nenhum conteúdo inserido para pré-visualização.
                                        </span>
                                    )}
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
                                    className={`w-full p-4 border rounded-xl outline-none text-sm leading-relaxed transition-all font-sans resize-y bg-canvas text-primary-hub placeholder:text-muted-hub ${
                                        formErrors.description
                                            ? 'border-rose-400 bg-rose-500/5 focus:ring-2 focus:ring-rose-500'
                                            : 'border-subtle focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20'
                                    }`}
                                />
                            )}

                            <div className="flex items-center justify-between text-[11px] text-muted-hub pt-1">
                                <span>
                                    Suporte nativo a <strong>Markdown GFM</strong> (tabelas, listas, links e blocos de código com sanitização XSS).
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

                {/* 3. RODAPÉ FIXO COM FEEDBACK DE SLA E BOTÕES V4.0 */}
                <div className="p-4 sm:px-6 bg-surface border-t border-subtle flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2 text-xs text-muted-hub w-full sm:w-auto">
                        <Clock className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>
                            SLA estimado: <strong className="text-primary-hub">{currentCategory.sla}</strong>
                        </span>
                        <span className="text-subtle">·</span>
                        <span>
                            {selectedAssigneeId ? (
                                <strong className="text-emerald-600 dark:text-emerald-400">Responsável Atribuído</strong>
                            ) : (
                                <span className="text-amber-600 dark:text-amber-400">Triagem por Supervisores</span>
                            )}
                        </span>
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2.5 border border-subtle hover:bg-subtle text-secondary-hub rounded-xl font-bold text-xs transition-colors cursor-pointer w-full sm:w-auto"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            form="taskFormModalForm"
                            disabled={saving}
                            className="px-6 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-rose-950/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95 w-full sm:w-auto"
                        >
                            {saving ? (
                                <>
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Salvando...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>{editingReport ? 'Salvar Alterações' : 'Criar Ordem de Serviço'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

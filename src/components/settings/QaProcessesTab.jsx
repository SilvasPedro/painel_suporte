import React, { useState, useMemo } from 'react';
import { 
    ShieldCheck, Plus, Trash2, Edit2, Copy, Eye, 
    Search, Filter, LayoutGrid, Table as TableIcon, AlignJustify,
    ChevronDown, ChevronUp, Layers, CheckSquare, Sparkles,
    CheckCircle2, AlertCircle, HelpCircle, ArrowUpDown
} from 'lucide-react';
import { collection, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useNotification } from '../../context/NotificationContext';
import QaProcessModal from './QaProcessModal';
import QaProcessPreviewModal from './QaProcessPreviewModal';

export default function QaProcessesTab({ 
    processes = [], 
    loading = false, 
    isEditable = true 
}) {
    const { showToast } = useNotification();

    // Visualização da lista: 'grid' | 'table' | 'accordion'
    const [viewMode, setViewMode] = useState('grid');
    
    // Filtros e busca
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('Todas');
    const [sortBy, setSortBy] = useState('name-asc'); // 'name-asc' | 'name-desc' | 'items-desc' | 'items-asc'

    // Estado dos cards com perguntas expandidas na visualização grid
    const [expandedGridCards, setExpandedGridCards] = useState({});

    // Estado do Acordeão (quais IDs estão abertos)
    const [expandedAccordions, setExpandedAccordions] = useState({});

    // Modais
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProcess, setEditingProcess] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Modal de Prévia de Auditoria
    const [previewProcess, setPreviewProcess] = useState(null);

    // Lista de categorias distintas encontradas
    const categories = useMemo(() => {
        const set = new Set();
        processes.forEach(p => {
            if (p.category) set.add(p.category);
        });
        return ['Todas', ...Array.from(set)];
    }, [processes]);

    // Métricas para os cartões de estatísticas
    const stats = useMemo(() => {
        const total = processes.length;
        const totalQuestions = processes.reduce((acc, p) => acc + (p.checklist?.length || 0), 0);
        const avgQuestions = total > 0 ? (totalQuestions / total).toFixed(1) : 0;
        const distinctCategories = new Set(processes.map(p => p.category || 'Geral')).size;

        return {
            total,
            totalQuestions,
            avgQuestions,
            distinctCategories
        };
    }, [processes]);

    // Processos filtrados e ordenados
    const filteredProcesses = useMemo(() => {
        return processes.filter(proc => {
            const matchesCategory = selectedCategory === 'Todas' || (proc.category || 'Geral') === selectedCategory;
            
            const searchLower = searchTerm.toLowerCase();
            const matchesName = (proc.name || '').toLowerCase().includes(searchLower);
            const matchesDesc = (proc.description || '').toLowerCase().includes(searchLower);
            const matchesChecklist = Array.isArray(proc.checklist) && proc.checklist.some(item => 
                item.toLowerCase().includes(searchLower)
            );

            return matchesCategory && (matchesName || matchesDesc || matchesChecklist);
        }).sort((a, b) => {
            if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
            if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
            if (sortBy === 'items-desc') return (b.checklist?.length || 0) - (a.checklist?.length || 0);
            if (sortBy === 'items-asc') return (a.checklist?.length || 0) - (b.checklist?.length || 0);
            return 0;
        });
    }, [processes, selectedCategory, searchTerm, sortBy]);

    // --- AÇÕES CRUD ---
    const handleOpenCreateModal = () => {
        setEditingProcess(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (proc) => {
        setEditingProcess(proc);
        setIsModalOpen(true);
    };

    const handleSaveProcess = async (formData) => {
        setIsSaving(true);
        try {
            const payload = {
                name: formData.name,
                category: formData.category || 'Geral',
                description: formData.description || '',
                checklist: formData.checklist,
                updatedAt: new Date().toISOString()
            };

            if (editingProcess && editingProcess.id) {
                await updateDoc(doc(db, "qa_processes", editingProcess.id), payload);
                showToast("Processo atualizado com sucesso!", "success");
            } else {
                await addDoc(collection(db, "qa_processes"), {
                    ...payload,
                    createdAt: new Date().toISOString()
                });
                showToast("Novo processo de QA criado!", "success");
            }
            setIsModalOpen(false);
            setEditingProcess(null);
        } catch (error) {
            console.error("Erro ao salvar processo:", error);
            showToast("Erro ao salvar processo. Tente novamente.", "error");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteProcess = async (proc) => {
        if (!window.confirm(`Deseja realmente apagar o processo "${proc.name}"?\nAs auditorias antigas continuarão registradas, mas este processo não aparecerá mais para novas avaliações.`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, "qa_processes", proc.id));
            showToast("Processo removido com sucesso.", "success");
        } catch (error) {
            console.error("Erro ao apagar:", error);
            showToast("Erro ao excluir processo.", "error");
        }
    };

    const handleDuplicateProcess = (proc) => {
        setEditingProcess({
            name: `${proc.name} (Cópia)`,
            category: proc.category || 'Geral',
            description: proc.description || '',
            checklist: [...(proc.checklist || [])]
        });
        setIsModalOpen(true);
    };

    const toggleGridCardExpansion = (id) => {
        setExpandedGridCards(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const toggleAccordion = (id) => {
        setExpandedAccordions(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const handleExpandAllAccordions = () => {
        const all = {};
        filteredProcesses.forEach(p => { all[p.id] = true; });
        setExpandedAccordions(all);
    };

    const handleCollapseAllAccordions = () => {
        setExpandedAccordions({});
    };

    return (
        <div id="qa-processes-module" className="flex flex-col flex-1 bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            {/* Top Bar de Resumo e Métricas Rápidas */}
            <div className="p-5 border-b border-gray-100 bg-linear-to-r from-gray-50/90 via-white to-gray-50/90">
                <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-red-700">
                                Módulo de Qualidade
                            </span>
                            <span className="text-xs text-gray-400">&bull;</span>
                            <span className="text-xs text-gray-500 font-medium">Checklists de Auditoria N1/N2</span>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mt-1 flex items-center gap-2">
                            <ShieldCheck className="w-6 h-6 text-red-600" />
                            Processos QA & Checklists
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5 max-w-2xl">
                            Padronize os procedimentos de atendimento técnico. Os critérios cadastrados aqui são utilizados automaticamente na aba de Auditorias de Atendimento.
                        </p>
                    </div>

                    {isEditable && (
                        <button
                            id="btn-create-qa-process"
                            onClick={handleOpenCreateModal}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs hover:shadow cursor-pointer shrink-0"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Novo Processo</span>
                        </button>
                    )}
                </div>

                {/* Grid de Métricas de Apoio */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-2xs">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                            Total de Processos
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-2xl font-black text-gray-900">{stats.total}</span>
                            <span className="text-xs text-gray-400">rotinas ativas</span>
                        </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-2xs">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                            Total de Critérios
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-2xl font-black text-red-600">{stats.totalQuestions}</span>
                            <span className="text-xs text-gray-400">perguntas</span>
                        </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-2xs">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                            Média por Processo
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-2xl font-black text-gray-900">{stats.avgQuestions}</span>
                            <span className="text-xs text-gray-400">itens / checklist</span>
                        </div>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-gray-200/80 shadow-2xs">
                        <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                            Categorias
                        </span>
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-2xl font-black text-gray-900">{stats.distinctCategories}</span>
                            <span className="text-xs text-gray-400">especialidades</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Barra de Ferramentas, Filtros e Alternador de Visualizações */}
            <div className="p-4 border-b border-gray-200 bg-gray-50/70 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
                {/* Campo de Busca e Filtro de Categoria */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-2xl">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar processo por nome ou item da checklist..."
                            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition-all shadow-2xs"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                            >
                                Limpar
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="relative shrink-0">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-red-600 cursor-pointer shadow-2xs appearance-none"
                            >
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>Setor: {cat}</option>
                                ))}
                            </select>
                            <Filter className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>

                        <div className="relative shrink-0">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="pl-3 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-red-600 cursor-pointer shadow-2xs appearance-none"
                            >
                                <option value="name-asc">Nome (A &rarr; Z)</option>
                                <option value="name-desc">Nome (Z &rarr; A)</option>
                                <option value="items-desc">Mais Perguntas</option>
                                <option value="items-asc">Menos Perguntas</option>
                            </select>
                            <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                    </div>
                </div>

                {/* Alternador de Visualização (Grade / Tabela / Acordeão) */}
                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                    <span className="text-xs text-gray-500 font-medium mr-1 hidden lg:inline">
                        Exibição:
                    </span>

                    <div className="inline-flex p-1 bg-gray-200/70 rounded-xl border border-gray-200 text-xs">
                        <button
                            id="view-mode-grid"
                            type="button"
                            onClick={() => setViewMode('grid')}
                            title="Visualização em Grade de Cards"
                            className={`p-1.5 px-2.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                viewMode === 'grid'
                                    ? 'bg-white text-red-600 shadow-2xs'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <LayoutGrid className="w-4 h-4" />
                            <span className="text-xs hidden sm:inline">Cards</span>
                        </button>

                        <button
                            id="view-mode-table"
                            type="button"
                            onClick={() => setViewMode('table')}
                            title="Visualização em Tabela Estruturada"
                            className={`p-1.5 px-2.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                viewMode === 'table'
                                    ? 'bg-white text-red-600 shadow-2xs'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <TableIcon className="w-4 h-4" />
                            <span className="text-xs hidden sm:inline">Tabela</span>
                        </button>

                        <button
                            id="view-mode-accordion"
                            type="button"
                            onClick={() => setViewMode('accordion')}
                            title="Visualização em Lista com Acordeão"
                            className={`p-1.5 px-2.5 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                                viewMode === 'accordion'
                                    ? 'bg-white text-red-600 shadow-2xs'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            <AlignJustify className="w-4 h-4" />
                            <span className="text-xs hidden sm:inline">Acordeão</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Conteúdo Principal conforme o ViewMode */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/40">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                        <p className="text-xs text-gray-500 font-medium">Carregando processos e checklists...</p>
                    </div>
                ) : filteredProcesses.length === 0 ? (
                    <div className="text-center py-16 px-4 bg-white rounded-2xl border border-gray-200 max-w-lg mx-auto shadow-2xs">
                        <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center mx-auto mb-3">
                            <ShieldCheck className="w-8 h-8 opacity-40" />
                        </div>
                        <h3 className="text-base font-bold text-gray-800">
                            {searchTerm || selectedCategory !== 'Todas' 
                                ? 'Nenhum processo encontrado para este filtro' 
                                : 'Nenhum processo cadastrado ainda'}
                        </h3>
                        <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                            {searchTerm || selectedCategory !== 'Todas' 
                                ? 'Tente ajustar os termos de pesquisa ou remover o filtro de categoria.' 
                                : 'Crie o primeiro processo de QA para habilitar as checklists na Auditoria de Atendimentos.'}
                        </p>
                        {isEditable && (
                            <button
                                onClick={handleOpenCreateModal}
                                className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Cadastrar Primeiro Processo</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {/* ======================================================== */}
                        {/* VISUALIZAÇÃO 1: GRADE DE CARDS (GRID VIEW)              */}
                        {/* ======================================================== */}
                        {viewMode === 'grid' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredProcesses.map(proc => {
                                    const isExpanded = !!expandedGridCards[proc.id];
                                    const checklist = Array.isArray(proc.checklist) ? proc.checklist : [];
                                    const itemsToShow = isExpanded ? checklist : checklist.slice(0, 3);
                                    const hasMore = checklist.length > 3;

                                    return (
                                        <div 
                                            key={proc.id} 
                                            className="bg-white border border-gray-200 hover:border-red-200 rounded-2xl p-5 flex flex-col transition-all duration-200 shadow-2xs hover:shadow-md group"
                                        >
                                            {/* Cabeçalho do Card */}
                                            <div className="flex justify-between items-start gap-2 mb-3">
                                                <div className="space-y-1 flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700">
                                                            {proc.category || 'Geral'}
                                                        </span>
                                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-red-50 text-red-600 border border-red-100">
                                                            {checklist.length} {checklist.length === 1 ? 'item' : 'itens'}
                                                        </span>
                                                    </div>
                                                    <h3 className="font-bold text-gray-900 text-base leading-snug group-hover:text-red-600 transition-colors line-clamp-1">
                                                        {proc.name}
                                                    </h3>
                                                </div>

                                                {/* Ações Rápidas do Card */}
                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => setPreviewProcess(proc)}
                                                        title="Pré-visualizar como Auditor"
                                                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>

                                                    {isEditable && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDuplicateProcess(proc)}
                                                                title="Duplicar Processo"
                                                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                            >
                                                                <Copy className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenEditModal(proc)}
                                                                title="Editar Processo"
                                                                className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteProcess(proc)}
                                                                title="Excluir Processo"
                                                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Descrição curta se houver */}
                                            {proc.description && (
                                                <p className="text-xs text-gray-500 line-clamp-2 mb-3 leading-relaxed">
                                                    {proc.description}
                                                </p>
                                            )}

                                            {/* Itens da Checklist */}
                                            <div className="flex-1 bg-gray-50/80 rounded-xl p-3.5 text-xs text-gray-700 border border-gray-100 space-y-2">
                                                <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 uppercase tracking-wider pb-1 border-b border-gray-200/60">
                                                    <span>Roteiro de Perguntas</span>
                                                    <span>{checklist.length} critérios</span>
                                                </div>

                                                <div className="space-y-1.5 pt-1">
                                                    {itemsToShow.map((item, idx) => (
                                                        <div key={idx} className="flex items-start gap-2 text-xs">
                                                            <span className="w-4 h-4 rounded-full bg-red-100 text-red-600 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                                                                {idx + 1}
                                                            </span>
                                                            <span className="leading-tight text-gray-700 line-clamp-2">
                                                                {item}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Botão Ver Todos / Recolher no card */}
                                                {hasMore && (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleGridCardExpansion(proc.id)}
                                                        className="pt-2 text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer w-full justify-center border-t border-gray-200/60 mt-2"
                                                    >
                                                        {isExpanded ? (
                                                            <>
                                                                <ChevronUp className="w-3.5 h-3.5" />
                                                                <span>Recolher perguntas</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <ChevronDown className="w-3.5 h-3.5" />
                                                                <span>Ver todas as {checklist.length} perguntas</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>

                                            {/* Rodapé do Card */}
                                            <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                                                <span>Pronto para auditorias</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewProcess(proc)}
                                                    className="font-bold text-gray-600 hover:text-red-600 transition-colors flex items-center gap-1 cursor-pointer"
                                                >
                                                    <span>Simular Auditoria</span>
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ======================================================== */}
                        {/* VISUALIZAÇÃO 2: TABELA ESTRUTURADA (TABLE VIEW)          */}
                        {/* ======================================================== */}
                        {viewMode === 'table' && (
                            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs text-gray-700">
                                        <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                                            <tr>
                                                <th className="py-3 px-4">Processo de Qualidade</th>
                                                <th className="py-3 px-4">Setor / Categoria</th>
                                                <th className="py-3 px-4 text-center">Itens</th>
                                                <th className="py-3 px-4">Exemplo de Pergunta</th>
                                                <th className="py-3 px-4 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {filteredProcesses.map(proc => {
                                                const checklist = Array.isArray(proc.checklist) ? proc.checklist : [];
                                                const firstQuestion = checklist[0] || 'Nenhuma pergunta cadastrada';

                                                return (
                                                    <tr key={proc.id} className="hover:bg-gray-50/70 transition-colors group">
                                                        <td className="py-3.5 px-4 font-bold text-gray-900">
                                                            <div className="flex items-center gap-2">
                                                                <CheckSquare className="w-4 h-4 text-red-600 shrink-0" />
                                                                <div>
                                                                    <span className="block font-bold text-sm text-gray-900 group-hover:text-red-600 transition-colors">
                                                                        {proc.name}
                                                                    </span>
                                                                    {proc.description && (
                                                                        <span className="text-[11px] text-gray-400 font-normal line-clamp-1">
                                                                            {proc.description}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="py-3.5 px-4">
                                                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-700 border border-gray-200">
                                                                {proc.category || 'Geral'}
                                                            </span>
                                                        </td>

                                                        <td className="py-3.5 px-4 text-center">
                                                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full font-mono font-bold text-xs bg-red-50 text-red-700 border border-red-200">
                                                                {checklist.length}
                                                            </span>
                                                        </td>

                                                        <td className="py-3.5 px-4 max-w-xs">
                                                            <div className="flex items-center gap-1.5 text-gray-600">
                                                                <span className="text-red-500 font-bold">•</span>
                                                                <span className="truncate italic">{firstQuestion}</span>
                                                            </div>
                                                        </td>

                                                        <td className="py-3.5 px-4 text-right">
                                                            <div className="inline-flex items-center gap-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setPreviewProcess(proc)}
                                                                    title="Pré-visualizar Checklist"
                                                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>

                                                                {isEditable && (
                                                                    <>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDuplicateProcess(proc)}
                                                                            title="Duplicar Processo"
                                                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                                        >
                                                                            <Copy className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleOpenEditModal(proc)}
                                                                            title="Editar Processo"
                                                                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                                                        >
                                                                            <Edit2 className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleDeleteProcess(proc)}
                                                                            title="Excluir Processo"
                                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* ======================================================== */}
                        {/* VISUALIZAÇÃO 3: ACORDEÃO / LISTA DETALHADA              */}
                        {/* ======================================================== */}
                        {viewMode === 'accordion' && (
                            <div className="space-y-3">
                                <div className="flex justify-end gap-2 text-xs mb-2">
                                    <button
                                        type="button"
                                        onClick={handleExpandAllAccordions}
                                        className="text-gray-500 hover:text-gray-900 font-semibold cursor-pointer"
                                    >
                                        Expandir Todos
                                    </button>
                                    <span className="text-gray-300">|</span>
                                    <button
                                        type="button"
                                        onClick={handleCollapseAllAccordions}
                                        className="text-gray-500 hover:text-gray-900 font-semibold cursor-pointer"
                                    >
                                        Recolher Todos
                                    </button>
                                </div>

                                {filteredProcesses.map(proc => {
                                    const isExpanded = !!expandedAccordions[proc.id];
                                    const checklist = Array.isArray(proc.checklist) ? proc.checklist : [];

                                    return (
                                        <div 
                                            key={proc.id} 
                                            className="bg-white border border-gray-200 rounded-2xl overflow-hidden transition-all shadow-2xs"
                                        >
                                            {/* Cabeçalho Clicável do Acordeão */}
                                            <div 
                                                onClick={() => toggleAccordion(proc.id)}
                                                className="p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50/70 transition-colors select-none"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center shrink-0">
                                                        <ShieldCheck className="w-5 h-5" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="font-bold text-sm text-gray-900 truncate">
                                                                {proc.name}
                                                            </h3>
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
                                                                {proc.category || 'Geral'}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                                                            {proc.description || `${checklist.length} perguntas auditáveis cadastradas`}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3 shrink-0">
                                                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-red-50 text-red-600 border border-red-100">
                                                        {checklist.length} {checklist.length === 1 ? 'item' : 'itens'}
                                                    </span>

                                                    <div className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
                                                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Conteúdo Expandido do Acordeão */}
                                            {isExpanded && (
                                                <div className="p-5 border-t border-gray-100 bg-gray-50/60 space-y-4 animate-in fade-in duration-150">
                                                    {proc.description && (
                                                        <div className="p-3 bg-white border border-gray-200 rounded-xl text-xs text-gray-600">
                                                            <strong className="block font-bold text-gray-800 mb-0.5">Orientações Técnicas:</strong>
                                                            {proc.description}
                                                        </div>
                                                    )}

                                                    <div className="space-y-2">
                                                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block">
                                                            Checklist de Verificação Completa:
                                                        </span>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                            {checklist.map((item, idx) => (
                                                                <div 
                                                                    key={idx} 
                                                                    className="flex items-start gap-2.5 p-3 bg-white border border-gray-200 rounded-xl text-xs text-gray-800"
                                                                >
                                                                    <div className="w-5 h-5 rounded-md bg-gray-100 text-gray-600 font-mono font-bold flex items-center justify-center shrink-0 text-[11px] mt-0.5">
                                                                        {idx + 1}
                                                                    </div>
                                                                    <span className="leading-snug">{item}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Barra de Ações do Processo Expandido */}
                                                    <div className="pt-3 border-t border-gray-200/80 flex flex-wrap justify-between items-center gap-2">
                                                        <div className="text-[11px] text-gray-400">
                                                            ID do Documento: <span className="font-mono">{proc.id}</span>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewProcess(proc)}
                                                                className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                                            >
                                                                <Eye className="w-3.5 h-3.5" />
                                                                Simular Auditoria
                                                            </button>

                                                            {isEditable && (
                                                                <>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDuplicateProcess(proc)}
                                                                        className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-blue-50 text-blue-700 border border-blue-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                                                    >
                                                                        <Copy className="w-3.5 h-3.5" />
                                                                        Duplicar
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenEditModal(proc)}
                                                                        className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                                                    >
                                                                        <Edit2 className="w-3.5 h-3.5" />
                                                                        Editar
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteProcess(proc)}
                                                                        className="px-3 py-1.5 text-xs font-bold bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                        Excluir
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Modal de Criação / Edição de Processo */}
            <QaProcessModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setEditingProcess(null); }}
                processToEdit={editingProcess}
                onSave={handleSaveProcess}
                isSaving={isSaving}
            />

            {/* Modal de Pré-visualização da Auditoria */}
            <QaProcessPreviewModal
                isOpen={!!previewProcess}
                onClose={() => setPreviewProcess(null)}
                process={previewProcess}
                onEdit={(proc) => handleOpenEditModal(proc)}
                isEditable={isEditable}
            />
        </div>
    );
}

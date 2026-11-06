import React from 'react';
import { 
    Search, Filter, X, Download, SlidersHorizontal, 
    User, Layers, Calendar
} from 'lucide-react';

export default function AuditFilters({
    searchTerm,
    setSearchTerm,
    periodFilter,
    setPeriodFilter,
    dateFilter = '',
    setDateFilter,
    statusFilter,
    setStatusFilter,
    processFilter,
    setProcessFilter,
    colabFilter,
    setColabFilter,
    sortBy,
    setSortBy,
    onResetFilters,
    hasActiveFilters,
    processesList = [],
    collaboratorsList = [],
    totalFiltered = 0,
    onExportCsv
}) {
    return (
        <div className="bg-surface rounded-3xl border border-subtle shadow-xs p-4 mb-6 space-y-3 shrink-0">
            {/* Linha Superior: Busca + Atalhos de Período + Exportar */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                {/* Campo de Busca Geral */}
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-muted-hub absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input 
                        type="text" 
                        placeholder="Buscar por colaborador, protocolo, processo, data ou observações..." 
                        value={searchTerm} 
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        className="w-full pl-10 pr-9 py-2.5 text-xs bg-subtle hover:bg-surface focus:bg-surface border border-transparent hover:border-subtle rounded-full outline-none focus:ring-2 focus:ring-red-600 focus:border-red-600 transition-all font-medium" 
                    />
                    {searchTerm && (
                        <button 
                            type="button" 
                            onClick={() => setSearchTerm('')} 
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-hub hover:text-secondary-hub cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Filtros Rápidos de Período */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
                    {[
                        { id: 'all', label: 'Todo Período' },
                        { id: 'today', label: 'Hoje' },
                        { id: '7d', label: '7 dias' },
                        { id: 'month', label: 'Este Mês' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => {
                                setPeriodFilter(tab.id);
                                if (setDateFilter) setDateFilter('');
                            }}
                            className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer whitespace-nowrap ${
                                periodFilter === tab.id && !dateFilter
                                    ? 'bg-zinc-900 text-white shadow-sm'
                                    : 'bg-subtle text-secondary-hub hover:bg-gray-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Ações: Exportar e Limpar Filtros */}
                <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={onResetFilters}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" /> Limpar Filtros
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={onExportCsv}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-surface hover:bg-subtle border border-subtle text-secondary-hub rounded-full transition-colors cursor-pointer shadow-2xs"
                        title="Exportar auditorias filtradas em formato CSV"
                    >
                        <Download className="w-3.5 h-3.5 text-secondary-hub" />
                        <span>Exportar CSV</span>
                    </button>
                </div>
            </div>

            {/* Linha Inferior: Dropdowns de Filtro Específico */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-2 border-t border-subtle text-xs">
                {/* 1. Data Específica */}
                <div className="relative flex items-center bg-subtle hover:bg-gray-100/70 border border-transparent focus-within:border-red-300 focus-within:bg-surface rounded-full px-3 py-2 transition-colors">
                    <Calendar className="w-3.5 h-3.5 text-muted-hub shrink-0 mr-1.5" />
                    <input
                        type="text"
                        placeholder="Data (ex: 28/09)"
                        value={dateFilter}
                        onChange={(e) => {
                            if (setDateFilter) setDateFilter(e.target.value);
                            if (e.target.value) setPeriodFilter('all');
                        }}
                        className="w-full bg-transparent outline-none text-xs font-semibold text-secondary-hub placeholder-gray-400 pr-5"
                    />
                    {dateFilter && setDateFilter && (
                        <button
                            type="button"
                            onClick={() => setDateFilter('')}
                            className="absolute right-2 text-muted-hub hover:text-secondary-hub text-xs cursor-pointer"
                        >
                            ✕
                        </button>
                    )}
                </div>

                {/* 2. Status */}
                <div className="flex items-center gap-1.5 bg-subtle hover:bg-gray-100/70 border border-transparent focus-within:border-red-300 focus-within:bg-surface rounded-full px-3 py-2 transition-colors">
                    <Filter className="w-3.5 h-3.5 text-muted-hub shrink-0" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full bg-transparent outline-none text-xs font-semibold text-secondary-hub cursor-pointer"
                    >
                        <option value="all">Status: Todos</option>
                        <option value="Conforme">Apenas Conformes</option>
                        <option value="Não Conforme">Apenas Não Conformes</option>
                    </select>
                </div>

                {/* 3. Colaborador */}
                <div className="flex items-center gap-1.5 bg-subtle hover:bg-gray-100/70 border border-transparent focus-within:border-red-300 focus-within:bg-surface rounded-full px-3 py-2 transition-colors">
                    <User className="w-3.5 h-3.5 text-muted-hub shrink-0" />
                    <select
                        value={colabFilter}
                        onChange={(e) => setColabFilter(e.target.value)}
                        className="w-full bg-transparent outline-none text-xs font-semibold text-secondary-hub cursor-pointer truncate"
                    >
                        <option value="all">Colaborador: Todos</option>
                        {collaboratorsList.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* 4. Processo QA */}
                <div className="flex items-center gap-1.5 bg-subtle hover:bg-gray-100/70 border border-transparent focus-within:border-red-300 focus-within:bg-surface rounded-full px-3 py-2 transition-colors">
                    <Layers className="w-3.5 h-3.5 text-muted-hub shrink-0" />
                    <select
                        value={processFilter}
                        onChange={(e) => setProcessFilter(e.target.value)}
                        className="w-full bg-transparent outline-none text-xs font-semibold text-secondary-hub cursor-pointer truncate"
                    >
                        <option value="all">Processo: Todos</option>
                        {processesList.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                {/* 5. Ordenação */}
                <div className="flex items-center gap-1.5 bg-subtle hover:bg-gray-100/70 border border-transparent focus-within:border-red-300 focus-within:bg-surface rounded-full px-3 py-2 transition-colors">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-muted-hub shrink-0" />
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-full bg-transparent outline-none text-xs font-semibold text-secondary-hub cursor-pointer"
                    >
                        <option value="recent">Mais Recentes</option>
                        <option value="oldest">Mais Antigas</option>
                        <option value="score_desc">Maior Pontuação (%)</option>
                        <option value="score_asc">Menor Pontuação (%)</option>
                    </select>
                </div>
            </div>

            {/* Contador de Resultados */}
            <div className="flex justify-between items-center text-[11px] text-secondary-hub pt-1">
                <span>
                    Mostrando <strong className="text-primary-hub">{totalFiltered}</strong> {totalFiltered === 1 ? 'auditoria encontrada' : 'auditorias encontradas'}
                </span>
                {hasActiveFilters && (
                    <span className="text-red-600 font-medium">Filtros aplicados</span>
                )}
            </div>
        </div>
    );
}

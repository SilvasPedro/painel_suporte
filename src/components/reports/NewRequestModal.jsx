import React, { useState, useEffect } from 'react';
import { 
    X, Bug, Monitor, Building, Sparkles, AlertTriangle, 
    Check, Clock, HelpCircle
} from 'lucide-react';
import { 
    REQUEST_CATEGORIES, 
    ERROR_DEPARTMENTS, 
    FACILITY_RESOURCES, 
    FACILITY_URGENCIES, 
    OTHER_SUBTYPES, 
    normalizeCategory,
    validateRequestForm
} from '../../types/request.types';
import { getCategorySlaHours } from '../../utils/ispHelpers';

function NewRequestModalContent({
    onClose,
    onSave,
    editingReport,
    saving
}) {
    const initialMeta = editingReport?.metadata || {};
    const initialCat = normalizeCategory(editingReport?.category || editingReport?.type || 'error_analysis');

    // Categoria selecionada
    const [selectedCategory, setSelectedCategory] = useState(initialCat);

    // Estados do Formulário Geral
    const [title, setTitle] = useState(editingReport?.title || '');
    const [description, setDescription] = useState(editingReport?.description || '');
    const [date, setDate] = useState(editingReport?.date || new Date().toISOString().split('T')[0]);
    const priority = editingReport?.priority || 'Normal';

    // Campos de Análise de Erro
    const [protocol, setProtocol] = useState(initialMeta.protocol || editingReport?.protocol || '');
    const [originDepartment, setOriginDepartment] = useState(initialMeta.originDepartment || editingReport?.originDepartment || '');
    const [affectedClient, setAffectedClient] = useState(initialMeta.affectedClient || editingReport?.affectedClient || 'Não');
    const [howAffected, setHowAffected] = useState(initialMeta.howAffected || editingReport?.howAffected || '');

    // Campos de Melhoria de Sistema
    const [affectedApp, setAffectedApp] = useState(initialMeta.affectedApp || editingReport?.affectedApp || '');

    // Campos de Melhoria de Ambiente
    const [resourceType, setResourceType] = useState(initialMeta.resourceType || editingReport?.resourceType || '');
    const [facilityUrgency, setFacilityUrgency] = useState(initialMeta.facilityUrgency || editingReport?.urgency || editingReport?.priority || 'Média');

    // Campos de Outros
    const [otherSubtype, setOtherSubtype] = useState(initialMeta.otherSubtype || editingReport?.otherSubtype || 'Sugestão de Processo / Ideia Geral');
    const [targetAudience, setTargetAudience] = useState(initialMeta.targetAudience || editingReport?.targetAudience || '');

    // Validação e Erros em tempo real
    const [formErrors, setFormErrors] = useState({});

    // Fechar com ESC
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const currentCatMeta = REQUEST_CATEGORIES[
        selectedCategory === 'error_analysis' ? 'ERROR_ANALYSIS' :
        selectedCategory === 'system_improvement' ? 'SYSTEM_IMPROVEMENT' :
        selectedCategory === 'facility_improvement' ? 'FACILITY_IMPROVEMENT' : 'OTHER'
    ];

    const currentSlaHours = getCategorySlaHours(selectedCategory);

    const handleSubmit = (e) => {
        e.preventDefault();

        const currentFormData = {
            category: selectedCategory,
            type: currentCatMeta.label,
            title,
            description,
            date,
            priority: selectedCategory === 'facility_improvement' ? facilityUrgency : priority,
            affectedClient,
            howAffected,
            protocol,
            metadata: {
                affectedDepartment: originDepartment,
                protocol: protocol.trim(),
                affectedClient,
                howAffected: affectedClient === 'Sim' ? howAffected.trim() : '',
                affectedApp: affectedApp.trim(),
                resourceType,
                urgency: facilityUrgency,
                otherSubtype,
                targetAudience: targetAudience.trim()
            }
        };

        const validation = validateRequestForm(currentFormData);
        if (!validation.isValid) {
            setFormErrors(validation.errors);
            return;
        }

        // Monta o payload final normalizado e compatível
        const payload = {
            category: selectedCategory,
            type: currentCatMeta.label,
            title: title.trim(),
            description: description.trim(),
            date,
            priority: selectedCategory === 'facility_improvement' ? facilityUrgency : priority,
            slaHours: currentSlaHours,
            slaStatus: 'within_sla',
            protocol: protocol.trim(),
            affectedClient: selectedCategory === 'error_analysis' ? affectedClient : 'Não',
            howAffected: selectedCategory === 'error_analysis' && affectedClient === 'Sim' ? howAffected.trim() : '',
            metadata: currentFormData.metadata,
            updatedAt: new Date()
        };

        onSave(payload);
    };

    return (
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200 border border-slate-200">
            {/* Header Superior Minimalista */}
            <div className="px-6 py-4 bg-slate-900 text-white flex justify-between items-center shrink-0 border-b border-slate-800">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl bg-slate-800 border border-slate-700 ${currentCatMeta.theme.iconColor}`}>
                        {selectedCategory === 'error_analysis' && <Bug className="w-5 h-5 text-rose-500" />}
                        {selectedCategory === 'system_improvement' && <Monitor className="w-5 h-5 text-indigo-400" />}
                        {selectedCategory === 'facility_improvement' && <Building className="w-5 h-5 text-emerald-400" />}
                        {selectedCategory === 'other' && <Sparkles className="w-5 h-5 text-purple-400" />}
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                            {editingReport ? 'Editar Solicitação' : 'Nova Solicitação Interna'}
                            <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono border ${currentCatMeta.theme.badgeClass}`}>
                                SLA: {currentSlaHours}h
                            </span>
                        </h3>
                        <p className="text-xs text-slate-400">
                            Gestão Operacional de Suporte ISP · {currentCatMeta.label}
                        </p>
                    </div>
                </div>
                <button 
                    type="button" 
                    onClick={onClose} 
                    className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                    title="Fechar (Esc)"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Corpo do Formulário */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 bg-slate-50/70 space-y-6">
                
                {/* 1. SELETOR DE CATEGORIA (SEGMENTED CARDS) */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                            1. Categoria da Solicitação
                        </label>
                        <span className="text-[11px] text-slate-400">Campos ajustados dinamicamente</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {/* Categoria 1: Análise de Erro */}
                        <button
                            type="button"
                            onClick={() => { setSelectedCategory('error_analysis'); setFormErrors({}); }}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-full ${
                                selectedCategory === 'error_analysis'
                                    ? 'border-rose-400 bg-rose-50/70 text-rose-950 shadow-xs ring-2 ring-rose-500/20'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <Bug className={`w-5 h-5 ${selectedCategory === 'error_analysis' ? 'text-rose-600' : 'text-slate-400'}`} />
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">48h</span>
                            </div>
                            <div>
                                <span className="font-bold text-xs block leading-tight">Análise de Erro</span>
                                <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">Falhas operacionais</span>
                            </div>
                        </button>

                        {/* Categoria 2: Melhoria de Sistema */}
                        <button
                            type="button"
                            onClick={() => { setSelectedCategory('system_improvement'); setFormErrors({}); }}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-full ${
                                selectedCategory === 'system_improvement'
                                    ? 'border-indigo-400 bg-indigo-50/70 text-indigo-950 shadow-xs ring-2 ring-indigo-500/20'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <Monitor className={`w-5 h-5 ${selectedCategory === 'system_improvement' ? 'text-indigo-600' : 'text-slate-400'}`} />
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">120h</span>
                            </div>
                            <div>
                                <span className="font-bold text-xs block leading-tight">Melhoria Sistema</span>
                                <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">ERPs, telas e apps</span>
                            </div>
                        </button>

                        {/* Categoria 3: Melhoria de Ambiente */}
                        <button
                            type="button"
                            onClick={() => { setSelectedCategory('facility_improvement'); setFormErrors({}); }}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-full ${
                                selectedCategory === 'facility_improvement'
                                    ? 'border-emerald-400 bg-emerald-50/70 text-emerald-950 shadow-xs ring-2 ring-emerald-500/20'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <Building className={`w-5 h-5 ${selectedCategory === 'facility_improvement' ? 'text-emerald-600' : 'text-slate-400'}`} />
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">72h</span>
                            </div>
                            <div>
                                <span className="font-bold text-xs block leading-tight">Melhoria Ambiente</span>
                                <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">Equipamentos e mobília</span>
                            </div>
                        </button>

                        {/* Categoria 4: Outros */}
                        <button
                            type="button"
                            onClick={() => { setSelectedCategory('other'); setFormErrors({}); }}
                            className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between h-full ${
                                selectedCategory === 'other'
                                    ? 'border-purple-400 bg-purple-50/70 text-purple-950 shadow-xs ring-2 ring-purple-500/20'
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <Sparkles className={`w-5 h-5 ${selectedCategory === 'other' ? 'text-purple-600' : 'text-slate-400'}`} />
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">72h</span>
                            </div>
                            <div>
                                <span className="font-bold text-xs block leading-tight">Outros / Ideias</span>
                                <span className="text-[10px] text-slate-500 mt-0.5 block leading-tight">Comunicados e processos</span>
                            </div>
                        </button>
                    </div>
                </div>

                <form id="newRequestForm" onSubmit={handleSubmit} className="space-y-5">
                    
                    {/* 2. CAMPOS BASE OBRIGATÓRIOS (TÍTULO E DESCRIÇÃO) */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                Título da Solicitação <span className="text-rose-500">*</span>
                            </label>
                            <input 
                                type="text"
                                value={title}
                                onChange={(e) => { setTitle(e.target.value); setFormErrors(prev => ({...prev, title: ''})); }}
                                placeholder={
                                    selectedCategory === 'error_analysis' ? "Ex: Erro de provisionamento no sistema ERP..." :
                                    selectedCategory === 'system_improvement' ? "Ex: Adicionar botão de exportação rápida na tela de faturas..." :
                                    selectedCategory === 'facility_improvement' ? "Ex: Substituição de headset do PA-04 com ruído..." :
                                    "Ex: Proposta de novo comunicado de boas práticas de atendimento..."
                                }
                                className={`w-full p-2.5 border rounded-xl outline-none font-semibold text-sm transition-all text-slate-900 ${
                                    formErrors.title ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'
                                }`}
                            />
                            {formErrors.title && (
                                <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    {formErrors.title}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                {selectedCategory === 'system_improvement' ? 'Descrição da Melhoria Solicitada' :
                                 selectedCategory === 'facility_improvement' ? 'Descrição da Necessidade / Problema' :
                                 selectedCategory === 'other' ? 'Descrição da Proposta / Demanda' :
                                 'Descrição Completa da Falha'} <span className="text-rose-500">*</span>
                            </label>
                            <textarea 
                                rows="4"
                                value={description}
                                onChange={(e) => { setDescription(e.target.value); setFormErrors(prev => ({...prev, description: ''})); }}
                                placeholder={
                                    selectedCategory === 'error_analysis' 
                                        ? "Descreva detalhadamente o que ocorreu, os passos para reproduzir ou o impacto observado..." :
                                    selectedCategory === 'system_improvement'
                                        ? "Explique a alteração desejada, a motivação operacional e qual benefício trará para o time..." :
                                    selectedCategory === 'facility_improvement'
                                        ? "Detalhe o problema enfrentado no equipamento ou posto de trabalho..." :
                                        "Conteúdo detalhado da proposta para análise da coordenação..."
                                }
                                className={`w-full p-3 border rounded-xl outline-none text-sm text-slate-800 resize-none leading-relaxed transition-all ${
                                    formErrors.description ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'
                                }`}
                            />
                            {formErrors.description && (
                                <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                    {formErrors.description}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 3. CAMPOS DINÂMICOS CONFORME A CATEGORIA */}

                    {/* CASO A: ANÁLISE DE ERRO */}
                    {selectedCategory === 'error_analysis' && (
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
                                <span>Parâmetros de Origem e Impacto</span>
                                <span className="text-[11px] font-normal text-slate-400">Análise de Erro</span>
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        Data do Ocorrido <span className="text-rose-500">*</span>
                                    </label>
                                    <input 
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none text-sm text-slate-800"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        Protocolo Vinculado <span className="font-normal text-slate-400">(Opcional)</span>
                                    </label>
                                    <input 
                                        type="text"
                                        value={protocol}
                                        onChange={(e) => setProtocol(e.target.value)}
                                        placeholder="Ex: #TK-2026-9841"
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none text-sm font-mono text-slate-800"
                                    />
                                </div>

                                <div className="sm:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        Departamento de Origem <span className="font-normal text-slate-400">(Opcional)</span>
                                    </label>
                                    <select
                                        value={originDepartment}
                                        onChange={(e) => setOriginDepartment(e.target.value)}
                                        className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none text-sm text-slate-800 bg-white"
                                    >
                                        <option value="">Selecione o setor de origem da falha...</option>
                                        {ERROR_DEPARTMENTS.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Toggle Afetou a Experiência do Cliente? */}
                            <div className="pt-2 border-t border-slate-100">
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                    Afetou a Experiência do Cliente?
                                </label>
                                
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => { setAffectedClient('Não'); setHowAffected(''); setFormErrors(prev => ({...prev, howAffected: ''})); }}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                            affectedClient === 'Não'
                                                ? 'bg-slate-800 text-white border-slate-700 shadow-2xs'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        Não / Falha Interna
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAffectedClient('Sim')}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                            affectedClient === 'Sim'
                                                ? 'bg-rose-600 text-white border-rose-500 shadow-2xs'
                                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                        }`}
                                    >
                                        Sim, Houve Impacto
                                    </button>
                                </div>

                                {/* Campo Condicional Obrigatório se "Sim" */}
                                {affectedClient === 'Sim' && (
                                    <div className="mt-3 p-3.5 bg-rose-50/60 rounded-xl border border-rose-200 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <label className="block text-xs font-bold text-rose-900 uppercase tracking-wider mb-1">
                                            Como isso afetou o cliente? <span className="text-rose-600">*</span>
                                        </label>
                                        <input 
                                            type="text"
                                            value={howAffected}
                                            onChange={(e) => { setHowAffected(e.target.value); setFormErrors(prev => ({...prev, howAffected: ''})); }}
                                            placeholder="Ex: Cliente ficou sem navegação por 40 minutos devido a credencial invertida..."
                                            className={`w-full p-2.5 border rounded-xl outline-none text-sm text-slate-900 bg-white transition-all ${
                                                formErrors.howAffected ? 'border-rose-400 focus:ring-2 focus:ring-rose-500' : 'border-rose-300 focus:border-rose-600'
                                            }`}
                                        />
                                        {formErrors.howAffected && (
                                            <p className="text-xs text-rose-700 mt-1 flex items-center gap-1 font-medium">
                                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                                {formErrors.howAffected}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CASO B: MELHORIA DE SISTEMA */}
                    {selectedCategory === 'system_improvement' && (
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
                                <span>Contexto do Sistema e Aplicação</span>
                                <span className="text-[11px] font-normal text-slate-400">Melhoria de Software</span>
                            </h4>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Tela ou Aplicativo Afetado <span className="text-rose-500">*</span>
                                </label>
                                <input 
                                    type="text"
                                    value={affectedApp}
                                    onChange={(e) => { setAffectedApp(e.target.value); setFormErrors(prev => ({...prev, affectedApp: ''})); }}
                                    placeholder="Ex: Tela de Faturas do ERP, App do Técnico, Módulo de Relatórios da Plataforma Antigravity..."
                                    className={`w-full p-2.5 border rounded-xl outline-none text-sm text-slate-900 transition-all ${
                                        formErrors.affectedApp ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'
                                    }`}
                                />
                                {formErrors.affectedApp && (
                                    <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        {formErrors.affectedApp}
                                    </p>
                                )}
                            </div>

                            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-start gap-2.5">
                                <HelpCircle className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                                <p className="text-xs text-indigo-900 leading-relaxed">
                                    As melhorias de sistema possuem SLA padrão de <strong>120 horas</strong> (5 dias úteis) para triagem inicial e estimativa pela liderança técnica.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* CASO C: MELHORIA DE AMBIENTE / INFRAESTRUTURA INTERNA */}
                    {selectedCategory === 'facility_improvement' && (
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
                                <span>Recurso Físico e Ergonomia</span>
                                <span className="text-[11px] font-normal text-slate-400">Infraestrutura Interna</span>
                            </h4>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Tipo de Item / Recurso <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={resourceType}
                                    onChange={(e) => { setResourceType(e.target.value); setFormErrors(prev => ({...prev, resourceType: ''})); }}
                                    className={`w-full p-2.5 border rounded-xl outline-none text-sm text-slate-800 bg-white transition-all ${
                                        formErrors.resourceType ? 'border-rose-400 bg-rose-50/30' : 'border-slate-300 focus:border-slate-900'
                                    }`}
                                >
                                    <option value="">Selecione o equipamento ou item...</option>
                                    {FACILITY_RESOURCES.map(item => (
                                        <option key={item} value={item}>{item}</option>
                                    ))}
                                </select>
                                {formErrors.resourceType && (
                                    <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        {formErrors.resourceType}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                    Nível de Urgência Operacional <span className="text-rose-500">*</span>
                                </label>
                                <div className="grid grid-cols-3 gap-2.5">
                                    {FACILITY_URGENCIES.map(urg => (
                                        <button
                                            key={urg.id}
                                            type="button"
                                            onClick={() => setFacilityUrgency(urg.id)}
                                            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs ${
                                                facilityUrgency === urg.id
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20 shadow-2xs'
                                                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            {urg.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CASO D: OUTROS (DEMANDAS DIVERSAS & SUGESTÕES GERAIS) */}
                    {selectedCategory === 'other' && (
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
                                <span>Alinhamentos e Ideias Gerais</span>
                                <span className="text-[11px] font-normal text-slate-400">Demandas Diversas</span>
                            </h4>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Subtipo de Solicitação <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={otherSubtype}
                                    onChange={(e) => setOtherSubtype(e.target.value)}
                                    className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 outline-none text-sm text-slate-800 bg-white"
                                >
                                    {OTHER_SUBTYPES.map(sub => (
                                        <option key={sub} value={sub}>{sub}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Público-Alvo / Setor de Aplicação <span className="text-rose-500">*</span>
                                </label>
                                <input 
                                    type="text"
                                    value={targetAudience}
                                    onChange={(e) => { setTargetAudience(e.target.value); setFormErrors(prev => ({...prev, targetAudience: ''})); }}
                                    placeholder="Ex: Toda a equipe de suporte, Supervisão e Coordenação, N1..."
                                    className={`w-full p-2.5 border rounded-xl outline-none text-sm text-slate-900 transition-all ${
                                        formErrors.targetAudience ? 'border-rose-400 bg-rose-50/30 focus:ring-2 focus:ring-rose-500' : 'border-slate-300 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10'
                                    }`}
                                />
                                {formErrors.targetAudience && (
                                    <p className="text-xs text-rose-600 mt-1 flex items-center gap-1 font-medium">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        {formErrors.targetAudience}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                </form>
            </div>

            {/* Footer com Ações */}
            <div className="p-4 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span>SLA Estimado: <strong className="text-slate-700">{currentSlaHours}h</strong></span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="newRequestForm"
                        disabled={saving}
                        className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>Salvando...</span>
                            </>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                <span>{editingReport ? 'Salvar Alterações' : 'Registrar Solicitação'}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function NewRequestModal({
    isOpen,
    onClose,
    onSave,
    editingReport = null,
    saving = false
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-3 sm:p-4 z-[90] backdrop-blur-xs overflow-y-auto">
            <NewRequestModalContent 
                key={editingReport?.id || 'new_request'}
                onClose={onClose}
                onSave={onSave}
                editingReport={editingReport}
                saving={saving}
            />
        </div>
    );
}

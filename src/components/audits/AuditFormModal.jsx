import React, { useState, useMemo } from 'react';
import { 
    X, ShieldCheck, CheckCircle2, XCircle, MinusCircle, 
    Calendar, User, FileText, Phone, MessageSquare, 
    Ticket, Mail, Check, AlertTriangle, Loader2, Save, 
    CheckCheck, RotateCcw, MessageCircle, Sliders, Sparkles
} from 'lucide-react';

const CHANNELS = [
    { id: 'Telefone', label: 'Ligação / Voz', icon: Phone },
    { id: 'WhatsApp', label: 'WhatsApp', icon: MessageSquare },
    { id: 'Chat', label: 'Chat Online', icon: MessageCircle },
    { id: 'Ticket', label: 'Ticket / Helpdesk', icon: Ticket },
    { id: 'E-mail', label: 'E-mail', icon: Mail }
];

function AuditFormModalContent({
    onClose,
    auditToEdit = null,
    collaboratorsList = [],
    qaProcesses = [],
    onSave,
    isSaving = false
}) {
    // Inicialização direta do estado a partir das props
    const [colabId, setColabId] = useState(auditToEdit?.colabId || '');
    const [date, setDate] = useState(auditToEdit?.date || new Date().toISOString().split('T')[0]);
    const [protocol, setProtocol] = useState(auditToEdit?.protocol || '');
    const [channel, setChannel] = useState(auditToEdit?.channel || 'Telefone');
    const [processId, setProcessId] = useState(auditToEdit?.processId || '');
    const [notes, setNotes] = useState(auditToEdit?.notes || '');
    
    // Checklist de itens
    const initialResults = useMemo(() => {
        return auditToEdit?.checklistResults ? { ...auditToEdit.checklistResults } : {};
    }, [auditToEdit]);

    const initialItemNotes = useMemo(() => {
        return auditToEdit?.checklistNotes ? { ...auditToEdit.checklistNotes } : {};
    }, [auditToEdit]);

    const [checklistResults, setChecklistResults] = useState(initialResults);
    const [checklistNotes, setChecklistNotes] = useState(initialItemNotes);
    const [expandedNoteIndex, setExpandedNoteIndex] = useState(null);

    // Controle de status e override manual
    const [manualStatusOverride, setManualStatusOverride] = useState(!!auditToEdit?.status);
    const [manualStatus, setManualStatus] = useState(auditToEdit?.status || 'Conforme');

    // Recupera o processo selecionado
    const selectedProcess = useMemo(() => {
        return qaProcesses.find(p => p.id === processId);
    }, [qaProcesses, processId]);

    const activeChecklist = useMemo(() => {
        if (!selectedProcess) return [];
        return Array.isArray(selectedProcess.checklist) ? selectedProcess.checklist : [];
    }, [selectedProcess]);

    // Troca de processo
    const handleProcessSelect = (newProcId) => {
        setProcessId(newProcId);
        setChecklistResults({});
        setChecklistNotes({});
        setExpandedNoteIndex(null);
    };

    // Marcação de item individual
    const handleMarkItem = (questionText, statusOption, index) => {
        setChecklistResults(prev => ({
            ...prev,
            [questionText]: statusOption
        }));

        // Se falhou, abre automaticamente o campo de anotação daquele item para dar feedback
        if (statusOption === 'Falhou') {
            setExpandedNoteIndex(index);
        }
    };

    const handleItemNoteChange = (questionText, noteValue) => {
        setChecklistNotes(prev => ({
            ...prev,
            [questionText]: noteValue
        }));
    };

    // --- AÇÕES RÁPIDAS DO AUDITOR ---
    const handleApproveAll = () => {
        if (activeChecklist.length === 0) return;
        const allPassed = {};
        activeChecklist.forEach(q => {
            allPassed[q] = 'Passou';
        });
        setChecklistResults(allPassed);
    };

    const handleResetChecklist = () => {
        setChecklistResults({});
        setChecklistNotes({});
    };

    // --- CÁLCULO DINÂMICO DE SCORE E SUGESTÃO DE STATUS ---
    const { passCount, failCount, naCount, totalAnswered, totalItems, calculatedScore, autoSuggestedStatus } = useMemo(() => {
        const total = activeChecklist.length;
        let pass = 0;
        let fail = 0;
        let na = 0;

        activeChecklist.forEach(q => {
            const res = checklistResults[q];
            if (res === 'Passou') pass++;
            else if (res === 'Falhou') fail++;
            else if (res === 'N/A') na++;
        });

        const answered = pass + fail + na;
        const scoreDivisor = pass + fail;
        const score = scoreDivisor > 0 ? Math.round((pass / scoreDivisor) * 100) : 100;
        const suggested = score >= 80 ? 'Conforme' : 'Não Conforme';

        return {
            passCount: pass,
            failCount: fail,
            naCount: na,
            totalAnswered: answered,
            totalItems: total,
            calculatedScore: score,
            autoSuggestedStatus: suggested
        };
    }, [activeChecklist, checklistResults]);

    // O status final considerado: se o auditor clicou em override ou se segue a sugestão automática
    const effectiveStatus = manualStatusOverride ? manualStatus : autoSuggestedStatus;

    // Submissão
    const handleSubmit = (e) => {
        e.preventDefault();
        onSave({
            colabId,
            date,
            protocol: protocol.trim(),
            channel,
            processId,
            processName: selectedProcess?.name || '',
            status: effectiveStatus,
            score: calculatedScore,
            passedItems: passCount,
            failedItems: failCount,
            naItems: naCount,
            totalItems,
            notes: notes.trim(),
            checklistResults,
            checklistNotes
        });
    };

    return (
        <div 
            id="audit-form-modal-backdrop"
            className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-3 sm:p-6 z-[85] backdrop-blur-xs animate-in fade-in duration-150"
        >
            <div 
                id="audit-form-modal-container"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[94vh] border border-gray-200"
            >
                {/* Cabeçalho do Modal */}
                <div className="p-4 sm:p-5 bg-zinc-950 text-white flex justify-between items-center shrink-0 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 text-red-500 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-bold">
                                    {auditToEdit ? 'Editar Auditoria QA' : 'Nova Auditoria de Qualidade'}
                                </h2>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                    effectiveStatus === 'Conforme'
                                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                        : 'bg-red-950 text-red-400 border border-red-800'
                                }`}>
                                    {effectiveStatus} ({calculatedScore}%)
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Preencha os dados do chamado e avalie os critérios objetivos na checklist.
                            </p>
                        </div>
                    </div>

                    <button 
                        type="button" 
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Corpo do Formulário com Scroll */}
                <div className="overflow-y-auto flex-1 p-4 sm:p-6 bg-gray-50/60">
                    <form id="auditForm" onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* COLUNA ESQUERDA (5 colunas no desktop): Dados Básicos e Resultado */}
                        <div className="lg:col-span-5 space-y-5">
                            
                            {/* Card 1: Identificação do Atendimento */}
                            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-gray-100">
                                    <FileText className="w-4 h-4 text-red-600" />
                                    Dados do Atendimento
                                </h3>

                                {/* Colaborador */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Colaborador Auditado <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        required
                                        value={colabId}
                                        onChange={(e) => setColabId(e.target.value)}
                                        className="w-full p-2.5 text-xs font-semibold bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none cursor-pointer"
                                    >
                                        <option value="" disabled>Selecione o colaborador...</option>
                                        {collaboratorsList.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Data e Protocolo */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">
                                            Data do Atendimento <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            className="w-full p-2 text-xs bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700 mb-1">
                                            Protocolo / ID <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="Ex: #984321"
                                            value={protocol}
                                            onChange={(e) => setProtocol(e.target.value)}
                                            className="w-full p-2 text-xs font-mono font-bold bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Canal de Atendimento */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                        Canal de Comunicação
                                    </label>
                                    <div className="grid grid-cols-3 gap-1.5">
                                        {CHANNELS.map(ch => {
                                            const Icon = ch.icon;
                                            const isSelected = channel === ch.id;
                                            return (
                                                <button
                                                    key={ch.id}
                                                    type="button"
                                                    onClick={() => setChannel(ch.id)}
                                                    className={`p-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs'
                                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <Icon className="w-3 h-3" />
                                                    <span className="truncate">{ch.id}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Processo QA Selecionado */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Processo / Procedimento Auditado <span className="text-red-500">*</span>
                                    </label>
                                    {qaProcesses.length === 0 ? (
                                        <div className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 shrink-0" />
                                            <span>Nenhum processo cadastrado. Acesse as Configurações para criar checklists.</span>
                                        </div>
                                    ) : (
                                        <select
                                            required
                                            value={processId}
                                            onChange={(e) => handleProcessSelect(e.target.value)}
                                            className="w-full p-2.5 text-xs font-bold bg-gray-50 hover:bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none cursor-pointer transition-all"
                                        >
                                            <option value="" disabled>Selecione o procedimento de QA...</option>
                                            {qaProcesses.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} {p.category ? `(${p.category})` : ''} — {p.checklist?.length || 0} perguntas
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>

                            {/* Card 2: Resultado & Cálculo de Score */}
                            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-2xs space-y-4">
                                <div className="flex justify-between items-center pb-2 border-b border-gray-100">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-amber-500" />
                                        Resultado & Pontuação
                                    </h3>
                                    <span className="text-[11px] font-mono font-bold text-gray-400">
                                        Cálculo em tempo real
                                    </span>
                                </div>

                                {/* Gauge / Pontuação Visual */}
                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between">
                                    <div>
                                        <span className="text-[11px] font-bold text-gray-500 uppercase block">
                                            Pontuação Calculada
                                        </span>
                                        <div className="flex items-baseline gap-1.5 mt-0.5">
                                            <span className={`text-3xl font-black ${
                                                calculatedScore >= 80 ? 'text-emerald-600' : 'text-red-600'
                                            }`}>
                                                {calculatedScore}%
                                            </span>
                                            <span className="text-xs text-gray-400 font-medium">
                                                (Meta: 80%)
                                            </span>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <span className="text-[11px] text-gray-500 block font-medium">
                                            Sugestão do sistema:
                                        </span>
                                        <span className={`inline-block mt-0.5 text-xs font-black px-2.5 py-1 rounded-lg ${
                                            autoSuggestedStatus === 'Conforme'
                                                ? 'bg-emerald-100 text-emerald-800'
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                            {autoSuggestedStatus}
                                        </span>
                                    </div>
                                </div>

                                {/* Seletor de Status (com suporte a override) */}
                                <div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <label className="block text-xs font-bold text-gray-700">
                                            Status Final da Auditoria
                                        </label>
                                        {manualStatusOverride && (
                                            <button
                                                type="button"
                                                onClick={() => setManualStatusOverride(false)}
                                                className="text-[11px] text-blue-600 hover:underline font-semibold cursor-pointer"
                                            >
                                                Restaurar cálculo automático
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setManualStatusOverride(true);
                                                setManualStatus('Conforme');
                                            }}
                                            className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                                                effectiveStatus === 'Conforme'
                                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-2xs'
                                                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                                            }`}
                                        >
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                            <span>Conforme</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setManualStatusOverride(true);
                                                setManualStatus('Não Conforme');
                                            }}
                                            className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 font-bold text-xs transition-all cursor-pointer ${
                                                effectiveStatus === 'Não Conforme'
                                                    ? 'border-red-500 bg-red-50 text-red-800 shadow-2xs'
                                                    : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
                                            }`}
                                        >
                                            <XCircle className="w-4 h-4 text-red-600" />
                                            <span>Não Conforme</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Observações / Parecer Geral */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                        Parecer Geral / Feedback ao Atendente <span className="text-gray-400 font-normal">(opcional)</span>
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Comentários sobre a postura, cordialidade, acertos ou orientações de melhoria..."
                                        className="w-full p-2.5 text-xs bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-600 outline-none resize-none"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* COLUNA DIREITA (7 colunas no desktop): Checklist Dinâmica com Atalhos */}
                        <div className="lg:col-span-7 flex flex-col space-y-4">
                            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200 shadow-2xs flex-1 flex flex-col">
                                
                                {/* Topo da Checklist com Botões de Ação Rápida */}
                                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 pb-3 border-b border-gray-100 shrink-0">
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4 text-red-600" />
                                            Itens de Verificação da Checklist
                                        </h3>
                                        <p className="text-[11px] text-gray-500 mt-0.5">
                                            {totalAnswered} de {totalItems} critérios respondidos
                                        </p>
                                    </div>

                                    {/* Atalhos: Aprovar Todos / Limpar */}
                                    {activeChecklist.length > 0 && (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={handleApproveAll}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer"
                                                title="Marcar todos os critérios como Passou com 1 clique"
                                            >
                                                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                                                <span>Aprovar Todos</span>
                                            </button>
                                            
                                            <button
                                                type="button"
                                                onClick={handleResetChecklist}
                                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                                title="Limpar todas as respostas"
                                            >
                                                <RotateCcw className="w-3 h-3" />
                                                <span>Limpar</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Barra de Progresso da Checklist */}
                                {totalItems > 0 && (
                                    <div className="pt-3 pb-1 shrink-0">
                                        <div className="flex justify-between items-center text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                            <span>Progresso da Avaliação</span>
                                            <span>{passCount} Passou • {failCount} Falhou • {naCount} N/A</span>
                                        </div>
                                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                            <div 
                                                className="h-full bg-emerald-500 transition-all duration-300"
                                                style={{ width: `${(passCount / totalItems) * 100}%` }}
                                            />
                                            <div 
                                                className="h-full bg-red-500 transition-all duration-300"
                                                style={{ width: `${(failCount / totalItems) * 100}%` }}
                                            />
                                            <div 
                                                className="h-full bg-gray-300 transition-all duration-300"
                                                style={{ width: `${(naCount / totalItems) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Lista Rolável de Perguntas */}
                                <div className="flex-1 overflow-y-auto space-y-3 pt-3 pr-1">
                                    {!processId ? (
                                        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 p-6 text-center">
                                            <Sliders className="w-10 h-10 mb-2 opacity-30" />
                                            <p className="text-xs font-bold text-gray-600">Nenhum processo selecionado</p>
                                            <p className="text-[11px] text-gray-400 mt-1">
                                                Escolha o procedimento de suporte na coluna ao lado para carregar os critérios de verificação.
                                            </p>
                                        </div>
                                    ) : activeChecklist.length === 0 ? (
                                        <div className="p-6 text-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl">
                                            Este processo não possui perguntas cadastradas. Edite-o nas configurações para adicionar perguntas.
                                        </div>
                                    ) : (
                                        activeChecklist.map((question, index) => {
                                            const currentVal = checklistResults[question];
                                            const itemNote = checklistNotes[question] || '';
                                            const isNoteOpen = expandedNoteIndex === index || !!itemNote;

                                            return (
                                                <div 
                                                    key={index}
                                                    className={`p-3.5 rounded-xl border transition-all ${
                                                        currentVal === 'Passou'
                                                            ? 'bg-emerald-50/40 border-emerald-200'
                                                            : currentVal === 'Falhou'
                                                                ? 'bg-red-50/40 border-red-200'
                                                                : currentVal === 'N/A'
                                                                    ? 'bg-gray-50 border-gray-200'
                                                                    : 'bg-white border-gray-200 hover:border-gray-300'
                                                    }`}
                                                >
                                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                                        {/* Texto da Pergunta */}
                                                        <div className="flex items-start gap-2.5 flex-1">
                                                            <span className="text-xs font-mono font-bold text-gray-400 mt-0.5 shrink-0">
                                                                {index + 1}.
                                                            </span>
                                                            <span className="text-xs font-semibold text-gray-800 leading-relaxed">
                                                                {question}
                                                            </span>
                                                        </div>

                                                        {/* Botões Passou / Falhou / N/A */}
                                                        <div className="flex items-center gap-1 self-end sm:self-auto shrink-0 bg-gray-100 p-1 rounded-xl">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMarkItem(question, 'Passou', index)}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                                                    currentVal === 'Passou'
                                                                        ? 'bg-emerald-600 text-white shadow-2xs'
                                                                        : 'text-gray-600 hover:bg-gray-200'
                                                                }`}
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                                <span>Passou</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => handleMarkItem(question, 'Falhou', index)}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                                                    currentVal === 'Falhou'
                                                                        ? 'bg-red-600 text-white shadow-2xs'
                                                                        : 'text-gray-600 hover:bg-gray-200'
                                                                }`}
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                                <span>Falhou</span>
                                                            </button>

                                                            <button
                                                                type="button"
                                                                onClick={() => handleMarkItem(question, 'N/A', index)}
                                                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                                                    currentVal === 'N/A'
                                                                        ? 'bg-zinc-800 text-white shadow-2xs'
                                                                        : 'text-gray-600 hover:bg-gray-200'
                                                                }`}
                                                            >
                                                                N/A
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Botão para abrir campo de nota se não estiver aberto */}
                                                    {!isNoteOpen && (
                                                        <div className="mt-2 pl-6">
                                                            <button
                                                                type="button"
                                                                onClick={() => setExpandedNoteIndex(index)}
                                                                className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <MessageSquare className="w-3 h-3" />
                                                                <span>Adicionar observação sobre este item...</span>
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Campo de Anotação Específica do Critério */}
                                                    {isNoteOpen && (
                                                        <div className="mt-2.5 pl-6 animate-in fade-in duration-100">
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={itemNote}
                                                                    onChange={(e) => handleItemNoteChange(question, e.target.value)}
                                                                    placeholder="Apontamento específico (ex: O colaborador não realizou o teste na rede 5GHz)..."
                                                                    className="flex-1 p-2 text-xs bg-white border border-gray-300 rounded-lg focus:ring-1 focus:ring-red-500 outline-none"
                                                                />
                                                                {!itemNote && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setExpandedNoteIndex(null)}
                                                                        className="text-gray-400 hover:text-gray-600 text-xs p-1"
                                                                    >
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                    </form>
                </div>

                {/* Rodapé com Botões de Ação */}
                <div className="p-4 sm:p-5 bg-white border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
                    <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span>
                            Resultado final: <strong className={effectiveStatus === 'Conforme' ? 'text-emerald-600' : 'text-red-600'}>{effectiveStatus}</strong> ({calculatedScore}%)
                        </span>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="flex-1 sm:flex-none px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-bold text-xs transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            form="auditForm"
                            disabled={isSaving || !colabId || !processId}
                            className="flex-1 sm:flex-none px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs transition-all shadow-xs hover:shadow flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Salvando Auditoria...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>{auditToEdit ? 'Atualizar Auditoria' : 'Salvar Auditoria'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function AuditFormModal({
    isOpen,
    onClose,
    auditToEdit = null,
    collaboratorsList = [],
    qaProcesses = [],
    onSave,
    isSaving = false
}) {
    if (!isOpen) return null;

    return (
        <AuditFormModalContent
            key={auditToEdit ? auditToEdit.id : 'new-audit'}
            onClose={onClose}
            auditToEdit={auditToEdit}
            collaboratorsList={collaboratorsList}
            qaProcesses={qaProcesses}
            onSave={onSave}
            isSaving={isSaving}
        />
    );
}

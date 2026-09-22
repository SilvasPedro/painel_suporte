import React, { useState, useMemo } from 'react';
import { 
    X, ShieldCheck, CheckCircle2, XCircle, MinusCircle, 
    Phone, MessageSquare, Ticket, Mail, Printer, Copy, 
    Check, AlertCircle, HelpCircle, FileText, User, 
    Calendar, Layers, Filter, Sparkles, AlertTriangle
} from 'lucide-react';

const CHANNEL_ICONS = {
    'Telefone': Phone,
    'WhatsApp': MessageSquare,
    'Chat': MessageSquare,
    'Ticket': Ticket,
    'E-mail': Mail
};

export default function AuditDetailModal({
    isOpen,
    onClose,
    audit,
    qaProcess = null,
    onShowToast
}) {
    const [stepFilter, setStepFilter] = useState('all'); // 'all' | 'failed' | 'passed' | 'na'
    const [copied, setCopied] = useState(false);

    const ChannelIcon = CHANNEL_ICONS[audit?.channel] || Ticket;
    const isConforme = audit?.status === 'Conforme';

    // Normalização das etapas / critérios avaliados
    const steps = useMemo(() => {
        if (!audit) return [];
        const rawResults = audit.checklistResults || {};
        const rawNotes = audit.checklistNotes || {};
        const processChecklist = Array.isArray(qaProcess?.checklist) ? qaProcess.checklist : [];
        
        const extracted = [];
        const processedKeys = new Set();

        // 1. Se o processo possuir uma lista ordenada de checklist, utiliza-a como base das etapas
        if (processChecklist.length > 0) {
            processChecklist.forEach((question, idx) => {
                const byText = rawResults[question];
                const byIndex = rawResults[idx] !== undefined ? rawResults[idx] : rawResults[String(idx)];
                const status = byText || byIndex || (rawResults && Object.keys(rawResults).length > 0 ? 'Não Avaliado' : (isConforme ? 'Passou' : 'Falhou'));
                
                const note = rawNotes[question] || rawNotes[idx] || rawNotes[String(idx)] || '';

                processedKeys.add(question);
                processedKeys.add(idx);
                processedKeys.add(String(idx));

                extracted.push({
                    stepNumber: idx + 1,
                    criterion: question,
                    status: status,
                    note: note
                });
            });
        }

        // 2. Se houver chaves em checklistResults que não estavam no array do processo (ou se o processo não tiver checklist)
        Object.entries(rawResults).forEach(([key, val]) => {
            if (processedKeys.has(key)) return;

            // Verifica se a chave é um índice numérico
            const numericIndex = Number(key);
            let criterionText = key;
            if (!isNaN(numericIndex) && processChecklist[numericIndex]) {
                criterionText = processChecklist[numericIndex];
            }

            extracted.push({
                stepNumber: extracted.length + 1,
                criterion: criterionText,
                status: val,
                note: rawNotes[key] || ''
            });
        });

        // 3. Fallback se não houver checklistResults salvo (auditoria antiga/legado)
        if (extracted.length === 0 && processChecklist.length > 0) {
            processChecklist.forEach((question, idx) => {
                extracted.push({
                    stepNumber: idx + 1,
                    criterion: question,
                    status: isConforme ? 'Passou' : 'Falhou',
                    note: idx === 0 && audit.notes ? audit.notes : ''
                });
            });
        }

        return extracted;
    }, [audit, qaProcess, isConforme]);

    // Métricas calculadas das etapas
    const { passCount, failCount, naCount, totalSteps, scorePercent } = useMemo(() => {
        let pass = 0;
        let fail = 0;
        let na = 0;

        steps.forEach(s => {
            if (s.status === 'Passou') pass++;
            else if (s.status === 'Falhou') fail++;
            else if (s.status === 'N/A') na++;
        });

        const total = steps.length;
        const validEvaluated = pass + fail;
        let calcScore = 0;
        if (audit.score !== undefined && audit.score !== null) {
            calcScore = Number(audit.score);
        } else if (validEvaluated > 0) {
            calcScore = Math.round((pass / validEvaluated) * 100);
        } else {
            calcScore = isConforme ? 100 : 0;
        }

        return {
            passCount: pass,
            failCount: fail,
            naCount: na,
            totalSteps: total,
            scorePercent: calcScore
        };
    }, [steps, audit.score, isConforme]);

    // Filtragem das etapas exibidas
    const filteredSteps = useMemo(() => {
        if (stepFilter === 'failed') return steps.filter(s => s.status === 'Falhou');
        if (stepFilter === 'passed') return steps.filter(s => s.status === 'Passou');
        if (stepFilter === 'na') return steps.filter(s => s.status === 'N/A');
        return steps;
    }, [steps, stepFilter]);

    const handleCopyProtocol = () => {
        if (!audit.protocol) return;
        navigator.clipboard.writeText(audit.protocol);
        setCopied(true);
        if (onShowToast) onShowToast('Protocolo copiado para a área de transferência!', 'success');
        setTimeout(() => setCopied(false), 2000);
    };

    const handlePrint = () => {
        window.print();
    };

    if (!isOpen || !audit) return null;

    const formattedDate = audit.date 
        ? (audit.date.includes('-') 
            ? audit.date.split('-').reverse().join('/') 
            : audit.date)
        : (audit.createdAt?.toDate ? audit.createdAt.toDate().toLocaleDateString('pt-BR') : '--');

    return (
        <div 
            id="audit-detailed-analysis-backdrop"
            className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center p-2 sm:p-4 z-[85] backdrop-blur-xs animate-in fade-in duration-150"
        >
            <div 
                id="audit-detailed-analysis-modal"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-200"
            >
                {/* CABEÇALHO PRINCIPAL */}
                <div className="p-4 sm:p-6 bg-zinc-950 text-white flex flex-col sm:flex-row justify-between sm:items-center gap-4 shrink-0 border-b border-zinc-800">
                    <div className="flex items-start sm:items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                            isConforme 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                            {isConforme ? <CheckCircle2 className="w-7 h-7" /> : <XCircle className="w-7 h-7" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white">
                                    Análise Detalhada da Auditoria QA
                                </h2>
                                <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${
                                    isConforme 
                                        ? 'bg-emerald-950/90 text-emerald-400 border-emerald-700/60' 
                                        : 'bg-red-950/90 text-red-400 border-red-700/60'
                                }`}>
                                    {audit.status || 'Conforme'} &bull; {scorePercent}%
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1 flex-wrap">
                                <span>Realizado em: <strong className="text-zinc-200">{formattedDate}</strong></span>
                                <span>&bull;</span>
                                <span className="flex items-center gap-1">
                                    Canal: <ChannelIcon className="w-3.5 h-3.5 text-red-400 ml-0.5" />
                                    <strong className="text-zinc-200">{audit.channel || 'Ticket / Sistema'}</strong>
                                </span>
                                {audit.evaluatorName && (
                                    <>
                                        <span>&bull;</span>
                                        <span>Auditor: <strong className="text-zinc-200">{audit.evaluatorName}</strong></span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Ações do Topo */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer hidden md:flex items-center gap-1.5 text-xs font-medium border border-zinc-800"
                            title="Imprimir relatório da auditoria"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Imprimir</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer border border-zinc-800"
                            title="Fechar modal"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* CONTEÚDO COM SCROLL */}
                <div className="overflow-y-auto flex-1 p-4 sm:p-6 bg-gray-50/70 space-y-6">
                    
                    {/* BANNER DO PROCESSO & PROTOCOLO */}
                    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-2xs">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3.5 border-b border-gray-100">
                            <div>
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-0.5">
                                    Procedimento Operacional Auditado
                                </span>
                                <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-red-600 shrink-0" />
                                    <span>{audit.processName || qaProcess?.name || 'Procedimento Padrão de Suporte'}</span>
                                    {qaProcess?.category && (
                                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">
                                            {qaProcess.category}
                                        </span>
                                    )}
                                </h3>
                            </div>

                            {/* Tag de Protocolo com Cópia Rápida */}
                            <div className="flex items-center gap-2">
                                <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase">Protocolo:</span>
                                    <span className="font-mono font-bold text-gray-900 text-xs sm:text-sm">
                                        {audit.protocol || 'Sem protocolo'}
                                    </span>
                                    {audit.protocol && (
                                        <button
                                            type="button"
                                            onClick={handleCopyProtocol}
                                            className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer p-0.5"
                                            title="Copiar protocolo"
                                        >
                                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {qaProcess?.description && (
                            <p className="text-xs text-gray-500 pt-2.5 leading-relaxed">
                                {qaProcess.description}
                            </p>
                        )}
                    </div>

                    {/* SCORECARD DE ETAPAS E APROVEITAMENTO */}
                    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-2xs space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                            <div>
                                <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    Aproveitamento nas Etapas da Auditoria
                                </h4>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Índice de conformidade baseado nos critérios obrigatórios e opcionais avaliados.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className={`text-2xl font-black font-mono ${
                                    scorePercent >= 80 ? 'text-emerald-600' : 'text-red-600'
                                }`}>
                                    {scorePercent}%
                                </span>
                                <span className="text-[11px] font-bold text-gray-400 uppercase">
                                    Aproveitamento
                                </span>
                            </div>
                        </div>

                        {/* Barra de Progresso Visual Segmentada */}
                        <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex shadow-inner">
                            {totalSteps > 0 && (
                                <>
                                    <div 
                                        className="h-full bg-emerald-500 transition-all duration-500"
                                        style={{ width: `${(passCount / totalSteps) * 100}%` }}
                                        title={`${passCount} Conformes / Aprovados`}
                                    />
                                    <div 
                                        className="h-full bg-red-500 transition-all duration-500"
                                        style={{ width: `${(failCount / totalSteps) * 100}%` }}
                                        title={`${failCount} Não Conformes / Falharam`}
                                    />
                                    <div 
                                        className="h-full bg-gray-300 transition-all duration-500"
                                        style={{ width: `${(naCount / totalSteps) * 100}%` }}
                                        title={`${naCount} Não Aplicáveis (N/A)`}
                                    />
                                </>
                            )}
                        </div>

                        {/* Indicadores em 4 Colunas */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                    Total de Etapas
                                </span>
                                <span className="text-lg font-black text-gray-900 mt-0.5 block">
                                    {totalSteps}
                                </span>
                            </div>

                            <div className="bg-emerald-50/80 rounded-xl p-3 border border-emerald-100 text-center">
                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block flex items-center justify-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Aprovadas
                                </span>
                                <span className="text-lg font-black text-emerald-800 mt-0.5 block">
                                    {passCount}
                                </span>
                            </div>

                            <div className="bg-red-50/80 rounded-xl p-3 border border-red-100 text-center">
                                <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block flex items-center justify-center gap-1">
                                    <XCircle className="w-3 h-3" /> Reprovadas
                                </span>
                                <span className="text-lg font-black text-red-800 mt-0.5 block">
                                    {failCount}
                                </span>
                            </div>

                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 text-center">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block flex items-center justify-center gap-1">
                                    <MinusCircle className="w-3 h-3" /> Não se aplica
                                </span>
                                <span className="text-lg font-black text-gray-700 mt-0.5 block">
                                    {naCount}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* DETALHAMENTO DAS ETAPAS E CRITÉRIOS AVALIADOS */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
                        {/* Barra Superior da Checklist */}
                        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                            <div>
                                <h3 className="text-xs font-black text-gray-900 uppercase tracking-wider flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-red-600" />
                                    Detalhamento Passo a Passo das Etapas
                                </h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Veja individualmente cada ação avaliada e os apontamentos feitos pelo auditor.
                                </p>
                            </div>

                            {/* Filtro Rápido Interno */}
                            <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto">
                                <button
                                    type="button"
                                    onClick={() => setStepFilter('all')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        stepFilter === 'all'
                                            ? 'bg-zinc-900 text-white shadow-2xs'
                                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                                    }`}
                                >
                                    Todas ({steps.length})
                                </button>
                                {failCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setStepFilter('failed')}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                            stepFilter === 'failed'
                                                ? 'bg-red-600 text-white shadow-2xs'
                                                : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                                        }`}
                                    >
                                        <XCircle className="w-3 h-3" /> Falhas ({failCount})
                                    </button>
                                )}
                                {passCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setStepFilter('passed')}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                            stepFilter === 'passed'
                                                ? 'bg-emerald-600 text-white shadow-2xs'
                                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                        }`}
                                    >
                                        <CheckCircle2 className="w-3 h-3" /> Aprovadas ({passCount})
                                    </button>
                                )}
                                {naCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setStepFilter('na')}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                            stepFilter === 'na'
                                                ? 'bg-gray-700 text-white shadow-2xs'
                                                : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                                        }`}
                                    >
                                        N/A ({naCount})
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Lista das Etapas */}
                        <div className="divide-y divide-gray-100 p-2 sm:p-3">
                            {filteredSteps.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-xs">
                                    Nenhuma etapa corresponde ao filtro selecionado.
                                </div>
                            ) : (
                                filteredSteps.map((step) => {
                                    const isPass = step.status === 'Passou';
                                    const isFail = step.status === 'Falhou';
                                    const isNa = step.status === 'N/A';

                                    return (
                                        <div 
                                            key={step.stepNumber} 
                                            className={`p-3.5 rounded-xl transition-all my-1 ${
                                                isFail 
                                                    ? 'bg-red-50/40 border border-red-200/80 shadow-2xs' 
                                                    : isPass 
                                                    ? 'hover:bg-gray-50/80 border border-transparent' 
                                                    : 'bg-gray-50/40 border border-gray-200/40'
                                            }`}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                <div className="flex items-start gap-3 flex-1">
                                                    <span className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-black shrink-0 mt-0.5 border ${
                                                        isFail
                                                            ? 'bg-red-100 text-red-800 border-red-300'
                                                            : isPass
                                                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                                            : 'bg-gray-100 text-gray-600 border-gray-200'
                                                    }`}>
                                                        Etapa {String(step.stepNumber).padStart(2, '0')}
                                                    </span>

                                                    <div className="flex-1">
                                                        <p className="text-xs sm:text-sm font-semibold text-gray-900 leading-relaxed">
                                                            {step.criterion}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Badge do Status da Etapa */}
                                                <div className="shrink-0 self-start sm:self-center">
                                                    {isPass && (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Conforme
                                                        </span>
                                                    )}
                                                    {isFail && (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 shadow-2xs animate-pulse">
                                                            <XCircle className="w-3.5 h-3.5 text-red-600" /> Não Conforme
                                                        </span>
                                                    )}
                                                    {isNa && (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
                                                            <MinusCircle className="w-3.5 h-3.5 text-gray-500" /> Não se Aplica
                                                        </span>
                                                    )}
                                                    {!isPass && !isFail && !isNa && (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> {step.status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Apontamento Específico do Auditor para esta Etapa */}
                                            {step.note && (
                                                <div className="mt-2.5 ml-0 sm:ml-10 p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950 flex items-start gap-2 shadow-2xs">
                                                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                                    <div className="flex-1">
                                                        <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800 block mb-0.5">
                                                            Apontamento do Auditor nesta etapa:
                                                        </span>
                                                        <p className="leading-relaxed font-medium">
                                                            {step.note}
                                                        </p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* PARECER GERAL / OBSERVAÇÕES DO AUDITOR */}
                    {audit.notes ? (
                        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-2xs space-y-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-red-600" />
                                Parecer Conclusivo & Orientações Gerais do Auditor
                            </span>
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs sm:text-sm text-gray-800 leading-relaxed whitespace-pre-wrap font-medium">
                                {audit.notes}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl p-4 border border-gray-200 text-xs text-gray-400 text-center">
                            Nenhuma observação geral adicional foi registrada pelo auditor para esta avaliação.
                        </div>
                    )}

                </div>

                {/* RODAPÉ DO MODAL */}
                <div className="p-4 bg-white border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-500 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Auditoria oficial arquivada no histórico de qualidade
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-6 py-2.5 bg-zinc-950 hover:bg-zinc-800 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs"
                    >
                        Fechar Visualização
                    </button>
                </div>
            </div>
        </div>
    );
}

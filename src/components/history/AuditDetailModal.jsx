import React, { useState, useMemo } from 'react';
import { 
    X, ShieldCheck, CheckCircle2, XCircle, MinusCircle, 
    Phone, MessageSquare, Ticket, Mail, Printer, Copy, 
    Check, AlertCircle, HelpCircle, FileText, User, 
    Calendar, Layers, Filter, Sparkles, AlertTriangle
} from 'lucide-react';
import { BorderBeam } from '../magicui';

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

        // 1. Processa itens que estão na ordem do checklist do processo
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

        // 2. Se houver chaves em checklistResults que não estavam no array do processo
        Object.entries(rawResults).forEach(([key, val]) => {
            if (processedKeys.has(key)) return;

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

        // 3. Fallback se não houver checklistResults salvo
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
        if (audit?.score !== undefined && audit?.score !== null) {
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
    }, [steps, audit?.score, isConforme]);

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
            className="fixed inset-0 bg-black/80 flex items-center justify-center p-2 sm:p-4 z-[85] backdrop-blur-md animate-in fade-in duration-150"
            onClick={onClose}
        >
            <div 
                id="audit-detailed-analysis-modal"
                onClick={(e) => e.stopPropagation()}
                className="relative bg-surface rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] border border-subtle text-primary-hub"
            >
                <BorderBeam 
                    size={240} 
                    duration={8} 
                    colorFrom={isConforme ? '#10b981' : '#f43f5e'} 
                    colorTo={isConforme ? '#059669' : '#e11d48'} 
                    borderWidth={1.5} 
                />

                {/* CABEÇALHO PRINCIPAL */}
                <div className={`p-4 sm:p-6 text-white flex flex-col sm:flex-row justify-between sm:items-center gap-4 shrink-0 border-b border-subtle ${
                    isConforme 
                        ? 'bg-gradient-to-r from-emerald-950 via-zinc-950 to-emerald-950' 
                        : 'bg-gradient-to-r from-rose-950 via-zinc-950 to-rose-950'
                }`}>
                    <div className="flex items-start sm:items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                            isConforme 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
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
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                }`}>
                                    {audit.status || 'Conforme'} &bull; {scorePercent}%
                                </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1 flex-wrap">
                                <span>Realizado em: <strong className="text-zinc-200">{formattedDate}</strong></span>
                                <span>&bull;</span>
                                <span className="flex items-center gap-1">
                                    Canal: <ChannelIcon className="w-3.5 h-3.5 text-rose-400 ml-0.5" />
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
                            className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer hidden md:flex items-center gap-1.5 text-xs font-medium border border-white/10"
                            title="Imprimir relatório da auditoria"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Imprimir</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer border border-white/10"
                            title="Fechar modal"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* CONTEÚDO COM SCROLL */}
                <div className="overflow-y-auto flex-1 p-4 sm:p-6 bg-canvas space-y-6 text-primary-hub">
                    
                    {/* BANNER DO PROCESSO & PROTOCOLO */}
                    <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-subtle shadow-xs">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3.5 border-b border-subtle">
                            <div>
                                <span className="text-[10px] font-bold text-muted-hub uppercase tracking-widest block mb-0.5">
                                    Procedimento Operacional Auditado
                                </span>
                                <h3 className="text-base font-extrabold text-primary-hub flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-rose-500 shrink-0" />
                                    <span>{audit.processName || qaProcess?.name || 'Procedimento Padrão de Suporte'}</span>
                                    {qaProcess?.category && (
                                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-subtle text-secondary-hub border border-subtle">
                                            {qaProcess.category}
                                        </span>
                                    )}
                                </h3>
                            </div>

                            {/* Tag de Protocolo com Cópia Rápida */}
                            <div className="flex items-center gap-2">
                                <div className="bg-subtle border border-subtle rounded-xl px-3 py-1.5 flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-muted-hub uppercase">Protocolo:</span>
                                    <span className="font-mono font-bold text-primary-hub text-xs sm:text-sm">
                                        {audit.protocol || 'Sem protocolo'}
                                    </span>
                                    {audit.protocol && (
                                        <button
                                            type="button"
                                            onClick={handleCopyProtocol}
                                            className="text-muted-hub hover:text-rose-500 transition-colors cursor-pointer p-0.5"
                                            title="Copiar protocolo"
                                        >
                                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {qaProcess?.description && (
                            <p className="text-xs text-secondary-hub pt-2.5 leading-relaxed">
                                {qaProcess.description}
                            </p>
                        )}
                    </div>

                    {/* SCORECARD DE ETAPAS E APROVEITAMENTO */}
                    <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-subtle shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                            <div>
                                <h4 className="text-xs font-black text-primary-hub uppercase tracking-wider flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-amber-500" />
                                    Aproveitamento nas Etapas da Auditoria
                                </h4>
                                <p className="text-xs text-muted-hub mt-0.5">
                                    Índice de conformidade baseado nos critérios obrigatórios e opcionais avaliados.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <span className={`text-2xl font-black font-mono ${
                                    scorePercent >= 80 ? 'text-emerald-500' : 'text-rose-500'
                                }`}>
                                    {scorePercent}%
                                </span>
                                <span className="text-[11px] font-bold text-muted-hub uppercase">
                                    Aproveitamento
                                </span>
                            </div>
                        </div>

                        {/* Barra de Progresso Visual Segmentada */}
                        <div className="w-full h-3 bg-subtle rounded-full overflow-hidden flex border border-subtle">
                            {totalSteps > 0 && (
                                <>
                                    <div 
                                        className="h-full bg-emerald-500 transition-all duration-500"
                                        style={{ width: `${(passCount / totalSteps) * 100}%` }}
                                        title={`${passCount} Conformes / Aprovados`}
                                    />
                                    <div 
                                        className="h-full bg-rose-500 transition-all duration-500"
                                        style={{ width: `${(failCount / totalSteps) * 100}%` }}
                                        title={`${failCount} Não Conformes / Falharam`}
                                    />
                                    <div 
                                        className="h-full bg-muted-hub/30 transition-all duration-500"
                                        style={{ width: `${(naCount / totalSteps) * 100}%` }}
                                        title={`${naCount} Não Aplicáveis (N/A)`}
                                    />
                                </>
                            )}
                        </div>

                        {/* Indicadores em 4 Colunas */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                            <div className="bg-subtle rounded-xl p-3 border border-subtle text-center">
                                <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block">
                                    Total de Etapas
                                </span>
                                <span className="text-lg font-black text-primary-hub mt-0.5 block">
                                    {totalSteps}
                                </span>
                            </div>

                            <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/20 text-center">
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block flex items-center justify-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Aprovadas
                                </span>
                                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                                    {passCount}
                                </span>
                            </div>

                            <div className="bg-rose-500/10 rounded-xl p-3 border border-rose-500/20 text-center">
                                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block flex items-center justify-center gap-1">
                                    <XCircle className="w-3 h-3" /> Reprovadas
                                </span>
                                <span className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5 block">
                                    {failCount}
                                </span>
                            </div>

                            <div className="bg-subtle rounded-xl p-3 border border-subtle text-center">
                                <span className="text-[10px] font-bold text-muted-hub uppercase tracking-wider block flex items-center justify-center gap-1">
                                    <MinusCircle className="w-3 h-3" /> Não se aplica
                                </span>
                                <span className="text-lg font-black text-muted-hub mt-0.5 block">
                                    {naCount}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* DETALHAMENTO DAS ETAPAS E CRITÉRIOS AVALIADOS */}
                    <div className="bg-surface rounded-2xl border border-subtle shadow-xs overflow-hidden">
                        {/* Barra Superior da Checklist */}
                        <div className="p-4 bg-subtle border-b border-subtle flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                            <div>
                                <h3 className="text-xs font-black text-primary-hub uppercase tracking-wider flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-rose-500" />
                                    Detalhamento Passo a Passo das Etapas
                                </h3>
                                <p className="text-xs text-muted-hub mt-0.5">
                                    Veja individualmente cada ação avaliada e os apontamentos feitos pelo auditor.
                                </p>
                            </div>

                            {/* Filtro Rápido Interno */}
                            <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto">
                                <button
                                    type="button"
                                    onClick={() => setStepFilter('all')}
                                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                        stepFilter === 'all'
                                            ? 'bg-rose-600 text-white shadow-xs'
                                            : 'bg-surface text-secondary-hub border border-subtle hover:bg-subtle'
                                    }`}
                                >
                                    Todas ({steps.length})
                                </button>
                                {failCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setStepFilter('failed')}
                                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                            stepFilter === 'failed'
                                                ? 'bg-rose-600 text-white shadow-xs'
                                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                                        }`}
                                    >
                                        <XCircle className="w-3 h-3" /> Falhas ({failCount})
                                    </button>
                                )}
                                {passCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setStepFilter('passed')}
                                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                            stepFilter === 'passed'
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                                        }`}
                                    >
                                        <CheckCircle2 className="w-3 h-3" /> Aprovadas ({passCount})
                                    </button>
                                )}
                                {naCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setStepFilter('na')}
                                        className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            stepFilter === 'na'
                                                ? 'bg-subtle text-primary-hub border border-subtle font-bold shadow-xs'
                                                : 'bg-surface text-muted-hub border border-subtle hover:bg-subtle'
                                        }`}
                                    >
                                        N/A ({naCount})
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Lista das Etapas */}
                        <div className="divide-y divide-subtle p-2 sm:p-3">
                            {filteredSteps.length === 0 ? (
                                <div className="text-center py-8 text-muted-hub text-xs">
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
                                                    ? 'bg-rose-500/5 border border-rose-500/20' 
                                                    : isPass 
                                                    ? 'hover:bg-subtle/50 border border-transparent' 
                                                    : 'bg-subtle/40 border border-subtle'
                                            }`}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                                <div className="flex items-start gap-3 flex-1">
                                                    <span className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-black shrink-0 mt-0.5 border ${
                                                        isFail
                                                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                                                            : isPass
                                                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                                            : 'bg-subtle text-muted-hub border-subtle'
                                                    }`}>
                                                        Etapa {String(step.stepNumber).padStart(2, '0')}
                                                    </span>

                                                    <div className="flex-1">
                                                        <p className="text-xs sm:text-sm font-semibold text-primary-hub leading-relaxed">
                                                            {step.criterion}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Badge do Status da Etapa */}
                                                <div className="shrink-0 self-start sm:self-center">
                                                    {isPass && (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 shadow-2xs">
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Conforme
                                                        </span>
                                                    )}
                                                    {isFail && (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 shadow-2xs">
                                                            <XCircle className="w-3.5 h-3.5 text-rose-500" /> Não Conforme
                                                        </span>
                                                    )}
                                                    {isNa && (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-subtle text-muted-hub border border-subtle">
                                                            <MinusCircle className="w-3.5 h-3.5 opacity-70" /> Não se Aplica
                                                        </span>
                                                    )}
                                                    {!isPass && !isFail && !isNa && (
                                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> {step.status}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Apontamento Específico do Auditor para esta Etapa */}
                                            {step.note && (
                                                <div className="mt-2.5 ml-0 sm:ml-10 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2 shadow-2xs">
                                                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                                    <div className="flex-1">
                                                        <span className="font-bold uppercase tracking-wider text-[10px] text-amber-600 dark:text-amber-400 block mb-0.5">
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
                        <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-subtle shadow-xs space-y-2">
                            <span className="text-xs font-bold text-muted-hub uppercase tracking-wider flex items-center gap-1.5">
                                <FileText className="w-4 h-4 text-rose-500" />
                                Parecer Conclusivo & Orientações Gerais do Auditor
                            </span>
                            <div className="bg-subtle p-4 rounded-xl border border-subtle text-xs sm:text-sm text-primary-hub leading-relaxed whitespace-pre-wrap font-medium">
                                {audit.notes}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-surface rounded-2xl p-4 border border-subtle text-xs text-muted-hub text-center">
                            Nenhuma observação geral adicional foi registrada pelo auditor para esta avaliação.
                        </div>
                    )}

                </div>

                {/* RODAPÉ DO MODAL */}
                <div className="p-4 bg-surface border-t border-subtle flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-hub flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Auditoria oficial arquivada no histórico de qualidade
                    </span>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full sm:w-auto px-6 py-2.5 bg-subtle hover:bg-surface text-primary-hub border border-subtle rounded-xl font-bold text-xs transition-colors cursor-pointer shadow-xs"
                    >
                        Fechar Visualização
                    </button>
                </div>
            </div>
        </div>
    );
}

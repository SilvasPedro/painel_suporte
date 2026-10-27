import React, { useState, useEffect } from 'react';
import { 
    X, Clock, User, CheckCircle2, AlertTriangle, ShieldCheck, 
    Copy, Check, MessageSquare, Send, ExternalLink, Network,
    Terminal, ArrowRight, CornerDownRight, Sparkles, Bug,
    Monitor, Building, HelpCircle, Layers, Tag, Eye, UserCheck, AlertOctagon
} from 'lucide-react';
import { calculateSlaStatus, ISP_QUICK_SCRIPTS } from '../../utils/ispHelpers';
import {
    getCategoryMetadata,
    normalizeCategory,
    getTaskOriginDepartment,
    getTaskAssignee,
    getTaskWatchers,
    isUserWatcherOnly
} from '../../types/request.types';
import SafeMarkdown from './SafeMarkdown';

export default function TicketDrawer({
    report,
    isOpen,
    onClose,
    onUpdateStatus,
    onAddComment,
    canManage,
    onExpandFull,
    user = null
}) {
    const [commentText, setCommentText] = useState('');
    const [copiedField, setCopiedField] = useState(null);
    const [submittingComment, setSubmittingComment] = useState(false);
    const [selectedScript, setSelectedScript] = useState(null);

    // Fechar com tecla ESC
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !report) return null;

    const sla = calculateSlaStatus(report);
    const categoryKey = normalizeCategory(report.category || report.type);
    const catMeta = getCategoryMetadata(categoryKey);
    const meta = report.metadata || {};
    const originDept = getTaskOriginDepartment(report);
    const assignee = getTaskAssignee(report);
    const watchers = getTaskWatchers(report);
    const watcherOnly = isUserWatcherOnly(report, user);

    const handleCopy = (text, fieldName) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(fieldName);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const handleSendComment = async (e) => {
        e.preventDefault();
        if (!commentText.trim() || submittingComment || watcherOnly) return;

        setSubmittingComment(true);
        try {
            await onAddComment(report.id, commentText);
            setCommentText('');
        } finally {
            setSubmittingComment(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop suave que mantém a lista visível ao fundo */}
            <div 
                className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px] transition-opacity cursor-pointer"
                onClick={onClose}
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-8 sm:pl-10">
                <div className="w-screen max-w-xl bg-slate-900 border-l border-slate-800 text-slate-100 shadow-2xl flex flex-col h-full transform transition ease-in-out duration-300">
                    
                    {/* Header do Drawer */}
                    <div className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/95 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                            {/* Badge Compacto de SLA */}
                            <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border shrink-0 ${sla.badgeClass}`}>
                                {sla.remainingText}
                            </span>
                            
                            {/* Identificador / Protocolo */}
                            <span className="text-xs text-slate-400 font-mono truncate">
                                #{meta.protocol || report.protocol || report.id?.substring(0, 8)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {onExpandFull && (
                                <button
                                    type="button"
                                    onClick={onExpandFull}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                                    title="Expandir em Modal Completo"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Fechar (Esc)"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Corpo Rolável do Drawer */}
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                        
                        {/* Título, Badges e Metadados de Cabeçalho */}
                        <div>
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                {/* Badge de Categoria nas cores pastéis sóbrias */}
                                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border flex items-center gap-1.5 ${catMeta.theme.badgeClass}`}>
                                    {categoryKey === 'error_analysis' && <Bug className="w-3.5 h-3.5" />}
                                    {categoryKey === 'system_improvement' && <Monitor className="w-3.5 h-3.5" />}
                                    {categoryKey === 'facility_improvement' && <Building className="w-3.5 h-3.5" />}
                                    {categoryKey === 'other' && <Sparkles className="w-3.5 h-3.5" />}
                                    {catMeta.label}
                                </span>

                                {/* Badge de Status */}
                                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border ${
                                    report.status === 'Resolvido' 
                                        ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/30' 
                                        : report.status === 'Em Andamento'
                                        ? 'bg-sky-950/50 text-sky-300 border-sky-500/30'
                                        : 'bg-amber-950/50 text-amber-300 border-amber-500/30'
                                }`}>
                                    {report.status || 'Pendente'}
                                </span>

                                {/* Badge de Departamento de Origem em Destaque */}
                                {originDept && (
                                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md border bg-indigo-950/60 text-indigo-300 border-indigo-500/40 flex items-center gap-1">
                                        <Building className="w-3 h-3" />
                                        Departamento: {originDept}
                                    </span>
                                )}

                                {(report.affectedClient === 'Sim' || meta.affectedClient === 'Sim') ? (
                                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md border bg-rose-950/60 text-rose-300 border-rose-500/40 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                                        Afetou Cliente: Sim
                                    </span>
                                ) : (
                                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-md border bg-slate-800 text-slate-400 border-slate-700">
                                        Afetou Cliente: Não
                                    </span>
                                )}

                                {(report.priority || meta.urgency) && (
                                    <span className="text-xs text-slate-400 font-medium">
                                        Prioridade: <strong className="text-slate-200">{report.priority || meta.urgency}</strong>
                                    </span>
                                )}
                            </div>

                            <h2 className="text-lg font-bold text-white leading-snug">
                                {report.title || 'Solicitação sem título'}
                            </h2>

                            <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-2 flex-wrap">
                                <span>Aberto por: <strong className="text-slate-300">{report.creatorName || 'Colaborador'}</strong></span>
                                <span>·</span>
                                <span>{report.date || 'Hoje'}</span>
                                <span>·</span>
                                <span className="inline-flex items-center gap-1">
                                    <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                                    Responsável: <strong className="text-slate-200">{assignee ? assignee.name : 'Gestores / Supervisores'}</strong>
                                </span>
                            </p>

                            {watchers.length > 0 && (
                                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                        <Eye className="w-3 h-3 text-indigo-400" /> Visualizadores:
                                    </span>
                                    {watchers.map((w) => (
                                        <span
                                            key={w.id}
                                            className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700"
                                        >
                                            {w.name}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {watcherOnly && (
                                <div className="mt-3 p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-indigo-200 text-xs flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-indigo-400 shrink-0" />
                                    <span>Modo Visualizador (Somente Leitura) — Acompanhamento de status sem permissão de edição.</span>
                                </div>
                            )}
                        </div>

                        {/* Barra de Transição Rápida de Status (Para Liderança/Supervisão ou Responsável) */}
                        {canManage && !watcherOnly && (
                            <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-2">
                                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Atualizar Fila / Status
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onUpdateStatus(report.id, 'Pendente')}
                                        className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                                            report.status === 'Pendente'
                                                ? 'bg-amber-600 text-white border-amber-500'
                                                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                        }`}
                                    >
                                        Pendente
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onUpdateStatus(report.id, 'Em Andamento')}
                                        className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                                            report.status === 'Em Andamento'
                                                ? 'bg-sky-600 text-white border-sky-500'
                                                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                        }`}
                                    >
                                        Em Andamento
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onUpdateStatus(report.id, 'Resolvido')}
                                        className={`py-1.5 px-2 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                                            report.status === 'Resolvido'
                                                ? 'bg-emerald-600 text-white border-emerald-500'
                                                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                        }`}
                                    >
                                        Resolvido
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* PAINEL UNIFICADO DE INFORMAÇÕES DA O.S. */}
                        <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/80 space-y-3">
                            <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                                Informações Unificadas da O.S.
                            </h4>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div>
                                    <span className="text-slate-400 block text-[11px]">Tipo de O.S.:</span>
                                    <span className="text-slate-200 font-bold mt-0.5 block">
                                        {report.type || catMeta.label || 'Tarefa'}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-slate-400 block text-[11px]">Setor de Origem:</span>
                                    <span className="text-indigo-300 font-bold mt-0.5 block flex items-center gap-1">
                                        <Building className="w-3 h-3 text-indigo-400" />
                                        {originDept || 'Geral / Suporte'}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-slate-400 block text-[11px]">Prioridade:</span>
                                    <span className="text-slate-200 font-semibold mt-0.5 block">
                                        {report.priority || 'Normal'}
                                    </span>
                                </div>

                                <div>
                                    <span className="text-slate-400 block text-[11px]">Prazo / Data:</span>
                                    <span className="text-slate-200 font-mono mt-0.5 block">
                                        {report.due_date || report.date || 'Hoje'}
                                    </span>
                                </div>

                                <div className="col-span-2 pt-2 border-t border-slate-750">
                                    <span className="text-slate-400 block text-[11px]">Impacto no Atendimento / Cliente:</span>
                                    <span className={`inline-block font-semibold mt-0.5 ${
                                        (meta.affectedClient === 'Sim' || report.affectedClient === 'Sim') 
                                            ? 'text-rose-400 font-bold' 
                                            : 'text-slate-300'
                                    }`}>
                                        {(meta.affectedClient === 'Sim' || report.affectedClient === 'Sim') ? 'Sim, Houve Impacto no Cliente' : 'Não / Falha Interna'}
                                    </span>

                                    {(meta.howAffected || report.howAffected) && (
                                        <div className="mt-2 p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-200 text-xs leading-relaxed">
                                            <strong className="block text-rose-300 mb-0.5">Como afetou o cliente:</strong>
                                            {meta.howAffected || report.howAffected}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* BLOCO HIERÁRQUICO DE DADOS ESPECÍFICOS CONFORME A CATEGORIA */}
                        
                        {/* 1. SE FOR ANÁLISE DE ERRO */}
                        {categoryKey === 'error_analysis' && (
                            <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800 space-y-3">
                                <h4 className="text-xs font-semibold text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Bug className="w-3.5 h-3.5 text-rose-400" />
                                    Parâmetros de Origem e Impacto
                                </h4>

                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Protocolo:</span>
                                        <div className="flex items-center gap-1.5 font-mono text-slate-200 mt-0.5">
                                            <span>{meta.protocol || report.protocol || 'Sem protocolo'}</span>
                                            {(meta.protocol || report.protocol) && (
                                                <button 
                                                    onClick={() => handleCopy(meta.protocol || report.protocol, 'protocol')}
                                                    className="p-1 hover:text-white text-slate-400 transition-colors"
                                                    title="Copiar Protocolo"
                                                >
                                                    {copiedField === 'protocol' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Setor de Origem:</span>
                                        <span className="text-slate-200 font-medium mt-0.5 block">
                                            {meta.affectedDepartment || report.originDepartment || 'Não informado'}
                                        </span>
                                    </div>

                                    <div className="col-span-2 pt-1 border-t border-slate-800/60">
                                        <span className="text-slate-400 block text-[11px]">Impacto no Cliente:</span>
                                        <span className={`inline-block font-semibold mt-0.5 ${
                                            (meta.affectedClient === 'Sim' || report.affectedClient === 'Sim') 
                                                ? 'text-rose-400' 
                                                : 'text-slate-300'
                                        }`}>
                                            {(meta.affectedClient === 'Sim' || report.affectedClient === 'Sim') ? 'Sim, Houve Impacto' : 'Não / Falha Interna'}
                                        </span>

                                        {(meta.howAffected || report.howAffected) && (
                                            <p className="mt-1.5 p-2 rounded-lg bg-rose-950/30 border border-rose-800/30 text-rose-200 text-xs leading-relaxed">
                                                <strong>Como afetou:</strong> {meta.howAffected || report.howAffected}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 2. SE FOR MELHORIA DE SISTEMA */}
                        {categoryKey === 'system_improvement' && (
                            <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800 space-y-3">
                                <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Monitor className="w-3.5 h-3.5 text-indigo-400" />
                                    Tela / Aplicativo Afetado
                                </h4>
                                <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-800/30 text-xs">
                                    <span className="text-indigo-400 block text-[11px] font-semibold uppercase">Local da Melhoria:</span>
                                    <span className="text-indigo-200 font-bold text-sm mt-0.5 block">
                                        {meta.affectedApp || report.affectedApp || 'Geral / Não especificado'}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* 3. SE FOR MELHORIA DE AMBIENTE */}
                        {categoryKey === 'facility_improvement' && (
                            <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800 space-y-3">
                                <h4 className="text-xs font-semibold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Building className="w-3.5 h-3.5 text-emerald-400" />
                                    Recurso Físico & Ergonomia
                                </h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Tipo de Item:</span>
                                        <span className="text-emerald-300 font-bold mt-0.5 block">
                                            {meta.resourceType || report.resourceType || 'Equipamento'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Urgência de Reposição:</span>
                                        <span className="text-slate-200 font-semibold mt-0.5 block">
                                            {meta.urgency || report.urgency || report.priority || 'Média'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 4. SE FOR OUTROS */}
                        {categoryKey === 'other' && (
                            <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-800 space-y-3">
                                <h4 className="text-xs font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                    Subtipo e Destinatários
                                </h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Subtipo:</span>
                                        <span className="text-purple-300 font-bold mt-0.5 block">
                                            {meta.otherSubtype || report.otherSubtype || 'Demanda Geral'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block text-[11px]">Público-Alvo:</span>
                                        <span className="text-slate-200 font-semibold mt-0.5 block">
                                            {meta.targetAudience || report.targetAudience || 'Equipe Geral'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Etiquetas (Tags) */}
                        {Array.isArray(report.tags) && report.tags.length > 0 && (
                            <div className="space-y-1.5">
                                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                    Etiquetas (Tags)
                                </h4>
                                <div className="flex flex-wrap gap-1.5">
                                    {report.tags.map((t) => (
                                        <span
                                            key={t}
                                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700"
                                        >
                                            #{t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Descrição Detalhada da Solicitação (Markdown GFM Seguro) */}
                        <div className="space-y-1.5">
                            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                Descrição Detalhada
                            </h4>
                            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-200 leading-relaxed font-sans">
                                <SafeMarkdown content={report.description} variant="dark" />
                            </div>
                        </div>

                        {/* Scripts Rápidos de Diagnóstico (ISP) */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Terminal className="w-3.5 h-3.5 text-amber-400" />
                                    Scripts Rápidos de Suporte ISP
                                </h4>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {ISP_QUICK_SCRIPTS.map(script => (
                                    <button
                                        key={script.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedScript(script);
                                            handleCopy(script.command, script.id);
                                        }}
                                        className="p-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-left transition-all group cursor-pointer"
                                    >
                                        <div className="flex items-center justify-between text-slate-200 font-medium text-xs">
                                            <span className="truncate">{script.title}</span>
                                            {copiedField === script.id ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                            ) : (
                                                <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-white shrink-0" />
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-mono mt-1 truncate">
                                            {script.command}
                                        </p>
                                    </button>
                                ))}
                            </div>
                            {selectedScript && (
                                <p className="text-[11px] text-slate-400 bg-slate-950/40 p-2 rounded-lg border border-slate-800">
                                    <strong className="text-slate-300">{selectedScript.title}:</strong> {selectedScript.notes}
                                </p>
                            )}
                        </div>

                        {/* Histórico / Thread de Comentários */}
                        <div className="space-y-3 pt-2 border-t border-slate-800">
                            <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                                Histórico de Pareceres e Interações
                            </h4>

                            {report.adminComment && (
                                <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-1">
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="font-semibold text-emerald-400">Parecer Técnico / Solução</span>
                                        <span className="text-emerald-500/80">Oficial</span>
                                    </div>
                                    <p className="text-xs text-emerald-200 leading-relaxed">
                                        {report.adminComment}
                                    </p>
                                </div>
                            )}

                            {/* Lista de Comentários */}
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {Array.isArray(report.comments) && report.comments.length > 0 ? (
                                    report.comments.map((c, i) => (
                                        <div key={i} className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 space-y-1 text-xs">
                                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                                                <span className="font-semibold text-slate-300">{c.authorName || 'Técnico'}</span>
                                                <span>{c.date || 'Recentemente'}</span>
                                            </div>
                                            <p className="text-slate-200 leading-relaxed">{c.content}</p>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-slate-500 italic py-2">
                                        Nenhum comentário registrado ainda.
                                    </p>
                                )}
                            </div>

                            {/* Envio de Novo Comentário (bloqueado para visualizadores somente leitura) */}
                            {!watcherOnly && (
                                <form onSubmit={handleSendComment} className="flex gap-2 mt-2">
                                    <input
                                        type="text"
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        placeholder="Adicionar nota técnica ou parecer..."
                                        className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-sky-500 transition-colors"
                                    />
                                    <button
                                        type="submit"
                                        disabled={submittingComment || !commentText.trim()}
                                        className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        Enviar
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* Footer com Ações */}
                    <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex justify-end shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                        >
                            Fechar Inspeção
                        </button>
                    </div>

                </div>
            </div>
        </div>
    );
}

import React from 'react';
import { 
    X, ShieldCheck, CheckCircle2, XCircle, MinusCircle, 
    Phone, MessageSquare, Ticket, Mail, Printer, Edit2
} from 'lucide-react';

const CHANNEL_ICONS = {
    'Telefone': Phone,
    'WhatsApp': MessageSquare,
    'Chat': MessageSquare,
    'Ticket': Ticket,
    'E-mail': Mail
};

export default function AuditDetailsModal({
    isOpen,
    onClose,
    audit,
    collaboratorName,
    onEdit
}) {
    if (!isOpen || !audit) return null;

    const ChannelIcon = CHANNEL_ICONS[audit.channel] || Ticket;
    const isConforme = audit.status === 'Conforme';

    // Recupera os resultados da checklist
    const checklistResults = audit.checklistResults || {};
    const checklistNotes = audit.checklistNotes || {};
    const checklistEntries = Object.entries(checklistResults);
    const resultValues = Object.values(checklistResults);

    // Contadores
    const passCount = resultValues.filter(val => val === 'Passou').length;
    const failCount = resultValues.filter(val => val === 'Falhou').length;
    const naCount = resultValues.filter(val => val === 'N/A').length;
    const totalValid = passCount + failCount;
    const calculatedScore = totalValid > 0 ? Math.round((passCount / totalValid) * 100) : (isConforme ? 100 : 0);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div 
            id="audit-details-backdrop"
            className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-3 sm:p-6 z-[85] backdrop-blur-xs animate-in fade-in duration-150"
        >
            <div 
                id="audit-details-modal"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-200"
            >
                {/* Cabeçalho */}
                <div className="p-4 sm:p-5 bg-zinc-950 text-white flex justify-between items-center shrink-0 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isConforme 
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                            {isConforme ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-bold">
                                    Auditoria de Qualidade
                                </h2>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                                    isConforme 
                                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                                        : 'bg-red-950 text-red-400 border border-red-800'
                                }`}>
                                    {audit.status} ({calculatedScore}%)
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                Protocolo: <strong className="text-zinc-200">{audit.protocol || 'Sem protocolo'}</strong> • Realizado em {audit.date ? new Date(audit.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '--'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer hidden sm:flex"
                            title="Imprimir / Salvar PDF"
                        >
                            <Printer className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => { onClose(); onEdit(audit); }}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                            title="Editar Auditoria"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Conteúdo com Scroll */}
                <div className="overflow-y-auto flex-1 p-4 sm:p-6 bg-gray-50/60 space-y-5">
                    {/* Painel de Metadados em Grade */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Colaborador
                            </span>
                            <span className="text-xs font-bold text-gray-900 mt-0.5 block truncate">
                                {collaboratorName || 'Não identificado'}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Procedimento
                            </span>
                            <span className="text-xs font-bold text-gray-900 mt-0.5 block truncate" title={audit.processName}>
                                {audit.processName || '--'}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Canal de Atendimento
                            </span>
                            <span className="text-xs font-bold text-gray-900 mt-0.5 flex items-center gap-1.5">
                                <ChannelIcon className="w-3.5 h-3.5 text-gray-500" />
                                {audit.channel || 'Ticket / Sistema'}
                            </span>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                                Avaliador
                            </span>
                            <span className="text-xs font-bold text-gray-900 mt-0.5 block truncate">
                                {audit.evaluatorName || 'Gestão'}
                            </span>
                        </div>
                    </div>

                    {/* Resumo de Aproveitamento da Checklist */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Aproveitamento na Checklist
                            </span>
                            <span className="text-xs font-mono font-bold text-gray-900">
                                {passCount} aprovados • {failCount} reprovados • {naCount} N/A
                            </span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden flex">
                            {totalValid > 0 && (
                                <>
                                    <div 
                                        className="h-full bg-emerald-500" 
                                        style={{ width: `${(passCount / (totalValid + naCount)) * 100}%` }}
                                        title={`${passCount} Passou`}
                                    />
                                    <div 
                                        className="h-full bg-red-500" 
                                        style={{ width: `${(failCount / (totalValid + naCount)) * 100}%` }}
                                        title={`${failCount} Falhou`}
                                    />
                                    <div 
                                        className="h-full bg-gray-300" 
                                        style={{ width: `${(naCount / (totalValid + naCount)) * 100}%` }}
                                        title={`${naCount} N/A`}
                                    />
                                </>
                            )}
                        </div>
                    </div>

                    {/* Lista de Itens da Checklist com Resultados */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
                        <div className="p-3.5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-red-600" />
                                Detalhamento dos Critérios Avaliados
                            </h3>
                            <span className="text-xs text-gray-500">
                                {checklistEntries.length} critérios respondidos
                            </span>
                        </div>

                        <div className="divide-y divide-gray-100 p-2">
                            {checklistEntries.length === 0 ? (
                                <div className="text-center py-6 text-gray-400 text-xs">
                                    Nenhuma pergunta individual registrada para esta auditoria.
                                </div>
                            ) : (
                                checklistEntries.map(([key, val], idx) => {
                                    const isPass = val === 'Passou';
                                    const isFail = val === 'Falhou';
                                    const isNa = val === 'N/A';
                                    const note = checklistNotes[key];

                                    return (
                                        <div key={idx} className="p-3 flex flex-col gap-1.5 hover:bg-gray-50/50 rounded-lg transition-colors">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-start gap-2.5 flex-1">
                                                    <span className="text-xs font-mono font-bold text-gray-400 mt-0.5 shrink-0">
                                                        {idx + 1}.
                                                    </span>
                                                    <span className="text-xs text-gray-800 font-medium leading-relaxed">
                                                        {/* Se a chave for número ou pergunta inteira */}
                                                        {key}
                                                    </span>
                                                </div>

                                                {/* Badge do Status */}
                                                <div className="shrink-0">
                                                    {isPass && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> Passou
                                                        </span>
                                                    )}
                                                    {isFail && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                                                            <XCircle className="w-3.5 h-3.5" /> Falhou
                                                        </span>
                                                    )}
                                                    {isNa && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                                            <MinusCircle className="w-3.5 h-3.5" /> N/A
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Observação Específica do Item */}
                                            {note && (
                                                <div className="ml-6 pl-2.5 border-l-2 border-amber-400 text-[11px] text-amber-900 bg-amber-50/60 p-1.5 rounded-r">
                                                    <strong>Apontamento do auditor:</strong> {note}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Observações Gerais do Avaliador */}
                    {audit.notes && (
                        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-1.5">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block">
                                Parecer Geral / Feedback do Avaliador
                            </span>
                            <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-lg leading-relaxed whitespace-pre-wrap">
                                {audit.notes}
                            </p>
                        </div>
                    )}
                </div>

                {/* Rodapé */}
                <div className="p-4 bg-white border-t border-gray-200 flex justify-end gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-bold text-xs transition-colors cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}

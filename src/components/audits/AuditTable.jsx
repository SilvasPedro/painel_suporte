import React, { useState } from 'react';
import { 
    Eye, Edit2, Trash2, CheckCircle2, XCircle, Phone, 
    MessageSquare, Ticket, Mail, Calendar, User, 
    ChevronLeft, ChevronRight, FileText, CheckSquare
} from 'lucide-react';

const CHANNEL_ICONS = {
    'Telefone': Phone,
    'WhatsApp': MessageSquare,
    'Chat': MessageSquare,
    'WhatsApp/Chat': MessageSquare,
    'Ticket': Ticket,
    'E-mail': Mail
};

export default function AuditTable({
    audits = [],
    collaboratorsMap = {},
    onView,
    onEdit,
    onDelete
}) {
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const totalPages = Math.max(1, Math.ceil(audits.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedAudits = audits.slice(startIndex, startIndex + pageSize);

    return (
        <div className="bg-surface rounded-3xl border border-subtle shadow-xs flex-1 flex flex-col overflow-hidden">
            {/* Topo da Tabela com Seletor de Registros por Página */}
            <div className="px-5 py-4 border-b border-subtle bg-surface flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-primary-hub">
                            Histórico de Auditorias Registradas
                        </h3>
                        <p className="text-[11px] text-secondary-hub">
                            {audits.length} {audits.length === 1 ? 'registro no período' : 'registros no período'}
                        </p>
                    </div>
                </div>

                {/* Seletor de Quantidade por Página */}
                <div className="flex items-center gap-2 text-xs text-secondary-hub self-end sm:self-auto">
                    <span>Exibir:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                        className="bg-surface border border-subtle rounded-lg px-2.5 py-1 text-xs font-semibold text-secondary-hub outline-none cursor-pointer"
                    >
                        <option value={10}>10 linhas</option>
                        <option value={25}>25 linhas</option>
                        <option value={50}>50 linhas</option>
                        <option value={100}>100 linhas</option>
                    </select>
                </div>
            </div>

            {/* Tabela de Dados */}
            <div className="overflow-x-auto flex-1">
                <table className="min-w-full divide-y divide-subtle text-xs whitespace-nowrap">
                    <thead className="bg-subtle text-secondary-hub sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-[10px]">Data da Auditoria</th>
                            <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-[10px]">Colaborador</th>
                            <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-[10px]">Canal / Protocolo</th>
                            <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-[10px]">Processo Auditado</th>
                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-[10px]">Pontuação</th>
                            <th className="px-4 py-3 text-center font-bold uppercase tracking-wider text-[10px]">Resultado</th>
                            <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-[10px] hidden md:table-cell">Avaliador</th>
                            <th className="px-4 py-3 text-right font-bold uppercase tracking-wider text-[10px] pr-6">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-surface divide-y divide-subtle">
                        {audits.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="px-6 py-16 text-center text-muted-hub">
                                    <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-30 text-muted-hub" />
                                    <p className="font-semibold text-secondary-hub">Nenhuma auditoria encontrada com os filtros atuais.</p>
                                    <p className="text-[11px] text-muted-hub mt-0.5">Tente redefinir os filtros ou registrar uma nova avaliação.</p>
                                </td>
                            </tr>
                        ) : (
                            paginatedAudits.map((a) => {
                                const colabName = collaboratorsMap[a.colabId] || 'Desconhecido';
                                const ChannelIcon = CHANNEL_ICONS[a.channel] || Ticket;
                                const isConforme = a.status === 'Conforme';
                                
                                // Pontuação calculada ou armazenada
                                const scoreValue = a.score !== undefined 
                                    ? a.score 
                                    : (isConforme ? 100 : 0);

                                return (
                                    <tr key={a.id} className="hover:bg-red-50/30 transition-colors group">
                                        {/* Data */}
                                        <td className="px-4 py-3.5 text-secondary-hub font-medium">
                                            {a.date ? new Date(a.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '--'}
                                        </td>

                                        {/* Colaborador */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white font-bold text-[11px] shadow-xs flex items-center justify-center shrink-0">
                                                    {colabName.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-bold text-primary-hub">
                                                    {colabName}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Canal e Protocolo */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <span className="p-1 rounded-md bg-subtle text-secondary-hub" title={a.channel || 'Ticket'}>
                                                    <ChannelIcon className="w-3.5 h-3.5" />
                                                </span>
                                                <span className="font-mono font-bold text-secondary-hub">
                                                    {a.protocol || '--'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Processo Auditado */}
                                        <td className="px-4 py-3.5">
                                            <span className="font-medium text-primary-hub truncate block max-w-[200px]" title={a.processName}>
                                                {a.processName || '--'}
                                            </span>
                                        </td>

                                        {/* Pontuação */}
                                        <td className="px-4 py-3.5 text-center">
                                            <div className="inline-flex items-center gap-2 min-w-[96px]">
                                                <div className="flex-1 h-1.5 bg-subtle rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${scoreValue >= 80 ? 'bg-emerald-500' : 'bg-red-500'}`}
                                                        style={{ width: `${Math.max(0, Math.min(100, scoreValue))}%` }}
                                                    />
                                                </div>
                                                <span className={`font-mono font-black text-xs w-9 text-right ${
                                                    scoreValue >= 80 ? 'text-emerald-600' : 'text-red-600'
                                                }`}>
                                                    {scoreValue}%
                                                </span>
                                            </div>
                                        </td>

                                        {/* Resultado (Status) */}
                                        <td className="px-4 py-3.5 text-center">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                                isConforme 
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                    : 'bg-red-50 text-red-700 border border-red-200'
                                            }`}>
                                                {isConforme ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                {a.status}
                                            </span>
                                        </td>

                                        {/* Avaliador */}
                                        <td className="px-4 py-3.5 text-secondary-hub text-[11px] hidden md:table-cell truncate max-w-[140px]">
                                            {a.evaluatorName || 'Gestão'}
                                        </td>

                                        {/* Ações */}
                                        <td className="px-4 py-3.5 text-right pr-6">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => onView(a)}
                                                    className="p-1.5 text-secondary-hub hover:text-zinc-900 hover:bg-gray-200/70 rounded-lg transition-colors cursor-pointer"
                                                    title="Ver Detalhes da Checklist"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onEdit(a)}
                                                    className="p-1.5 text-secondary-hub hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                                    title="Editar Auditoria"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onDelete(a.id)}
                                                    className="p-1.5 text-secondary-hub hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                                    title="Excluir Auditoria"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Paginação */}
            {audits.length > 0 && (
                <div className="px-5 py-3 bg-surface border-t border-subtle flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-secondary-hub">
                    <div>
                        Exibindo de <strong>{startIndex + 1}</strong> a <strong>{Math.min(startIndex + pageSize, audits.length)}</strong> de <strong>{audits.length}</strong> auditorias
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            disabled={currentPage === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="p-1.5 bg-surface border border-subtle rounded-lg text-secondary-hub hover:bg-subtle disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-2 font-bold text-secondary-hub">
                            Página {currentPage} de {totalPages}
                        </span>
                        <button
                            type="button"
                            disabled={currentPage === totalPages}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            className="p-1.5 bg-surface border border-subtle rounded-lg text-secondary-hub hover:bg-subtle disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

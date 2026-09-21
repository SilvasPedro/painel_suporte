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
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs flex-1 flex flex-col overflow-hidden">
            {/* Topo da Tabela com Seletor de Registros por Página */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/70 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                        <FileText className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900">
                            Histórico de Auditorias Registradas
                        </h3>
                        <p className="text-[11px] text-gray-500">
                            {audits.length} {audits.length === 1 ? 'registro no período' : 'registros no período'}
                        </p>
                    </div>
                </div>

                {/* Seletor de Quantidade por Página */}
                <div className="flex items-center gap-2 text-xs text-gray-500 self-end sm:self-auto">
                    <span>Exibir:</span>
                    <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                        className="bg-white border border-gray-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-700 outline-none cursor-pointer"
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
                <table className="min-w-full divide-y divide-gray-200 text-xs whitespace-nowrap">
                    <thead className="bg-zinc-950 text-white sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-3.5 text-left font-semibold">Data</th>
                            <th className="px-4 py-3.5 text-left font-semibold">Colaborador</th>
                            <th className="px-4 py-3.5 text-left font-semibold">Canal / Protocolo</th>
                            <th className="px-4 py-3.5 text-left font-semibold">Processo Auditado</th>
                            <th className="px-4 py-3.5 text-center font-semibold">Pontuação</th>
                            <th className="px-4 py-3.5 text-center font-semibold">Resultado</th>
                            <th className="px-4 py-3.5 text-left font-semibold hidden md:table-cell">Avaliador</th>
                            <th className="px-4 py-3.5 text-right font-semibold pr-6">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                        {audits.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="px-6 py-16 text-center text-gray-400">
                                    <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-30 text-gray-400" />
                                    <p className="font-semibold text-gray-600">Nenhuma auditoria encontrada com os filtros atuais.</p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">Tente redefinir os filtros ou registrar uma nova avaliação.</p>
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
                                    <tr key={a.id} className="hover:bg-gray-50/80 transition-colors group">
                                        {/* Data */}
                                        <td className="px-4 py-3.5 text-gray-600 font-medium">
                                            {a.date ? new Date(a.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '--'}
                                        </td>

                                        {/* Colaborador */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-full bg-red-100 text-red-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                                                    {colabName.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-bold text-gray-900">
                                                    {colabName}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Canal e Protocolo */}
                                        <td className="px-4 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <span className="p-1 rounded-md bg-gray-100 text-gray-600" title={a.channel || 'Ticket'}>
                                                    <ChannelIcon className="w-3.5 h-3.5" />
                                                </span>
                                                <span className="font-mono font-bold text-gray-700">
                                                    {a.protocol || '--'}
                                                </span>
                                            </div>
                                        </td>

                                        {/* Processo Auditado */}
                                        <td className="px-4 py-3.5">
                                            <span className="font-medium text-gray-800 truncate block max-w-[200px]" title={a.processName}>
                                                {a.processName || '--'}
                                            </span>
                                        </td>

                                        {/* Pontuação */}
                                        <td className="px-4 py-3.5 text-center">
                                            <div className="inline-flex items-center gap-1.5">
                                                <span className={`font-mono font-black text-xs ${
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
                                        <td className="px-4 py-3.5 text-gray-500 text-[11px] hidden md:table-cell truncate max-w-[140px]">
                                            {a.evaluatorName || 'Gestão'}
                                        </td>

                                        {/* Ações */}
                                        <td className="px-4 py-3.5 text-right pr-6">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => onView(a)}
                                                    className="p-1.5 text-gray-500 hover:text-zinc-900 hover:bg-gray-200/70 rounded-lg transition-colors cursor-pointer"
                                                    title="Ver Detalhes da Checklist"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onEdit(a)}
                                                    className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                                                    title="Editar Auditoria"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onDelete(a.id)}
                                                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
                <div className="p-3 bg-gray-50/90 border-t border-gray-100 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs text-gray-500">
                    <div>
                        Exibindo de <strong>{startIndex + 1}</strong> a <strong>{Math.min(startIndex + pageSize, audits.length)}</strong> de <strong>{audits.length}</strong> auditorias
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            disabled={currentPage === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-2 font-bold text-gray-700">
                            Página {currentPage} de {totalPages}
                        </span>
                        <button
                            type="button"
                            disabled={currentPage === totalPages}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            className="p-1.5 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

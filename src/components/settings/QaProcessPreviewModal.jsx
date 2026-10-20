import React, { useState } from 'react';
import { X, ShieldCheck, CheckSquare, Edit2, Copy, CheckCircle2 } from 'lucide-react';

export default function QaProcessPreviewModal({ 
    isOpen, 
    onClose, 
    process, 
    onEdit,
    isEditable 
}) {
    const [checkedItems, setCheckedItems] = useState({});

    if (!isOpen || !process) return null;

    const checklist = Array.isArray(process.checklist) ? process.checklist : [];
    const totalCount = checklist.length;
    const checkedCount = Object.values(checkedItems).filter(Boolean).length;
    const progressPercent = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

    const toggleItem = (idx) => {
        setCheckedItems(prev => ({
            ...prev,
            [idx]: !prev[idx]
        }));
    };

    const handleCheckAll = () => {
        const allChecked = {};
        checklist.forEach((_, idx) => {
            allChecked[idx] = true;
        });
        setCheckedItems(allChecked);
    };

    const handleClearAll = () => {
        setCheckedItems({});
    };

    return (
        <div 
            id="qa-preview-modal-backdrop"
            className="fixed inset-0 bg-zinc-950/70 flex items-center justify-center p-4 z-[90] backdrop-blur-xs animate-in fade-in duration-150"
        >
            <div 
                id="qa-preview-modal-card"
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200"
            >
                {/* Header */}
                <div className="p-5 bg-zinc-950 text-white flex justify-between items-center shrink-0 border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 text-red-500 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-zinc-800 text-zinc-300">
                                    {process.category || 'Geral'}
                                </span>
                                <span className="text-xs text-zinc-400">Visualização de Auditoria</span>
                            </div>
                            <h2 className="text-base font-bold text-white mt-0.5">
                                {process.name}
                            </h2>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-gray-50/50">
                    {/* Descrição orientativa */}
                    {process.description && (
                        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
                            <strong className="block font-bold mb-0.5 text-blue-950 uppercase tracking-wider text-[10px]">
                                Instrução Operacional:
                            </strong>
                            {process.description}
                        </div>
                    )}

                    {/* Barra de Progresso Interativa */}
                    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-3">
                        <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-gray-700">Simulação de Conformidade:</span>
                            <span className="font-mono font-bold text-red-600">
                                {checkedCount} de {totalCount} ({progressPercent}%)
                            </span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={handleCheckAll}
                                className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                            >
                                Marcar Todos
                            </button>
                            <span className="text-gray-300">&bull;</span>
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="text-[11px] font-bold text-gray-500 hover:underline cursor-pointer"
                            >
                                Desmarcar Todos
                            </button>
                        </div>
                    </div>

                    {/* Lista de Itens com Checkbox Interativo */}
                    <div className="space-y-2.5">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                                Critérios de Avaliação ({totalCount})
                            </span>
                            <span className="text-[11px] text-gray-400">
                                Clique para testar o comportamento
                            </span>
                        </div>

                        {checklist.map((item, idx) => (
                            <div
                                key={idx}
                                onClick={() => toggleItem(idx)}
                                className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                                    checkedItems[idx]
                                        ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-2xs'
                                        : 'bg-white border-gray-200 text-gray-800 hover:border-gray-300'
                                }`}
                            >
                                <div className="pt-0.5 shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={!!checkedItems[idx]}
                                        onChange={() => {}} // tratado no onClick do container
                                        className="w-4 h-4 rounded text-emerald-600 border-gray-300 focus:ring-emerald-500 cursor-pointer"
                                    />
                                </div>
                                <div className="text-xs flex-1 leading-relaxed">
                                    <span className="font-mono font-bold text-gray-400 mr-2">{idx + 1}.</span>
                                    <span className={checkedItems[idx] ? 'font-medium' : 'font-normal'}>
                                        {item}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-gray-200 flex justify-between items-center shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-bold text-xs transition-colors cursor-pointer"
                    >
                        Fechar
                    </button>

                    {isEditable && (
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                onEdit(process);
                            }}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Editar Processo</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

import React from 'react';
import { X, Sparkles, CheckCircle2, History, ChevronRight } from 'lucide-react';
import { CURRENT_VERSION, CHANGELOG_VERSIONS } from '../data/changelogData';

export default function VersionChangelogModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div 
            id="version-changelog-backdrop"
            onClick={onClose}
            className="fixed inset-0 bg-zinc-950/80 flex items-center justify-center p-4 z-[95] backdrop-blur-xs animate-in fade-in duration-150"
        >
            <div 
                id="version-changelog-modal"
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden border border-gray-200 flex flex-col animate-in zoom-in-95 duration-150"
            >
                {/* Cabeçalho */}
                <div className="p-5 bg-zinc-950 text-white flex justify-between items-center border-b border-zinc-800 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 text-red-500 flex items-center justify-center shrink-0">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-white">
                                    Notas de Atualizações
                                </h2>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px] font-mono font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    {CURRENT_VERSION}
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                HubDesk Suporte &bull; Histórico Completo de Versões
                            </p>
                        </div>
                    </div>

                    <button 
                        type="button"
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
                        title="Fechar modal"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Corpo com Lista Extensa de Versões */}
                <div className="p-5 sm:p-6 space-y-6 bg-gray-50/50 overflow-y-auto max-h-[60vh] scrollbar-thin">
                    {CHANGELOG_VERSIONS.map((release) => (
                        <div key={release.version} className="space-y-3">
                            <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-extrabold text-gray-900 bg-gray-100 px-2.5 py-0.5 rounded-lg border border-gray-200">
                                        {release.version}
                                    </span>
                                    <span className="text-xs font-medium text-gray-400">
                                        &bull; {release.date}
                                    </span>
                                </div>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                                    release.isCurrent 
                                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                                        : 'text-zinc-500 bg-zinc-100 border-zinc-200'
                                }`}>
                                    {release.tag}
                                </span>
                            </div>

                            {release.summary && (
                                <p className="text-xs text-gray-500 italic px-0.5">
                                    {release.summary}
                                </p>
                            )}

                            <div className="space-y-2.5">
                                {release.items.map((item, idx) => {
                                    const IconComp = item.icon;
                                    return (
                                        <div 
                                            key={idx}
                                            className={`p-3.5 rounded-xl border transition-all flex items-start gap-3 ${
                                                release.isCurrent 
                                                    ? 'bg-white border-gray-200/90 shadow-2xs hover:border-gray-300' 
                                                    : 'bg-white/80 border-gray-200/60 opacity-90'
                                            }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${item.iconColor}`}>
                                                <IconComp className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                                    <h4 className="text-xs font-bold text-gray-900 leading-snug">
                                                        {item.title}
                                                    </h4>
                                                    <span className="text-[10px] font-semibold text-gray-400 shrink-0">
                                                        {item.category}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-gray-600 leading-relaxed">
                                                    {item.description}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Rodapé */}
                <div className="p-4 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Versão ativa: {CURRENT_VERSION} &bull; Registro em tempo real</span>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
}

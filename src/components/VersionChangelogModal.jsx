import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, CheckCircle2, History, ChevronRight, ShieldCheck, Tag, Calendar, Layers } from 'lucide-react';
import { CURRENT_VERSION, CHANGELOG_VERSIONS } from '../data/changelogData';
import { cn } from '../utils/cn';
import { BorderBeam } from './magicui/BorderBeam';

export default function VersionChangelogModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    const [selectedVersion, setSelectedVersion] = useState('all');

    const displayedReleases = selectedVersion === 'all' 
        ? CHANGELOG_VERSIONS 
        : CHANGELOG_VERSIONS.filter(r => r.version === selectedVersion);

    return (
        <AnimatePresence>
            <div 
                id="version-changelog-backdrop"
                onClick={onClose}
                className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[95] animate-in fade-in duration-200"
            >
                <motion.div 
                    id="version-changelog-modal"
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 15 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#0d0f15]/95 text-zinc-100 rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.85)] w-full max-w-2xl max-h-[88vh] overflow-hidden border border-white/10 flex flex-col relative z-10 backdrop-blur-2xl"
                >
                    <BorderBeam size={240} duration={8} colorFrom="#f43f5e" colorTo="#e11d48" borderWidth={1.5} />
                    {/* Luz Ambiente Volumétrica no Topo */}
                    <div className="pointer-events-none absolute -top-24 -right-24 w-56 h-56 bg-rose-500/15 rounded-full blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-24 -left-24 w-56 h-56 bg-amber-500/10 rounded-full blur-3xl" />

                    {/* Cabeçalho do Modal */}
                    <div className="p-5 sm:p-6 border-b border-white/10 flex justify-between items-center shrink-0 relative z-10 bg-black/20">
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500/20 via-zinc-900 to-zinc-950 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0 shadow-lg shadow-rose-950/40">
                                <Sparkles className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="font-brand text-lg font-extrabold text-white tracking-tight">
                                        Notas de Atualizações
                                    </h2>
                                    <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 text-[10px] font-mono font-bold">
                                        {CURRENT_VERSION}
                                    </span>
                                </div>
                                <p className="text-xs text-zinc-400 mt-0.5">
                                    HubDesk Suporte &bull; Histórico oficial de lançamentos e melhorias
                                </p>
                            </div>
                        </div>

                        <button 
                            type="button"
                            onClick={onClose}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-white/10"
                            title="Fechar modal"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Barra de Filtro Rápido por Versão */}
                    <div className="px-5 sm:px-6 py-2.5 bg-zinc-950/40 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto scrollbar-hide shrink-0 text-xs">
                        <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mr-1">Versões:</span>
                        <button
                            type="button"
                            onClick={() => setSelectedVersion('all')}
                            className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap",
                                selectedVersion === 'all'
                                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                            )}
                        >
                            Todas as Releases
                        </button>
                        {CHANGELOG_VERSIONS.slice(0, 6).map(r => (
                            <button
                                key={r.version}
                                type="button"
                                onClick={() => setSelectedVersion(r.version)}
                                className={cn(
                                    "px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer whitespace-nowrap",
                                    selectedVersion === r.version
                                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                                        : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                                )}
                            >
                                {r.version} {r.isCurrent && "★"}
                            </button>
                        ))}
                    </div>

                    {/* Timeline Vertical de Releases */}
                    <div className="p-5 sm:p-6 space-y-8 overflow-y-auto max-h-[62vh] scrollbar-thin relative z-10">
                        {displayedReleases.map((release) => (
                            <div key={release.version} className="relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-0 before:w-0.5 before:bg-white/10 last:before:hidden space-y-3">
                                {/* Ponto Indicador da Timeline */}
                                <span className={cn(
                                    "absolute left-0 top-1 w-4 h-4 rounded-full flex items-center justify-center ring-4 ring-[#0d0f15]",
                                    release.isCurrent 
                                        ? "bg-rose-500 text-white shadow-sm shadow-rose-500" 
                                        : "bg-zinc-800 text-zinc-400 border border-white/20"
                                )}>
                                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                </span>

                                {/* Header da Release */}
                                <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "font-mono text-xs font-extrabold px-2.5 py-1 rounded-lg border",
                                            release.isCurrent 
                                                ? "bg-rose-500/15 text-rose-400 border-rose-500/30" 
                                                : "bg-white/5 text-zinc-300 border-white/10"
                                        )}>
                                            {release.version}
                                        </span>
                                        <span className="text-xs text-zinc-400 flex items-center gap-1">
                                            <Calendar className="w-3 h-3 text-zinc-500" />
                                            {release.date}
                                        </span>
                                    </div>
                                    <span className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase",
                                        release.isCurrent 
                                            ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" 
                                            : "text-zinc-400 bg-white/5 border-white/10"
                                    )}>
                                        {release.tag}
                                    </span>
                                </div>

                                {release.summary && (
                                    <p className="text-xs text-zinc-400 leading-relaxed bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                        {release.summary}
                                    </p>
                                )}

                                {/* Itens da Release */}
                                <div className="space-y-2 pt-1">
                                    {release.items.map((item, idx) => {
                                        const IconComp = item.icon;
                                        return (
                                            <div 
                                                key={idx}
                                                className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors flex items-start gap-3 shadow-xs"
                                            >
                                                <div className={cn(
                                                    "w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 shadow-2xs",
                                                    item.iconColor || "text-rose-400 bg-rose-500/10 border-rose-500/20"
                                                )}>
                                                    <IconComp className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <h4 className="text-xs font-bold text-white leading-snug truncate">
                                                            {item.title}
                                                        </h4>
                                                        <span className="text-[10px] font-semibold text-zinc-400 px-2 py-0.5 rounded-md bg-white/5 border border-white/5 shrink-0">
                                                            {item.category}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-zinc-300 leading-relaxed">
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

                    {/* Rodapé Executivo */}
                    <div className="p-4 sm:p-5 border-t border-white/10 flex items-center justify-between shrink-0 bg-black/40 relative z-10">
                        <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium">
                            <ShieldCheck className="w-4 h-4 text-rose-500" />
                            <span>Versão ativa: <strong className="text-white font-mono">{CURRENT_VERSION}</strong></span>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg shadow-rose-950/50"
                        >
                            Fechar Notas
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

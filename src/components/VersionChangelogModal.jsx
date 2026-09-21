import React from 'react';
import { X, Sparkles, CheckCircle2, ShieldCheck, Sliders, Palette, Tag } from 'lucide-react';

export default function VersionChangelogModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    const changelogItems = [
        {
            icon: Palette,
            iconColor: 'text-purple-600 bg-purple-50 border-purple-200',
            title: 'Alterado ícone do sistema',
            category: 'Identidade Visual',
            description: 'Atualização e refinamento do ícone oficial e dos elementos de identidade visual da aplicação.'
        },
        {
            icon: ShieldCheck,
            iconColor: 'text-red-600 bg-red-50 border-red-200',
            title: 'Atualização de visualização na tela de auditorias QA',
            category: 'Módulo de Qualidade',
            description: 'Novo painel completo com indicadores em tempo real, ranking de conformidade com pódio da equipe, gráficos analíticos e histórico detalhado com paginação e inspeção rápida.'
        },
        {
            icon: Sliders,
            iconColor: 'text-blue-600 bg-blue-50 border-blue-200',
            title: 'Atualização na tela de adição de processos de auditoria',
            category: 'Processos & Checklists',
            description: 'Fluxo aprimorado para cadastro e edição de processos de QA, com categorização dinâmica, gerenciamento ágil de perguntas e pré-visualização interativa antes da publicação.'
        }
    ];

    return (
        <div 
            id="version-changelog-backdrop"
            onClick={onClose}
            className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-4 z-[95] backdrop-blur-xs animate-in fade-in duration-150"
        >
            <div 
                id="version-changelog-modal"
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 flex flex-col animate-in zoom-in-95 duration-150"
            >
                {/* Cabeçalho */}
                <div className="p-5 bg-zinc-950 text-white flex justify-between items-center border-b border-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 text-red-500 flex items-center justify-center shrink-0">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-white">
                                    Notas da Versão
                                </h2>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[11px] font-mono font-bold flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    v3.1
                                </span>
                            </div>
                            <p className="text-xs text-zinc-400 mt-0.5">
                                HubDesk Suporte &bull; Histórico de Atualizações
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

                {/* Corpo com Itens do Changelog */}
                <div className="p-5 sm:p-6 space-y-4 bg-gray-50/50">
                    <div className="flex items-center justify-between pb-2 border-b border-gray-200/80">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" />
                            O que há de novo na versão 3.1
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            Versão Ativa
                        </span>
                    </div>

                    <div className="space-y-3">
                        {changelogItems.map((item, index) => {
                            const IconComponent = item.icon;
                            return (
                                <div 
                                    key={index}
                                    className="p-4 bg-white rounded-xl border border-gray-200/80 shadow-2xs hover:border-gray-300 transition-all flex items-start gap-3.5"
                                >
                                    <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${item.iconColor}`}>
                                        <IconComponent className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <h4 className="text-xs font-bold text-gray-900 leading-snug">
                                                {item.title}
                                            </h4>
                                            <span className="text-[10px] font-semibold text-gray-400 shrink-0">
                                                {item.category}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 leading-relaxed">
                                            {item.description}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Rodapé */}
                <div className="p-4 bg-white border-t border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Sistema operando com estabilidade</span>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
}

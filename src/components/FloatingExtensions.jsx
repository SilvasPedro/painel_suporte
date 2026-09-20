import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Phone, Minus, Search, Copy, Check, Clock, ArrowRightLeft, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const EXTENSIONS_DATA = [
  {
    category: 'Setores Principais',
    items: [
      { name: 'Suporte Técnico', ext: '20', tag: 'Principal', desc: 'Atendimento operacional e suporte ao cliente' },
      { name: 'Financeiro', ext: '21', tag: 'Faturamento', desc: 'Emissão de boletos, faturas e pagamentos' },
      { name: 'Comercial', ext: '22', tag: 'Vendas', desc: 'Planos, contratações e novos clientes' },
      { name: 'Torre de Serviços', ext: '25', tag: 'Operação', desc: 'Instalações, manutenções e técnicos externos' },
      { name: 'Retenção', ext: '28', tag: 'Cancelamento', desc: 'Negociações de cancelamento e fidelidade' },
      { name: 'Cobrança', ext: '32', tag: 'Cobrança', desc: 'Acordos financeiros e negociação de débitos' },
      { name: 'Auto Desbloqueio (Bot)', ext: '5002', tag: 'Automático', desc: 'Desbloqueio em confiança automatizado' },
    ]
  },
  {
    category: 'Plantão & Feriados',
    items: [
      { name: 'Suporte Feriado', ext: '27', tag: 'Plantão', desc: 'Atendimento de emergência técnica' },
      { name: 'Financeiro Feriado', ext: '34', tag: 'Plantão', desc: 'Atendimento financeiro especial' },
      { name: 'Comercial Feriado', ext: '30', tag: 'Plantão', desc: 'Plantão de vendas em datas especiais' },
    ]
  }
];

export default function FloatingExtensions() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedExt, setCopiedExt] = useState(null);

  const modalRef = useRef(null);
  const buttonRef = useRef(null);
  const { currentUser } = useAuth();

  // Fecha o modal ao clicar fora ou pressionar tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Copia o ramal para a área de transferência com feedback
  const handleCopy = (ext, e) => {
    if (e) e.stopPropagation();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(ext);
      setCopiedExt(ext);
      setTimeout(() => setCopiedExt(null), 1800);
    }
  };

  // Filtro de ramais por busca
  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return EXTENSIONS_DATA;

    return EXTENSIONS_DATA.map(group => {
      const matchedItems = group.items.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.ext.toLowerCase().includes(query) ||
        item.desc.toLowerCase().includes(query) ||
        item.tag.toLowerCase().includes(query)
      );
      return { ...group, items: matchedItems };
    }).filter(group => group.items.length > 0);
  }, [searchQuery]);

  // Não renderiza se o usuário não estiver autenticado
  if (!currentUser) return null;

  // Se o usuário for Admin, posiciona ao lado do chat do sistema para não sobrepor
  const isAdmin = currentUser.role === 'Admin';
  const positionClass = isAdmin ? 'right-24' : 'right-4 sm:right-6';

  return (
    <>
      {/* Botão Flutuante (Permanece sempre visível para permitir recolher pelo próprio ícone) */}
      <button
        ref={buttonRef}
        id="toggle-extensions-floating-btn"
        onClick={() => setIsOpen(prev => !prev)}
        className={`fixed bottom-6 ${positionClass} p-3.5 sm:p-4 rounded-full text-white shadow-xl transition-all duration-300 z-50 flex items-center justify-center cursor-pointer ${
          isOpen
            ? 'bg-red-700 ring-4 ring-red-200 shadow-2xl scale-105'
            : 'bg-red-600 hover:bg-red-700 hover:scale-105'
        }`}
        title={isOpen ? 'Clique para recolher ramais' : 'Ver lista de ramais da empresa'}
        aria-label={isOpen ? 'Recolher janela de ramais' : 'Abrir janela de ramais'}
      >
        <Phone className="w-5 h-5 sm:w-6 sm:h-6 transition-transform" />
      </button>

      {/* Janela Modal de Ramais (Posicionada logo acima do botão flutuante) */}
      <div
        ref={modalRef}
        id="extensions-modal-window"
        className={`fixed bottom-22 ${positionClass} w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-gray-200/90 z-50 origin-bottom-right transition-all duration-200 ${
          isOpen
            ? 'scale-100 opacity-100 pointer-events-auto'
            : 'scale-90 opacity-0 pointer-events-none'
        }`}
        style={{ maxHeight: 'calc(100vh - 120px)' }}
      >
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-red-600 to-rose-700 px-4 py-3.5 text-white flex justify-between items-center shadow-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-white/15 rounded-lg">
              <Phone className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-black text-sm tracking-tight leading-tight">Ramais Telefônicos</h3>
              <p className="text-[10px] text-red-100 font-medium">Guia rápido para transferências</p>
            </div>
          </div>
          
          {/* Botão de Minimizar com o ícone "-" */}
          <button
            id="minimize-extensions-btn"
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-white/20 active:bg-white/30 rounded-lg text-white transition-colors flex items-center justify-center cursor-pointer"
            title="Minimizar janela"
            aria-label="Minimizar janela de ramais"
          >
            <Minus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Barra de Pesquisa Rápida */}
        <div className="p-3 bg-gray-50/90 border-b border-gray-100 shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="search-extensions-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por setor ou número..."
              className="w-full pl-9 pr-7 py-2 bg-white rounded-xl border border-gray-200 text-xs text-gray-800 placeholder-gray-400 focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold p-1 cursor-pointer"
                title="Limpar pesquisa"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Lista de Ramais */}
        <div className="p-4 overflow-y-auto flex-1 bg-white text-gray-800 space-y-5 divide-y divide-gray-100">
          {filteredGroups.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-medium text-gray-600">Nenhum ramal encontrado para &quot;{searchQuery}&quot;</p>
              <button 
                onClick={() => setSearchQuery('')}
                className="text-[11px] font-bold text-red-600 hover:underline mt-1 cursor-pointer"
              >
                Limpar filtro
              </button>
            </div>
          ) : (
            filteredGroups.map((group, groupIdx) => (
              <div key={group.category} className={groupIdx > 0 ? 'pt-4' : ''}>
                <div className="flex items-center justify-between mb-2.5">
                  <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
                    {group.category}
                  </h4>
                  <span className="text-[10px] text-gray-400 font-medium">
                    {group.items.length} {group.items.length === 1 ? 'ramal' : 'ramais'}
                  </span>
                </div>

                <div className="space-y-2">
                  {group.items.map((item) => {
                    const isCopied = copiedExt === item.ext;
                    return (
                      <div
                        key={item.ext}
                        onClick={() => handleCopy(item.ext)}
                        className={`group p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                          isCopied 
                            ? 'bg-emerald-50/90 border-emerald-300 ring-2 ring-emerald-500/20 shadow-2xs' 
                            : 'bg-gray-50/60 hover:bg-red-50/40 border-gray-100 hover:border-red-200 shadow-2xs'
                        }`}
                        title="Clique para copiar o número do ramal"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-gray-900 truncate group-hover:text-red-700 transition-colors">
                              {item.name}
                            </span>
                            <span className="px-1.5 py-0.2 rounded-md bg-gray-200/60 text-gray-600 text-[9px] font-semibold">
                              {item.tag}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 truncate mt-0.5">
                            {item.desc}
                          </p>
                        </div>

                        {/* Botão de Ramal / Copiar */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`font-mono px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs ${
                              isCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-red-100 text-red-700 group-hover:bg-red-600 group-hover:text-white'
                            }`}
                          >
                            {item.ext}
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-white" />
                            ) : (
                              <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {/* Orientações de Transferência e Horários */}
          <div className="pt-4 space-y-3">
            <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-red-600" /> Como Transferir no Telefone
            </h4>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-red-50/80 p-2.5 rounded-xl border border-red-100/80 flex flex-col justify-between">
                <span className="font-mono text-xs font-black text-red-700 bg-red-200/70 px-1.5 py-0.5 rounded w-fit mb-1">
                  ##
                </span>
                <span className="text-[11px] font-bold text-gray-900 leading-tight">Direta (Cega)</span>
                <span className="text-[9px] text-gray-500 mt-0.5 leading-tight">Transfere imediatamente sem consultar</span>
              </div>

              <div className="bg-amber-50/80 p-2.5 rounded-xl border border-amber-100/80 flex flex-col justify-between">
                <span className="font-mono text-xs font-black text-amber-700 bg-amber-200/70 px-1.5 py-0.5 rounded w-fit mb-1">
                  **
                </span>
                <span className="text-[11px] font-bold text-gray-900 leading-tight">Assistida</span>
                <span className="text-[9px] text-gray-500 mt-0.5 leading-tight">Consulta antes com o analista</span>
              </div>
            </div>

            {/* Horários e Contato ETECC Resolve */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-gray-500" /> Horários de Atendimento ETECC Resolve
                </span>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded-full">
                  Operacional
                </span>
              </div>
              <div className="text-[10px] text-gray-600 space-y-0.5 font-medium">
                <p className="flex justify-between"><span>Segunda a Sexta:</span> <strong className="text-gray-900">08:30 às 17:00</strong></p>
                <p className="flex justify-between"><span>Sábado:</span> <strong className="text-gray-900">08:30 às 16:00</strong></p>
              </div>

              {/* Telefone ETECC Resolve */}
              <div className="pt-2 border-t border-gray-200/70 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-red-100/80 text-red-600 rounded-lg">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-gray-500 block leading-tight">Telefone ETECC Resolve</span>
                    <a
                      href="tel:1334211980"
                      className="text-xs font-black text-gray-900 font-mono hover:text-red-600 transition-colors"
                      title="Clique para ligar"
                    >
                      (13) 3421-1980
                    </a>
                  </div>
                </div>

                <button
                  id="copy-resolve-phone-btn"
                  onClick={(e) => handleCopy('(13) 3421-1980', e)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs ${
                    copiedExt === '(13) 3421-1980'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-gray-200 text-gray-700 hover:border-red-300 hover:text-red-700'
                  }`}
                  title="Copiar telefone do ETECC Resolve"
                >
                  {copiedExt === '(13) 3421-1980' ? (
                    <>
                      <Check className="w-3 h-3 text-white" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-gray-400 group-hover:text-red-600" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé Informativo Rápido */}
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-500 shrink-0">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-red-500" /> Toque no número para copiar
          </span>
          <span className="font-mono text-[9px] text-gray-400">Hubdesk Telecom</span>
        </div>
      </div>
    </>
  );
}

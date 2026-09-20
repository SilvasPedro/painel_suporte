import React, { useEffect } from 'react';
import { LogOut, ArrowLeft, ShieldAlert, X } from 'lucide-react';

export default function LogoutConfirmModal({ isOpen, onClose, onConfirm, userName }) {
  // Fecha com a tecla Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-4 z-[999] backdrop-blur-sm transition-all"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="logout-confirm-modal"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Topo do Modal */}
        <div className="p-5 sm:p-6 pb-0 flex items-start justify-between">
          <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0 shadow-2xs">
            <LogOut className="w-6 h-6" />
          </div>
          <button
            id="close-logout-modal-x"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo Informativo */}
        <div className="p-5 sm:p-6 space-y-3">
          <div>
            <h3 className="text-lg font-black text-gray-900">
              Deseja mesmo sair do sistema?
            </h3>
            <p className="text-xs text-gray-500 mt-1 leading-relaxed">
              {userName ? (
                <>Olá, <strong className="text-gray-700">{userName}</strong>. </>
              ) : null}
              Sua sessão atual será encerrada e você precisará realizar login novamente para acessar o painel de suporte.
            </p>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl flex items-center gap-2.5 text-xs text-amber-800">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Lembre-se de certificar-se de ter salvo seus lançamentos e edições antes de sair.</span>
          </div>
        </div>

        {/* Rodapé com Ações Claras (Voltar ou Confirmar Saída) */}
        <div className="p-4 sm:p-5 bg-gray-50/80 border-t border-gray-100 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <button
            id="btn-cancel-logout"
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao sistema</span>
          </button>
          
          <button
            id="btn-confirm-logout"
            type="button"
            onClick={onConfirm}
            className="w-full sm:w-auto px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-all shadow-sm hover:shadow flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sim, quero sair</span>
          </button>
        </div>
      </div>
    </div>
  );
}

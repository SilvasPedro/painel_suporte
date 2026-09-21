import React from 'react';
import { UserX, LogOut, ShieldAlert, Mail } from 'lucide-react';
import { logout } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function AccountInactive() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error("Erro ao deslogar:", error);
      navigate('/login', { replace: true });
    }
  };

  return (
    <div 
      id="inactive-account-screen"
      className="min-h-screen w-full bg-zinc-950 flex items-center justify-center p-4 sm:p-6 select-none"
    >
      <div 
        id="inactive-account-card"
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl text-center flex flex-col items-center animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Ícone de Alerta em Destaque */}
        <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-6 shadow-inner">
          <UserX className="w-10 h-10" />
        </div>

        {/* Badge de Status */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Acesso Suspenso</span>
        </div>

        {/* Título Principal */}
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">
          Usuário Desativado
        </h1>

        {/* Mensagem Principal */}
        <p className="text-sm sm:text-base text-zinc-300 leading-relaxed max-w-md mb-6">
          Este usuário foi desativado no sistema. O acesso às funcionalidades e painéis da plataforma foi bloqueado.
        </p>

        {/* Caixa de Orientação e Contato */}
        <div className="w-full bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 mb-8 text-left space-y-3">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                Como proceder?
              </h2>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                Por favor, entre em contato diretamente com o <strong className="text-zinc-200">administrador da plataforma</strong> ou com a sua liderança para verificar o status do seu cadastro e solicitar a reativação.
              </p>
            </div>
          </div>

          {/* Detalhes da Conta Conectada */}
          {currentUser?.email && (
            <div className="pt-3 border-t border-zinc-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-zinc-500">
              <span>Conta conectada:</span>
              <span className="font-mono text-zinc-300 font-medium truncate max-w-[260px]">
                {currentUser.name ? `${currentUser.name} (${currentUser.email})` : currentUser.email}
              </span>
            </div>
          )}
        </div>

        {/* Botão de Ação para Sair da Conta */}
        <button
          id="btn-inactive-logout"
          onClick={handleLogout}
          className="w-full sm:w-auto min-w-[200px] px-6 py-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs sm:text-sm font-bold tracking-wide transition-all duration-150 shadow-sm hover:shadow flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sair da conta e voltar ao login</span>
        </button>

        {/* Identificador sutil de versão */}
        <div className="mt-8 text-[11px] text-zinc-600 font-mono">
          HubDesk Suporte &bull; v3.1
        </div>
      </div>
    </div>
  );
}

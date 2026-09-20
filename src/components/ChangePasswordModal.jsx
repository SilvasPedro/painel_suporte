import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Lock, KeyRound, Eye, EyeOff, Check, X, ShieldCheck, 
  AlertCircle, CheckCircle2, Loader2 
} from 'lucide-react';
import { updatePassword } from 'firebase/auth';
import { auth } from '../services/firebase';

export default function ChangePasswordModal({ isOpen, onClose, showToast }) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fecha o modal e reseta os estados
  const handleClose = useCallback(() => {
    if (loading) return;
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setLoading(false);
    onClose();
  }, [loading, onClose]);

  // Fecha o modal ao pressionar Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, handleClose]);

  // Cálculo da Força da Senha (Fraca, Média, Forte)
  const strength = useMemo(() => {
    if (!newPassword) {
      return {
        level: 0,
        label: 'Aguardando senha...',
        barColor: 'bg-gray-200',
        textColor: 'text-gray-400',
        badgeBg: 'bg-gray-100 text-gray-500 border-gray-200',
        message: 'Digite sua nova senha para avaliar o nível de segurança.',
        checks: {
          minLength: false,
          number: false,
          upperLower: false,
          special: false,
        }
      };
    }

    const minLength = newPassword.length >= 6;
    const goodLength = newPassword.length >= 8;
    const hasNumber = /\d/.test(newPassword);
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasUpperLower = hasUpper && hasLower;
    const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);

    let score = 0;
    if (minLength) score += 1;
    if (goodLength) score += 1;
    if (hasNumber) score += 1;
    if (hasUpperLower) score += 1;
    if (hasSpecial) score += 1;

    if (score <= 2) {
      return {
        level: 1,
        label: 'Senha Fraca',
        barColor: 'bg-red-500',
        textColor: 'text-red-600',
        badgeBg: 'bg-red-50 text-red-700 border-red-200',
        message: 'Recomendamos adicionar números e letras maiúsculas.',
        checks: {
          minLength,
          number: hasNumber,
          upperLower: hasUpperLower,
          special: hasSpecial,
        }
      };
    } else if (score <= 3) {
      return {
        level: 2,
        label: 'Senha Média',
        barColor: 'bg-amber-500',
        textColor: 'text-amber-600',
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
        message: 'Boa senha! Inclua caracteres especiais para máxima proteção.',
        checks: {
          minLength,
          number: hasNumber,
          upperLower: hasUpperLower,
          special: hasSpecial,
        }
      };
    } else {
      return {
        level: 3,
        label: 'Senha Forte',
        barColor: 'bg-emerald-500',
        textColor: 'text-emerald-600',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        message: 'Excelente! Sua senha atende aos mais altos padrões de segurança.',
        checks: {
          minLength,
          number: hasNumber,
          upperLower: hasUpperLower,
          special: hasSpecial,
        }
      };
    }
  }, [newPassword]);

  // Validação de correspondência de senhas
  const isMatch = Boolean(confirmPassword && newPassword === confirmPassword);
  const hasMismatch = Boolean(confirmPassword && newPassword !== confirmPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) {
      showToast?.("Usuário não autenticado.", "error");
      return;
    }

    if (newPassword.length < 6) {
      showToast?.("A senha deve ter pelo menos 6 caracteres.", "error");
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast?.("As senhas digitadas não coincidem.", "error");
      return;
    }

    setLoading(true);
    try {
      await updatePassword(auth.currentUser, newPassword);
      showToast?.("Senha alterada com sucesso!", "success");
      handleClose();
    } catch (error) {
      if (error.code === 'auth/requires-recent-login') {
        showToast?.("Por segurança, saia e faça login novamente antes de alterar a senha.", "error");
      } else {
        showToast?.("Erro ao alterar senha: " + (error.message || "Tente novamente mais tarde"), "error");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-zinc-950/75 flex items-center justify-center p-4 z-[999] backdrop-blur-sm transition-all"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) handleClose();
      }}
    >
      <div 
        id="change-password-modal"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col"
      >
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 text-white p-4 sm:p-5 flex justify-between items-center border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-base text-white flex items-center gap-2">
                Alterar Minha Senha
              </h3>
              <p className="text-xs text-zinc-400">Proteja seu acesso ao sistema</p>
            </div>
          </div>
          <button 
            id="close-change-password-modal-btn"
            onClick={handleClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer disabled:opacity-50"
            title="Fechar janela (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo do Formulário */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* Campo: Nova Senha */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Nova Senha</span>
              {newPassword && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${strength.badgeBg}`}>
                  {strength.label}
                </span>
              )}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="new-password-input"
                type={showNewPassword ? "text" : "password"}
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha (mín. 6 dígitos)"
                className="w-full pl-9 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-2xs"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(prev => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                title={showNewPassword ? "Ocultar senha" : "Ver senha"}
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Barra de Indicação Visual de Senha Fraca / Média / Forte */}
            <div className="mt-2 space-y-1.5">
              <div className="grid grid-cols-3 gap-1.5">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    strength.level >= 1 ? strength.barColor : 'bg-gray-200'
                  }`} 
                />
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    strength.level >= 2 ? strength.barColor : 'bg-gray-200'
                  }`} 
                />
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    strength.level >= 3 ? strength.barColor : 'bg-gray-200'
                  }`} 
                />
              </div>

              {/* Indicadores de requisitos */}
              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                <span className="flex items-center gap-1 font-medium">
                  {strength.level === 0 && <span className="text-gray-400">Insira ao menos 6 caracteres</span>}
                  {strength.level === 1 && <span className="text-red-600 font-bold">● Senha Fraca</span>}
                  {strength.level === 2 && <span className="text-amber-600 font-bold">● Senha Média</span>}
                  {strength.level === 3 && <span className="text-emerald-600 font-bold">● Senha Forte</span>}
                </span>
                <span className="text-[10px] text-gray-400">
                  {newPassword.length} caracteres
                </span>
              </div>

              {/* Checklist de requisitos de segurança */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                <div className={`flex items-center gap-1.5 ${strength.checks.minLength ? 'text-emerald-700 font-bold' : 'text-gray-400'}`}>
                  {strength.checks.minLength ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300 ml-1 mr-0.5" />}
                  <span>Mínimo 6 caracteres</span>
                </div>
                <div className={`flex items-center gap-1.5 ${strength.checks.number ? 'text-emerald-700 font-bold' : 'text-gray-400'}`}>
                  {strength.checks.number ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300 ml-1 mr-0.5" />}
                  <span>Números (0-9)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${strength.checks.upperLower ? 'text-emerald-700 font-bold' : 'text-gray-400'}`}>
                  {strength.checks.upperLower ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300 ml-1 mr-0.5" />}
                  <span>Maiúsculas e minúsculas</span>
                </div>
                <div className={`flex items-center gap-1.5 ${strength.checks.special ? 'text-emerald-700 font-bold' : 'text-gray-400'}`}>
                  {strength.checks.special ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-300 ml-1 mr-0.5" />}
                  <span>Símbolos especiais</span>
                </div>
              </div>
            </div>
          </div>

          {/* Campo: Confirmar Nova Senha */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Confirmar Nova Senha</span>
              {confirmPassword && (
                isMatch ? (
                  <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Senhas coincidem
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Não coincidem
                  </span>
                )
              )}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                id="confirm-password-input"
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita exatamente a nova senha"
                className={`w-full pl-9 pr-10 py-2.5 bg-gray-50 border rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-hidden focus:ring-2 transition-all shadow-2xs ${
                  hasMismatch 
                    ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' 
                    : isMatch 
                    ? 'border-emerald-300 focus:ring-emerald-500/20 focus:border-emerald-500' 
                    : 'border-gray-200 focus:ring-red-500/20 focus:border-red-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(prev => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                title={showConfirmPassword ? "Ocultar confirmação" : "Ver confirmação"}
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Dica de Segurança */}
          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 flex items-start gap-2 text-xs text-gray-500">
            <ShieldCheck className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Evite reutilizar senhas antigas ou senhas pessoais fáceis de deduzir. Sua senha atualizada valerá para os próximos acessos.
            </p>
          </div>

          {/* Rodapé de Ações */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-gray-100">
            <button
              id="cancel-change-password-btn"
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2.5 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              id="submit-change-password-btn"
              type="submit"
              disabled={loading || !newPassword || newPassword !== confirmPassword || newPassword.length < 6}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-all shadow-sm hover:shadow flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Atualizando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Atualizar Senha</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  Activity,
  Calendar,
  Headphones,
  Trophy,
  Clock,
  Layers,
  FileText
} from 'lucide-react';
import { login } from '../services/auth';
import logo from '../assets/favicon_red.png';
import VersionChangelogModal from '../components/VersionChangelogModal';
import { CURRENT_VERSION } from '../data/changelogData';
import { Button, Input, Badge } from '../components/ui';
import { BorderBeam } from '../components/magicui';
import { cn } from '../utils/cn';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isChangelogModalOpen, setIsChangelogModalOpen] = useState(false);

  const navigate = useNavigate();
  const { currentUser, isInactive } = useAuth();

  // Redirecionamento automático se usuário já estiver autenticado
  useEffect(() => {
    if (currentUser) {
      if (isInactive || currentUser.isInactive) {
        navigate('/inactive', { replace: true });
      } else {
        navigate('/home', { replace: true });
      }
    }
  }, [currentUser, isInactive, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email, password);
    } catch {
      setError("Credenciais inválidas. Verifique os dados e tente novamente.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080b] text-zinc-100 flex items-center justify-center p-4 sm:p-6 lg:p-10 relative overflow-hidden font-sans selection:bg-rose-500/30 selection:text-rose-200">
      
      {/* Grade de Linhas Sutil & Iluminação Volumétrica de Fundo */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }}
      />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[750px] h-[380px] bg-rose-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-24 -left-20 w-96 h-96 bg-rose-950/25 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 -right-24 w-80 h-80 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Card Principal Dual-Panel com Glassmorphism Refinado */}
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="max-w-6xl w-full bg-[#0d0f15]/90 backdrop-blur-2xl border border-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.8)] rounded-3xl overflow-hidden flex flex-col lg:flex-row relative z-10"
      >
        
        {/* Painel Esquerdo: Vitrine Executiva & Métricas da Operação */}
        <div className="lg:w-7/12 p-6 sm:p-8 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/10 bg-gradient-to-br from-black/40 via-zinc-950/20 to-black/30 relative">
          <div>
            {/* Topo: Logo & Versão Ativa */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500/20 via-zinc-900 to-zinc-950 border border-rose-500/30 flex items-center justify-center shrink-0 p-2 shadow-lg shadow-rose-950/40">
                  <img src={logo} alt="HubDesk Logo" className="w-full h-full object-contain filter drop-shadow" />
                </div>
                <div>
                  <span className="font-brand text-2xl font-black tracking-tight text-white flex items-center select-none">
                    HUB<span className="text-rose-500 ml-0.5">DESK</span>
                  </span>
                  <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 -mt-0.5">
                    Central de Operações
                  </p>
                </div>
              </div>

              {/* Tag de Versão Estática (Trigger para Changelog) */}
              <button
                type="button"
                id="btn-login-version"
                onClick={() => setIsChangelogModalOpen(true)}
                className="group px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-rose-500/40 text-xs font-mono font-bold text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center gap-2 shadow-xs"
                title="Ver histórico de notas da versão"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{CURRENT_VERSION}</span>
                <span className="text-[10px] uppercase tracking-wider text-rose-400 font-sans font-bold">
                  Notas ➔
                </span>
              </button>
            </div>

            {/* Cabeçalho da Seção */}
            <div className="mb-8">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold mb-3 tracking-wide">
                <Activity className="w-3.5 h-3.5 text-rose-500" />
                <span>Plataforma Integrada de Gestão</span>
              </div>
              <h1 className="font-brand text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight mb-3">
                Inteligência Operacional & <br />
                <span className="bg-gradient-to-r from-rose-400 via-rose-500 to-amber-400 bg-clip-text text-transparent">
                  Performance de Suporte
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 max-w-lg leading-relaxed">
                Cockpit unificado para acompanhamento de KPIs, auditorias de conformidade QA, gestão de 4 turnos e rankings da equipe.
              </p>
            </div>

            {/* Bento Grid: 3 Pilares Executivos em Cards Glass */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
              <div className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 transition-colors flex flex-col justify-between">
                <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-2.5">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-200 block">Cockpit de KPIs</span>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">TMR, TMA, FCR & chamados em tempo real</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 transition-colors flex flex-col justify-between">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-2.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-200 block">Radar de Turnos</span>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">Gestão de 4 turnos oficiais e escalas</span>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 transition-colors flex flex-col justify-between">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-2.5">
                  <Trophy className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-zinc-200 block">Auditorias & Rank</span>
                  <span className="text-[11px] text-zinc-400 block mt-0.5">Rankings semanais com pontuação ponderada</span>
                </div>
              </div>
            </div>

            {/* Destaque da Versão Atual */}
            <div className="p-4 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-white block truncate">
                    Atualização {CURRENT_VERSION} disponível
                  </span>
                  <span className="text-[11px] text-zinc-400 block truncate">
                    Novo Hub da equipe, navegação com Magic UI e design executivo.
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChangelogModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-rose-400 hover:text-rose-300 transition-colors shrink-0 cursor-pointer"
              >
                Ver Notas
              </button>
            </div>
          </div>

          {/* Rodapé da Coluna Esquerda */}
          <div className="mt-8 pt-4 border-t border-white/10 text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>&copy; 2026 HubDesk Suporte &bull; Gestão Operacional</span>
            <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
              Ambiente Seguro com RBAC
            </span>
          </div>
        </div>

        {/* Painel Direito: Formulário com BorderBeam Magic UI */}
        <div className="lg:w-5/12 p-6 sm:p-8 lg:p-12 flex flex-col justify-center bg-zinc-950/90 relative overflow-hidden">
          <BorderBeam size={160} duration={8} colorFrom="#f43f5e" colorTo="#fbbf24" borderWidth={1.5} />
          
          <div className="max-w-md w-full mx-auto relative z-10">
            
            <div className="mb-6 sm:mb-8 text-left">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-bold text-rose-400 tracking-wider uppercase mb-3">
                <Lock className="w-3 h-3 text-rose-400" />
                <span>Portal de Acesso</span>
              </span>
              <h2 className="font-brand text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Entrar no Sistema
              </h2>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1.5">
                Informe suas credenciais autorizadas para acessar o cockpit.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              
              {/* Alerta de Erro com Animação */}
              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex items-start gap-3 p-3.5 text-xs text-rose-300 bg-rose-950/40 rounded-xl border border-rose-800/60 shadow-xs"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input: E-mail */}
              <Input
                label="E-MAIL CORPORATIVO"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@empresa.com"
                icon={Mail}
                autoComplete="email"
              />

              {/* Input: Senha */}
              <Input
                label="SENHA DE ACESSO"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                icon={Lock}
                autoComplete="current-password"
                iconRight={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />

              {/* Botão de Entrar Shimmer com Feixe de Luz */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="shimmer"
                  size="lg"
                  loading={isLoading}
                  disabled={isLoading}
                  iconRight={ArrowRight}
                  className="w-full h-12 text-sm font-bold shadow-lg shadow-rose-600/25"
                >
                  Entrar no HubDesk
                </Button>
              </div>
            </form>

            <div className="mt-8 pt-6 border-t border-white/10 text-center">
              <p className="text-xs text-zinc-500 leading-relaxed">
                Problemas de acesso ou redefinição de credenciais? Contate a gestão ou o administrador do suporte.
              </p>
            </div>

          </div>
        </div>

      </motion.div>

      {/* Modal Completo de Changelog */}
      <VersionChangelogModal
        isOpen={isChangelogModalOpen}
        onClose={() => setIsChangelogModalOpen(false)}
      />
    </div>
  );
};

export default Login;

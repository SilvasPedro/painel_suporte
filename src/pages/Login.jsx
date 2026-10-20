import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Layers,
  History,
  Info
} from 'lucide-react';
import { login } from '../services/auth';
import logo from '../assets/favicon_red.png';
import VersionChangelogModal from '../components/VersionChangelogModal';
import { CURRENT_VERSION, CHANGELOG_VERSIONS } from '../data/changelogData';

// Geração de partículas de bolha para o plano de fundo
const BUBBLE_COUNT = 38;
const BUBBLES_DATA = Array.from({ length: BUBBLE_COUNT }).map((_, idx) => ({
  id: idx,
  size: Math.floor(Math.random() * 22) + 10, // 10px a 32px
  left: Math.floor(Math.random() * 96) + 2,   // 2% a 98%
  duration: (Math.random() * 4 + 4.5).toFixed(2), // 4.5s a 8.5s
  delay: (Math.random() * 5).toFixed(2),         // 0s a 5s
  isRed: Math.random() > 0.45,
  opacity: (Math.random() * 0.4 + 0.3).toFixed(2),
}));

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

  // Efeito de bolhas subindo suavemente até 70% da altura da tela e sumindo
  const renderedBubbles = useMemo(() => {
    return BUBBLES_DATA.map((b) => (
      <div
        key={b.id}
        className={`absolute rounded-full pointer-events-none animate-float-bubble backdrop-blur-xs ${
          b.isRed 
            ? 'bg-red-500/15 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]' 
            : 'bg-white/10 border border-white/20 shadow-[0_0_12px_rgba(255,255,255,0.1)]'
        }`}
        style={{
          width: `${b.size}px`,
          height: `${b.size}px`,
          left: `${b.left}%`,
          bottom: '-30px',
          animationDuration: `${b.duration}s`,
          animationDelay: `${b.delay}s`,
        }}
      />
    ));
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-3 sm:p-5 lg:p-8 relative overflow-hidden font-sans selection:bg-red-500/30 selection:text-red-200">
      
      {/* Camada Atmosférica de Fundo */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(185,28,28,0.15),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute top-1/4 -left-40 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-0 w-80 h-80 bg-red-950/20 rounded-full blur-3xl pointer-events-none" />

      {/* Bolhas ascendentes animadas que sobem até 70% e somem */}
      <div className="absolute inset-x-0 bottom-0 top-0 overflow-hidden pointer-events-none z-0">
        {renderedBubbles}
      </div>

      {/* Card Principal Dual-Panel */}
      <div className="max-w-6xl w-full bg-zinc-900/70 backdrop-blur-2xl border border-zinc-800/90 shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-3xl overflow-hidden flex flex-col lg:flex-row relative z-10">
        
        {/* Painel Esquerdo: Branding e Feed de Changelog Visível */}
        <div className="lg:w-7/12 p-6 sm:p-8 lg:p-10 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-zinc-800/80 bg-zinc-950/40 relative">
          
          <div>
            {/* Topo: Logo & Identidade Visual */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-zinc-900 border border-zinc-800/90 flex items-center justify-center shrink-0 p-2 shadow-inner">
                  <img src={logo} alt="HubDesk Logo" className="w-full h-full object-contain" />
                </div>
                <span className="font-brand text-2xl font-black tracking-tight text-white flex items-center select-none">
                  HUB<span className="text-red-500 font-black ml-0.5">DESK</span>
                </span>
              </div>

              {/* Tag de Versão Ativa com Trigger para Modal */}
              <button
                type="button"
                id="btn-login-version"
                onClick={() => setIsChangelogModalOpen(true)}
                className="group px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-red-500/40 text-xs font-mono font-bold text-zinc-300 hover:text-white transition-all cursor-pointer flex items-center gap-2 shadow-2xs"
                title="Clique para ver o histórico completo de versões"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{CURRENT_VERSION}</span>
                <span className="text-[10px] uppercase tracking-wider text-emerald-400 font-sans font-semibold ml-0.5">
                  Ativa
                </span>
              </button>
            </div>

            {/* Cabeçalho da Seção */}
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug mb-2">
                Gestão & Performance de <span className="text-red-500">Suporte Técnico</span>
              </h1>
              <p className="text-sm text-zinc-400 max-w-xl leading-relaxed">
                Plataforma unificada para acompanhamento de KPIs, auditorias de conformidade QA, escalas de colaboradores e produtividade.
              </p>
            </div>

            {/* FEED DO CHANGELOG VISÍVEL DIRETAMENTE NA TELA DE LOGIN */}
            <div className="mt-6 rounded-2xl bg-zinc-900/80 border border-zinc-800/90 p-4 sm:p-5 shadow-inner">
              <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="text-xs sm:text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                    Changelog & Novidades
                  </h2>
                </div>
                <span className="text-[11px] font-medium text-zinc-400">
                  Atualizado em tempo real
                </span>
              </div>

              {/* Lista com scroll para comportar histórico extenso */}
              <div className="space-y-4 max-h-[280px] sm:max-h-[320px] overflow-y-auto pr-1.5 scrollbar-thin">
                {CHANGELOG_VERSIONS.map((release) => (
                  <div key={release.version} className="space-y-2.5">
                    {/* Header da Versão */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-md font-mono text-xs font-black border ${
                          release.isCurrent 
                            ? 'bg-red-500/15 text-red-400 border-red-500/30' 
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700/50'
                        }`}>
                          {release.version}
                        </span>
                        <span className="text-[11px] text-zinc-500">
                          {release.date}
                        </span>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        release.isCurrent 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-zinc-800/70 text-zinc-400 border border-zinc-700/40'
                      }`}>
                        {release.tag}
                      </span>
                    </div>

                    {/* Resumo da Versão */}
                    {release.summary && (
                      <p className="text-xs text-zinc-400 px-0.5">
                        {release.summary}
                      </p>
                    )}

                    {/* Itens detalhados */}
                    <div className="space-y-2">
                      {release.items.map((item, idx) => {
                        const IconComponent = item.icon;
                        return (
                          <div 
                            key={idx}
                            className={`p-3 rounded-xl border transition-all flex items-start gap-3 ${
                              release.isCurrent
                                ? 'bg-zinc-950/60 border-zinc-800/90 hover:border-zinc-700'
                                : 'bg-zinc-950/30 border-zinc-800/40 opacity-80'
                            }`}
                          >
                            <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${item.iconColor}`}>
                              <IconComponent className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <h3 className="text-xs font-bold text-zinc-200 truncate">
                                  {item.title}
                                </h3>
                                <span className="text-[10px] font-medium text-zinc-500 shrink-0">
                                  {item.category}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 leading-relaxed">
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

              {/* Botão de Expansão Modal */}
              <div className="pt-3 mt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                <span className="text-[11px] flex items-center gap-1.5 text-zinc-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Histórico cumulativo preservado
                </span>
                <button
                  type="button"
                  onClick={() => setIsChangelogModalOpen(true)}
                  className="text-xs font-semibold text-red-400 hover:text-red-300 hover:underline cursor-pointer flex items-center gap-1"
                >
                  Ver em tela cheia
                </button>
              </div>
            </div>
          </div>

          {/* Rodapé da Coluna */}
          <div className="mt-8 pt-4 border-t border-zinc-800/60 text-xs text-zinc-500 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>&copy; 2026 HubDesk Suporte &bull; Gestão Interna</span>
            <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <ShieldCheck className="w-3.5 h-3.5 text-red-500" />
              Conexão Segura Corporativa
            </span>
          </div>
        </div>

        {/* Painel Direito: Formulário de Autenticação */}
        <div className="lg:w-5/12 p-6 sm:p-8 lg:p-10 flex flex-col justify-center bg-zinc-950/80 relative">
          <div className="max-w-md w-full mx-auto relative z-10">
            
            <div className="mb-6 sm:mb-8 text-left">
              <span className="px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-bold uppercase tracking-wider mb-3 inline-block">
                Acesso Restrito
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Entrar no Sistema
              </h2>
              <p className="text-sm text-zinc-400 mt-1">
                Informe suas credenciais autorizadas para continuar.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              
              {/* Alerta de Erro */}
              {error && (
                <div className="flex items-start gap-3 p-3.5 text-xs text-red-300 bg-red-950/50 rounded-xl border border-red-800/80 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{error}</p>
                </div>
              )}

              {/* Input: E-mail */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 uppercase tracking-wider">
                  E-mail corporativo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3.5 py-3 text-sm border border-zinc-800 rounded-xl bg-zinc-900/80 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-colors shadow-inner"
                    placeholder="usuario@empresa.com"
                  />
                </div>
              </div>

              {/* Input: Senha */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                    Senha
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 py-3 text-sm border border-zinc-800 rounded-xl bg-zinc-900/80 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition-colors shadow-inner"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                    title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Botão de Entrar */}
              <button
                type="submit"
                disabled={isLoading}
                id="btn-login-submit"
                className="w-full mt-2 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl shadow-lg shadow-red-600/20 text-sm font-bold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-zinc-950 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Autenticando acesso...</span>
                  </span>
                ) : (
                  <>
                    <span>Entrar no HubDesk</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-zinc-800/80 text-center">
              <p className="text-xs text-zinc-500">
                Problemas de acesso ou redefinição de credenciais? Contate o administrador do suporte.
              </p>
            </div>

          </div>
        </div>

      </div>

      {/* Modal Completo de Changelog */}
      <VersionChangelogModal
        isOpen={isChangelogModalOpen}
        onClose={() => setIsChangelogModalOpen(false)}
      />
    </div>
  );
};

export default Login;

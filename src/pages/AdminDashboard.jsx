import React, { useState } from 'react';
import { 
  Users, BarChart2, Settings, LogOut, ShieldAlert,
  TrendingUp, Clock, Star, ClipboardList
} from 'lucide-react';
import { logout } from '../services/auth';
import CollaboratorsHub from './CollaboratorsHub'; // Importando a nova tela

const AdminDashboard = () => {
  // Estado que controla qual tela está visível no momento
  const [activeTab, setActiveTab] = useState('dashboard');

  // Função que renderiza o conteúdo baseado na aba ativa
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverview />;
      case 'hub':
        return <CollaboratorsHub />;
      case 'reports':
        return <div className="p-8 text-gray-500">Módulo de Relatórios (Em desenvolvimento)</div>;
      case 'settings':
        return <div className="p-8 text-gray-500">Módulo de Configurações (Em desenvolvimento)</div>;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex overflow-hidden">
      
      {/* SIDEBAR (Menu Lateral Escuro) */}
      <aside className="w-64 bg-zinc-950 text-white flex flex-col hidden md:flex">
        <div className="p-6 flex items-center gap-3 border-b border-zinc-800">
          <div className="p-2 bg-red-600 rounded-lg">
            <BarChart2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-wider">SUPPORT<span className="text-red-500">SYS</span></span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {/* Botão Dashboard */}
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'dashboard' 
                ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' 
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'
            }`}
          >
            <BarChart2 className="w-5 h-5" />
            <span className="font-medium">Visão Geral KPIs</span>
          </button>

          {/* Botão Hub de Colaboradores */}
          <button 
            onClick={() => setActiveTab('hub')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'hub' 
                ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' 
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'
            }`}
          >
            <Users className="w-5 h-5" />
            <span className="font-medium">Hub da Equipe</span>
          </button>

          {/* Botão Relatórios */}
          <button 
            onClick={() => setActiveTab('reports')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'reports' 
                ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' 
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'
            }`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="font-medium">Relatórios</span>
          </button>

          {/* Botão Configurações */}
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeTab === 'settings' 
                ? 'bg-red-600/10 text-red-500 border-l-4 border-red-600' 
                : 'text-zinc-400 hover:bg-zinc-900 hover:text-white border-l-4 border-transparent'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="font-medium">Configurações</span>
          </button>
        </nav>

        {/* Rodapé do Sidebar */}
        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700">
              <ShieldAlert className="w-4 h-4 text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-white">Admin</p>
              <p className="text-xs text-zinc-500">Gestão de TI</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Sair do sistema</span>
          </button>
        </div>
      </aside>

      {/* ÁREA PRINCIPAL DINÂMICA */}
      <main className="flex-1 flex flex-col overflow-hidden bg-gray-50 relative">
        {/* Aqui é onde a mágica acontece: chamamos a função que decide qual tela renderizar */}
        {renderContent()}
      </main>
      
    </div>
  );
};

// ==========================================
// SUB-COMPONENTE: Visão Geral (Os KPIs)
// Deixei separado aqui no fundo para manter a função principal limpa
// ==========================================
const DashboardOverview = () => {
  return (
    <div className="h-full flex flex-col overflow-auto">
      <header className="bg-white border-b border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral de Desempenho</h1>
        <p className="text-sm text-gray-500">Métricas consolidadas de toda a equipe de suporte.</p>
      </header>

      <div className="p-6">
        {/* CARDS DE KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <KpiCard title="TMA Global" value="09:15" subtitle="Minutos" icon={Clock} trend="-2% vs última semana" isPositive />
          <KpiCard title="Qualidade Média" value="92.5%" subtitle="Satisfação" icon={Star} trend="+1.5% vs última semana" isPositive />
          <KpiCard title="Volume de Chamados" value="1.248" subtitle="Resolvidos" icon={ClipboardList} />
          <KpiCard title="Taxa de Reincidência" value="4.2%" subtitle="Retornos" icon={ShieldAlert} />
        </div>
        
        {/* Você pode adicionar gráficos gerais aqui no futuro */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-center h-64 text-gray-400">
          Área reservada para o gráfico de evolução temporal (Ex: Volume de chamados por dia da semana)
        </div>
      </div>
    </div>
  );
};

// Sub-componente para os Cards (Reutilizável)
const KpiCard = ({ title, value, subtitle, icon: Icon, trend, isPositive }) => (
  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
      </div>
      <div className="p-2 bg-gray-50 rounded-lg border border-gray-100">
        <Icon className="w-5 h-5 text-gray-600" />
      </div>
    </div>
    <div className="mt-auto">
      {trend ? (
        <span className={`text-xs font-medium ${isPositive ? 'text-green-600' : 'text-gray-500'}`}>
          {trend}
        </span>
      ) : (
        <span className="text-xs text-gray-400">{subtitle}</span>
      )}
    </div>
  </div>
);

export default AdminDashboard;
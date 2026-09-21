import { Palette, ShieldCheck, Sliders, Sparkles, Layout, Flame } from 'lucide-react';

export const CURRENT_VERSION = 'v3.2';

export const CHANGELOG_VERSIONS = [
  {
    version: 'v3.2',
    date: 'Setembro 2026',
    isCurrent: true,
    tag: 'Versão Ativa',
    summary: 'Redesenho da tela de login, visualização direta de changelog, nova animação e padronização visual.',
    items: [
      {
        icon: Layout,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Nova Tela de Login & Changelog Visível',
        category: 'Interface & Acesso',
        description: 'Redesenho completo da interface de autenticação com feed direto de atualizações na tela principal, permitindo acompanhar novidades antes mesmo de efetuar o login.'
      },
      {
        icon: Palette,
        iconColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        title: 'Padronização do Favicon & Tipografia Brand',
        category: 'Identidade Visual',
        description: 'Substituição da logo antiga pelo ícone oficial do favicon na tela de login e barras de navegação, com aplicação da nova tipografia geométrica moderna (.font-brand).'
      },
      {
        icon: Flame,
        iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        title: 'Animação Atmosférica de Bolhas Ascendentes',
        category: 'Efeitos Visuais',
        description: 'Nova camada dinâmica no plano de fundo com bolhas e partículas luminosas subindo suavemente até 70% da altura da tela e dissipando de forma natural.'
      }
    ]
  },
  {
    version: 'v3.1',
    date: 'Setembro 2026',
    isCurrent: false,
    tag: 'Versão Anterior',
    summary: 'Refinamento de ícones e grandes novidades nas telas de auditoria QA.',
    items: [
      {
        icon: Palette,
        iconColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
        title: 'Alterado ícone do sistema',
        category: 'Identidade Visual',
        description: 'Atualização e refinamento do ícone oficial e dos elementos de identidade visual da aplicação.'
      },
      {
        icon: ShieldCheck,
        iconColor: 'text-red-400 bg-red-500/10 border-red-500/20',
        title: 'Atualização de visualização na tela de auditorias QA',
        category: 'Módulo de Qualidade',
        description: 'Novo painel completo com indicadores em tempo real, ranking de conformidade com pódio da equipe, gráficos analíticos e histórico detalhado com paginação e inspeção rápida.'
      },
      {
        icon: Sliders,
        iconColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
        title: 'Atualização na tela de adição de processos de auditoria',
        category: 'Processos & Checklists',
        description: 'Fluxo aprimorado para cadastro e edição de processos de QA, com categorização dinâmica, gerenciamento ágil de perguntas e pré-visualização interativa antes da publicação.'
      }
    ]
  }
];

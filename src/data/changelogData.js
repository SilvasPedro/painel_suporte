import { Palette, ShieldCheck, Sliders, Sparkles, Layout, Flame, History, Layers, Filter, CheckCircle2, Award, BarChart3, TrendingUp } from 'lucide-react';

export const CURRENT_VERSION = 'v3.4';

export const CHANGELOG_VERSIONS = [
  {
    version: 'v3.4',
    date: 'Setembro 2026',
    isCurrent: true,
    tag: 'Versão Ativa',
    summary: 'Nova fórmula equitativa de Líder Geral por pontuação média na Visão Geral de KPIs e Dashboard 360° no Relatório Individual do Colaborador.',
    items: [
      {
        icon: Award,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Nova Fórmula do Líder Geral por Pontuação Média',
        category: 'Visão Geral KPIs',
        description: 'A determinação do Líder Geral por turno (Dia e Noite) foi atualizada para utilizar a pontuação média calculada com base nas avaliações efetivamente lançadas, eliminando a distorção da pontuação acumulada bruta. Agora, novos colaboradores e analistas com menos avaliações competem com o mesmo critério e mesma régua de justiça operacional.'
      },
      {
        icon: BarChart3,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Dashboard Individual 360° do Colaborador',
        category: 'Hub da Equipe',
        description: 'Reformulação total da tela de relatório individual no Hub da Equipe, transformando-a em uma central de inteligência analítica completa: consolidação do mês vigente por padrão, cards estatísticos de pontuação, finalizações, telefonia (voz), chat Huggy, TMAs e conformidade QA.'
      },
      {
        icon: Sliders,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Filtros Avançados de Período, Mês e Semanas de Avaliação',
        category: 'Filtros & Análise',
        description: 'Novos controles de navegação com atalhos rápidos (Mês Vigente, Mês Anterior, Últimos 3 Meses e Todo o Histórico), dropdown seletor de mês e filtro detalhado por semana de avaliação para analisar recortes específicos ou todo o período consolidado.'
      },
      {
        icon: TrendingUp,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Gráficos Analíticos Dinâmicos & Abas Operacionais',
        category: 'Visualização de Métricas',
        description: 'Gráficos interativos de produção semanal, curva de pontuação e evolução de tempos médios (TMA e TME), combinados com abas de foco em Voz, Chat Huggy, Produtividade e Auditorias QA, além de extrato detalhado semana a semana com exportação em CSV e impressão.'
      }
    ]
  },
  {
    version: 'v3.3',
    date: 'Setembro 2026',
    isCurrent: false,
    tag: 'Versão Anterior',
    summary: 'Análise detalhada passo a passo de auditorias QA, refatoração de todas as visões de Meu Histórico, alternância entre Tabela e Cards e novos filtros avançados.',
    items: [
      {
        icon: ShieldCheck,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Análise Detalhada de Auditoria QA com Etapas',
        category: 'Qualidade & Auditoria',
        description: 'Substituição do resumo simples por uma análise aprofundada passo a passo (Etapa 01, 02...), exibindo o status de cada critério avaliado, apontamentos específicos do auditor, barra de aproveitamento percentual segmentada e filtros internos de etapas.'
      },
      {
        icon: History,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Refatoração Completa das Visões de Meu Histórico',
        category: 'Experiência do Colaborador',
        description: 'Reformulação integral de todos os modais detalhados: Feedbacks com categorização visual (Elogio, Ponto de Melhoria, Orientação), Avaliações Semanais com score consolidado e fórmula transparente de cálculo, e Avaliação Mensal 1:1 com pontuação por pilares e PDI.'
      },
      {
        icon: Layers,
        iconColor: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
        title: 'Novas Visualizações: Modo Tabela e Modo Cards',
        category: 'Visualização de Dados',
        description: 'Adicionada alternância fluida entre visualização em Tabela detalhada e Grade de Cards visuais interativos, acompanhada por um mini-dashboard de 4 métricas resumidas que se adaptam dinamicamente a cada aba.'
      },
      {
        icon: Filter,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Filtros Avançados & Exportação CSV',
        category: 'Produtividade & Gestão',
        description: 'Novo conjunto de filtros combinados: busca instantânea por protocolo, auditor ou processo; atalhos de período rápido (7 dias, 30 dias, mês atual); filtros por status e processo QA; ordenação flexível e exportação dos dados filtrados para CSV.'
      }
    ]
  },
  {
    version: 'v3.2',
    date: 'Setembro 2026',
    isCurrent: false,
    tag: 'Versão Anterior',
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

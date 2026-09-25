import { Palette, ShieldCheck, Sliders, Sparkles, Layout, Flame, History, Layers, Filter, CheckCircle2, Award, BarChart3, TrendingUp, Activity, Network, Moon, Sun, Coffee, User, Trophy, Zap, Mail, Phone } from 'lucide-react';

export const CURRENT_VERSION = 'v3.6';

export const CHANGELOG_VERSIONS = [
  {
    version: 'v3.6',
    date: 'Setembro 2026',
    isCurrent: true,
    tag: 'Versão Ativa',
    summary: 'Nova grande atualização v3.6: Tela de Perfil 360° para todos os usuários com Foto via PhotoUrl do Firebase, Nível de 1 a 8 no Card de Role & Foto, Emblemas de Feitos exclusivos da Gestão, Métricas Operacionais 100% Reais (TMA Telefonia/Chat, Pontuação e Auditorias), Tags de Redes (Básico, Médio e Avançado) e Atualização Oficial dos Expedientes da Operação e Plantão Terceirizado Noturno.',
    items: [
      {
        icon: User,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Tela de Perfil & Acesso Centralizado no Card de Role e Foto com Nível (1 a 8)',
        category: 'Perfil & Identidade',
        description: 'Acesso à tela de Perfil agora centralizado exclusivamente no Card do Usuário (onde detém sua Role, Foto oficial via PhotoUrl do Firebase e Nível calculado dinamicamente de 1 a 8 com base nos emblemas conquistados), otimizando a barra lateral.'
      },
      {
        icon: BarChart3,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Métricas Operacionais 100% Reais (Sem Mocks)',
        category: 'Desempenho & Métricas',
        description: 'Cálculo real de dados direto do Firestore: Média de TMA Telefonia (chamadas de voz), Média de TMA Chat (atendimentos Huggy), Média de Pontos de produtividade e % de Conformidade nas Auditorias de QA com atualização em tempo real.'
      },
      {
        icon: Trophy,
        iconColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
        title: 'Emblemas de Feitos Concedidos Exclusivamente pela Gestão',
        category: 'Gamificação & Mérito',
        description: 'Os emblemas (Top TMA, Top Finalizações, Destaque QA, Guardião da Qualidade, FCR, Plantão de Ferro, Mestre em Redes, Veterano HubDesk) agora são homologados e concedidos exclusivamente pelo Gestor. Os demais membros podem visualizar suas conquistas e seu nível correspondente.'
      },
      {
        icon: Sun,
        iconColor: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
        title: 'Expedientes Oficiais Corrigidos & Operação Terceirizada (20:00 às 08:00)',
        category: 'Expediente & Escalas',
        description: 'Ajuste oficial dos horários: Manhã I (08:00 até 14:15), Manhã II (09:00 até 15:15), Tarde (11:00 até 17:15) e Noturno (13:45 até 20:00). A operação noturna externa (20:00 até às 08:00 por terceirizada) fica devidamente registrada nas configurações do sistema no Firestore para controle de plantões e futuras integrações.'
      },
      {
        icon: Network,
        iconColor: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
        title: 'Tags de Conhecimento em Redes & Canais de Comunicação',
        category: 'Competências & Contatos',
        description: 'Definição de proficiência em redes (Básico, Médio e Avançado), chips de habilidades técnicas (GPON, Mikrotik, OSPF, Wi-Fi 6), múltiplos e-mails secundários e link direto para WhatsApp e telefone de contato.'
      }
    ]
  },
  {
    version: 'v3.5',
    date: 'Setembro 2026',
    isCurrent: false,
    tag: 'Versão Anterior',
    summary: 'Novos modos globais de visualização: Modo Escuro de alto contraste e Modo Morno para conforto visual sem extremos, disponíveis em todas as telas.',
    items: [
      {
        icon: Moon,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Modo Escuro (Paleta Suave, Aveludada & Ergonomia Prolongada)',
        category: 'Aparência & Ergonomia',
        description: 'Reformulação completa do modo escuro, substituindo o preto absoluto por tons suaves e repousantes de ardósia (#0f1115) e carvão aveludado (#181a20). Unificação de todas as telas e canva sem descontinuidades, com tipografia suave e barra lateral harmonizada (#121419) para leitura contínua e sem ofuscamento.'
      },
      {
        icon: Coffee,
        iconColor: 'text-amber-700 bg-amber-600/10 border-amber-600/20',
        title: 'Modo Morno (Equilíbrio Sépia, Linho & Conforto Ocular)',
        category: 'Aparência & Ergonomia',
        description: 'O meio-termo ideal para quem não se adapta ao branco luminoso e nem ao escuro total. Paleta inspirada em linho aconchegante, pedra e tons terrosos suaves com tipografia espresso (#261f1c), preservando a barra lateral escura original e eliminando a fadiga visual sem poluição luminosa.'
      },
      {
        icon: Palette,
        iconColor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
        title: 'Seletor de Modo no Canto Superior Direito',
        category: 'Navegação & Sistema',
        description: 'Alternância instantânea de temas em 1 clique posicionada de forma limpa e padronizada exclusivamente no canto superior direito do sistema, presente tanto na visão de Administrador quanto de Colaborador com persistência automática no navegador.'
      }
    ]
  },
  {
    version: 'v3.4',
    date: 'Setembro 2026',
    isCurrent: false,
    tag: 'Versão Anterior',
    summary: 'Nova fórmula equitativa de Líder Geral, Dashboard 360° do Colaborador, Organograma Operacional reformulado com RBAC inteligente e Central de Demanda Diária.',
    items: [
      {
        icon: Network,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Organograma Operacional & RBAC de Edição',
        category: 'Organograma',
        description: 'Reformulação visual e funcional do Organograma Operacional: reconhecimento inteligente de permissões RBAC para Gestores e perfis com edição liberada, badges de status em tempo real (Modo Edição vs Somente Leitura), novo menu rápido de movimentação por clique (sem depender apenas de drag & drop), auto-distribuição inteligente por cargo cadastrado, busca e filtros por turno nos não alocados, e conector vertical hierárquico refinado.'
      },
      {
        icon: Activity,
        iconColor: 'text-red-500 bg-red-500/10 border-red-500/20',
        title: 'Nova Central de Demanda e Fila Diária',
        category: 'Demanda Diária',
        description: 'Reformulação visual e analítica profunda do painel de Demanda Diária: novos filtros por presets de período (Mês Atual, 7, 15 e 30 dias, Mês Anterior, Últimos 3 Meses e Personalizado), filtros multicritério por canal (Chamados/Chats), tendência de saldo de fila (Reduziu, Subiu ou Estável), dia da semana (Seg a Dom) e busca rápida. Acompanha novos cards executivos de delta/saldo, gráficos com áreas gradientes de Início vs Fim, comparativo geral por dia da semana e exportação completa em CSV.'
      },
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

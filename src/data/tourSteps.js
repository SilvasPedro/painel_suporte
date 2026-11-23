/**
 * Tours guiados do primeiro acesso.
 *
 * - operational: Operacional e Apoio
 * - leadership:  Gestor e Supervisor (e administrador master)
 * - quality:     Qualidade (acessa todas as telas, somente para visualização)
 *
 * Cada passo aponta para um elemento marcado com data-tour="..." na interface.
 * Passos sem "target" são exibidos centralizados. Passos com "requires" só entram
 * se o usuário tiver permissão de visualizar aquela tela (RBAC).
 */

// Aumentar este número reapresenta o tour para todos os usuários (ex.: após grandes mudanças)
export const TOUR_VERSION = 1;

export const getTourType = ({ normalizedRole, isMasterAdmin }) => {
    if (isMasterAdmin || normalizedRole === 'gestor' || normalizedRole === 'supervisor') return 'leadership';
    if (normalizedRole === 'qualidade') return 'quality';
    return 'operational';
};

export const getTourStorageKey = (userId) => `hubdesk_tour_v${TOUR_VERSION}_${userId}`;

const nav = (id) => `[data-tour="nav-${id}"]`;

const WELCOME = {
    id: 'welcome',
    title: 'Bem-vindo(a) ao Hubdesk! 👋',
    body: 'Vamos fazer um tour rápido, de cerca de 1 minuto, pelas principais áreas do sistema. Você pode pular quando quiser e rever o tour depois pelo menu lateral.'
};

const SIDEBAR = {
    id: 'sidebar',
    target: '[data-tour="sidebar"]',
    title: 'Menu de navegação',
    body: 'Aqui ficam todas as telas que você pode acessar, organizadas por grupo. Use o botão de recolher para ganhar espaço e a busca (Ctrl + K) para ir direto a qualquer tela.'
};

const PROFILE = {
    id: 'profile',
    target: '[data-tour="profile"]',
    title: 'Meu Perfil',
    body: 'Seu crachá digital. Ao clicar, você edita foto, capa, contatos e acompanha seus emblemas e nível de conquistas.'
};

const SEARCH = {
    id: 'search',
    target: '[data-tour="search"]',
    title: 'Busca rápida',
    body: 'Digite o nome de uma tela ou ação para navegar sem usar o menu. Atalho: Ctrl + K.'
};

const NOTIFICATIONS = {
    id: 'notifications',
    target: '[data-tour="notifications"]',
    title: 'Notificações',
    body: 'Feedbacks, avaliações e atualizações das suas solicitações chegam aqui em tempo real. Um indicador pulsante avisa quando há novidade.'
};

const THEME = {
    id: 'theme',
    target: '[data-tour="theme"]',
    title: 'Tema da tela',
    body: 'Escolha entre os modos claro, morno (sépia) e escuro, o que for mais confortável para o seu turno.'
};

const REPLAY = {
    id: 'replay',
    target: '[data-tour="tour-replay"]',
    menu: null,
    title: 'Rever o tour',
    body: 'Precisou relembrar alguma função? Clique em "Tour guiado" para ver esta apresentação de novo.'
};

const MOBILE_MENU = {
    id: 'mobile-menu',
    target: '[data-tour="mobile-menu"]',
    title: 'Menu de navegação',
    body: 'Toque aqui para abrir a lista de telas: desempenho, histórico, escalas, solicitações e muito mais.'
};

// ---- Tour do nível Qualidade (somente visualização) ----
const VIEW_ONLY_BADGE = 'Somente visualização';

const WELCOME_QUALITY = {
    id: 'welcome',
    title: 'Bem-vindo(a), Qualidade! 👋',
    body: 'Este tour apresenta os módulos que você acompanha e como cada um funciona. Seu nível acessa todas as telas do sistema, sempre somente para visualização. Você pode pular quando quiser e rever depois pelo menu lateral.'
};

const QUALITY_READONLY = {
    id: 'quality-readonly',
    badge: VIEW_ONLY_BADGE,
    title: 'Acesso somente de visualização',
    body: 'O nível Qualidade enxerga todos os módulos, mas não cria, edita nem exclui nada: lançamentos, auditorias, escalas, solicitações e configurações ficam apenas para consulta. Você pode filtrar, pesquisar e abrir detalhes livremente. Se tentar uma ação de alteração, o sistema avisa que o seu nível é somente leitura. A única edição liberada é o seu próprio perfil (foto, capa e contatos).'
};

const FINISH_QUALITY = {
    id: 'finish',
    title: 'Tudo pronto! 🚀',
    body: 'Agora é só acompanhar a operação. Lembre-se: o seu acesso é somente de visualização. Para pedir ajustes em qualquer módulo, fale com a liderança. Bom trabalho!'
};

const FINISH = {
    id: 'finish',
    title: 'Tudo pronto! 🚀',
    body: 'Agora é só explorar. Comece pelo seu desempenho e fique de olho nas notificações. Bom trabalho!'
};

const OPERATIONAL_SCREENS = [
    {
        id: 'my_dashboard', menu: 'individual',
        title: 'Meu Desempenho',
        body: 'Seu painel pessoal: pontuação, médias de TMA, aproveitamento do Huggy, finalizações, tarefa do dia, próximo plantão e próxima folga, com gráficos de evolução.'
    },
    {
        id: 'my_history', menu: 'individual',
        title: 'Meu Histórico',
        body: 'Todos os feedbacks, análises mensais 1:1, métricas semanais e auditorias QA que você recebeu, com opção de confirmar ciência e exportar.'
    },
    {
        id: 'smart_pre', menu: 'operacional', requires: 'smart_pre',
        title: 'Smart Pre',
        body: 'Acompanhe os clientes do novo serviço: quem entrou em contato após a instalação, o problema relatado, a tratativa (remota, visita técnica ou TI) e a dashboard de saúde do serviço.'
    },
    {
        id: 'rankings', menu: 'equipe', requires: 'rankings',
        title: 'Rankings da Equipe',
        body: 'Compare a pontuação da equipe por turno e acompanhe os destaques do período.'
    },
    {
        id: 'reports', menu: 'operacional', requires: 'reports',
        title: 'Tarefas & Relatórios',
        body: 'Abra solicitações e chamados para a liderança, acompanhe o andamento e converse pelos comentários de cada solicitação.'
    },
    {
        id: 'DailyQueueTracker', menu: 'operacional', requires: 'DailyQueueTracker',
        title: 'Demanda Diária',
        body: 'Lançamento do volume de filas por faixa de horário e acompanhamento dos picos de atendimento.'
    },
    {
        id: 'metrics', menu: 'operacional', requires: 'metrics',
        title: 'Avaliações Semanais',
        body: 'Lançamento das métricas semanais da equipe: ligações, Huggy, finalizações e tempos médios, com validação antes de salvar.'
    },
    {
        id: 'day_off_schedule', menu: 'escalas', requires: 'day_off_schedule',
        title: 'Escala de Folgas',
        body: 'Veja as folgas do mês em um calendário de cards, com destaque para feriados.'
    },
    {
        id: 'daily_schedule', menu: 'escalas', requires: 'daily_schedule',
        title: 'Escala Diária & Plantão',
        body: 'Consulte a distribuição diária entre telefonia, Huggy e apoio e a escala de plantões dos domingos.'
    },
    {
        id: 'orgchart', menu: 'equipe', requires: 'orgchart',
        title: 'Organograma',
        body: 'Conheça a estrutura da equipe, as lideranças e a distribuição por função.'
    }
];

const LEADERSHIP_SCREENS = [
    {
        id: 'dashboard', menu: 'gestao', requires: 'dashboard',
        title: 'Visão Geral KPIs',
        body: 'Cockpit da operação: TMR, FCR, reincidência, conformidade QA, indicadores da terceirizada e evolução histórica, com filtros por período.'
    },
    {
        id: 'hub', menu: 'equipe', requires: 'hub',
        title: 'Hub da Equipe',
        body: 'Gestão dos colaboradores: cadastro, turnos, cargos, histórico de feedbacks e relatório individual de cada pessoa.'
    },
    {
        id: 'metrics', menu: 'operacional', requires: 'metrics',
        title: 'Avaliações Semanais',
        body: 'Lance as métricas da equipe (ligações realizadas, Huggy iniciados e finalizados, tempos). Antes de salvar, o sistema mostra quem ficou sem lançamento para você confirmar.'
    },
    {
        id: 'monthly_evaluations', menu: 'operacional', requires: 'monthly_evaluations',
        title: 'Análise Mensal (1:1)',
        body: 'Registre os alinhamentos 1:1 em Markdown, com confirmação de ciência do colaborador e trilha de auditoria.'
    },
    {
        id: 'DailyQueueTracker', menu: 'operacional', requires: 'DailyQueueTracker',
        title: 'Demanda Diária',
        body: 'Acompanhe o volume de filas por faixa de horário e identifique os picos.'
    },
    {
        id: 'reports', menu: 'operacional', requires: 'reports',
        title: 'Tarefas & Relatórios',
        body: 'Central de solicitações: receba, despache e responda chamados da equipe, com parecer e histórico de cada um.'
    },
    {
        id: 'audits', menu: 'operacional', requires: 'audits',
        title: 'Auditorias QA',
        body: 'Auditorias de qualidade por checklist, com pontuação automática, filtros e exportação.'
    },
    {
        id: 'third_party_audits', menu: 'operacional', requires: 'third_party_audits',
        title: 'Auditoria Terceirizada',
        body: 'Audite os atendimentos da empresa terceirizada (ATSOC atual e UpCall como histórico): FCR, procedimentos, qualidade e reincidência.'
    },
    {
        id: 'rankings', menu: 'equipe', requires: 'rankings',
        title: 'Rankings da Equipe',
        body: 'Pontuação por colaborador e turno, com detalhamento semanal e exportação.'
    },
    {
        id: 'day_off_schedule', menu: 'escalas', requires: 'day_off_schedule',
        title: 'Escala de Folgas',
        body: 'Monte a escala arrastando colaboradores para os dias do mês; feriados com 100% H.E ficam destacados.'
    },
    {
        id: 'daily_schedule', menu: 'escalas', requires: 'daily_schedule',
        title: 'Escala Diária & Plantão',
        body: 'Defina a escala diária entre telefonia, Huggy e apoio e os plantões dos domingos.'
    },
    {
        id: 'sector_kpis', menu: 'gestao', requires: 'sector_kpis',
        title: 'KPIs do Setor',
        body: 'Lance e acompanhe as metas globais do setor (TMR, FCR e reincidência) e os SLAs.'
    },
    {
        id: 'data_manager', menu: 'gestao', requires: 'data_manager',
        title: 'Gestão de Dados',
        body: 'Consulte, edite e exporte os registros do sistema com auditoria de integridade.'
    },
    {
        id: 'settings', menu: 'gestao', requires: 'settings',
        title: 'Configurações',
        body: 'Processos de QA, tags de feedback, metas e a matriz de permissões por cargo.'
    }
];

const QUALITY_SCREENS = [
    {
        id: 'dashboard', menu: 'gestao', requires: 'dashboard',
        title: 'Visão Geral KPIs',
        body: 'O cockpit da operação: TMR, FCR, reincidência, conformidade QA, indicadores da terceirizada e a evolução histórica. Use os filtros de período e as abas (Visão Geral, Equipe, Canais, Qualidade e Metas) para analisar os números.'
    },
    {
        id: 'audits', menu: 'operacional', requires: 'audits',
        title: 'Auditorias QA',
        body: 'Auditorias de qualidade por checklist, com pontuação calculada automaticamente. Consulte as auditorias por colaborador, período e resultado e abra cada uma para ver o checklist, as observações e a nota.'
    },
    {
        id: 'third_party_audits', menu: 'operacional', requires: 'third_party_audits',
        title: 'Auditoria Terceirizada',
        body: 'Auditoria dos atendimentos da empresa terceirizada (ATSOC atual e UpCall como histórico). Acompanhe FCR, procedimentos conformes, qualidade positiva x negativa e reincidência, com filtros por período, operador e processo.'
    },
    {
        id: 'metrics', menu: 'operacional', requires: 'metrics',
        title: 'Avaliações Semanais',
        body: 'Métricas semanais lançadas pela liderança: ligações, Huggy iniciados e finalizados e tempos médios. Aqui você apenas consulta os lançamentos e as semanas apuradas.'
    },
    {
        id: 'monthly_evaluations', menu: 'operacional', requires: 'monthly_evaluations',
        title: 'Análise Mensal (1:1)',
        body: 'Registros dos alinhamentos 1:1 de cada colaborador, escritos em Markdown, com a confirmação de ciência e a trilha de auditoria. Você lê o histórico, sem poder registrar ou alterar.'
    },
    {
        id: 'reports', menu: 'operacional', requires: 'reports',
        title: 'Tarefas & Relatórios',
        body: 'Central de solicitações da equipe, com pareceres e histórico de cada chamado. Você acompanha o andamento e lê os comentários, mas não abre, responde nem despacha solicitações.'
    },
    {
        id: 'DailyQueueTracker', menu: 'operacional', requires: 'DailyQueueTracker',
        title: 'Demanda Diária',
        body: 'Volume de filas por faixa de horário e os picos de atendimento do dia, para correlacionar a demanda com a qualidade.'
    },
    {
        id: 'smart_pre', menu: 'operacional', requires: 'smart_pre',
        title: 'Smart Pre',
        body: 'Acompanhamento dos clientes do novo serviço: contato após a instalação, problema relatado, tratativa (remota, visita técnica ou TI) e a dashboard de saúde do serviço.'
    },
    {
        id: 'hub', menu: 'equipe', requires: 'hub',
        title: 'Hub da Equipe',
        body: 'Os colaboradores, seus turnos e cargos, com o histórico de feedbacks e o relatório individual de cada um. Consulte sem alterar cadastros.'
    },
    {
        id: 'rankings', menu: 'equipe', requires: 'rankings',
        title: 'Rankings da Equipe',
        body: 'Pontuação por colaborador e turno, com detalhamento semanal, para identificar destaques e pontos de atenção.'
    },
    {
        id: 'orgchart', menu: 'equipe', requires: 'orgchart',
        title: 'Organograma',
        body: 'A estrutura da equipe, as lideranças e a distribuição por função, apenas para consulta.'
    },
    {
        id: 'day_off_schedule', menu: 'escalas', requires: 'day_off_schedule',
        title: 'Escala de Folgas',
        body: 'Calendário de folgas do mês, com os feriados em destaque. Você vê a escala montada pela liderança, sem mover colaboradores.'
    },
    {
        id: 'daily_schedule', menu: 'escalas', requires: 'daily_schedule',
        title: 'Escala Diária & Plantão',
        body: 'Distribuição diária entre telefonia, Huggy e apoio e a escala de plantões dos domingos, em modo de consulta.'
    },
    {
        id: 'sector_kpis', menu: 'gestao', requires: 'sector_kpis',
        title: 'KPIs do Setor',
        body: 'Metas globais do setor (TMR, FCR e reincidência) e os SLAs, para comparar com o resultado real.'
    },
    {
        id: 'data_manager', menu: 'gestao', requires: 'data_manager',
        title: 'Gestão de Dados',
        body: 'Consulta aos registros do sistema com a auditoria de integridade. Edição e exclusão ficam com a liderança.'
    },
    {
        id: 'settings', menu: 'gestao', requires: 'settings',
        title: 'Configurações',
        body: 'Processos de QA, tags de feedback, metas e a matriz de permissões por cargo, em modo de leitura.'
    }
];

const toNavStep = (screen) => ({
    id: screen.id,
    target: nav(screen.id),
    menu: screen.menu,
    requires: screen.requires,
    title: screen.title,
    body: screen.body,
    ...(screen.badge && { badge: screen.badge })
});

/**
 * Monta a lista de passos do tour.
 * @param {'operational'|'leadership'} type
 * @param {(moduleId: string) => boolean} canView  permissão RBAC do usuário
 * @param {boolean} isMobile  em telas estreitas o menu lateral fica oculto
 */
export const buildTourSteps = (type, canView, isMobile = false) => {
    const isQuality = type === 'quality';
    const source = type === 'leadership' ? LEADERSHIP_SCREENS : isQuality ? QUALITY_SCREENS : OPERATIONAL_SCREENS;
    const screens = source
        .filter(screen => !screen.requires || canView(screen.requires))
        // No tour de Qualidade, todo módulo leva o selo de somente visualização
        .map(screen => toNavStep(isQuality ? { ...screen, badge: VIEW_ONLY_BADGE } : screen));

    const welcome = isQuality ? WELCOME_QUALITY : WELCOME;
    const intro = isMobile ? [welcome, MOBILE_MENU] : [welcome, SIDEBAR, PROFILE];
    if (isQuality) intro.push(QUALITY_READONLY);
    // No celular os itens do menu não estão visíveis: as telas são resumidas em um único passo
    const middle = isMobile
        ? [{
            id: 'screens-summary',
            title: 'O que você encontra no menu',
            body: screens.map(s => `• ${s.title}`).join('\n')
        }]
        : screens;
    const tools = isMobile ? [SEARCH, NOTIFICATIONS, THEME] : [SEARCH, NOTIFICATIONS, THEME, REPLAY];

    return [...intro, ...middle, ...tools, isQuality ? FINISH_QUALITY : FINISH];
};

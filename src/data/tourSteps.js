/**
 * Tours guiados do primeiro acesso.
 *
 * - operational: Operacional e Apoio
 * - leadership:  Gestor e Supervisor (e administrador master)
 *
 * Cada passo aponta para um elemento marcado com data-tour="..." na interface.
 * Passos sem "target" são exibidos centralizados. Passos com "requires" só entram
 * se o usuário tiver permissão de visualizar aquela tela (RBAC).
 */

// Aumentar este número reapresenta o tour para todos os usuários (ex.: após grandes mudanças)
export const TOUR_VERSION = 1;

export const getTourType = ({ normalizedRole, isMasterAdmin }) => (
    isMasterAdmin || normalizedRole === 'gestor' || normalizedRole === 'supervisor'
        ? 'leadership'
        : 'operational'
);

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
        id: 'rankings', menu: 'operacional', requires: 'rankings',
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
        id: 'orgchart', menu: 'geral', requires: 'orgchart',
        title: 'Organograma',
        body: 'Conheça a estrutura da equipe, as lideranças e a distribuição por função.'
    }
];

const LEADERSHIP_SCREENS = [
    {
        id: 'dashboard', menu: 'geral', requires: 'dashboard',
        title: 'Visão Geral KPIs',
        body: 'Cockpit da operação: TMR, FCR, reincidência, conformidade QA, indicadores da terceirizada e evolução histórica, com filtros por período.'
    },
    {
        id: 'hub', menu: 'geral', requires: 'hub',
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
        id: 'rankings', menu: 'operacional', requires: 'rankings',
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

const toNavStep = (screen) => ({
    id: screen.id,
    target: nav(screen.id),
    menu: screen.menu,
    requires: screen.requires,
    title: screen.title,
    body: screen.body
});

/**
 * Monta a lista de passos do tour.
 * @param {'operational'|'leadership'} type
 * @param {(moduleId: string) => boolean} canView  permissão RBAC do usuário
 * @param {boolean} isMobile  em telas estreitas o menu lateral fica oculto
 */
export const buildTourSteps = (type, canView, isMobile = false) => {
    const screens = (type === 'leadership' ? LEADERSHIP_SCREENS : OPERATIONAL_SCREENS)
        .filter(screen => !screen.requires || canView(screen.requires))
        .map(toNavStep);

    const intro = isMobile ? [WELCOME, MOBILE_MENU] : [WELCOME, SIDEBAR, PROFILE];
    // No celular os itens do menu não estão visíveis: as telas são resumidas em um único passo
    const middle = isMobile
        ? [{
            id: 'screens-summary',
            title: 'O que você encontra no menu',
            body: screens.map(s => `• ${s.title}`).join('\n')
        }]
        : screens;
    const tools = isMobile ? [SEARCH, NOTIFICATIONS, THEME] : [SEARCH, NOTIFICATIONS, THEME, REPLAY];

    return [...intro, ...middle, ...tools, FINISH];
};

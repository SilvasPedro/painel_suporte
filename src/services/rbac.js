import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

// -------------------------------------------------------------
// DEFINIÇÃO DOS 4 CARGOS OFICIAIS (ROLES)
// -------------------------------------------------------------
export const ROLES = [
    {
        id: 'gestor',
        label: 'Gestor',
        badgeColor: 'bg-red-100 text-red-700 border-red-200',
        activeBadgeColor: 'bg-red-600 text-white',
        description: 'Acesso executivo total. Gerencia configurações, regras de acesso, metas e visualiza todas as métricas da operação.'
    },
    {
        id: 'supervisor',
        label: 'Supervisor',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
        activeBadgeColor: 'bg-amber-600 text-white',
        description: 'Supervisão tática da equipe. Realiza auditorias QA, acompanha métricas, organiza escalas e aplica feedbacks.'
    },
    {
        id: 'apoio',
        label: 'Apoio',
        badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
        activeBadgeColor: 'bg-blue-600 text-white',
        description: 'Suporte à operação e monitoria de filas diárias, controle de escalas e auxílio nos lançamentos operacionais.'
    },
    {
        id: 'colaborador',
        label: 'Colaborador',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        activeBadgeColor: 'bg-emerald-600 text-white',
        description: 'Analista de atendimento. Consulta escalas de trabalho, organograma da equipe e rankings de desempenho.'
    }
];

// -------------------------------------------------------------
// LISTA DE MÓDULOS / TELAS DO SISTEMA
// -------------------------------------------------------------
export const SYSTEM_MODULES = [
    // Grupo: Principal
    {
        id: 'my_dashboard',
        label: 'Meu Desempenho',
        group: 'Principal',
        description: 'Painel individual do colaborador com tarefas do dia, plantões, métricas e evolução de TMA pessoal.'
    },
    {
        id: 'my_history',
        label: 'Meu Histórico',
        group: 'Principal',
        description: 'Histórico individual de feedbacks recebidos, avaliações 1:1, métricas e auditorias QA.'
    },
    {
        id: 'dashboard',
        label: 'Visão Geral KPIs',
        group: 'Principal',
        description: 'Painel com indicadores consolidados, gráficos de evolução e TMA/TME geral.'
    },
    {
        id: 'hub',
        label: 'Hub da Equipe',
        group: 'Principal',
        description: 'Gestão dos colaboradores, cadastro, turnos, histórico de feedbacks e relatórios individuais.'
    },
    {
        id: 'orgchart',
        label: 'Organograma',
        group: 'Principal',
        description: 'Visualização da hierarquia da equipe, lideranças e distribuição dos analistas.'
    },

    // Grupo: Lançamentos/Análise
    {
        id: 'metrics',
        label: 'Avaliações Semanais',
        group: 'Lançamentos & Análise',
        description: 'Registro e acompanhamento semanal dos atendimentos, ligações e tempos.'
    },
    {
        id: 'monthly_evaluations',
        label: 'Análise Mensal (1:1)',
        group: 'Lançamentos & Análise',
        description: 'Avaliações mensais consolidadas e registro de reuniões 1:1 de desenvolvimento.'
    },
    {
        id: 'DailyQueueTracker',
        label: 'Demanda Diária',
        group: 'Lançamentos & Análise',
        description: 'Lançamento de volume de filas por faixa de horário e acompanhamento de picos.'
    },
    {
        id: 'reports',
        label: 'Relatórios Críticos',
        group: 'Lançamentos & Análise',
        description: 'Registro e auditoria de chamados com incidentes críticos de suporte.'
    },
    {
        id: 'audits',
        label: 'Auditorias QA',
        group: 'Lançamentos & Análise',
        description: 'Auditorias de qualidade baseadas em checklists de conformidade e boas práticas.'
    },
    {
        id: 'rankings',
        label: 'Rankings da Equipe',
        group: 'Lançamentos & Análise',
        description: 'Classificação de pontuação, gamificação e destaques de produtividade.'
    },

    // Grupo: Escalas
    {
        id: 'daily_schedule',
        label: 'Escala Diária',
        group: 'Escalas',
        description: 'Planejamento dos horários de expediente e pausas da semana.'
    },
    {
        id: 'schedule',
        label: 'Escala de Plantão',
        group: 'Escalas',
        description: 'Escala de plantões de domingos e feriados.'
    },

    // Grupo: Gestão & Sistema
    {
        id: 'sector_kpis',
        label: 'KPIs do Setor',
        group: 'Gestão & Sistema',
        description: 'Painel estratégico de acompanhamento de TMR, FCR e Reincidência global.'
    },
    {
        id: 'data_manager',
        label: 'Gestão de Dados',
        group: 'Gestão & Sistema',
        description: 'Módulo de importação em massa, backup e limpeza de tabelas do banco de dados.'
    },
    {
        id: 'settings',
        label: 'Configurações',
        group: 'Gestão & Sistema',
        description: 'Definição de metas globais, processos auditáveis e matriz de permissões RBAC.'
    }
];

// -------------------------------------------------------------
// PERMISSÕES PADRÃO (FALLBACK ROBUSTO)
// -------------------------------------------------------------
export const DEFAULT_ROLE_PERMISSIONS = {
    gestor: {
        my_dashboard: { view: true, edit: true },
        my_history: { view: true, edit: true },
        dashboard: { view: true, edit: true },
        hub: { view: true, edit: true },
        orgchart: { view: true, edit: true },
        metrics: { view: true, edit: true },
        monthly_evaluations: { view: true, edit: true },
        DailyQueueTracker: { view: true, edit: true },
        reports: { view: true, edit: true },
        audits: { view: true, edit: true },
        rankings: { view: true, edit: true },
        daily_schedule: { view: true, edit: true },
        schedule: { view: true, edit: true },
        sector_kpis: { view: true, edit: true },
        data_manager: { view: true, edit: true },
        settings: { view: true, edit: true }
    },
    supervisor: {
        my_dashboard: { view: true, edit: false },
        my_history: { view: true, edit: false },
        dashboard: { view: true, edit: false },
        hub: { view: true, edit: true },
        orgchart: { view: true, edit: false },
        metrics: { view: true, edit: true },
        monthly_evaluations: { view: true, edit: true },
        DailyQueueTracker: { view: true, edit: true },
        reports: { view: true, edit: true },
        audits: { view: true, edit: true },
        rankings: { view: true, edit: false },
        daily_schedule: { view: true, edit: true },
        schedule: { view: true, edit: true },
        sector_kpis: { view: true, edit: false },
        data_manager: { view: false, edit: false },
        settings: { view: false, edit: false }
    },
    apoio: {
        my_dashboard: { view: true, edit: false },
        my_history: { view: true, edit: false },
        dashboard: { view: true, edit: false },
        hub: { view: true, edit: false },
        orgchart: { view: true, edit: false },
        metrics: { view: true, edit: false },
        monthly_evaluations: { view: false, edit: false },
        DailyQueueTracker: { view: true, edit: true },
        reports: { view: true, edit: false },
        audits: { view: true, edit: false },
        rankings: { view: true, edit: false },
        daily_schedule: { view: true, edit: true },
        schedule: { view: true, edit: true },
        sector_kpis: { view: false, edit: false },
        data_manager: { view: false, edit: false },
        settings: { view: false, edit: false }
    },
    colaborador: {
        my_dashboard: { view: true, edit: false },
        my_history: { view: true, edit: false },
        dashboard: { view: false, edit: false },
        hub: { view: false, edit: false },
        orgchart: { view: true, edit: false },
        metrics: { view: false, edit: false },
        monthly_evaluations: { view: false, edit: false },
        DailyQueueTracker: { view: false, edit: false },
        reports: { view: false, edit: false },
        audits: { view: false, edit: false },
        rankings: { view: true, edit: false },
        daily_schedule: { view: true, edit: false },
        schedule: { view: true, edit: false },
        sector_kpis: { view: false, edit: false },
        data_manager: { view: false, edit: false },
        settings: { view: false, edit: false }
    }
};

// -------------------------------------------------------------
// NORMALIZAÇÃO DE CARGOS DO USUÁRIO
// -------------------------------------------------------------
export const normalizeRole = (roleString) => {
    if (!roleString) return 'colaborador';
    const lower = String(roleString).trim().toLowerCase();

    if (lower.includes('gestor') || lower.includes('admin') || lower.includes('gerente') || lower.includes('coordenador')) {
        return 'gestor';
    }
    if (lower.includes('supervis')) {
        return 'supervisor';
    }
    if (lower.includes('apoio') || lower.includes('assistente')) {
        return 'apoio';
    }
    return 'colaborador';
};

// -------------------------------------------------------------
// SERVIÇO DE PERSISTÊNCIA NO FIRESTORE
// -------------------------------------------------------------
const ROLES_PERMISSIONS_DOC = doc(db, 'system_settings', 'roles_permissions');

export const getRolesPermissions = async () => {
    try {
        const snap = await getDoc(ROLES_PERMISSIONS_DOC);
        if (snap.exists()) {
            return snap.data();
        }
    } catch (err) {
        console.warn('Erro ao carregar permissões do Firestore, usando padrões:', err);
    }
    return DEFAULT_ROLE_PERMISSIONS;
};

export const saveRolesPermissions = async (permissions) => {
    await setDoc(ROLES_PERMISSIONS_DOC, permissions, { merge: true });
};

export const subscribeRolesPermissions = (callback) => {
    return onSnapshot(ROLES_PERMISSIONS_DOC, (snap) => {
        if (snap.exists()) {
            callback(snap.data());
        } else {
            callback(DEFAULT_ROLE_PERMISSIONS);
        }
    }, (error) => {
        console.warn('Erro no listener de permissões:', error);
        callback(DEFAULT_ROLE_PERMISSIONS);
    });
};

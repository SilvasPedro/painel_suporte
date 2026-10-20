/**
 * DEFINIÇÕES DE TIPOS, CONSTANTES E VALIDAÇÃO DE SOLICITAÇÕES / RELATÓRIOS (ISP)
 * Future-Proof Architecture para categorização e SLA parametrizável
 */

// Categorias Oficiais do Sistema
export const REQUEST_CATEGORIES = {
    ERROR_ANALYSIS: {
        id: 'error_analysis',
        label: 'Análise de Erro',
        description: 'Falhas operacionais, divergências em atendimentos ou gargalos entre setores',
        defaultSlaHours: 48,
        theme: {
            badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40',
            dotClass: 'bg-rose-500',
            activeBorder: 'border-rose-500 bg-rose-50/50 text-rose-900',
            iconColor: 'text-rose-600'
        }
    },
    SYSTEM_IMPROVEMENT: {
        id: 'system_improvement',
        label: 'Melhoria de Sistema',
        description: 'Sugestões de novos recursos, automações e melhorias em softwares e ERPs',
        defaultSlaHours: 120,
        theme: {
            badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/40',
            dotClass: 'bg-indigo-500',
            activeBorder: 'border-indigo-500 bg-indigo-50/50 text-indigo-900',
            iconColor: 'text-indigo-600'
        }
    },
    FACILITY_IMPROVEMENT: {
        id: 'facility_improvement',
        label: 'Melhoria de Ambiente',
        description: 'Infraestrutura física de trabalho, ergonomia, cadeiras e equipamentos',
        defaultSlaHours: 72,
        theme: {
            badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
            dotClass: 'bg-emerald-500',
            activeBorder: 'border-emerald-500 bg-emerald-50/50 text-emerald-900',
            iconColor: 'text-emerald-600'
        }
    },
    OTHER: {
        id: 'other',
        label: 'Outros',
        description: 'Demandas diversas, alinhamentos internos, comunicados e sugestões gerais',
        defaultSlaHours: 72,
        theme: {
            badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40',
            dotClass: 'bg-purple-500',
            activeBorder: 'border-purple-500 bg-purple-50/50 text-purple-900',
            iconColor: 'text-purple-600'
        }
    }
};

// Departamentos de Origem para Análise de Erro
export const ERROR_DEPARTMENTS = [
    'Comercial',
    'NOC',
    'Técnico de Campo',
    'Financeiro',
    'Atendimento N1',
    'Liderança / Supervisão',
    'Outro'
];

// Tipos de Itens / Recursos para Melhoria de Ambiente
export const FACILITY_RESOURCES = [
    'Periférico (mouse, teclado, headset)',
    'Notebook / Desktop',
    'Cadeira / Mobiliário',
    'Uniforme',
    'Outros Equipamentos de Escritório'
];

// Níveis de Urgência Operacional
export const FACILITY_URGENCIES = [
    { id: 'Baixa', label: 'Baixa Prioridade', color: 'bg-slate-100 text-slate-700 border-slate-300' },
    { id: 'Média', label: 'Média Urgência', color: 'bg-amber-100 text-amber-800 border-amber-300' },
    { id: 'Alta', label: 'Alta Urgência', color: 'bg-rose-100 text-rose-800 border-rose-300 font-bold' }
];

// Subtipos de Solicitação para a Categoria Outros
export const OTHER_SUBTYPES = [
    'Criação de Comunicado Interno',
    'Tarefa Operacional Avulsa',
    'Sugestão de Processo / Ideia Geral'
];

/**
 * Normaliza qualquer chave ou label para a chave de categoria canônica
 */
export const normalizeCategory = (categoryOrType = '') => {
    const val = String(categoryOrType).trim().toLowerCase();
    if (val === 'error_analysis' || val.includes('erro') || val.includes('falha') || val.includes('análise')) {
        return 'error_analysis';
    }
    if (val === 'system_improvement' || val.includes('sistema') || val.includes('software') || val.includes('erp')) {
        return 'system_improvement';
    }
    if (val === 'facility_improvement' || val.includes('ambiente') || val.includes('infra') || val.includes('equipamento') || val.includes('cadeira')) {
        return 'facility_improvement';
    }
    return 'other';
};

/**
 * Retorna as configurações completas de categoria por ID ou label
 */
export const getCategoryMetadata = (categoryOrType = '') => {
    const key = normalizeCategory(categoryOrType);
    switch (key) {
        case 'error_analysis':
            return REQUEST_CATEGORIES.ERROR_ANALYSIS;
        case 'system_improvement':
            return REQUEST_CATEGORIES.SYSTEM_IMPROVEMENT;
        case 'facility_improvement':
            return REQUEST_CATEGORIES.FACILITY_IMPROVEMENT;
        default:
            return REQUEST_CATEGORIES.OTHER;
    }
};

/**
 * Validação rigorosa do formulário dinâmico conforme a categoria
 * Retorna { isValid: boolean, errors: Record<string, string> }
 */
export const validateRequestForm = (formData) => {
    const errors = {};

    if (!formData.title || !formData.title.trim()) {
        errors.title = 'O título resumido é obrigatório.';
    } else if (formData.title.trim().length < 3) {
        errors.title = 'O título deve ter no mínimo 3 caracteres.';
    }

    if (!formData.description || !formData.description.trim()) {
        errors.description = 'A descrição detalhada é obrigatória.';
    } else if (formData.description.trim().length < 5) {
        errors.description = 'A descrição deve ter no mínimo 5 caracteres.';
    }

    const category = normalizeCategory(formData.category || formData.type);

    if (category === 'error_analysis') {
        if (!formData.date) {
            errors.date = 'A data do ocorrido é obrigatória.';
        }
        if (formData.affectedClient === 'Sim' && (!formData.howAffected || !formData.howAffected.trim())) {
            errors.howAffected = 'Explique detalhadamente como a ocorrência afetou o cliente.';
        }
    } else if (category === 'system_improvement') {
        const affectedApp = formData.metadata?.affectedApp || formData.affectedApp;
        if (!affectedApp || !affectedApp.trim()) {
            errors.affectedApp = 'Informe a tela ou aplicativo afetado pela melhoria.';
        }
    } else if (category === 'facility_improvement') {
        const resourceType = formData.metadata?.resourceType || formData.resourceType;
        if (!resourceType || !resourceType.trim()) {
            errors.resourceType = 'Selecione o tipo de item ou recurso.';
        }
        const urgency = formData.metadata?.urgency || formData.priority || formData.urgency;
        if (!urgency) {
            errors.urgency = 'Informe o nível de urgência operacional.';
        }
    } else if (category === 'other') {
        const otherSubtype = formData.metadata?.otherSubtype || formData.otherSubtype;
        if (!otherSubtype || !otherSubtype.trim()) {
            errors.otherSubtype = 'Selecione o subtipo da demanda.';
        }
        const targetAudience = formData.metadata?.targetAudience || formData.targetAudience;
        if (!targetAudience || !targetAudience.trim()) {
            errors.targetAudience = 'Informe o público-alvo ou setor de aplicação.';
        }
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};

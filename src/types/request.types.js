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

// ============================================================================
// SCHEMAS, INTERFACES (TS/JSDoc) & POLÍTICAS RBAC / RLS (v3.10.1)
// ============================================================================

/**
 * @typedef {'Gestor' | 'Supervisor' | 'Administrador' | 'Admin' | 'Auditor' | 'Operador' | 'Colaborador'} UserRole
 */

/**
 * @typedef {Object} Watcher
 * @property {string} id - Identificador único do visualizador (UID ou ID de colaborador)
 * @property {string} [uid] - Firebase Auth UID opcional
 * @property {string} name - Nome completo do colaborador visualizador
 * @property {string} [email] - E-mail corporativo do visualizador
 * @property {UserRole|string} [role] - Cargo/papel do usuário
 * @property {string} [addedAt] - Timestamp ISO de quando foi adicionado
 * @property {string} [addedBy] - Nome do usuário que adicionou o visualizador
 */

/**
 * @typedef {Object} TaskAssignee
 * @property {string} id - Identificador único do responsável
 * @property {string} [uid] - Firebase Auth UID opcional
 * @property {string} name - Nome completo do responsável
 * @property {string} [email] - E-mail corporativo do responsável
 * @property {UserRole|string} [role] - Cargo/papel do responsável
 * @property {string} [assignedAt] - Timestamp ISO da atribuição
 * @property {string} [assignedBy] - Nome de quem realizou a atribuição
 */

/**
 * @typedef {Object} Task
 * @property {string} id - ID do chamado/tarefa
 * @property {string} title - Título resumido
 * @property {string} description - Descrição detalhada com suporte a Markdown/GFM
 * @property {string} category - Categoria canônica ('error_analysis' | 'system_improvement' | 'facility_improvement' | 'other')
 * @property {string} status - Status ('Pendente' | 'Em Andamento' | 'Resolvido' | 'Cancelado')
 * @property {string} creatorId - Identificador do autor/criador
 * @property {string} creatorName - Nome do autor/criador
 * @property {string} [creatorEmail] - E-mail do autor/criador
 * @property {string} [originDepartment] - Departamento de origem da solicitação
 * @property {TaskAssignee|null} [assignedTo] - Objeto do colaborador responsável atribuído
 * @property {string|null} [assigned_to] - ID/identificador do responsável (compatibilidade snake_case)
 * @property {string|null} [assignedToId] - ID direto do responsável
 * @property {string|null} [assignedToName] - Nome direto do responsável
 * @property {Watcher[]} [watchers] - Lista de observadores/visualizadores (somente leitura)
 * @property {string[]} [watcherIds] - Lista indexada de IDs dos visualizadores
 * @property {Object} [metadata] - Metadados específicos da categoria
 */

export const LEADERSHIP_ROLES = ['gestor', 'supervisor', 'administrador', 'admin'];

/**
 * Verifica se o cargo informado pertence à liderança ("Gestor" ou "Supervisor")
 * @param {UserRole|string} [role]
 * @returns {boolean}
 */
export const isLeadershipRole = (role = '') => {
    const normalized = String(role || '').trim().toLowerCase();
    return LEADERSHIP_ROLES.includes(normalized);
};

/**
 * Extrai e normaliza todos os identificadores possíveis de um usuário logado
 * @param {Object} user
 * @returns {{ ids: Set<string>, emails: Set<string>, names: Set<string> }}
 */
export const extractUserIdentity = (user) => {
    const ids = new Set();
    const emails = new Set();
    const names = new Set();

    if (!user || typeof user !== 'object') {
        return { ids, emails, names };
    }

    [user.uid, user.id, user.collaboratorId, user.userId].forEach((val) => {
        if (val && String(val).trim()) {
            ids.add(String(val).trim());
            ids.add(String(val).trim().toLowerCase());
        }
    });

    [user.email, user.creatorEmail].forEach((val) => {
        if (val && String(val).trim()) {
            const clean = String(val).trim().toLowerCase();
            emails.add(clean);
            ids.add(clean);
        }
    });

    [user.name, user.displayName, user.fullName].forEach((val) => {
        if (val && String(val).trim()) {
            names.add(String(val).trim().toLowerCase());
        }
    });

    return { ids, emails, names };
};

/**
 * Obtém o departamento de origem consolidado da tarefa
 * @param {Task|Object} task
 * @returns {string}
 */
export const getTaskOriginDepartment = (task) => {
    if (!task || typeof task !== 'object') return '';
    return (
        task.originDepartment ||
        task.metadata?.originDepartment ||
        task.metadata?.affectedDepartment ||
        task.department ||
        ''
    ).trim();
};

/**
 * Obtém o objeto normalizado do responsável atribuído à tarefa (ou null se sem responsável)
 * @param {Task|Object} task
 * @returns {TaskAssignee|null}
 */
export const getTaskAssignee = (task) => {
    if (!task || typeof task !== 'object') return null;

    const raw = task.assignedTo ?? task.assigned_to ?? null;

    if (raw && typeof raw === 'object') {
        const id = String(raw.id || raw.uid || raw.email || '').trim();
        const name = String(raw.name || raw.displayName || '').trim();
        const email = String(raw.email || '').trim();
        const role = String(raw.role || '').trim();
        if (id || name || email) {
            return {
                id: id || email || name,
                uid: raw.uid || id || '',
                name: name || email || id,
                email,
                role,
                assignedAt: raw.assignedAt || '',
                assignedBy: raw.assignedBy || ''
            };
        }
    }

    if (typeof raw === 'string' && raw.trim()) {
        const clean = raw.trim();
        return {
            id: String(task.assignedToId || clean).trim(),
            uid: String(task.assignedToId || clean).trim(),
            name: String(task.assignedToName || clean).trim(),
            email: String(task.assignedToEmail || '').trim(),
            role: String(task.assignedToRole || '').trim()
        };
    }

    if (task.assignedToId || task.assignedToName || task.assignedToEmail) {
        const id = String(task.assignedToId || task.assignedToEmail || task.assignedToName || '').trim();
        const name = String(task.assignedToName || task.assignedToEmail || task.assignedToId || '').trim();
        if (id || name) {
            return {
                id,
                uid: id,
                name,
                email: String(task.assignedToEmail || '').trim(),
                role: String(task.assignedToRole || '').trim()
            };
        }
    }

    return null;
};

/**
 * Verifica se a tarefa possui um responsável atribuído
 * @param {Task|Object} task
 * @returns {boolean}
 */
export const hasAssignedResponsible = (task) => {
    const assignee = getTaskAssignee(task);
    return Boolean(assignee && (assignee.id || assignee.name || assignee.email));
};

/**
 * Retorna a lista normalizada de visualizadores (watchers/viewers) da tarefa
 * @param {Task|Object} task
 * @returns {Watcher[]}
 */
export const getTaskWatchers = (task) => {
    if (!task || typeof task !== 'object') return [];
    const rawList = Array.isArray(task.watchers)
        ? task.watchers
        : Array.isArray(task.viewers)
        ? task.viewers
        : [];

    const seen = new Set();
    const result = [];

    rawList.forEach((item) => {
        if (!item) return;
        if (typeof item === 'string') {
            const clean = item.trim();
            if (!clean) return;
            const key = clean.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                result.push({ id: clean, uid: clean, name: clean, email: '', role: '' });
            }
            return;
        }
        if (typeof item === 'object') {
            const id = String(item.id || item.uid || item.email || item.name || '').trim();
            const name = String(item.name || item.displayName || item.email || id).trim();
            const email = String(item.email || '').trim();
            const role = String(item.role || '').trim();
            if (!id && !name) return;
            const key = (id || email || name).toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                result.push({
                    id: id || name,
                    uid: String(item.uid || id || '').trim(),
                    name,
                    email,
                    role,
                    addedAt: item.addedAt || '',
                    addedBy: item.addedBy || ''
                });
            }
        }
    });

    return result;
};

/**
 * Verifica se o usuário fornecido é o autor/criador da tarefa
 * @param {Task|Object} task
 * @param {Object} user
 * @returns {boolean}
 */
export const isUserTaskCreator = (task, user) => {
    if (!task || !user) return false;
    const { ids, emails, names } = extractUserIdentity(user);

    const creatorCandidates = [
        task.creatorId,
        task.creatorUid,
        task.creatorEmail,
        task.authorId
    ]
        .filter(Boolean)
        .map((v) => String(v).trim());

    for (const candidate of creatorCandidates) {
        if (ids.has(candidate) || ids.has(candidate.toLowerCase()) || emails.has(candidate.toLowerCase())) {
            return true;
        }
    }

    if (task.creatorName && names.has(String(task.creatorName).trim().toLowerCase())) {
        return true;
    }

    return false;
};

/**
 * Verifica se o usuário fornecido é o responsável atribuído à tarefa
 * @param {Task|Object} task
 * @param {Object} user
 * @returns {boolean}
 */
export const isUserTaskAssignee = (task, user) => {
    if (!task || !user) return false;
    const assignee = getTaskAssignee(task);
    if (!assignee) return false;

    const { ids, emails, names } = extractUserIdentity(user);

    const candidateIds = [assignee.id, assignee.uid, assignee.email]
        .filter(Boolean)
        .map((v) => String(v).trim());

    for (const cid of candidateIds) {
        if (ids.has(cid) || ids.has(cid.toLowerCase()) || emails.has(cid.toLowerCase())) {
            return true;
        }
    }

    if (assignee.name && names.has(assignee.name.toLowerCase())) {
        return true;
    }

    return false;
};

/**
 * Verifica se o usuário fornecido consta na lista de visualizadores (watchers) da tarefa
 * @param {Task|Object} task
 * @param {Object} user
 * @returns {boolean}
 */
export const isUserTaskWatcher = (task, user) => {
    if (!task || !user) return false;
    const watchers = getTaskWatchers(task);
    const watcherIds = Array.isArray(task.watcherIds) ? task.watcherIds : [];

    const { ids, emails, names } = extractUserIdentity(user);

    for (const wid of watcherIds) {
        if (!wid) continue;
        const clean = String(wid).trim();
        if (ids.has(clean) || ids.has(clean.toLowerCase()) || emails.has(clean.toLowerCase())) {
            return true;
        }
    }

    for (const w of watchers) {
        const wCandidates = [w.id, w.uid, w.email].filter(Boolean).map((v) => String(v).trim());
        for (const c of wCandidates) {
            if (ids.has(c) || ids.has(c.toLowerCase()) || emails.has(c.toLowerCase())) {
                return true;
            }
        }
        if (w.name && names.has(w.name.toLowerCase())) {
            return true;
        }
    }

    return false;
};

/**
 * MATRIZ DE ACESSO E VISIBILIDADE (RLS / RBAC):
 * - Usuário comum: só visualiza se for (1) Autor/Criador, (2) Responsável atribuído, ou (3) Visualizador.
 * - Gestores e Supervisores: visualizam suas próprias tarefas, tarefas onde são responsáveis/visualizadores
 *   E todas as tarefas que não possuem responsável atribuído.
 *
 * @param {Task|Object} task
 * @param {Object} user
 * @returns {boolean}
 */
export const canUserViewTask = (task, user) => {
    if (!task || !user) return false;

    if (
        isUserTaskCreator(task, user) ||
        isUserTaskAssignee(task, user) ||
        isUserTaskWatcher(task, user)
    ) {
        return true;
    }

    if (isLeadershipRole(user.role)) {
        // Tarefas sem responsável atribuído são direcionadas e visíveis para Gestores e Supervisores
        if (!hasAssignedResponsible(task)) {
            return true;
        }
    }

    return false;
};

/**
 * Filtra uma coleção de tarefas aplicando estritamente a política RLS de visibilidade
 * @param {Array<Task|Object>} tasks
 * @param {Object} user
 * @returns {Array<Task|Object>}
 */
export const filterVisibleTasks = (tasks = [], user) => {
    if (!Array.isArray(tasks) || !user) return [];
    return tasks.filter((task) => canUserViewTask(task, user));
};

/**
 * Verifica se o usuário tem acesso ESTRITAMENTE como Visualizador (somente leitura)
 * Visualizadores não podem editar campos, fechar o chamado ou adicionar outros visualizadores.
 * @param {Task|Object} task
 * @param {Object} user
 * @returns {boolean}
 */
export const isUserWatcherOnly = (task, user) => {
    if (!task || !user) return false;
    if (isUserTaskCreator(task, user)) return false;
    if (isUserTaskAssignee(task, user)) return false;
    if (isLeadershipRole(user.role)) return false;
    return isUserTaskWatcher(task, user);
};

/**
 * Verifica quem pode gerenciar (adicionar/remover) a lista de visualizadores:
 * Apenas o criador da tarefa, o responsável direto ou liderança ("Gestor" / "Supervisor").
 * @param {Task|Object} task
 * @param {Object} user
 * @returns {boolean}
 */
export const canUserManageWatchers = (task, user) => {
    if (!user) return false;
    if (!task) return true; // Na criação de nova tarefa, o autor pode adicionar visualizadores
    if (isUserWatcherOnly(task, user)) return false;
    return (
        isUserTaskCreator(task, user) ||
        isUserTaskAssignee(task, user) ||
        isLeadershipRole(user.role)
    );
};

/**
 * Verifica quem pode atribuir ou alterar o responsável da tarefa:
 * Usuários de liderança ("Gestor" / "Supervisor").
 * @param {Task|Object} task
 * @param {Object} user
 * @returns {boolean}
 */
export const canUserAssignResponsible = (task, user) => {
    if (!user) return false;
    if (task && isUserWatcherOnly(task, user)) return false;
    return isLeadershipRole(user.role);
};

/**
 * Verifica se o usuário pode alterar status / despachar / encerrar o chamado:
 * Liderança ou o responsável direto atribuído (nunca um mero visualizador).
 * @param {Task|Object} task
 * @param {Object} user
 * @returns {boolean}
 */
export const canUserDispatchOrCloseTask = (task, user) => {
    if (!task || !user) return false;
    if (isUserWatcherOnly(task, user)) return false;
    return isLeadershipRole(user.role) || isUserTaskAssignee(task, user);
};

/**
 * Limpeza defensiva adicional contra payloads XSS em texto bruto Markdown
 * Remove tags <script>, <iframe>, <object>, <embed>, <style> e atributos on*
 * @param {string} [raw]
 * @returns {string}
 */
export const sanitizeMarkdownInput = (raw = '') => {
    if (!raw || typeof raw !== 'string') return '';
    return raw
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/<(object|embed|style|form|meta|link)\b[^>]*>([\s\S]*?<\/\1>)?/gi, '')
        .replace(/\bon\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/javascript\s*:/gi, 'blocked:');
};



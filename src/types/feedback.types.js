/**
 * DEFINIÇÕES DE TIPOS, SCHEMAS E UTILITÁRIOS: FEEDBACKS 1:1 (v3.11.0)
 * Suporte a novo formato consolidado em Markdown (.md) e modo Legado (4 Pilares)
 */

export const FEEDBACK_FORMATS = {
    MARKDOWN: 'markdown',
    LEGACY_4_PILLARS: '4_pillars'
};

export const CLASSIFICATIONS = {
    POSITIVE: 'Positiva',
    NEUTRAL: 'Neutra',
    NEGATIVE: 'Negativa'
};

/**
 * Modelo padrão estruturado de 1:1 em Markdown
 */
export const DEFAULT_1ON1_MARKDOWN_TEMPLATE = `# 🎯 Alinhamento 1:1 Mensal

## 📌 1. Destaques Positivos & Reconhecimento
- Excelente comprometimento com as entregas operacionais e indicadores do período.
- Proatividade e colaboração ativa com os colegas de equipe.

## ⚠️ 2. Pontos de Atenção & Oportunidades de Ajuste
- Monitoramento contínuo do TMA e atenção aos detalhes em procedimentos técnicos.
- Garantir atualização constante das ordens de serviço no sistema.

## 🚀 3. Plano de Desenvolvimento Individual (PDI)
| Ação / Meta | Prazo | Responsável | Status |
| :--- | :--- | :--- | :--- |
| Revisão dos POPs de Atendimento | 15 dias | Colaborador | Em andamento |
| Calibração técnica com Supervisor | 30 dias | Liderança & Colaborador | Planejado |

## 🤝 4. Acordos & Alinhamento de Expectativas
> As metas deste ciclo foram alinhadas e acordadas mutuamente entre colaborador e liderança.
`;

/**
 * Identifica se a avaliação/feedback é no modo legado (4 Pilares)
 * @param {Object} feedback
 * @returns {boolean}
 */
export function isLegacy4PillarsFeedback(feedback) {
    if (!feedback) return false;
    if (feedback.format === FEEDBACK_FORMATS.LEGACY_4_PILLARS) return true;
    if (feedback.format === FEEDBACK_FORMATS.MARKDOWN) return false;

    // Detecção heurística de registros anteriores:
    // Se possui notas/textos de pilares e não possui contentMarkdown explícito
    const hasPillarsFields = Boolean(
        feedback.performanceScore !== undefined ||
        feedback.qualityScore !== undefined ||
        feedback.behaviorScore !== undefined ||
        feedback.punctualityScore !== undefined ||
        feedback.performance ||
        feedback.quality ||
        feedback.behavior ||
        feedback.punctuality
    );

    const hasMarkdownContent = Boolean(
        feedback.contentMarkdown ||
        feedback.markdownContent ||
        feedback.markdown
    );

    return hasPillarsFields && !hasMarkdownContent;
}

/**
 * Identifica se a avaliação/feedback é no formato consolidado Markdown
 * @param {Object} feedback
 * @returns {boolean}
 */
export function isMarkdownFeedback(feedback) {
    if (!feedback) return false;
    if (feedback.format === FEEDBACK_FORMATS.MARKDOWN) return true;
    if (feedback.format === FEEDBACK_FORMATS.LEGACY_4_PILLARS) return false;

    return Boolean(
        feedback.contentMarkdown ||
        feedback.markdownContent ||
        feedback.markdown
    );
}

/**
 * Retorna o formato canônico ('markdown' | '4_pillars')
 * @param {Object} feedback
 * @returns {'markdown' | '4_pillars'}
 */
export function getFeedbackFormat(feedback) {
    return isLegacy4PillarsFeedback(feedback) ? FEEDBACK_FORMATS.LEGACY_4_PILLARS : FEEDBACK_FORMATS.MARKDOWN;
}

/**
 * Obtém o texto do Markdown normalizado independente do campo de persistência
 * @param {Object} feedback
 * @returns {string}
 */
export function getMarkdownContent(feedback) {
    if (!feedback) return '';
    return feedback.contentMarkdown || feedback.markdownContent || feedback.markdown || feedback.generalComments || '';
}

/**
 * Formata data e hora para exibição amigável
 * @param {string|Date|any} dateValue
 * @returns {string}
 */
export function formatDateTimeBR(dateValue) {
    if (!dateValue) return '--';
    try {
        const d = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
        if (isNaN(d.getTime())) return String(dateValue);
        return d.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return String(dateValue);
    }
}

/**
 * Formata mês de referência (YYYY-MM para MM/YYYY)
 * @param {string} yyyyMm
 * @returns {string}
 */
export function formatReferenceMonth(yyyyMm) {
    if (!yyyyMm) return '--/----';
    const parts = yyyyMm.split('-');
    if (parts.length === 2) {
        return `${parts[1]}/${parts[0]}`;
    }
    return yyyyMm;
}

/**
 * Constrói payload seguro para auditoria de confirmação de leitura ("Estou Ciente")
 * @param {Object} user Usuário logado que realizou a confirmação
 * @returns {Object}
 */
export function buildMarkAsReadPayload(user) {
    const now = new Date();
    const userName = user?.name || user?.displayName || (user?.email ? user.email.split('@')[0] : 'Colaborador');
    return {
        read: true,
        readAt: now.toISOString(),
        readAtFormatted: now.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }),
        readByUid: user?.uid || user?.id || user?.firestoreId || 'unknown_user',
        readByName: userName,
        readByEmail: user?.email || '',
        updatedAt: now.toISOString()
    };
}

/**
 * Retorna texto descritivo do status de leitura
 * @param {Object} feedback
 * @returns {string}
 */
export function formatFeedbackReadStatus(feedback) {
    if (!feedback) return 'Indisponível';
    if (!feedback.read) return 'Pendente de leitura';
    
    const dateStr = feedback.readAtFormatted || (feedback.readAt ? formatDateTimeBR(feedback.readAt) : null);
    const userStr = feedback.readByName ? ` por ${feedback.readByName}` : '';
    
    if (dateStr) {
        return `Visualizado e confirmado em ${dateStr}${userStr}`;
    }
    return `Visualizado e confirmado${userStr}`;
}

/**
 * Validação dos campos ao criar/atualizar um feedback consolidado em Markdown
 * @param {Object} data
 * @returns {{ isValid: boolean, errors: string[] }}
 */
export function validateMarkdownFeedback(data) {
    const errors = [];
    if (!data.colabId) errors.push('Colaborador obrigatório.');
    if (!data.referenceMonth) errors.push('Mês de referência obrigatório.');
    if (!data.contentMarkdown || data.contentMarkdown.trim().length < 5) {
        errors.push('Conteúdo do feedback em Markdown deve ter ao menos 5 caracteres.');
    }
    return {
        isValid: errors.length === 0,
        errors
    };
}

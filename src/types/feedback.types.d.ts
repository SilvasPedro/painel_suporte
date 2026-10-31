/**
 * Tipos TypeScript para Feedbacks 1:1 e Avaliações Mensais (v3.11.0)
 */

export type FeedbackFormat = 'markdown' | '4_pillars';

export type FeedbackClassification = 'Positiva' | 'Neutra' | 'Negativa';

export interface AuditReadConfirmation {
    read: boolean;
    readAt?: string;
    readAtFormatted?: string;
    readByUid?: string;
    readByName?: string;
    readByEmail?: string;
}

export interface Legacy4PillarsEvaluation extends AuditReadConfirmation {
    id: string;
    format?: '4_pillars';
    colabId: string;
    colabName: string;
    referenceMonth: string; // YYYY-MM
    classification: FeedbackClassification;
    evaluatorId?: string;
    evaluatorName?: string;
    performance?: string;
    performanceScore?: number | string;
    quality?: string;
    qualityScore?: number | string;
    behavior?: string;
    behaviorScore?: number | string;
    punctuality?: string;
    punctualityScore?: number | string;
    generalComments?: string;
    createdAt?: any;
    updatedAt?: any;
}

export interface Markdown1on1Feedback extends AuditReadConfirmation {
    id: string;
    format: 'markdown';
    colabId: string;
    colabName: string;
    referenceMonth: string; // YYYY-MM
    classification: FeedbackClassification;
    title?: string;
    contentMarkdown: string;
    evaluatorId?: string;
    evaluatorName?: string;
    tags?: string[];
    createdAt?: any;
    updatedAt?: any;
}

export type MonthlyFeedback = Legacy4PillarsEvaluation | Markdown1on1Feedback;

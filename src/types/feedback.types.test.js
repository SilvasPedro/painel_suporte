import { describe, it, expect } from 'vitest';
import {
    FEEDBACK_FORMATS,
    isLegacy4PillarsFeedback,
    isMarkdownFeedback,
    getFeedbackFormat,
    getMarkdownContent,
    buildMarkAsReadPayload,
    formatFeedbackReadStatus,
    formatReferenceMonth,
    validateMarkdownFeedback
} from './feedback.types';

describe('Hubdesk v3.11.0 — Feedback 1:1 Schema, Legacy 4 Pillars & Markdown Mode', () => {
    const legacyItem = {
        id: 'legacy_1',
        format: '4_pillars',
        colabId: 'c1',
        colabName: 'Colaborador Antigo',
        referenceMonth: '2025-10',
        classification: 'Positiva',
        performance: 'Bom desempenho',
        performanceScore: 9,
        quality: 'Sem falhas',
        qualityScore: 8,
        behavior: 'Excelente postura',
        behaviorScore: 10,
        punctuality: 'Pontual',
        punctualityScore: 9,
        generalComments: 'PDI do ciclo anterior'
    };

    const implicitLegacyItem = {
        id: 'legacy_implicit',
        colabId: 'c2',
        colabName: 'Colaborador Sem Formato Explícito',
        referenceMonth: '2025-09',
        classification: 'Neutra',
        performanceScore: 7,
        qualityScore: 7,
        behaviorScore: 8,
        punctualityScore: 9
    };

    const modernMarkdownItem = {
        id: 'md_1',
        format: 'markdown',
        colabId: 'c3',
        colabName: 'Colaborador Atual',
        referenceMonth: '2026-10',
        classification: 'Positiva',
        contentMarkdown: '# Alinhamento Mensal\n\n- Meta atingida com sucesso!'
    };

    it('identifica corretamente feedbacks em formato Legado (4 Pilares)', () => {
        expect(isLegacy4PillarsFeedback(legacyItem)).toBe(true);
        expect(isLegacy4PillarsFeedback(implicitLegacyItem)).toBe(true);
        expect(isLegacy4PillarsFeedback(modernMarkdownItem)).toBe(false);
        expect(getFeedbackFormat(legacyItem)).toBe(FEEDBACK_FORMATS.LEGACY_4_PILLARS);
    });

    it('identifica corretamente feedbacks em formato Markdown Consolidado', () => {
        expect(isMarkdownFeedback(modernMarkdownItem)).toBe(true);
        expect(isMarkdownFeedback(legacyItem)).toBe(false);
        expect(getFeedbackFormat(modernMarkdownItem)).toBe(FEEDBACK_FORMATS.MARKDOWN);
    });

    it('extrai conteúdo markdown unificado com segurança', () => {
        expect(getMarkdownContent(modernMarkdownItem)).toContain('Alinhamento Mensal');
        expect(getMarkdownContent(legacyItem)).toBe('PDI do ciclo anterior');
    });

    it('constrói payload de auditoria de leitura ("Estou Ciente") com campos obrigatórios', () => {
        const user = { uid: 'usr_123', name: 'Pedro Silva', email: 'pedro@hubdesk.com' };
        const payload = buildMarkAsReadPayload(user);

        expect(payload.read).toBe(true);
        expect(payload.readByUid).toBe('usr_123');
        expect(payload.readByName).toBe('Pedro Silva');
        expect(payload.readByEmail).toBe('pedro@hubdesk.com');
        expect(typeof payload.readAt).toBe('string');
        expect(payload.readAtFormatted).toBeTruthy();
    });

    it('formata status de leitura para usuário pendente e confirmado', () => {
        expect(formatFeedbackReadStatus({ read: false })).toBe('Pendente de leitura');
        
        const confirmed = {
            read: true,
            readAtFormatted: '31/10/2026 às 12:30',
            readByName: 'Pedro Silva'
        };
        expect(formatFeedbackReadStatus(confirmed)).toContain('Visualizado e confirmado em 31/10/2026 às 12:30 por Pedro Silva');
    });

    it('formata mês de referência no padrão MM/YYYY', () => {
        expect(formatReferenceMonth('2026-10')).toBe('10/2026');
        expect(formatReferenceMonth('2026-05')).toBe('05/2026');
        expect(formatReferenceMonth('')).toBe('--/----');
    });

    it('valida formulário de feedback Markdown', () => {
        const valid = {
            colabId: 'c1',
            referenceMonth: '2026-10',
            contentMarkdown: '## Feedback detalhado com markdown válido.'
        };
        expect(validateMarkdownFeedback(valid).isValid).toBe(true);

        const invalid = {
            colabId: '',
            referenceMonth: '',
            contentMarkdown: ''
        };
        const validation = validateMarkdownFeedback(invalid);
        expect(validation.isValid).toBe(false);
        expect(validation.errors.length).toBeGreaterThanOrEqual(3);
    });
});

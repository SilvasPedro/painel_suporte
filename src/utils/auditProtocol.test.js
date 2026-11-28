import { describe, it, expect } from 'vitest';
import { normalizeProtocol, findDuplicateAudit } from './auditProtocol';

describe('normalizeProtocol', () => {
    it('ignora #, espaços e maiúsculas', () => {
        expect(normalizeProtocol(' #984321 ')).toBe('984321');
        expect(normalizeProtocol('AB 12')).toBe('ab12');
        expect(normalizeProtocol(null)).toBe('');
    });
});

describe('findDuplicateAudit', () => {
    const audits = [
        { id: 'a1', protocol: '#984321' },
        { id: 'a2', protocol: 'XY-1' }
    ];

    it('encontra duplicado mesmo com formatação diferente', () => {
        expect(findDuplicateAudit(audits, '984321')?.id).toBe('a1');
        expect(findDuplicateAudit(audits, 'xy-1')?.id).toBe('a2');
    });

    it('ignora a própria auditoria em edição', () => {
        expect(findDuplicateAudit(audits, '984321', 'a1')).toBeNull();
    });

    it('protocolo vazio ou inexistente não é duplicado', () => {
        expect(findDuplicateAudit(audits, '')).toBeNull();
        expect(findDuplicateAudit(audits, '555')).toBeNull();
    });
});

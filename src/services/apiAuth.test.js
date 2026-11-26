import { describe, it, expect, vi } from 'vitest';

vi.mock('./firebase', () => ({ auth: {} }));

import { readAiError, describeAiError } from './apiAuth';

describe('readAiError', () => {
    it('usa a explicação do servidor e monta o detalhe técnico', () => {
        const r = readAiError(502, { error: 'chave-invalida', message: 'A chave da Anthropic foi recusada.', detail: '401 • authentication_error', retryable: false });
        expect(r.message).toBe('A chave da Anthropic foi recusada.');
        expect(r.detail).toBe('HTTP 502 • chave-invalida • 401 • authentication_error');
        expect(r.retryable).toBe(false);
    });

    it('erros temporários permitem tentar de novo; login e permissão não', () => {
        expect(readAiError(503, { error: 'ia-sobrecarregada', message: 'Sobrecarregada', retryable: true }).retryable).toBe(true);
        expect(readAiError(401, { error: 'nao-autenticado', message: 'Entre no sistema.' }).retryable).toBe(false);
        expect(readAiError(403, { error: 'sem-permissao', message: 'Exclusivo da gestão.' }).retryable).toBe(false);
    });

    it('resposta que não é JSON (função fora do ar) mostra o status HTTP', () => {
        const r = readAiError(500, null);
        expect(r.message).toMatch(/logs da função/);
        expect(r.detail).toBe('HTTP 500 • resposta sem JSON');
        expect(r.retryable).toBe(true);
    });

    it('JSON sem mensagem cai no texto padrão do status', () => {
        const r = readAiError(413, { error: 'x' });
        expect(r.message).toBe(describeAiError(413));
        expect(r.detail).toBe('HTTP 413 • x');
    });
});

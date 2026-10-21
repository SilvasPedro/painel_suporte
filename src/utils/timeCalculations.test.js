import { describe, it, expect } from 'vitest';
import { timeToDecimal, formatTime, formatDateBR, parseDateSort } from './timeCalculations';

describe('timeToDecimal', () => {
    it('deve converter "HH:MM:SS" em minutos decimais corretamente', () => {
        expect(timeToDecimal('00:05:30')).toBe(5.5);
        expect(timeToDecimal('01:00:00')).toBe(60);
        expect(timeToDecimal('01:30:30')).toBe(90.5);
        expect(timeToDecimal('00:00:45')).toBe(0.75);
    });

    it('deve converter "MM:SS" em minutos decimais', () => {
        expect(timeToDecimal('04:30')).toBe(4.5);
    });

    it('deve retornar 0 para valores vazios ou nulos', () => {
        expect(timeToDecimal('')).toBe(0);
        expect(timeToDecimal('--')).toBe(0);
        expect(timeToDecimal('00:00:00')).toBe(0);
        expect(timeToDecimal(null)).toBe(0);
    });
});

describe('formatTime', () => {
    it('deve formatar minutos decimais para "HH:MM:SS"', () => {
        expect(formatTime(5.5)).toBe('00:05:30');
        expect(formatTime(60)).toBe('01:00:00');
        expect(formatTime(90.5)).toBe('01:30:30');
        expect(formatTime(0)).toBe('00:00:00');
    });

    it('deve lidar com valores inválidos', () => {
        expect(formatTime(null)).toBe('00:00:00');
        expect(formatTime(undefined)).toBe('00:00:00');
    });
});

describe('formatDateBR', () => {
    it('deve converter YYYY-MM-DD para DD/MM', () => {
        expect(formatDateBR('2026-10-21')).toBe('21/10');
    });

    it('deve aceitar DD/MM/YYYY e retornar DD/MM', () => {
        expect(formatDateBR('21/10/2026')).toBe('21/10');
    });

    it('deve retornar string vazia para entrada vazia', () => {
        expect(formatDateBR('')).toBe('');
    });
});

describe('parseDateSort', () => {
    it('deve retornar timestamp válido para ordenação cronológica', () => {
        const t1 = parseDateSort('2026-01-10');
        const t2 = parseDateSort('2026-05-15');
        expect(t2).toBeGreaterThan(t1);
    });

    it('deve ordenar corretamente formatos brasileiros DD/MM/YYYY', () => {
        const t1 = parseDateSort('10/01/2026');
        const t2 = parseDateSort('15/05/2026');
        expect(t2).toBeGreaterThan(t1);
    });
});

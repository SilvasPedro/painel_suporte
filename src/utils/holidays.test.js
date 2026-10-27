import { describe, it, expect } from 'vitest';
import { 
    getEaster, 
    getHolidaysForYear, 
    getHoliday, 
    isHolidayHE100, 
    formatDateKey 
} from './holidays';

describe('getEaster', () => {
    it('deve calcular corretamente a data da Páscoa para múltiplos anos', () => {
        expect(formatDateKey(getEaster(2024))).toBe('2024-03-31');
        expect(formatDateKey(getEaster(2025))).toBe('2025-04-20');
        expect(formatDateKey(getEaster(2026))).toBe('2026-04-05');
        expect(formatDateKey(getEaster(2027))).toBe('2027-03-28');
    });
});

describe('getHolidaysForYear', () => {
    it('deve incluir todos os feriados nacionais fixos e móveis de 2026', () => {
        const holidays = getHolidaysForYear(2026);

        // Fixos
        expect(holidays['2026-01-01']?.name).toBe('Confraternização Universal');
        expect(holidays['2026-04-21']?.name).toBe('Tiradentes');
        expect(holidays['2026-05-01']?.name).toBe('Dia do Trabalho');
        expect(holidays['2026-09-07']?.name).toBe('Independência do Brasil');
        expect(holidays['2026-10-12']?.name).toBe('Nossa Senhora Aparecida');
        expect(holidays['2026-11-02']?.name).toBe('Finados');
        expect(holidays['2026-11-15']?.name).toBe('Proclamação da República');
        expect(holidays['2026-11-20']?.name).toBe('Dia da Consciência Negra');
        expect(holidays['2026-12-25']?.name).toBe('Natal');

        // Móveis de 2026 (baseados na Páscoa 05/04/2026)
        expect(holidays['2026-02-17']?.name).toBe('Carnaval');
        expect(holidays['2026-04-03']?.name).toBe('Sexta-feira Santa');
        expect(holidays['2026-04-05']?.name).toBe('Páscoa');
        expect(holidays['2026-06-04']?.name).toBe('Corpus Christi');
    });
});

describe('Regra de Exceção de Feriados em Domingos (H.E 100%)', () => {
    it('deve marcar isEligibleHE100 como true para feriados de segunda a sábado', () => {
        // Tiradentes 2026: 21 de abril de 2026 (terça-feira)
        const tiradentes = getHoliday('2026-04-21');
        expect(tiradentes).not.toBeNull();
        expect(tiradentes.dayOfWeek).toBe(2);
        expect(tiradentes.isSunday).toBe(false);
        expect(tiradentes.isEligibleHE100).toBe(true);
        expect(isHolidayHE100('2026-04-21')).toBe(true);

        // Sexta-feira Santa 2026: 3 de abril de 2026 (sexta-feira)
        const sextaSanta = getHoliday('2026-04-03');
        expect(sextaSanta).not.toBeNull();
        expect(sextaSanta.dayOfWeek).toBe(5);
        expect(sextaSanta.isSunday).toBe(false);
        expect(sextaSanta.isEligibleHE100).toBe(true);
        expect(isHolidayHE100('2026-04-03')).toBe(true);
    });

    it('NÃO deve conceder H.E 100% para feriados que caem no domingo', () => {
        // Domingo de Páscoa 2026: 5 de abril de 2026 (domingo)
        const pascoa = getHoliday('2026-04-05');
        expect(pascoa).not.toBeNull();
        expect(pascoa.dayOfWeek).toBe(0);
        expect(pascoa.isSunday).toBe(true);
        expect(pascoa.isEligibleHE100).toBe(false);
        expect(isHolidayHE100('2026-04-05')).toBe(false);

        // Proclamação da República 2026: 15 de novembro de 2026 (cai em um domingo!)
        const proclamacao = getHoliday('2026-11-15');
        expect(proclamacao).not.toBeNull();
        expect(proclamacao.dayOfWeek).toBe(0);
        expect(proclamacao.isSunday).toBe(true);
        expect(proclamacao.isEligibleHE100).toBe(false);
        expect(isHolidayHE100('2026-11-15')).toBe(false);
    });

    it('deve retornar null / false para dias comuns que não são feriados', () => {
        expect(getHoliday('2026-04-10')).toBeNull();
        expect(isHolidayHE100('2026-04-10')).toBe(false);
        expect(getHoliday(null)).toBeNull();
        expect(getHoliday('')).toBeNull();
        expect(isHolidayHE100('')).toBe(false);
    });
});

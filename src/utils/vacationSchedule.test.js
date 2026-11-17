import { describe, it, expect } from 'vitest';
import {
    countDays, eachDay, validateEntry, colabSummary, shiftConflicts, monthlyLoad, yearPosition, yearSpan, VACATION_YEAR,
} from './vacationSchedule';

const e = (id, colabId, shift, start, end, name = colabId) => ({ id, colabId, colabName: name, shift, start, end });

describe('vacationSchedule', () => {
    it('conta dias de forma inclusiva e lida com virada de mês', () => {
        expect(countDays('2027-07-01', '2027-07-10')).toBe(10);
        expect(countDays('2027-01-30', '2027-02-02')).toBe(4);
        expect(countDays('2027-07-10', '2027-07-01')).toBe(0);
        expect(eachDay('2027-12-30', '2027-12-31')).toEqual(['2027-12-30', '2027-12-31']);
    });

    it('conta certo atravessando horário de verão (sem erro de 1 dia)', () => {
        expect(countDays('2027-10-01', '2027-11-30')).toBe(61);
    });

    it('valida campos, ano, ordem e sobreposição do mesmo colaborador', () => {
        const list = [e('1', 'a', 'Tarde', '2027-07-01', '2027-07-15')];
        expect(validateEntry({ colabId: '', start: '', end: '' }, list)).toHaveLength(2);
        expect(validateEntry({ colabId: 'a', start: '2027-08-10', end: '2027-08-01' }, list)[0]).toMatch(/anterior/);
        expect(validateEntry({ colabId: 'a', start: '2028-01-01', end: '2028-01-10' }, list)[0]).toMatch(/2027/);
        expect(validateEntry({ colabId: 'a', start: '2027-07-10', end: '2027-07-20' }, list)[0]).toMatch(/já tem férias/);
        // editar o próprio período não conflita consigo mesmo
        expect(validateEntry({ id: '1', colabId: 'a', start: '2027-07-02', end: '2027-07-16' }, list)).toEqual([]);
        // outro colaborador pode ter o mesmo período
        expect(validateEntry({ colabId: 'b', start: '2027-07-01', end: '2027-07-15' }, list)).toEqual([]);
    });

    it('resume por colaborador com avisos de fracionamento', () => {
        const s = colabSummary([
            e('1', 'a', 'Tarde', '2027-01-01', '2027-01-04'),
            e('2', 'a', 'Tarde', '2027-03-01', '2027-03-10'),
        ]);
        expect(s[0].days).toBe(14);
        expect(s[0].hints.join(' ')).toMatch(/menos de 5/);
        expect(s[0].hints.join(' ')).toMatch(/14 dias ou mais/);
        const ok = colabSummary([e('3', 'b', 'Tarde', '2027-05-01', '2027-05-30')]);
        expect(ok[0].hints).toEqual([]);
    });

    it('detecta conflito apenas dentro do mesmo turno', () => {
        const list = [
            e('1', 'a', 'Tarde', '2027-07-01', '2027-07-10', 'Ana'),
            e('2', 'b', 'Tarde', '2027-07-08', '2027-07-20', 'Bia'),
            e('3', 'c', 'Noturno', '2027-07-01', '2027-07-20', 'Caio'),
        ];
        const c = shiftConflicts(list, 2);
        expect(c).toHaveLength(1);
        expect(c[0]).toMatchObject({ shift: 'Tarde', start: '2027-07-08', end: '2027-07-10', count: 2 });
        expect(c[0].names).toEqual(['Ana', 'Bia']);
        expect(shiftConflicts(list, 3)).toEqual([]);
    });

    it('calcula carga mensal e pico simultâneo', () => {
        const m = monthlyLoad([
            e('1', 'a', 'Tarde', '2027-01-30', '2027-02-02'),
            e('2', 'b', 'Tarde', '2027-02-01', '2027-02-01'),
        ]);
        expect(m[0]).toMatchObject({ people: 1, personDays: 2, peak: 1 });
        expect(m[1]).toMatchObject({ people: 2, personDays: 3, peak: 2 });
        expect(m[5].personDays).toBe(0);
    });

    it('posiciona datas na linha do tempo anual', () => {
        expect(yearPosition('2027-01-01', VACATION_YEAR)).toBe(0);
        expect(yearPosition('2027-07-02', VACATION_YEAR)).toBeCloseTo(50, 0);
        expect(yearSpan('2027-01-01', '2027-12-31')).toBeCloseTo(100, 5);
    });
});

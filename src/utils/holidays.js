/**
 * Utilitário determinístico puro para cálculo de feriados nacionais brasileiros
 * e identificação de dias elegíveis para Horas Extras 100% (H.E 100%).
 *
 * Regra de Negócio:
 * - Feriados nacionais que caem de segunda a sábado recebem destaque de 100% H.E.
 * - Feriados que caem no domingo NÃO recebem destaque de 100% H.E (mantêm regra de domingo).
 */

/**
 * Calcula a data do Domingo de Páscoa no calendário gregoriano (Algoritmo Meeus/Jones/Butcher).
 * @param {number} year - Ano com 4 dígitos.
 * @returns {Date} Instância de Date no meio-dia local para evitar shifts de fuso horário.
 */
export const getEaster = (year) => {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed (2 = março, 3 = abril)
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month, day, 12, 0, 0);
};

/**
 * Adiciona ou subtrai dias de uma data base de forma determinística.
 * @param {Date} baseDate
 * @param {number} days
 * @returns {Date}
 */
export const addDays = (baseDate, days) => {
    const result = new Date(baseDate.getTime());
    result.setDate(result.getDate() + days);
    return result;
};

/**
 * Formata um objeto Date para string no padrão YYYY-MM-DD.
 * @param {Date} date
 * @returns {string}
 */
export const formatDateKey = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Cache em memória para evitar recálculos desnecessários por ano
const holidaysCacheByYear = new Map();

/**
 * Retorna todos os feriados nacionais brasileiros para o ano especificado.
 * Inclui feriados fixos e móveis.
 * @param {number} year
 * @returns {Record<string, { date: Date, dateString: string, name: string, dayOfWeek: number, isSunday: boolean, isEligibleHE100: boolean }>}
 */
export const getHolidaysForYear = (year) => {
    if (holidaysCacheByYear.has(year)) {
        return holidaysCacheByYear.get(year);
    }

    const easter = getEaster(year);

    // Feriados Nacionais Fixos no Brasil (Legislação Federal)
    const fixedHolidays = [
        { month: 0, day: 1, name: 'Confraternização Universal' },
        { month: 3, day: 21, name: 'Tiradentes' },
        { month: 4, day: 1, name: 'Dia do Trabalho' },
        { month: 8, day: 7, name: 'Independência do Brasil' },
        { month: 9, day: 12, name: 'Nossa Senhora Aparecida' },
        { month: 10, day: 2, name: 'Finados' },
        { month: 10, day: 15, name: 'Proclamação da República' },
        { month: 10, day: 20, name: 'Dia da Consciência Negra' },
        { month: 11, day: 25, name: 'Natal' }
    ];

    // Feriados Nacionais Móveis vinculados ao ciclo da Páscoa
    const movableHolidays = [
        { date: addDays(easter, -48), name: 'Carnaval (Segunda-feira)' },
        { date: addDays(easter, -47), name: 'Carnaval' },
        { date: addDays(easter, -2), name: 'Sexta-feira Santa' },
        { date: easter, name: 'Páscoa' },
        { date: addDays(easter, 60), name: 'Corpus Christi' }
    ];

    const holidayMap = {};

    // Adiciona feriados fixos
    fixedHolidays.forEach(({ month, day, name }) => {
        const date = new Date(year, month, day, 12, 0, 0);
        const dateString = formatDateKey(date);
        const dayOfWeek = date.getDay();
        const isSunday = dayOfWeek === 0;

        holidayMap[dateString] = {
            date,
            dateString,
            name,
            dayOfWeek,
            isSunday,
            isEligibleHE100: !isSunday
        };
    });

    // Adiciona feriados móveis
    movableHolidays.forEach(({ date, name }) => {
        const dateString = formatDateKey(date);
        const dayOfWeek = date.getDay();
        const isSunday = dayOfWeek === 0;

        // Se já existir entrada nessa data (raríssimo), prioriza ou preserva
        holidayMap[dateString] = {
            date,
            dateString,
            name,
            dayOfWeek,
            isSunday,
            isEligibleHE100: !isSunday
        };
    });

    holidaysCacheByYear.set(year, holidayMap);
    return holidayMap;
};

/**
 * Consulta se uma data específica é feriado nacional.
 * @param {Date | string} dateInput - Instância Date ou string 'YYYY-MM-DD'.
 * @returns {{ date: Date, dateString: string, name: string, dayOfWeek: number, isSunday: boolean, isEligibleHE100: boolean } | null}
 */
export const getHoliday = (dateInput) => {
    if (!dateInput) return null;

    let dateObj;
    let dateString;

    if (typeof dateInput === 'string') {
        const parts = dateInput.split('-').map(Number);
        if (parts.length !== 3 || parts.some(isNaN)) return null;
        dateObj = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
        dateString = dateInput;
    } else if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
        dateObj = dateInput;
        dateString = formatDateKey(dateInput);
    } else {
        return null;
    }

    const year = dateObj.getFullYear();
    const holidays = getHolidaysForYear(year);

    return holidays[dateString] || null;
};

/**
 * Verifica se a data é um feriado elegível para Horas Extras 100% (ou seja, feriado que NÃO é domingo).
 * @param {Date | string} dateInput
 * @returns {boolean}
 */
export const isHolidayHE100 = (dateInput) => {
    const holiday = getHoliday(dateInput);
    return Boolean(holiday && holiday.isEligibleHE100);
};

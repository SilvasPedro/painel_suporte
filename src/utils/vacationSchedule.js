/**
 * Regras e cálculos da Escala de Férias (funções puras, sem React/Firebase).
 *
 * Modelo de dados (documento `vacation_schedules/{ano}`):
 *   { year, entries: [{ id, colabId, colabName, shift, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', status, notes }] }
 * `start` e `end` são inclusivos (férias de 01/07 a 10/07 = 10 dias).
 */

export const VACATION_YEAR = 2027;
export const VACATION_COLLECTION = 'vacation_schedules';

export const VACATION_STATUS = [
    { id: 'planejada', label: 'Planejada', tone: 'sky' },
    { id: 'confirmada', label: 'Confirmada', tone: 'emerald' },
    { id: 'pendente', label: 'A definir', tone: 'amber' },
];

export const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const MS_DAY = 86400000;

/** 'YYYY-MM-DD' -> Date local (sem distorção de fuso). */
export const parseISO = (s) => {
    if (!s || typeof s !== 'string') return null;
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
};

export const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const formatBR = (s) => {
    const p = (s || '').split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s || '--';
};

export const formatShortBR = (s) => {
    const p = (s || '').split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}` : s || '--';
};

/** Número de dias entre duas datas ISO, inclusivo. 0 se inválido. */
export const countDays = (start, end) => {
    const a = parseISO(start);
    const b = parseISO(end);
    if (!a || !b || b < a) return 0;
    // Date.UTC evita erro de 1h na virada de horário de verão
    return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / MS_DAY) + 1;
};

/** Datas ISO (todas) de um período. */
export const eachDay = (start, end) => {
    const a = parseISO(start);
    const n = countDays(start, end);
    const out = [];
    for (let i = 0; i < n; i++) out.push(toISO(new Date(a.getFullYear(), a.getMonth(), a.getDate() + i)));
    return out;
};

export const periodsOverlap = (a, b) => a.start <= b.end && b.start <= a.end;

/**
 * Validação de um período antes de gravar.
 * @returns {string[]} lista de erros (vazia = válido)
 */
export const validateEntry = (entry, entries = [], year = VACATION_YEAR) => {
    const errors = [];
    if (!entry.colabId) errors.push('Selecione o colaborador.');
    if (!entry.start || !entry.end) {
        errors.push('Informe a data de início e a de fim.');
        return errors;
    }
    if (entry.end < entry.start) errors.push('A data final não pode ser anterior à inicial.');
    if (!entry.start.startsWith(`${year}-`) || !entry.end.startsWith(`${year}-`)) {
        errors.push(`O período precisa estar dentro de ${year}.`);
    }
    const clash = entries.find((e) => e.id !== entry.id && e.colabId === entry.colabId && periodsOverlap(e, entry));
    if (clash) errors.push(`Este colaborador já tem férias de ${formatBR(clash.start)} a ${formatBR(clash.end)}.`);
    return errors;
};

/**
 * Resumo por colaborador: dias totais, nº de períodos e avisos das regras de fracionamento (CLT):
 * até 3 períodos; um deles com 14+ dias e os demais com 5+ dias; total de até 30 dias.
 */
export const colabSummary = (entries) => {
    const map = new Map();
    entries.forEach((e) => {
        if (!map.has(e.colabId)) map.set(e.colabId, { colabId: e.colabId, colabName: e.colabName, shift: e.shift, periods: [], days: 0 });
        const row = map.get(e.colabId);
        const d = countDays(e.start, e.end);
        row.periods.push({ ...e, days: d });
        row.days += d;
    });
    return [...map.values()].map((row) => {
        const hints = [];
        if (row.days > 30) hints.push(`Total de ${row.days} dias passa de 30.`);
        if (row.periods.length > 3) hints.push('Mais de 3 períodos (limite legal de fracionamento).');
        if (row.periods.length > 1) {
            if (row.periods.some((p) => p.days < 5)) hints.push('Há período com menos de 5 dias.');
            if (row.days >= 14 && !row.periods.some((p) => p.days >= 14)) hints.push('Nenhum período com 14 dias ou mais.');
        }
        return { ...row, hints };
    }).sort((a, b) => (a.colabName || '').localeCompare(b.colabName || ''));
};

/**
 * Conflitos por turno: dias em que `threshold` ou mais pessoas do mesmo turno estão de férias.
 * Devolve faixas contínuas: [{ shift, start, end, count, names }].
 */
export const shiftConflicts = (entries, threshold = 2, year = VACATION_YEAR) => {
    const byShift = new Map();
    entries.forEach((e) => {
        const key = e.shift || 'Sem turno';
        if (!byShift.has(key)) byShift.set(key, []);
        byShift.get(key).push(e);
    });

    const out = [];
    byShift.forEach((list, shift) => {
        if (list.length < threshold) return;
        // dia -> nomes
        const dayMap = new Map();
        list.forEach((e) => {
            eachDay(e.start, e.end).forEach((d) => {
                if (!d.startsWith(`${year}-`)) return;
                if (!dayMap.has(d)) dayMap.set(d, new Set());
                dayMap.get(d).add(e.colabName || e.colabId);
            });
        });
        const days = [...dayMap.keys()].filter((d) => dayMap.get(d).size >= threshold).sort();
        let cur = null;
        days.forEach((d) => {
            const names = [...dayMap.get(d)].sort();
            const sig = names.join('|');
            const consecutive = cur && countDays(cur.end, d) === 2 && cur.sig === sig;
            if (consecutive) {
                cur.end = d;
            } else {
                if (cur) out.push(cur);
                cur = { shift, start: d, end: d, count: names.length, names, sig };
            }
        });
        if (cur) out.push(cur);
    });
    return out.map((r) => ({ shift: r.shift, start: r.start, end: r.end, count: r.count, names: r.names })).sort((a, b) => a.start.localeCompare(b.start));
};

/** Carga por mês: pessoas distintas de férias, dias-pessoa e pico simultâneo. */
export const monthlyLoad = (entries, year = VACATION_YEAR) => {
    return MONTH_NAMES.map((name, m) => {
        const prefix = `${year}-${String(m + 1).padStart(2, '0')}-`;
        const perDay = new Map();
        const people = new Set();
        entries.forEach((e) => {
            eachDay(e.start, e.end).forEach((d) => {
                if (!d.startsWith(prefix)) return;
                perDay.set(d, (perDay.get(d) || 0) + 1);
                people.add(e.colabId);
            });
        });
        const personDays = [...perDay.values()].reduce((s, v) => s + v, 0);
        const peak = perDay.size ? Math.max(...perDay.values()) : 0;
        return { month: m, name, short: MONTH_SHORT[m], people: people.size, personDays, peak };
    });
};

/** Posição (0–100) de uma data dentro do ano, para a linha do tempo. */
export const yearPosition = (iso, year = VACATION_YEAR) => {
    const d = parseISO(iso);
    if (!d) return 0;
    const start = Date.UTC(year, 0, 1);
    const total = (Date.UTC(year + 1, 0, 1) - start) / MS_DAY;
    return ((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - start) / MS_DAY / total) * 100;
};

/** Largura percentual de um período no ano (inclusivo). */
export const yearSpan = (start, end, year = VACATION_YEAR) => {
    const total = (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / MS_DAY;
    return (countDays(start, end) / total) * 100;
};

/** Gera id estável e curto para novos períodos. */
export const newEntryId = () => `v_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/**
 * Resumo das férias de um colaborador (cartão do Meu Desempenho).
 * `current`: período em andamento hoje; `next`: próximo período que ainda vai começar.
 */
export const myVacationSummary = (entries, colabId, todayISO) => {
    const mine = (Array.isArray(entries) ? entries : [])
        .filter((e) => e && e.colabId === colabId && e.start && e.end)
        .map((e) => ({ ...e, days: countDays(e.start, e.end) }))
        .sort((a, b) => a.start.localeCompare(b.start));
    const current = mine.find((e) => e.start <= todayISO && todayISO <= e.end) || null;
    const next = mine.find((e) => e.start > todayISO) || null;
    return {
        entries: mine,
        totalDays: mine.reduce((sum, e) => sum + e.days, 0),
        current,
        next,
        daysUntilNext: next ? countDays(todayISO, next.start) - 1 : null,
    };
};

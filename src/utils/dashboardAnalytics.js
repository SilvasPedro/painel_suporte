/**
 * CAMADA ANALÍTICA DA DASHBOARD (funções puras, sem React/Firebase)
 * Recebe os registros brutos (avaliações semanais, KPIs do setor, auditorias)
 * e devolve séries/rankings/insights prontos para os gráficos.
 */
import { timeToDecimal, formatTime, formatDateBR, parseDateSort } from './timeCalculations';
import { calculatePerformanceScore, getHuggyStats } from './scoringCalculations';

export const OFFICIAL_SHIFTS = ['Manhã I', 'Manhã II', 'Tarde', 'Noturno'];

const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const sum = (arr) => arr.reduce((s, v) => s + v, 0);
const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);
const round1 = (v) => Math.round(v * 10) / 10;

export const stdDev = (arr) => {
    if (arr.length < 2) return 0;
    const m = avg(arr);
    return Math.sqrt(avg(arr.map((v) => (v - m) ** 2)));
};

/** Variação percentual entre dois valores (null se não há base de comparação). */
export const deltaPct = (current, previous) => {
    if (previous === null || previous === undefined || !previous) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
};

/** Localiza o colaborador de uma avaliação/auditoria no mapa indexado por id/nome. */
export const resolveColab = (record, colabsFull = {}) => {
    const id = record.colabId || record.collaboratorId;
    let info = id ? colabsFull[id] : undefined;
    const name = record.colabName || record.name;
    if (!info && name) info = colabsFull[String(name).trim().toLowerCase()];
    return info || null;
};

export const isNightShift = (shiftStr) => {
    if (!shiftStr) return false;
    const s = String(shiftStr).toLowerCase();
    return s.includes('noturn') || s.includes('noit');
};

/** Pontuação do registro (usa a gravada; recalcula só se ausente). */
export const evalScore = (e) => (e.pontuacao !== undefined && e.pontuacao !== null ? num(e.pontuacao) : calculatePerformanceScore(e));

/**
 * Normaliza avaliações: descarta colaboradores inativos/desconhecidos e anexa campos derivados.
 */
export const normalizeEvals = (evals, colabsFull) => {
    const out = [];
    evals.forEach((e) => {
        const colab = resolveColab(e, colabsFull);
        if (!colab || colab.active === false) return;
        const huggy = getHuggyStats(e);
        const atendidas = num(e.Ligacoes_Atendidas);
        const perdidas = num(e.Ligacoes_Perdidas);
        out.push({
            raw: e,
            ts: parseDateSort(e.date),
            date: e.date,
            colabId: colab.id || e.colabId,
            name: colab.name || e.colabName || '--',
            shift: colab.shift || e.shift || '',
            score: evalScore(e),
            finalizados: num(e.Atendimentos_Finalizados),
            atendidas,
            perdidas,
            realizadas: num(e.Ligacoes_Realizadas),
            huggyIni: huggy.iniciados || 0,
            huggyFin: huggy.finalizados || 0,
            huggyPct: huggy.percentual, // null no formato legado
            tmaTel: timeToDecimal(e.TMA_Telefonia),
            tmaHuggy: timeToDecimal(e.TMA_Huggy),
            tmeTel: timeToDecimal(e.TME_Telefonia),
            lostRate: atendidas + perdidas > 0 ? (perdidas / (atendidas + perdidas)) * 100 : 0,
        });
    });
    return out.sort((a, b) => a.ts - b.ts);
};

/** Agrega registros que têm TMA informado (> 0) para que zeros não puxem a média. */
const avgPositive = (rows, key) => avg(rows.map((r) => r[key]).filter((v) => v > 0));

/** Série semanal consolidada (uma linha por data de apuração). */
export const weeklySeries = (rows) => {
    const byDate = new Map();
    rows.forEach((r) => {
        if (!byDate.has(r.date)) byDate.set(r.date, []);
        byDate.get(r.date).push(r);
    });
    const series = [];
    byDate.forEach((list, date) => {
        const pcts = list.map((r) => r.huggyPct).filter((v) => v !== null);
        const calls = sum(list.map((r) => r.atendidas)) + sum(list.map((r) => r.perdidas));
        series.push({
            date,
            label: formatDateBR(date),
            ts: list[0].ts,
            colabs: list.length,
            totalScore: sum(list.map((r) => r.score)),
            avgScore: round1(avg(list.map((r) => r.score))),
            finalizados: sum(list.map((r) => r.finalizados)),
            atendidas: sum(list.map((r) => r.atendidas)),
            perdidas: sum(list.map((r) => r.perdidas)),
            realizadas: sum(list.map((r) => r.realizadas)),
            huggyFin: sum(list.map((r) => r.huggyFin)),
            huggyIni: sum(list.map((r) => r.huggyIni)),
            huggyPct: pcts.length ? round1(avg(pcts)) : null,
            tmaTel: round1(avgPositive(list, 'tmaTel')),
            tmaHuggy: round1(avgPositive(list, 'tmaHuggy')),
            tmeTel: round1(avgPositive(list, 'tmeTel')),
            lostRate: calls > 0 ? round1((sum(list.map((r) => r.perdidas)) / calls) * 100) : 0,
            volumePerColab: round1(avg(list.map((r) => r.finalizados))),
        });
    });
    return series.sort((a, b) => a.ts - b.ts);
};

/** Média móvel simples sobre uma chave numérica da série. */
export const withMovingAverage = (series, key, window = 3, outKey = `${key}MA`) =>
    series.map((row, i) => {
        const slice = series.slice(Math.max(0, i - window + 1), i + 1).map((r) => r[key]).filter((v) => v !== null && v !== undefined);
        return { ...row, [outKey]: slice.length ? round1(avg(slice)) : null };
    });

/** Série semanal quebrada por turno (para comparativo de pontuação média). */
export const shiftSeries = (rows) => {
    const dates = [...new Set(rows.map((r) => r.date))].sort((a, b) => parseDateSort(a) - parseDateSort(b));
    return dates.map((date) => {
        const row = { date, label: formatDateBR(date) };
        OFFICIAL_SHIFTS.forEach((shift) => {
            const list = rows.filter((r) => r.date === date && r.shift === shift);
            row[shift] = list.length ? round1(avg(list.map((r) => r.score))) : null;
        });
        return row;
    });
};

/** Resumo por turno no período. */
export const shiftSummary = (rows) =>
    OFFICIAL_SHIFTS.map((shift) => {
        const list = rows.filter((r) => r.shift === shift);
        return {
            shift,
            evals: list.length,
            colabs: new Set(list.map((r) => r.colabId)).size,
            avgScore: round1(avg(list.map((r) => r.score))),
            avgVol: round1(avg(list.map((r) => r.finalizados))),
            lostRate: round1(avg(list.map((r) => r.lostRate))),
            tmaTel: round1(avgPositive(list, 'tmaTel')),
            tmaHuggy: round1(avgPositive(list, 'tmaHuggy')),
        };
    }).filter((s) => s.evals > 0);

/** Ranking individual com tendência (último vs anterior) e consistência (desvio-padrão). */
export const colabRanking = (rows) => {
    const byColab = new Map();
    rows.forEach((r) => {
        if (!byColab.has(r.colabId)) byColab.set(r.colabId, []);
        byColab.get(r.colabId).push(r);
    });
    const list = [];
    byColab.forEach((items, id) => {
        const sorted = [...items].sort((a, b) => a.ts - b.ts);
        const scores = sorted.map((r) => r.score);
        const last = scores[scores.length - 1];
        const prev = scores.length > 1 ? scores[scores.length - 2] : null;
        list.push({
            id,
            name: sorted[0].name,
            shift: sorted[sorted.length - 1].shift,
            evals: sorted.length,
            avgScore: Math.round(avg(scores)),
            bestScore: Math.max(...scores),
            lastScore: last,
            trend: prev === null ? null : last - prev,
            consistency: round1(stdDev(scores)),
            avgVol: Math.round(avg(sorted.map((r) => r.finalizados))),
            totalLost: sum(sorted.map((r) => r.perdidas)),
            lostRate: round1(avg(sorted.map((r) => r.lostRate))),
            tmaTel: round1(avgPositive(sorted, 'tmaTel')),
            tmaHuggy: round1(avgPositive(sorted, 'tmaHuggy')),
        });
    });
    return list.sort((a, b) => b.avgScore - a.avgScore);
};

/** Matriz colaborador × semana (últimas N semanas) para o heatmap de pontuação. */
export const scoreHeatmap = (rows, maxWeeks = 8) => {
    const dates = [...new Set(rows.map((r) => r.date))].sort((a, b) => parseDateSort(a) - parseDateSort(b)).slice(-maxWeeks);
    const ranking = colabRanking(rows);
    const matrix = ranking.map((c) => ({
        id: c.id,
        name: c.name,
        shift: c.shift,
        avgScore: c.avgScore,
        cells: dates.map((d) => {
            const hit = rows.find((r) => r.colabId === c.id && r.date === d);
            return hit ? hit.score : null;
        }),
    }));
    const all = matrix.flatMap((m) => m.cells).filter((v) => v !== null);
    return { dates, labels: dates.map(formatDateBR), matrix, min: all.length ? Math.min(...all) : 0, max: all.length ? Math.max(...all) : 0 };
};

/** Histograma de pontuação por avaliação, em faixas dinâmicas. */
export const scoreDistribution = (rows, buckets = 6) => {
    const scores = rows.map((r) => r.score);
    if (!scores.length) return [];
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    if (min === max) return [{ range: String(min), count: scores.length, from: min, to: max }];
    const step = Math.ceil((max - min + 1) / buckets);
    const out = Array.from({ length: buckets }, (_, i) => {
        const from = min + i * step;
        const to = from + step - 1;
        return { range: `${from}–${to}`, from, to, count: 0 };
    });
    scores.forEach((s) => {
        const idx = Math.min(buckets - 1, Math.floor((s - min) / step));
        out[idx].count += 1;
    });
    return out;
};

/** KPIs do setor (TMR/FCR/Reincidência) normalizados e ordenados. */
export const kpiSeries = (kpis) =>
    kpis
        .map((k) => ({
            date: k.date,
            label: formatDateBR(k.date),
            ts: parseDateSort(k.date),
            tmr: round1(timeToDecimal(k.tmr)),
            tmrRaw: k.tmr,
            fcr: num(k.fcr),
            recurrence: num(k.recurrence),
        }))
        .sort((a, b) => a.ts - b.ts);

/** Metas com valores numéricos prontos (TMR em minutos decimais). */
export const normalizeGoals = (goals = {}) => ({
    tmr: timeToDecimal(goals.tmr || '00:20:00'),
    tmrRaw: goals.tmr || '00:20:00',
    fcr: num(goals.fcr ?? 80),
    recurrence: num(goals.recurrence ?? 20),
    qa: num(goals.qa ?? 85),
});

/** KPI está dentro da meta? (TMR e reincidência: menor é melhor.) */
export const inGoal = (kind, value, goals) => {
    if (kind === 'tmr') return value <= goals.tmr;
    if (kind === 'recurrence') return value <= goals.recurrence;
    if (kind === 'fcr') return value >= goals.fcr;
    if (kind === 'qa') return value >= goals.qa;
    return true;
};

/** Aderência às metas: % de semanas dentro da meta + sequência atual. */
export const goalAdherence = (kpis, goals) => {
    const kinds = ['tmr', 'fcr', 'recurrence'];
    const out = {};
    kinds.forEach((kind) => {
        const flags = kpis.map((k) => inGoal(kind, k[kind], goals));
        let streak = 0;
        for (let i = flags.length - 1; i >= 0 && flags[i]; i--) streak++;
        let missStreak = 0;
        for (let i = flags.length - 1; i >= 0 && !flags[i]; i--) missStreak++;
        out[kind] = {
            total: flags.length,
            hits: flags.filter(Boolean).length,
            pct: flags.length ? Math.round((flags.filter(Boolean).length / flags.length) * 100) : 0,
            streak,
            missStreak,
        };
    });
    return out;
};

/** QA interno: taxa de conformidade por data + total + motivos mais frequentes. */
export const qaSeries = (audits) => {
    const byDate = new Map();
    audits.forEach((a) => {
        const date = a.date || '';
        if (!byDate.has(date)) byDate.set(date, { total: 0, ok: 0 });
        const b = byDate.get(date);
        b.total++;
        if (a.status === 'Conforme') b.ok++;
    });
    return [...byDate.entries()]
        .map(([date, b]) => ({
            date,
            label: formatDateBR(date),
            ts: parseDateSort(date),
            total: b.total,
            conformes: b.ok,
            naoConformes: b.total - b.ok,
            taxa: b.total ? round1((b.ok / b.total) * 100) : 0,
        }))
        .sort((a, b) => a.ts - b.ts);
};

/** Filtra registros pelos últimos N dias ancorados na data mais recente informada. */
export const filterByDays = (items, dateOf, days, anchorTs) => {
    if (!days || !anchorTs) return items;
    const limit = anchorTs - days * 86400000;
    return items.filter((it) => {
        const ts = parseDateSort(dateOf(it));
        return !ts || ts >= limit;
    });
};

/** Comparativo última semana × anterior (a partir da série semanal). */
export const weekOverWeek = (series, key) => {
    if (!series.length) return { current: null, previous: null, delta: null };
    const current = series[series.length - 1][key];
    const previous = series.length > 1 ? series[series.length - 2][key] : null;
    return { current, previous, delta: previous === null ? null : deltaPct(current, previous) };
};

/**
 * Insights automáticos em linguagem natural — destaques e alertas da operação.
 * Cada item: { tone: 'good'|'warn'|'bad'|'info', text }
 */
export const buildInsights = ({ series, ranking, kpis, goals, adherence, qa }) => {
    const out = [];

    const score = weekOverWeek(series, 'avgScore');
    if (score.delta !== null && Math.abs(score.delta) >= 5) {
        out.push({
            tone: score.delta > 0 ? 'good' : 'warn',
            text: `Pontuação média ${score.delta > 0 ? 'subiu' : 'caiu'} ${Math.abs(score.delta).toFixed(1).replace('.', ',')}% na última semana (${score.previous} → ${score.current} pts).`,
        });
    }

    const lost = weekOverWeek(series, 'lostRate');
    if (lost.current !== null && lost.current > 0 && lost.delta !== null && lost.delta >= 20) {
        out.push({ tone: 'bad', text: `Taxa de ligações perdidas subiu para ${String(lost.current).replace('.', ',')}% (era ${String(lost.previous).replace('.', ',')}%).` });
    }

    kpis.length &&
        ['tmr', 'fcr', 'recurrence'].forEach((kind) => {
            const a = adherence[kind];
            const names = { tmr: 'TMR', fcr: 'FCR', recurrence: 'Reincidência' };
            if (a.missStreak >= 2) out.push({ tone: 'bad', text: `${names[kind]} está fora da meta há ${a.missStreak} apurações seguidas.` });
            else if (a.streak >= 3) out.push({ tone: 'good', text: `${names[kind]} dentro da meta há ${a.streak} apurações seguidas.` });
        });

    if (ranking.length) {
        const top = ranking[0];
        out.push({ tone: 'good', text: `${top.name} lidera o ranking com média de ${top.avgScore} pts em ${top.evals} avaliação(ões).` });
        const rising = [...ranking].filter((r) => r.trend !== null).sort((a, b) => b.trend - a.trend)[0];
        if (rising && rising.trend > 0) out.push({ tone: 'info', text: `Maior evolução da última semana: ${rising.name} (+${rising.trend} pts).` });
        const falling = [...ranking].filter((r) => r.trend !== null).sort((a, b) => a.trend - b.trend)[0];
        if (falling && falling.trend < 0) out.push({ tone: 'warn', text: `Maior queda da última semana: ${falling.name} (${falling.trend} pts) — vale um alinhamento.` });
        const lostTop = [...ranking].sort((a, b) => b.totalLost - a.totalLost)[0];
        if (lostTop && lostTop.totalLost > 0) out.push({ tone: 'info', text: `${lostTop.name} acumula mais ligações perdidas no período (${lostTop.totalLost}).` });
    }

    if (qa && qa.total > 0 && qa.taxa < goals.qa) {
        out.push({ tone: 'warn', text: `Conformidade de QA em ${String(qa.taxa).replace('.', ',')}%, abaixo da meta de ${goals.qa}%.` });
    }

    return out;
};

export { formatTime, formatDateBR };

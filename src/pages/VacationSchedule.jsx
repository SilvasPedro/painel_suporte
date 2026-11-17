import React, { useState, useEffect, useMemo } from 'react';
import {
    Plane, Plus, Trash2, Edit2, X, Search, Download, Loader2, AlertTriangle, CheckCircle2, CalendarRange,
    Users, Eye, GanttChartSquare, ListChecks, BarChart3, ShieldAlert, Save,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeSharedCollection, subscribeSharedDocument } from '../services/dataCache';
import { useNotification } from '../context/NotificationContext';
import { Card, Tabs, Badge } from '../components/ui';
import { cn } from '../utils/cn';
import {
    VACATION_YEAR, VACATION_COLLECTION, VACATION_STATUS, MONTH_NAMES, MONTH_SHORT,
    countDays, formatBR, formatShortBR, validateEntry, colabSummary, shiftConflicts, monthlyLoad,
    yearPosition, yearSpan, newEntryId, periodsOverlap,
} from '../utils/vacationSchedule';

const MONTH_DAYS = MONTH_NAMES.map((_, m) => new Date(VACATION_YEAR, m + 1, 0).getDate());
const YEAR_MIN = `${VACATION_YEAR}-01-01`;
const YEAR_MAX = `${VACATION_YEAR}-12-31`;

const STATUS_STYLE = {
    planejada: { bar: 'bg-sky-500/80 border-sky-400', chip: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30' },
    confirmada: { bar: 'bg-emerald-500/80 border-emerald-400', chip: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30' },
    pendente: { bar: 'bg-amber-500/80 border-amber-400', chip: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' },
};
const statusLabel = (id) => VACATION_STATUS.find((s) => s.id === id)?.label || 'Planejada';

const shortName = (full) => {
    const parts = String(full || '').trim().split(/\s+/);
    if (parts.length <= 1) return parts[0] || '';
    const preps = ['de', 'da', 'do', 'dos', 'das', 'e'];
    return parts.length >= 3 && preps.includes(parts[1].toLowerCase()) ? `${parts[0]} ${parts[1]} ${parts[2]}` : `${parts[0]} ${parts[1]}`;
};

const VIEWS = [
    { id: 'timeline', label: 'Linha do tempo', icon: GanttChartSquare },
    { id: 'list', label: 'Lista', icon: ListChecks },
    { id: 'coverage', label: 'Cobertura', icon: BarChart3 },
];

// ───────────────────────── Modal de período (edição ou detalhe) ─────────────────────────
function PeriodModal({ initial, people, entries, readOnly, saving, onSave, onDelete, onClose }) {
    const isEditing = Boolean(initial.id);
    const [form, setForm] = useState({
        id: initial.id || null,
        colabId: initial.colabId || '',
        start: initial.start || '',
        end: initial.end || '',
        status: initial.status || 'planejada',
        notes: initial.notes || '',
    });
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    const person = people.find((p) => p.id === form.colabId);
    const days = countDays(form.start, form.end);
    const errors = readOnly ? [] : validateEntry({ ...form, colabName: person?.name, shift: person?.shift }, entries);
    // Só mostra os erros depois que as datas foram preenchidas (formulário vazio não "grita")
    const shownErrors = form.start && form.end ? errors : [];

    // Prévia: total do colaborador e conflito de turno ao salvar este período
    const others = entries.filter((e) => e.id !== form.id && e.colabId === form.colabId);
    const totalAfter = others.reduce((s, e) => s + countDays(e.start, e.end), 0) + days;
    const candidate = { id: form.id || '__new', colabId: form.colabId, colabName: person?.name, shift: person?.shift, start: form.start, end: form.end };
    const conflictNames = useMemo(() => {
        if (errors.length || !person) return [];
        return shiftConflicts([...entries.filter((e) => e.id !== form.id), candidate], 2)
            .filter((c) => c.names.includes(person.name) && periodsOverlap(c, candidate))
            .map((c) => `${c.names.filter((n) => n !== person.name).join(', ')} (${formatShortBR(c.start)}–${formatShortBR(c.end)})`);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entries, form.start, form.end, form.colabId, errors.length]);

    const submit = (e) => {
        e.preventDefault();
        if (readOnly || errors.length) return;
        onSave({
            id: form.id || newEntryId(),
            colabId: form.colabId,
            colabName: person?.name || initial.colabName || '',
            shift: person?.shift || initial.shift || '',
            start: form.start,
            end: form.end,
            status: form.status,
            notes: form.notes.trim(),
        });
    };

    const input = 'w-full px-3 py-2.5 bg-surface border border-subtle rounded-xl text-sm text-primary-hub outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500 disabled:opacity-70';

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-surface text-primary-hub rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[94vh] overflow-y-auto border border-subtle">
                <div className="p-4 sm:p-5 border-b border-subtle flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500"><Plane className="w-4 h-4" /></div>
                        <div>
                            <h2 className="text-sm font-bold">{readOnly ? 'Período de férias' : isEditing ? 'Editar período de férias' : 'Novo período de férias'}</h2>
                            <p className="text-[11px] text-muted-hub">Escala {VACATION_YEAR}</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 text-muted-hub hover:text-primary-hub cursor-pointer"><X className="w-5 h-5" /></button>
                </div>

                <form onSubmit={submit} className="p-4 sm:p-5 space-y-4">
                    <div>
                        <label htmlFor="vac-colab" className="block text-[11px] font-bold uppercase tracking-wider text-secondary-hub mb-1">Colaborador</label>
                        <select id="vac-colab" value={form.colabId} onChange={set('colabId')} disabled={readOnly || isEditing} className={input}>
                            <option value="">Selecione…</option>
                            {people.map((p) => <option key={p.id} value={p.id}>{p.name}{p.shift ? ` · ${p.shift}` : ''}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="vac-start" className="block text-[11px] font-bold uppercase tracking-wider text-secondary-hub mb-1">Início</label>
                            <input id="vac-start" type="date" min={YEAR_MIN} max={YEAR_MAX} value={form.start} onChange={set('start')} disabled={readOnly} className={input} />
                        </div>
                        <div>
                            <label htmlFor="vac-end" className="block text-[11px] font-bold uppercase tracking-wider text-secondary-hub mb-1">Fim</label>
                            <input id="vac-end" type="date" min={form.start || YEAR_MIN} max={YEAR_MAX} value={form.end} onChange={set('end')} disabled={readOnly} className={input} />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="vac-status" className="block text-[11px] font-bold uppercase tracking-wider text-secondary-hub mb-1">Situação</label>
                        <select id="vac-status" value={form.status} onChange={set('status')} disabled={readOnly} className={input}>
                            {VACATION_STATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="vac-notes" className="block text-[11px] font-bold uppercase tracking-wider text-secondary-hub mb-1">Observações</label>
                        <input id="vac-notes" type="text" maxLength={140} value={form.notes} onChange={set('notes')} disabled={readOnly} placeholder={readOnly ? '—' : 'Ex.: acordado com o supervisor'} className={input} />
                    </div>

                    {days > 0 && (
                        <div className="rounded-xl border border-subtle bg-subtle px-3 py-2.5 text-xs flex items-center justify-between gap-3">
                            <span className="font-semibold text-primary-hub">{formatBR(form.start)} → {formatBR(form.end)}</span>
                            <span className="font-mono font-bold">{days} dia(s)</span>
                        </div>
                    )}
                    {!readOnly && form.colabId && days > 0 && (
                        <p className={cn('text-[11px] font-medium', totalAfter > 30 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-hub')}>
                            Total do colaborador em {VACATION_YEAR}: <strong>{totalAfter}</strong> de 30 dias{totalAfter > 30 ? ' — acima do direito anual.' : '.'}
                        </p>
                    )}
                    {shownErrors.length > 0 && (
                        <ul className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300 space-y-1">
                            {shownErrors.map((er) => <li key={er} className="flex gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />{er}</li>)}
                        </ul>
                    )}
                    {conflictNames.length > 0 && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                            <strong>Atenção:</strong> sobrepõe férias de colegas do mesmo turno — {conflictNames.join('; ')}. Você ainda pode salvar.
                        </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                        {!readOnly && isEditing && (
                            <button type="button" onClick={() => onDelete(form.id)} disabled={saving} className="p-2.5 rounded-xl border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer disabled:opacity-50" title="Excluir período" aria-label="Excluir período">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-subtle bg-subtle hover:bg-surface text-xs font-bold text-secondary-hub cursor-pointer">
                            {readOnly ? 'Fechar' : 'Cancelar'}
                        </button>
                        {!readOnly && (
                            <button type="submit" disabled={saving || errors.length > 0} className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {isEditing ? 'Atualizar' : 'Adicionar'}
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

// ───────────────────────── Tela principal ─────────────────────────
export default function VacationSchedule({ readOnly = true }) {
    const { showToast } = useNotification();
    const [collaborators, setCollaborators] = useState([]);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [view, setView] = useState('timeline');
    const [shiftFilter, setShiftFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [modal, setModal] = useState(null);
    const [threshold, setThreshold] = useState(2);

    useEffect(() => {
        const unsubC = subscribeSharedCollection('collaborators', (items) => {
            setCollaborators(
                items
                    .filter((c) => c.active !== false && String(c.status || '').toLowerCase() !== 'inativo')
                    .map((c) => ({ id: c.id || c.firestoreId || c.uid, name: c.name || c.email?.split('@')[0] || 'Colaborador', shift: c.shift || '' }))
                    .sort((a, b) => a.name.localeCompare(b.name))
            );
        });
        const unsubD = subscribeSharedDocument(VACATION_COLLECTION, String(VACATION_YEAR), (data) => {
            setEntries(Array.isArray(data?.entries) ? data.entries : []);
            setLoading(false);
        });
        const t = setTimeout(() => setLoading(false), 1500);
        return () => { unsubC(); unsubD(); clearTimeout(t); };
    }, []);

    // Pessoas: colaboradores ativos + quem tem lançamento mas saiu da lista
    const people = useMemo(() => {
        const map = new Map(collaborators.map((c) => [c.id, c]));
        entries.forEach((e) => { if (!map.has(e.colabId)) map.set(e.colabId, { id: e.colabId, name: e.colabName || 'Ex-colaborador', shift: e.shift || '' }); });
        return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    }, [collaborators, entries]);

    const shifts = useMemo(() => [...new Set(people.map((p) => p.shift).filter(Boolean))].sort(), [people]);

    const visiblePeople = useMemo(() => {
        const q = search.trim().toLowerCase();
        return people.filter((p) => (shiftFilter === 'all' || p.shift === shiftFilter) && (!q || p.name.toLowerCase().includes(q)));
    }, [people, shiftFilter, search]);

    const visibleIds = useMemo(() => new Set(visiblePeople.map((p) => p.id)), [visiblePeople]);
    const visibleEntries = useMemo(() => entries.filter((e) => visibleIds.has(e.colabId)), [entries, visibleIds]);

    const summary = useMemo(() => colabSummary(visibleEntries), [visibleEntries]);
    const summaryById = useMemo(() => new Map(summary.map((s) => [s.colabId, s])), [summary]);
    const conflicts = useMemo(() => shiftConflicts(visibleEntries, threshold), [visibleEntries, threshold]);
    const load = useMemo(() => monthlyLoad(visibleEntries), [visibleEntries]);

    const conflictEntryIds = useMemo(() => {
        const ids = new Set();
        visibleEntries.forEach((e) => {
            if (conflicts.some((c) => c.shift === (e.shift || 'Sem turno') && c.names.includes(e.colabName || e.colabId) && periodsOverlap(e, c))) ids.add(e.id);
        });
        return ids;
    }, [visibleEntries, conflicts]);

    const withoutVacation = visiblePeople.filter((p) => !summaryById.has(p.id));
    const totalPersonDays = summary.reduce((s, r) => s + r.days, 0);
    const busiest = load.reduce((m, x) => (x.personDays > m.personDays ? x : m), load[0]);
    const hintCount = summary.reduce((s, r) => s + r.hints.length, 0);

    // ── persistência (cada ação grava o documento inteiro do ano) ──
    const persist = async (next, okMessage) => {
        if (readOnly) return false;
        setSaving(true);
        try {
            await setDoc(doc(db, VACATION_COLLECTION, String(VACATION_YEAR)), { year: VACATION_YEAR, entries: next, updatedAt: new Date() }, { merge: true });
            setEntries(next);
            showToast(okMessage, 'success');
            return true;
        } catch (err) {
            console.error('Erro ao salvar escala de férias:', err);
            showToast('Erro ao salvar. Você precisa ser Gestor para editar a escala de férias.', 'error');
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async (entry) => {
        const exists = entries.some((e) => e.id === entry.id);
        const next = exists ? entries.map((e) => (e.id === entry.id ? entry : e)) : [...entries, entry];
        if (await persist(next, exists ? 'Período atualizado.' : 'Período adicionado.')) setModal(null);
    };

    const handleDelete = async (id) => {
        if (await persist(entries.filter((e) => e.id !== id), 'Período removido.')) setModal(null);
    };

    const openEntry = (entry) => setModal({ initial: entry });
    const openNew = (colabId = '') => { if (!readOnly) setModal({ initial: { colabId } }); };

    const exportCSV = () => {
        const rows = [...visibleEntries].sort((a, b) => a.start.localeCompare(b.start));
        if (!rows.length) return;
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = ['Colaborador;Turno;Início;Fim;Dias;Situação;Observações']
            .concat(rows.map((r) => [esc(r.colabName), esc(r.shift), formatBR(r.start), formatBR(r.end), countDays(r.start, r.end), esc(statusLabel(r.status)), esc(r.notes)].join(';')))
            .join('\n');
        const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `escala_ferias_${VACATION_YEAR}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-canvas h-full p-8">
                <Loader2 className="w-9 h-9 text-rose-500 animate-spin mb-3" />
                <p className="text-sm text-secondary-hub">Carregando escala de férias…</p>
            </div>
        );
    }

    const tile = (label, value, sub, tone = '') => (
        <Card className="p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-hub">{label}</p>
            <p className={cn('font-brand text-3xl font-black tabular-nums mt-1', tone)}>{value}</p>
            <p className="text-[11px] text-muted-hub mt-0.5 truncate">{sub}</p>
        </Card>
    );

    return (
        <div className="flex-1 h-full overflow-y-auto bg-canvas text-primary-hub p-4 sm:p-6 lg:p-8 space-y-5">
            {/* Cabeçalho */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-rose-500 uppercase tracking-wider">
                        <Plane className="w-3.5 h-3.5" />
                        <span>Escalas • Planejamento anual</span>
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="font-brand text-2xl sm:text-3xl font-bold tracking-tight">Escala de Férias {VACATION_YEAR}</h1>
                        {readOnly && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-subtle text-secondary-hub border border-subtle">
                                <Eye className="w-3 h-3" /> Somente visualização
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-secondary-hub mt-1">Períodos de férias de toda a equipe, com cobertura por turno e conflitos.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={exportCSV} disabled={!visibleEntries.length} className="px-3.5 py-2.5 rounded-xl border border-subtle bg-surface hover:bg-subtle text-secondary-hub text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50">
                        <Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">Exportar CSV</span>
                    </button>
                    {!readOnly && (
                        <button type="button" onClick={() => openNew()} className="bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-rose-950/20 cursor-pointer active:scale-95">
                            <Plus className="w-4 h-4" /> Novo período
                        </button>
                    )}
                </div>
            </header>

            {/* Indicadores */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {tile('Períodos lançados', visibleEntries.length, `${summary.length} de ${visiblePeople.length} colaboradores`)}
                {tile('Sem férias lançadas', withoutVacation.length, withoutVacation.length ? 'ainda a planejar' : 'todos planejados', withoutVacation.length ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}
                {tile('Dias de férias (total)', totalPersonDays, busiest?.personDays ? `maior carga: ${busiest.name}` : 'nada lançado')}
                {tile('Conflitos de turno', conflicts.length, conflicts.length ? `${threshold}+ pessoas do mesmo turno` : 'nenhum detectado', conflicts.length ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}
            </div>

            {/* Controles */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <Tabs tabs={VIEWS} activeTab={view} onChange={setView} id="vacation-views" />
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap items-center gap-1">
                        {['all', ...shifts].map((s) => (
                            <button key={s} type="button" onClick={() => setShiftFilter(s)}
                                className={cn('px-2.5 py-1.5 rounded-lg text-xs font-bold border cursor-pointer transition-colors',
                                    shiftFilter === s ? 'bg-primary-hub text-white dark:text-zinc-950 border-transparent' : 'bg-surface text-secondary-hub border-subtle hover:text-primary-hub')}>
                                {s === 'all' ? 'Todos os turnos' : s}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-muted-hub absolute left-2.5 top-2.5" />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar colaborador…" aria-label="Buscar colaborador"
                            className="pl-8 pr-3 py-2 rounded-xl border border-subtle bg-surface text-xs text-primary-hub outline-none focus:ring-2 focus:ring-rose-500/30 w-48" />
                    </div>
                </div>
            </div>

            {/* ===== LINHA DO TEMPO ===== */}
            {view === 'timeline' && (
                <Card className="p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <div className="min-w-[960px]">
                            <div className="flex border-b border-subtle bg-subtle/60 text-[10px] font-bold uppercase tracking-wider text-muted-hub">
                                <div className="w-52 shrink-0 px-4 py-2.5">Colaborador</div>
                                <div className="flex-1 flex">
                                    {MONTH_SHORT.map((m, i) => (
                                        <div key={m} style={{ flex: MONTH_DAYS[i] }} className="py-2.5 text-center border-l border-subtle">{m}</div>
                                    ))}
                                </div>
                            </div>
                            {visiblePeople.length === 0 && <p className="p-8 text-center text-xs text-muted-hub">Nenhum colaborador para os filtros atuais.</p>}
                            {visiblePeople.map((p) => {
                                const s = summaryById.get(p.id);
                                const mine = visibleEntries.filter((e) => e.colabId === p.id);
                                return (
                                    <div key={p.id} className="flex border-b border-subtle last:border-b-0 hover:bg-subtle/40 transition-colors">
                                        <div className="w-52 shrink-0 px-4 py-2 flex items-center justify-between gap-2 min-w-0">
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold truncate" title={p.name}>{shortName(p.name)}</p>
                                                <p className="text-[10px] text-muted-hub truncate">{p.shift || '—'}</p>
                                            </div>
                                            {s ? (
                                                <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md border', s.hints.length ? STATUS_STYLE.pendente.chip : 'bg-subtle text-secondary-hub border-subtle')} title={s.hints.join(' ')}>
                                                    {s.days}d
                                                </span>
                                            ) : !readOnly ? (
                                                <button type="button" onClick={() => openNew(p.id)} className="text-[10px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer shrink-0">+ férias</button>
                                            ) : null}
                                        </div>
                                        <div className="flex-1 relative h-11">
                                            <div className="absolute inset-0 flex pointer-events-none">
                                                {MONTH_DAYS.map((d, i) => <div key={i} style={{ flex: d }} className={cn('border-l border-subtle', i % 2 ? 'bg-subtle/40' : '')} />)}
                                            </div>
                                            {mine.map((e) => {
                                                const st = STATUS_STYLE[e.status] || STATUS_STYLE.planejada;
                                                const days = countDays(e.start, e.end);
                                                const wide = yearSpan(e.start, e.end) > 6;
                                                return (
                                                    <button key={e.id} type="button" onClick={() => openEntry(e)}
                                                        title={`${p.name}\n${formatBR(e.start)} a ${formatBR(e.end)} · ${days} dia(s)\n${statusLabel(e.status)}${e.notes ? `\n${e.notes}` : ''}`}
                                                        className={cn('absolute top-2 h-7 rounded-lg border text-white text-[10px] font-bold px-1.5 overflow-hidden whitespace-nowrap text-left cursor-pointer hover:brightness-110 transition',
                                                            st.bar, conflictEntryIds.has(e.id) && 'ring-2 ring-rose-500 ring-offset-1 ring-offset-surface')}
                                                        style={{ left: `${yearPosition(e.start)}%`, width: `${yearSpan(e.start, e.end)}%`, minWidth: 8 }}>
                                                        {wide ? `${formatShortBR(e.start)}–${formatShortBR(e.end)} · ${days}d` : ''}
                                                    </button>
                                                );
                                            })}
                                            {mine.length === 0 && <span className="absolute inset-y-0 left-3 flex items-center text-[10px] text-muted-hub opacity-60">Sem férias lançadas</span>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-t border-subtle text-[11px] text-muted-hub">
                        {VACATION_STATUS.map((s) => (
                            <span key={s.id} className="inline-flex items-center gap-1.5"><span className={cn('w-3 h-3 rounded', STATUS_STYLE[s.id].bar.split(' ')[0])} />{s.label}</span>
                        ))}
                        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded ring-2 ring-rose-500" />Conflito no turno</span>
                        <span className="ml-auto">{readOnly ? 'Clique em uma barra para ver os detalhes.' : 'Clique em uma barra para editar.'}</span>
                    </div>
                </Card>
            )}

            {/* ===== LISTA ===== */}
            {view === 'list' && (
                <Card className="p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                            <thead className="bg-subtle/60 text-[10px] uppercase tracking-wider text-muted-hub">
                                <tr>
                                    {['Colaborador', 'Turno', 'Início', 'Fim', 'Dias', 'Situação', 'Observações', ''].map((h) => <th key={h} className="px-4 py-2.5 font-bold whitespace-nowrap">{h}</th>)}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-subtle">
                                {[...visibleEntries].sort((a, b) => a.start.localeCompare(b.start)).map((e) => (
                                    <tr key={e.id} className="hover:bg-subtle/50 group">
                                        <td className="px-4 py-2.5 font-bold whitespace-nowrap">{shortName(e.colabName)}</td>
                                        <td className="px-4 py-2.5 text-secondary-hub whitespace-nowrap">{e.shift || '—'}</td>
                                        <td className="px-4 py-2.5 font-mono whitespace-nowrap">{formatBR(e.start)}</td>
                                        <td className="px-4 py-2.5 font-mono whitespace-nowrap">{formatBR(e.end)}</td>
                                        <td className="px-4 py-2.5 font-mono font-bold">{countDays(e.start, e.end)}</td>
                                        <td className="px-4 py-2.5"><span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-bold', (STATUS_STYLE[e.status] || STATUS_STYLE.planejada).chip)}>{statusLabel(e.status)}</span></td>
                                        <td className="px-4 py-2.5 text-secondary-hub max-w-[220px] truncate" title={e.notes || ''}>{e.notes || <span className="opacity-50">—</span>}</td>
                                        <td className="px-4 py-2.5 text-right">
                                            <button type="button" onClick={() => openEntry(e)} className="p-1.5 rounded-lg text-muted-hub hover:text-primary-hub hover:bg-subtle cursor-pointer" aria-label={readOnly ? 'Ver detalhes' : 'Editar'}>
                                                {readOnly ? <Eye className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {visibleEntries.length === 0 && (
                                    <tr><td colSpan={8} className="p-10 text-center text-muted-hub">
                                        <CalendarRange className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                        Nenhum período lançado ainda.{!readOnly && ' Use “Novo período” para começar.'}
                                    </td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            )}

            {/* ===== COBERTURA ===== */}
            {view === 'coverage' && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    <Card className="p-4 sm:p-5 xl:col-span-2">
                        <h3 className="text-sm font-bold font-brand">Dias de férias por mês</h3>
                        <p className="text-[11px] text-muted-hub mb-3">Soma de dias-pessoa em cada mês; o pico é o maior nº de pessoas ausentes no mesmo dia.</p>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={load} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                                    <XAxis dataKey="short" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip content={({ active, payload }) => {
                                        if (!active || !payload?.length) return null;
                                        const d = payload[0].payload;
                                        return (
                                            <div className="bg-zinc-900 text-white p-3 rounded-xl text-xs space-y-1 border border-zinc-800">
                                                <p className="font-bold">{d.name}</p>
                                                <p>{d.personDays} dia(s) de férias</p>
                                                <p>{d.people} pessoa(s) · pico de {d.peak} no mesmo dia</p>
                                            </div>
                                        );
                                    }} />
                                    <Bar dataKey="personDays" radius={[6, 6, 0, 0]}>
                                        {load.map((d) => <Cell key={d.month} fill={d.peak >= threshold + 1 ? '#f43f5e' : d.personDays ? '#0ea5e9' : 'var(--border-subtle)'} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>

                    <Card className="p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <h3 className="text-sm font-bold font-brand flex items-center gap-1.5"><ShieldAlert className="w-4 h-4 text-rose-500" />Conflitos por turno</h3>
                            <select value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} aria-label="Limite de ausências simultâneas" className="text-xs bg-subtle border border-subtle rounded-lg px-2 py-1 text-primary-hub cursor-pointer">
                                {[2, 3, 4].map((n) => <option key={n} value={n}>{n}+ pessoas</option>)}
                            </select>
                        </div>
                        <p className="text-[11px] text-muted-hub mb-3">Dias em que o mesmo turno fica com {threshold} ou mais pessoas de férias.</p>
                        {conflicts.length === 0 ? (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />Nenhum conflito detectado.</p>
                        ) : (
                            <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {conflicts.map((c, i) => (
                                    <li key={i} className="rounded-xl border border-rose-500/25 bg-rose-500/5 p-2.5 text-xs">
                                        <p className="font-bold">{c.shift} · {formatShortBR(c.start)}{c.end !== c.start ? ` a ${formatShortBR(c.end)}` : ''}</p>
                                        <p className="text-secondary-hub">{c.names.join(', ')}</p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    <Card className="p-4 sm:p-5 xl:col-span-3">
                        <h3 className="text-sm font-bold font-brand flex items-center gap-1.5"><Users className="w-4 h-4 text-sky-500" />Situação por colaborador</h3>
                        <p className="text-[11px] text-muted-hub mb-3">Dias lançados em relação aos 30 do direito anual. Os avisos seguem as regras de fracionamento (até 3 períodos, um com 14+ dias e os demais com 5+).</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                            {visiblePeople.map((p) => {
                                const s = summaryById.get(p.id);
                                const days = s?.days || 0;
                                return (
                                    <div key={p.id} className="rounded-xl border border-subtle bg-subtle/40 p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-xs font-bold truncate">{shortName(p.name)}</p>
                                            <Badge size="sm" variant={days === 0 ? 'neutral' : days > 30 ? 'danger' : days === 30 ? 'success' : 'info'}>{days}/30 d</Badge>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-subtle overflow-hidden mt-2">
                                            <div className={cn('h-full rounded-full', days > 30 ? 'bg-rose-500' : days === 30 ? 'bg-emerald-500' : 'bg-sky-500')} style={{ width: `${Math.min(100, (days / 30) * 100)}%` }} />
                                        </div>
                                        {s?.hints.map((h) => <p key={h} className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 flex gap-1"><AlertTriangle className="w-3 h-3 shrink-0" />{h}</p>)}
                                        {!s && <p className="text-[10px] text-muted-hub mt-1.5">Sem férias lançadas.</p>}
                                    </div>
                                );
                            })}
                        </div>
                        {hintCount > 0 && <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-3">{hintCount} aviso(s) de regra — são apenas orientações, nada bloqueia o lançamento.</p>}
                    </Card>
                </div>
            )}

            {modal && (
                <PeriodModal
                    initial={modal.initial}
                    people={people}
                    entries={entries}
                    readOnly={readOnly}
                    saving={saving}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    onClose={() => setModal(null)}
                />
            )}
        </div>
    );
}

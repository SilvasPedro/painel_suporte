import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    CalendarDays, Plus, ChevronLeft, ChevronRight, MapPin, Clock, Users, Check, X, Trash2, Edit2,
    Loader2, Search, AlertTriangle, CheckCircle2, XCircle, Hourglass, BellRing, Eye,
} from 'lucide-react';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeSharedCollection } from '../services/dataCache';
import { sendAgendaInviteDm } from '../services/discordDm';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { Badge, Modal, EmptyState } from '../components/ui';
import { cn } from '../utils/cn';
import { MONTH_NAMES, toISO, formatBR } from '../utils/vacationSchedule';
import {
    AGENDA_COLLECTION, newEventId, validateEvent, buildEventPayload, idsToNotify, myResponse,
    eventsForUser, upcomingEvents, pendingInvites, summarizeResponses, monthGrid, eventsByDay, sortEvents,
    participantConflicts, formatEventWhen, responseLabel, MAX_PARTICIPANTS,
} from '../utils/agenda';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const STATUS_BADGE = { pendente: 'warning', confirmado: 'success', recusado: 'danger' };
const STATUS_ICON = { pendente: Hourglass, confirmado: CheckCircle2, recusado: XCircle };
const CHIP_STYLE = {
    pendente: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
    confirmado: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
    recusado: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20 line-through opacity-70',
    organizador: 'bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-500/30',
};

const chipKey = (event, uid) => myResponse(event, uid) || 'organizador';

// ───────────────────────── Modal de evento (criar/editar) ─────────────────────────
function EventModal({ initial, people, events, saving, onSave, onClose }) {
    const isEditing = Boolean(initial?.id);
    const [form, setForm] = useState({
        title: initial?.title || '',
        description: initial?.description || '',
        location: initial?.location || '',
        date: initial?.date || '',
        startTime: initial?.startTime || '',
        endTime: initial?.endTime || '',
        participantIds: initial?.participantIds || [],
        remind: initial ? initial.remind === true : true, // evento novo já vem com lembrete ligado
    });
    const [query, setQuery] = useState('');
    const [errors, setErrors] = useState([]);
    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return people.filter((p) => !q || p.name.toLowerCase().includes(q) || p.shift.toLowerCase().includes(q));
    }, [people, query]);

    const toggle = (id) => setForm((f) => ({
        ...f,
        participantIds: f.participantIds.includes(id) ? f.participantIds.filter((x) => x !== id) : [...f.participantIds, id],
    }));
    const selectFiltered = () => setForm((f) => ({ ...f, participantIds: [...new Set([...f.participantIds, ...filtered.map((p) => p.id)])] }));
    const clearAll = () => setForm((f) => ({ ...f, participantIds: [] }));

    const nameById = useMemo(() => Object.fromEntries(people.map((p) => [p.id, p.name])), [people]);
    const conflicts = useMemo(
        () => participantConflicts(events, { id: initial?.id, ...form }, form.participantIds),
        [events, form, initial?.id],
    );
    const conflictList = Object.entries(conflicts);

    const submit = () => {
        const found = validateEvent(form);
        setErrors(found);
        if (found.length) return;
        onSave({ ...form, participantNames: nameById });
    };

    const inputCls = 'w-full px-3 py-2 bg-subtle border border-subtle rounded-xl text-xs text-primary-hub outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 placeholder:text-muted-hub';

    return (
        <Modal
            isOpen
            onClose={onClose}
            size="lg"
            title={isEditing ? 'Editar evento' : 'Novo evento'}
            description="Quem for marcado recebe um aviso na DM do Discord e confirma ou recusa na tela de Agenda."
            footer={(
                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-bold text-secondary-hub hover:bg-subtle cursor-pointer">Cancelar</button>
                    <button type="button" onClick={submit} disabled={saving}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50 inline-flex items-center gap-2">
                        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {isEditing ? 'Salvar alterações' : 'Criar e convidar'}
                    </button>
                </div>
            )}
        >
            <div className="space-y-3">
                {errors.length > 0 && (
                    <div role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 space-y-0.5">
                        {errors.map((e) => <p key={e}>• {e}</p>)}
                    </div>
                )}
                <label className="block">
                    <span className="text-[11px] font-bold text-secondary-hub">Título</span>
                    <input value={form.title} onChange={set('title')} maxLength={120} placeholder="Ex.: Treinamento do Huggy" className={cn(inputCls, 'mt-1')} />
                </label>
                <div className="grid grid-cols-3 gap-2">
                    <label className="block col-span-3 sm:col-span-1">
                        <span className="text-[11px] font-bold text-secondary-hub">Data</span>
                        <input type="date" value={form.date} onChange={set('date')} className={cn(inputCls, 'mt-1')} />
                    </label>
                    <label className="block">
                        <span className="text-[11px] font-bold text-secondary-hub">Início</span>
                        <input type="time" value={form.startTime} onChange={set('startTime')} className={cn(inputCls, 'mt-1')} />
                    </label>
                    <label className="block">
                        <span className="text-[11px] font-bold text-secondary-hub">Término (opcional)</span>
                        <input type="time" value={form.endTime} onChange={set('endTime')} className={cn(inputCls, 'mt-1')} />
                    </label>
                </div>
                <label className="block">
                    <span className="text-[11px] font-bold text-secondary-hub">Local ou link (opcional)</span>
                    <input value={form.location} onChange={set('location')} maxLength={120} placeholder="Sala 2, Google Meet..." className={cn(inputCls, 'mt-1')} />
                </label>
                <label className="block">
                    <span className="text-[11px] font-bold text-secondary-hub">Descrição (opcional)</span>
                    <textarea value={form.description} onChange={set('description')} maxLength={1000} rows={2} className={cn(inputCls, 'mt-1 resize-none')} />
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-subtle cursor-pointer hover:bg-subtle">
                    <input type="checkbox" checked={form.remind} onChange={(e) => setForm((f) => ({ ...f, remind: e.target.checked }))} className="w-4 h-4 mt-0.5 accent-rose-600" />
                    <span className="text-xs">
                        <span className="font-bold text-primary-hub flex items-center gap-1.5"><BellRing className="w-3.5 h-3.5 text-rose-600" />Enviar lembretes na DM do Discord</span>
                        <span className="block text-[11px] text-muted-hub mt-0.5">Organizador e convidados que não recusaram recebem um aviso 15 minutos antes e outro no horário de início.</span>
                    </span>
                </label>

                <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[11px] font-bold text-secondary-hub">
                            Participantes <span className="font-mono text-muted-hub">({form.participantIds.length}/{MAX_PARTICIPANTS})</span>
                        </span>
                        <div className="flex gap-1">
                            <button type="button" onClick={selectFiltered} className="px-2 py-1 rounded-lg text-[10px] font-bold text-rose-600 hover:bg-rose-500/10 cursor-pointer">Marcar {query ? 'filtrados' : 'todos'}</button>
                            <button type="button" onClick={clearAll} className="px-2 py-1 rounded-lg text-[10px] font-bold text-muted-hub hover:bg-subtle cursor-pointer">Limpar</button>
                        </div>
                    </div>
                    <div className="relative mb-2">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-hub" />
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou turno..." className={cn(inputCls, 'pl-8')} />
                    </div>
                    <div className="max-h-52 overflow-y-auto rounded-xl border border-subtle divide-y divide-subtle">
                        {filtered.length === 0 && <p className="p-3 text-xs text-muted-hub">Nenhum colaborador encontrado.</p>}
                        {filtered.map((p) => {
                            const checked = form.participantIds.includes(p.id);
                            return (
                                <label key={p.id} className={cn('flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-subtle', checked && 'bg-rose-500/5')}>
                                    <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} className="w-4 h-4 accent-rose-600" />
                                    <span className="font-semibold text-primary-hub flex-1 truncate">{p.name}</span>
                                    {p.shift && <span className="text-[10px] text-muted-hub">{p.shift}</span>}
                                </label>
                            );
                        })}
                    </div>
                </div>

                {conflictList.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-900 dark:text-amber-200 space-y-0.5">
                        <p className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Já têm outro evento neste horário:</p>
                        {conflictList.map(([id, titles]) => <p key={id}>• {nameById[id] || id}: {titles.join(', ')}</p>)}
                    </div>
                )}
                {isEditing && (
                    <p className="text-[11px] text-muted-hub">Se você mudar a data ou o horário, as respostas voltam para "aguardando" e os convidados recebem um novo aviso.</p>
                )}
            </div>
        </Modal>
    );
}

// ───────────────────────── Cartão de evento ─────────────────────────
function EventCard({ event, myId, canManage, busy, onRespond, onEdit, onDelete }) {
    const [open, setOpen] = useState(false);
    const mine = myResponse(event, myId);
    const counts = summarizeResponses(event);
    const MineIcon = mine ? STATUS_ICON[mine] : null;

    return (
        <div className="bg-surface border border-subtle rounded-2xl p-4 space-y-3 hover:border-rose-500/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h4 className="text-sm font-black text-primary-hub tracking-tight break-words">{event.title}</h4>
                    <p className="text-xs text-secondary-hub mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <Clock className="w-3.5 h-3.5 text-muted-hub" />{formatEventWhen(event)}
                        {event.location && <><span className="text-muted-hub">·</span><MapPin className="w-3.5 h-3.5 text-muted-hub" />{event.location}</>}
                    </p>
                </div>
                {mine && (
                    <Badge variant={STATUS_BADGE[mine]} size="sm" icon={MineIcon}>{responseLabel(mine)}</Badge>
                )}
            </div>

            {event.description && <p className="text-xs text-secondary-hub whitespace-pre-line">{event.description}</p>}

            <p className="text-[11px] text-muted-hub">Marcado por <strong className="text-secondary-hub">{event.creatorName || 'Gestão'}</strong></p>

            {mine && (
                <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy || mine === 'confirmado'} onClick={() => onRespond(event, 'confirmado')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer disabled:opacity-40 disabled:cursor-default">
                        <Check className="w-3.5 h-3.5" />Confirmar presença
                    </button>
                    <button type="button" disabled={busy || mine === 'recusado'} onClick={() => onRespond(event, 'recusado')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 cursor-pointer disabled:opacity-40 disabled:cursor-default">
                        <X className="w-3.5 h-3.5" />Recusar
                    </button>
                </div>
            )}

            {canManage && (
                <div className="pt-2 border-t border-subtle space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
                            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-secondary-hub hover:text-primary-hub cursor-pointer">
                            <Users className="w-3.5 h-3.5" />
                            {counts.confirmado} confirmaram · {counts.pendente} aguardando · {counts.recusado} recusaram
                        </button>
                        <div className="flex gap-1">
                            <button type="button" onClick={() => onEdit(event)} aria-label="Editar evento" className="p-1.5 rounded-lg text-secondary-hub hover:bg-subtle cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button type="button" onClick={() => onDelete(event)} aria-label="Excluir evento" className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-500/10 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                    </div>
                    {open && (
                        <ul className="grid sm:grid-cols-2 gap-1.5">
                            {event.participantIds.map((id) => {
                                const r = event.responses?.[id];
                                const status = r?.status || 'pendente';
                                return (
                                    <li key={id} className="flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5 rounded-lg bg-subtle">
                                        <span className="truncate font-semibold text-primary-hub">{r?.name || id}</span>
                                        <Badge variant={STATUS_BADGE[status]} size="sm">{responseLabel(status)}</Badge>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}

// ───────────────────────── Página ─────────────────────────
const Agenda = ({ readOnly = false }) => {
    const { currentUser } = useAuth();
    const { showToast } = useNotification();
    const myId = currentUser?.firestoreId || currentUser?.uid || '';
    const myName = currentUser?.name || currentUser?.displayName || '';
    const canManage = !readOnly;

    const today = toISO(new Date());
    const [cursor, setCursor] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
    const [selectedDay, setSelectedDay] = useState(null);
    const [events, setEvents] = useState([]);
    const [people, setPeople] = useState([]);
    const [loading, setLoading] = useState(true);
    const [scope, setScope] = useState('meus'); // 'meus' | 'todos' (só quem gerencia)
    const [modal, setModal] = useState(null);
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState('');

    useEffect(() => {
        if (!myId) return undefined;
        // Gestão lê todos os eventos; os demais só leem os próprios convites (exigência das regras do Firestore)
        const options = canManage ? {} : { where: [['participantIds', 'array-contains', myId]] };
        const unsubE = subscribeSharedCollection(AGENDA_COLLECTION, (items) => {
            setEvents(items);
            setLoading(false);
        }, options);
        const unsubC = canManage
            ? subscribeSharedCollection('collaborators', (items) => {
                setPeople(items
                    .filter((c) => c.active !== false && String(c.status || '').toLowerCase() !== 'inativo')
                    .map((c) => ({ id: c.id || c.firestoreId || c.uid, name: c.name || c.email?.split('@')[0] || 'Colaborador', shift: c.shift || '' }))
                    .sort((a, b) => a.name.localeCompare(b.name)));
            })
            : () => {};
        const t = setTimeout(() => setLoading(false), 2000);
        return () => { unsubE(); unsubC(); clearTimeout(t); };
    }, [myId, canManage]);

    const visible = useMemo(
        () => (canManage && scope === 'todos' ? events : eventsForUser(events, myId)),
        [events, myId, canManage, scope],
    );
    const byDay = useMemo(() => eventsByDay(visible), [visible]);
    const invites = useMemo(() => pendingInvites(events, myId, today), [events, myId, today]);
    const grid = useMemo(() => monthGrid(cursor.y, cursor.m), [cursor]);

    const listed = selectedDay ? (byDay[selectedDay] || []) : upcomingEvents(visible, today).slice(0, 10);

    const moveMonth = (delta) => setCursor(({ y, m }) => {
        const d = new Date(y, m + delta, 1);
        return { y: d.getFullYear(), m: d.getMonth() };
    });

    const respond = useCallback(async (event, status) => {
        setBusyId(event.id);
        try {
            await updateDoc(doc(db, AGENDA_COLLECTION, event.id), {
                [`responses.${myId}`]: { status, name: myName, at: new Date().toISOString() },
            });
            showToast(status === 'confirmado' ? 'Presença confirmada!' : 'Convite recusado.', status === 'confirmado' ? 'success' : 'info');
        } catch (error) {
            console.error('Erro ao responder convite:', error);
            showToast('Não foi possível registrar sua resposta. Tente novamente.', 'error');
        } finally {
            setBusyId('');
        }
    }, [myId, myName, showToast]);

    const save = async (form) => {
        setSaving(true);
        try {
            const existing = modal?.event || null;
            const id = existing?.id || newEventId();
            const { payload, newlyInvitedIds, resetIds } = buildEventPayload(form, { id: myId, name: myName }, existing);
            await setDoc(doc(db, AGENDA_COLLECTION, id), payload);
            setModal(null);
            showToast(existing ? 'Evento atualizado!' : 'Evento criado! Os convidados serão avisados na DM do Discord.', 'success');

            // Convite novo e reagendamento têm textos diferentes; a função lê o evento salvo no servidor
            const invited = idsToNotify({ newlyInvitedIds }, myId);
            const rescheduled = idsToNotify({ resetIds }, myId);
            if (invited.length) void sendAgendaInviteDm({ eventId: id, recipientIds: invited });
            if (rescheduled.length) void sendAgendaInviteDm({ eventId: id, recipientIds: rescheduled, rescheduled: true });
        } catch (error) {
            console.error('Erro ao salvar evento:', error);
            // Só culpa a permissão quando foi mesmo o Firestore que recusou
            showToast(error?.code === 'permission-denied'
                ? 'Sem permissão para salvar o evento. Confira se as regras do Firestore foram publicadas e se o seu cargo é Gestor.'
                : `Erro ao salvar o evento: ${error?.message || 'tente novamente'}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const remove = async (event) => {
        if (!window.confirm(`Excluir o evento "${event.title}"? Os convidados deixarão de vê-lo.`)) return;
        try {
            await deleteDoc(doc(db, AGENDA_COLLECTION, event.id));
            showToast('Evento excluído.', 'success');
        } catch (error) {
            console.error('Erro ao excluir evento:', error);
            showToast('Não foi possível excluir o evento.', 'error');
        }
    };

    return (
        <div className="flex-1 p-4 sm:p-6 lg:p-8 bg-canvas text-primary-hub min-h-full overflow-y-auto font-sans">
            <div className="max-w-6xl mx-auto space-y-6">
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center justify-center"><CalendarDays className="w-5 h-5" /></div>
                        <div>
                            <h1 className="font-brand text-xl font-black tracking-tight">Agenda</h1>
                            <p className="text-xs text-secondary-hub">{canManage ? 'Marque eventos e convide a equipe. Os convidados são avisados na DM do Discord.' : 'Seus convites e eventos da equipe.'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {canManage && (
                            <div role="group" aria-label="Quais eventos exibir" className="flex p-1 bg-subtle rounded-xl">
                                {[['meus', 'Meus eventos'], ['todos', 'Todos']].map(([id, label]) => (
                                    <button key={id} type="button" aria-pressed={scope === id} onClick={() => setScope(id)}
                                        className={cn('px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer', scope === id ? 'bg-surface shadow-xs text-primary-hub' : 'text-muted-hub')}>{label}</button>
                                ))}
                            </div>
                        )}
                        {canManage && (
                            <button type="button" onClick={() => setModal({ event: null })}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold cursor-pointer">
                                <Plus className="w-4 h-4" />Novo evento
                            </button>
                        )}
                    </div>
                </header>

                {readOnly && (
                    <div className="p-3 rounded-xl bg-subtle border border-subtle text-[11px] text-secondary-hub flex items-center gap-2"><Eye className="w-3.5 h-3.5" />Somente a Gestão cria e edita eventos. Aqui você confirma ou recusa seus convites.</div>
                )}

                {invites.length > 0 && (
                    <section aria-label="Convites pendentes" className="space-y-3">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-amber-600 flex items-center gap-2"><BellRing className="w-4 h-4" />Convites aguardando sua resposta ({invites.length})</h2>
                        <div className="grid md:grid-cols-2 gap-3">
                            {invites.map((e) => (
                                <EventCard key={e.id} event={e} myId={myId} canManage={false} busy={busyId === e.id} onRespond={respond} />
                            ))}
                        </div>
                    </section>
                )}

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Calendário */}
                    <section aria-label="Calendário" className="lg:col-span-2 bg-surface border border-subtle rounded-3xl p-4 sm:p-5">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="font-brand text-base font-black tracking-tight">{MONTH_NAMES[cursor.m]} <span className="text-muted-hub font-semibold">{cursor.y}</span></h2>
                            <div className="flex gap-1">
                                <button type="button" onClick={() => moveMonth(-1)} aria-label="Mês anterior" className="p-2 rounded-xl hover:bg-subtle cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
                                <button type="button" onClick={() => { const n = new Date(); setCursor({ y: n.getFullYear(), m: n.getMonth() }); setSelectedDay(today); }} className="px-3 rounded-xl text-[11px] font-bold hover:bg-subtle cursor-pointer">Hoje</button>
                                <button type="button" onClick={() => moveMonth(1)} aria-label="Próximo mês" className="p-2 rounded-xl hover:bg-subtle cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wider text-muted-hub mb-1">
                            {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {grid.map((cell) => {
                                const dayEvents = byDay[cell.iso] || [];
                                const isToday = cell.iso === today;
                                const isSelected = cell.iso === selectedDay;
                                return (
                                    <button key={cell.iso} type="button" onClick={() => setSelectedDay(isSelected ? null : cell.iso)}
                                        aria-label={`${formatBR(cell.iso)}${dayEvents.length ? `, ${dayEvents.length} evento(s)` : ''}`} aria-pressed={isSelected}
                                        className={cn(
                                            'min-h-[68px] sm:min-h-[84px] p-1 rounded-xl border text-left flex flex-col gap-0.5 cursor-pointer transition-colors',
                                            cell.inMonth ? 'bg-canvas/50' : 'bg-transparent opacity-40',
                                            isSelected ? 'border-rose-500 ring-1 ring-rose-500' : 'border-subtle hover:border-rose-500/40',
                                        )}>
                                        <span className={cn('text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full', isToday ? 'bg-rose-600 text-white' : 'text-secondary-hub')}>{cell.day}</span>
                                        {dayEvents.slice(0, 2).map((e) => (
                                            <span key={e.id} className={cn('hidden sm:block truncate text-[10px] font-semibold px-1 rounded border', CHIP_STYLE[chipKey(e, myId)])}>{e.startTime} {e.title}</span>
                                        ))}
                                        {dayEvents.length > 0 && <span className="sm:hidden w-1.5 h-1.5 rounded-full bg-rose-500 mx-auto" />}
                                        {dayEvents.length > 2 && <span className="hidden sm:block text-[10px] text-muted-hub font-semibold">+{dayEvents.length - 2}</span>}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex flex-wrap gap-3 mt-3 text-[10px] text-muted-hub font-semibold">
                            {[['confirmado', 'Confirmado'], ['pendente', 'Aguardando'], ['recusado', 'Recusado'], ['organizador', 'Marcado por você']].map(([k, label]) => (
                                <span key={k} className="inline-flex items-center gap-1"><span className={cn('w-2.5 h-2.5 rounded border', CHIP_STYLE[k].split(' ').filter((c) => !c.startsWith('line-through') && !c.startsWith('opacity')).join(' '))} />{label}</span>
                            ))}
                        </div>
                    </section>

                    {/* Lista do dia ou próximos */}
                    <section aria-label={selectedDay ? `Eventos de ${formatBR(selectedDay)}` : 'Próximos eventos'} className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-secondary-hub">
                                {selectedDay ? `Eventos de ${formatBR(selectedDay)}` : 'Próximos eventos'}
                            </h2>
                            {selectedDay && <button type="button" onClick={() => setSelectedDay(null)} className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer">Ver próximos</button>}
                        </div>
                        {loading ? (
                            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-hub" /></div>
                        ) : listed.length === 0 ? (
                            <EmptyState icon={CalendarDays} title={selectedDay ? 'Nenhum evento neste dia' : 'Nenhum evento próximo'}
                                description={canManage ? 'Use "Novo evento" para marcar e convidar a equipe.' : 'Quando a Gestão marcar um evento com você, ele aparece aqui.'} />
                        ) : (
                            sortEvents(listed).map((e) => (
                                <EventCard key={e.id} event={e} myId={myId} canManage={canManage} busy={busyId === e.id}
                                    onRespond={respond} onEdit={(ev) => setModal({ event: ev })} onDelete={remove} />
                            ))
                        )}
                    </section>
                </div>
            </div>

            {modal && (
                <EventModal initial={modal.event} people={people} events={events} saving={saving} onSave={save} onClose={() => setModal(null)} />
            )}
        </div>
    );
};

export default Agenda;

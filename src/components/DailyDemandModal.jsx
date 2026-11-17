import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { Save, Calendar, Clock, Activity, AlertCircle, X, Check, ChevronLeft, ChevronRight, Ticket, MessageSquare, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { db } from '../services/firebase';
import { BorderBeam } from './magicui/BorderBeam';

const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const parseLocal = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};
const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shiftDate = (s, delta) => {
    const d = parseLocal(s);
    d.setDate(d.getDate() + delta);
    return toISO(d);
};
const formatDisplayDate = (s) => {
    if (!s) return '--';
    const p = s.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : s;
};

const fieldsFrom = (rec) => ({
    startTickets: rec?.startTickets ?? '',
    startChats: rec?.startChats ?? '',
    endTickets: rec?.endTickets ?? '',
    endChats: rec?.endChats ?? '',
    notes: rec?.notes ?? '',
});

const ORDER = ['startTickets', 'startChats', 'endTickets', 'endChats', 'notes'];

const numInput =
    'w-full px-3 py-2.5 bg-surface border border-subtle rounded-xl outline-none text-lg font-mono font-bold text-primary-hub placeholder:text-muted-hub/60 focus:ring-2 transition-shadow';

/** Cartinha de diferença (fim − início). */
const DeltaBox = ({ label, value }) => {
    if (value === null) {
        return (
            <div className="rounded-xl border border-subtle bg-subtle px-3 py-2 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-hub">{label}</p>
                <p className="font-mono text-lg font-black text-muted-hub">--</p>
            </div>
        );
    }
    const good = value <= 0;
    const Icon = value < 0 ? TrendingDown : value > 0 ? TrendingUp : Minus;
    return (
        <div className={`rounded-xl border px-3 py-2 text-center ${good ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/30 bg-rose-500/10'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-hub">{label}</p>
            <p className={`font-mono text-lg font-black inline-flex items-center gap-1 ${good ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                <Icon className="w-4 h-4" />
                {value > 0 ? `+${value}` : value}
            </p>
        </div>
    );
};

/**
 * Modal de lançamento/edição da demanda diária.
 * Estado do formulário isolado (digitar aqui não re-renderiza a página), navegação entre dias,
 * Enter avança entre campos, saldo projetado em destaque e visual compatível com os temas.
 */
export default function DailyDemandModal({ initialDate, initialFocus = 'startTickets', historicalData, onClose }) {
    const [date, setDate] = useState(initialDate);
    const [isEditing, setIsEditing] = useState(() => historicalData.some((d) => d.date === initialDate));
    const [fields, setFields] = useState(() => fieldsFrom(historicalData.find((d) => d.date === initialDate)));
    const { startTickets, startChats, endTickets, endChats, notes } = fields;
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    const refs = useRef({});
    const todayISO = toISO(new Date());

    const setField = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.value }));

    // Foco inicial inteligente + Esc fecha
    useEffect(() => {
        const el = refs.current[initialFocus];
        if (el) { el.focus(); el.select?.(); }
    }, [initialFocus]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Troca de data: carrega o registro existente ou limpa o formulário
    const goToDate = (newDate) => {
        if (!newDate) return;
        setDate(newDate);
        const existing = historicalData.find((d) => d.date === newDate);
        setIsEditing(Boolean(existing));
        setFields(fieldsFrom(existing));
        setMessage({ text: '', type: '' });
    };

    // Enter avança para o próximo campo; no último, deixa o formulário enviar
    const handleEnter = (key) => (e) => {
        if (e.key !== 'Enter') return;
        const i = ORDER.indexOf(key);
        if (i < ORDER.length - 1) {
            e.preventDefault();
            const next = refs.current[ORDER[i + 1]];
            next?.focus();
            next?.select?.();
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (startTickets === '' && startChats === '' && endTickets === '' && endChats === '') {
            setMessage({ text: 'Erro: Preencha pelo menos um dos campos de chamados ou chats.', type: 'error' });
            return;
        }
        setIsSaving(true);
        setMessage({ text: '', type: '' });
        try {
            await setDoc(doc(db, 'dailyDemand', date), {
                date,
                startTickets: startTickets !== '' ? Number(startTickets) : null,
                startChats: startChats !== '' ? Number(startChats) : null,
                endTickets: endTickets !== '' ? Number(endTickets) : null,
                endChats: endChats !== '' ? Number(endChats) : null,
                notes: String(notes).trim() !== '' ? String(notes).trim() : null,
                updatedAt: new Date().toISOString(),
            }, { merge: true });
            setMessage({ text: 'Registro diário salvo com sucesso!', type: 'success' });
            setTimeout(onClose, 1200);
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
            setMessage({ text: 'Erro ao salvar. Verifique a conexão com o banco.', type: 'error' });
        } finally {
            setIsSaving(false);
        }
    };

    // Saldo projetado (fim − início) por canal e total
    const has = (v) => v !== '';
    const dTickets = has(startTickets) && has(endTickets) ? Number(endTickets) - Number(startTickets) : null;
    const dChats = has(startChats) && has(endChats) ? Number(endChats) - Number(startChats) : null;
    const anyFilled = has(startTickets) || has(endTickets) || has(startChats) || has(endChats);
    const dTotal = (has(endTickets) || has(endChats)) && (has(startTickets) || has(startChats))
        ? ((Number(endTickets) || 0) + (Number(endChats) || 0)) - ((Number(startTickets) || 0) + (Number(startChats) || 0))
        : null;

    const weekday = WEEKDAYS[parseLocal(date).getDay()];

    const field = (key, label, icon, ring) => {
        const Icon = icon;
        return (
        <div>
            <label htmlFor={`dd-${key}`} className="flex items-center gap-1 text-[11px] text-secondary-hub mb-1 font-semibold">
                <Icon className="w-3 h-3 opacity-70" /> {label}
            </label>
            <input
                id={`dd-${key}`}
                ref={(el) => { refs.current[key] = el; }}
                type="number"
                inputMode="numeric"
                min="0"
                value={fields[key]}
                onChange={setField(key)}
                onKeyDown={handleEnter(key)}
                placeholder="0"
                className={`${numInput} ${ring}`}
            />
        </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="relative bg-surface text-primary-hub rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[94vh] overflow-y-auto border border-subtle animate-in fade-in zoom-in-95 duration-200">
                <BorderBeam size={180} duration={8} colorFrom="#f43f5e" colorTo="#e11d48" borderWidth={1.5} />

                {/* Cabeçalho + navegação de dia */}
                <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm p-4 sm:p-5 border-b border-subtle">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                                <Activity className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-sm font-bold tracking-tight">{isEditing ? 'Editar registro diário' : 'Novo registro de demanda'}</h2>
                                <span className={`inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${isEditing ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30' : 'bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/30'}`}>
                                    {isEditing ? 'Já existe lançamento neste dia' : 'Sem lançamento neste dia'}
                                </span>
                            </div>
                        </div>
                        <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 text-muted-hub hover:text-primary-hub rounded-lg transition-colors cursor-pointer">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="mt-3 flex items-center gap-1.5">
                        <button type="button" onClick={() => goToDate(shiftDate(date, -1))} aria-label="Dia anterior" className="p-2 rounded-xl border border-subtle bg-subtle hover:bg-surface text-secondary-hub cursor-pointer">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex-1 min-w-0">
                            <div className="relative">
                                <Calendar className="w-3.5 h-3.5 text-rose-500 absolute left-3 top-3 pointer-events-none" />
                                <input
                                    type="date"
                                    value={date}
                                    max={todayISO}
                                    onChange={(e) => goToDate(e.target.value)}
                                    required
                                    className="w-full pl-8 pr-2 py-2 bg-surface border border-subtle rounded-xl text-sm font-semibold text-primary-hub outline-none focus:ring-2 focus:ring-rose-500/30"
                                />
                            </div>
                        </div>
                        <button type="button" onClick={() => goToDate(shiftDate(date, 1))} disabled={date >= todayISO} aria-label="Próximo dia" className="p-2 rounded-xl border border-subtle bg-subtle hover:bg-surface text-secondary-hub cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={() => goToDate(todayISO)} disabled={date === todayISO} className="px-3 py-2 rounded-xl border border-subtle bg-subtle hover:bg-surface text-xs font-bold text-secondary-hub cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                            Hoje
                        </button>
                    </div>
                    <p className="text-[11px] text-muted-hub mt-1.5 pl-1">{weekday} · {formatDisplayDate(date)}</p>
                </div>

                <div className="p-4 sm:p-5 space-y-4">
                    {message.text && (
                        <div role="status" className={`p-3 rounded-xl text-xs flex items-center gap-2 font-medium border ${message.type === 'error' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'}`}>
                            {message.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
                            <span>{message.text}</span>
                        </div>
                    )}

                    <form onSubmit={handleSave} className="space-y-4">
                        {/* Início do expediente */}
                        <div className="p-3.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 space-y-3">
                            <h3 className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> Início do expediente (abertura da fila)
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {field('startTickets', 'Chamados pendentes', Ticket, 'focus:ring-emerald-500/30 focus:border-emerald-500')}
                                {field('startChats', 'Chats na fila', MessageSquare, 'focus:ring-emerald-500/30 focus:border-emerald-500')}
                            </div>
                        </div>

                        {/* Fim do expediente */}
                        <div className="p-3.5 rounded-2xl border border-indigo-500/25 bg-indigo-500/5 space-y-3">
                            <h3 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" /> Fim do expediente (encerramento da fila)
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {field('endTickets', 'Chamados pendentes', Ticket, 'focus:ring-indigo-500/30 focus:border-indigo-500')}
                                {field('endChats', 'Chats na fila', MessageSquare, 'focus:ring-indigo-500/30 focus:border-indigo-500')}
                            </div>
                        </div>

                        {/* Observações */}
                        <div>
                            <label htmlFor="dd-notes" className="block text-[11px] font-bold text-secondary-hub uppercase tracking-wider mb-1">Observações do dia (opcional)</label>
                            <input
                                id="dd-notes"
                                ref={(el) => { refs.current.notes = el; }}
                                type="text"
                                value={notes}
                                onChange={setField('notes')}
                                onKeyDown={handleEnter('notes')}
                                placeholder="Ex: queda de link, feriado municipal…"
                                maxLength={150}
                                className="w-full px-3 py-2.5 bg-surface border border-subtle rounded-xl outline-none text-sm text-primary-hub placeholder:text-muted-hub/60 focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500"
                            />
                        </div>

                        {/* Saldo projetado em destaque */}
                        {anyFilled && (
                            <div className="rounded-2xl border border-subtle bg-subtle p-3">
                                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-hub mb-2">Saldo projetado do dia</p>
                                <div className="grid grid-cols-3 gap-2">
                                    <DeltaBox label="Chamados" value={dTickets} />
                                    <DeltaBox label="Chats" value={dChats} />
                                    <DeltaBox label="Total" value={dTotal} />
                                </div>
                                {dTotal !== null && (
                                    <p className={`text-center text-xs font-bold mt-2 ${dTotal <= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                                        {dTotal <= 0 ? 'A fila fechou menor ou igual ao início' : 'A fila acumulou durante o dia'}
                                    </p>
                                )}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-md shadow-rose-950/20 cursor-pointer disabled:opacity-50"
                        >
                            {isSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>{isSaving ? 'Salvando...' : isEditing ? 'Atualizar registro' : 'Salvar registro'}</span>
                        </button>
                        <p className="text-center text-[10px] text-muted-hub -mt-2">Enter avança entre os campos · Enter no último salva · Esc fecha</p>
                    </form>
                </div>
            </div>
        </div>
    );
}

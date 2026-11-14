import React, { useEffect, useRef, useState } from 'react';
import { Plus, UserCheck, ArrowRightLeft, Eye, MessageSquare, ShieldCheck, ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react';
import { getRoleLabel } from '../../../services/rbac';
import {
    buildActivityFeed, describeEvent, formatDateTime, getIdleLabel, getStatusLabel, sortFeed,
    FEED_ORDERS, FEED_ORDER_STORAGE_KEY
} from '../../../utils/reportTimeline';

const EVENT_ICON = {
    status: ArrowRightLeft,
    assigned: UserCheck,
    watcher_added: Eye,
    watcher_removed: Eye
};

const LEADER_ROLES = ['gestor', 'supervisor', 'admin', 'gerente', 'coordenador'];

const SystemDot = ({ icon: Icon }) => (
    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-surface border border-strong text-secondary-hub">
        <Icon className="w-3.5 h-3.5" aria-hidden="true" />
    </div>
);

/** Linha do tempo única: abertura, eventos do sistema e comentários, do mais antigo ao mais recente. */
export default function ActivityFeed({ report, currentUserId }) {
    const [order, setOrder] = useState(() => {
        try { return localStorage.getItem(FEED_ORDER_STORAGE_KEY) === 'desc' ? 'desc' : 'asc'; } catch { return 'asc'; }
    });
    const chooseOrder = (next) => {
        setOrder(next);
        try { localStorage.setItem(FEED_ORDER_STORAGE_KEY, next); } catch { /* sem acesso ao armazenamento */ }
    };
    const chronological = buildActivityFeed(report);
    const feed = sortFeed(chronological, order);
    const idle = getIdleLabel(report);
    const endRef = useRef(null);
    const firstRender = useRef(true);

    // Depois de enviar algo, mantém o fim da lista visível (não rola na abertura)
    useEffect(() => {
        if (firstRender.current) { firstRender.current = false; return; }
        if (order === 'asc') endRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }, [chronological.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const commentCount = chronological.filter(i => i.kind === 'comment').length;

    return (
        <section aria-label="Atividade do chamado">
            <div className="flex items-center justify-between gap-3 mb-3">
                <h4 className="text-xs font-bold text-secondary-hub uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-sky-500" aria-hidden="true" />
                    Atividade
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">{commentCount}</span>
                </h4>
                <div className="flex items-center gap-2.5">
                    {idle && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">{idle}</span>}
                    <div className="flex gap-1 rounded-full bg-subtle border border-subtle p-0.5" role="group" aria-label="Ordem da linha do tempo">
                        {FEED_ORDERS.map(o => {
                            const on = order === o.id;
                            const Icon = o.id === 'asc' ? ArrowDownWideNarrow : ArrowUpWideNarrow;
                            return (
                                <button
                                    key={o.id}
                                    type="button"
                                    aria-pressed={on}
                                    title={o.label}
                                    onClick={() => chooseOrder(o.id)}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${on ? 'bg-surface text-primary-hub border border-subtle' : 'text-muted-hub hover:text-primary-hub border border-transparent'}`}
                                >
                                    <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                                    {o.id === 'asc' ? 'Antigos' : 'Recentes'}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <ol className="space-y-0">
                {feed.map(item => {
                    if (item.kind === 'created') {
                        return (
                            <li key={item.key} className="flex gap-3 relative pb-4 before:absolute before:left-3.5 before:top-7 before:bottom-0 before:w-px before:bg-subtle last:before:hidden">
                                <SystemDot icon={Plus} />
                                <div className="min-w-0 pt-0.5">
                                    <p className="text-xs text-primary-hub"><strong className="font-semibold">{item.actorName}</strong> abriu o chamado</p>
                                    <p className="text-xs text-muted-hub">{formatDateTime(item.createdAt)}</p>
                                </div>
                            </li>
                        );
                    }

                    if (item.kind === 'event') {
                        const { who, text, detail } = describeEvent(item);
                        return (
                            <li key={item.key} className="flex gap-3 relative pb-4 before:absolute before:left-3.5 before:top-7 before:bottom-0 before:w-px before:bg-subtle last:before:hidden">
                                <SystemDot icon={EVENT_ICON[item.type] || ArrowRightLeft} />
                                <div className="min-w-0 pt-0.5">
                                    <p className="text-xs text-primary-hub"><strong className="font-semibold">{who}</strong> {text}</p>
                                    <p className="text-xs text-muted-hub">{formatDateTime(item.createdAt)}{detail ? ` • ${detail}` : ''}</p>
                                </div>
                            </li>
                        );
                    }

                    const isMine = item.authorId && item.authorId === currentUserId;
                    const isCreator = item.authorId && item.authorId === report.creatorId;
                    const isLeader = item.isStaff || (item.authorRole && LEADER_ROLES.some(r => String(item.authorRole).toLowerCase().includes(r)));
                    const bubble = item.isOpinion
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : isLeader ? 'bg-indigo-500/5 border-indigo-500/30' : isCreator ? 'bg-amber-500/5 border-amber-500/30' : 'bg-surface border-subtle';
                    const avatar = isLeader ? 'bg-indigo-600 text-white border-indigo-700' : isCreator ? 'bg-amber-500 text-white border-amber-600' : 'bg-subtle text-secondary-hub border-subtle';

                    return (
                        <li key={item.key} className="flex gap-3 relative pb-4 before:absolute before:left-3.5 before:top-8 before:bottom-0 before:w-px before:bg-subtle last:before:hidden">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border ${avatar}`} aria-hidden="true">
                                {(item.authorName || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                    <span className="text-xs font-semibold text-primary-hub">{item.authorName}</span>
                                    {isMine && <span className="px-1.5 rounded-md text-xs bg-subtle text-secondary-hub border border-subtle">Você</span>}
                                    <span className="px-1.5 rounded-md text-xs bg-subtle text-muted-hub border border-subtle">
                                        {isCreator ? 'Autor' : (isLeader ? (item.authorRole || 'Liderança') : getRoleLabel(item.authorRole))}
                                    </span>
                                    <span className="text-xs text-muted-hub">{formatDateTime(item.createdAt)}</span>
                                </div>
                                <div className={`px-3.5 py-2.5 rounded-2xl border ${bubble}`}>
                                    {item.isOpinion && (
                                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 mb-1">
                                            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                                            Parecer da liderança{item.status ? ` • ${getStatusLabel(item.status)}` : ''}
                                        </p>
                                    )}
                                    <p className="text-sm text-secondary-hub leading-relaxed whitespace-pre-wrap break-words">{item.text}</p>
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ol>
            <div ref={endRef} />
        </section>
    );
}

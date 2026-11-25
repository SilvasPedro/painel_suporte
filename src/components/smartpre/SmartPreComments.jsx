import React, { useState, useMemo } from 'react';
import { Edit2, Trash2, Send, MessageSquare, Search, Save } from 'lucide-react';
import { Button } from '../ui';
import { cn } from '../../utils/cn';
import { MAX_COMMENT_LENGTH, filterComments } from '../../utils/smartPre';

const PAGE = 5;
const LONG_TEXT = 320;
const inputCls = 'w-full px-3 py-2 rounded-xl bg-surface border border-subtle text-sm text-primary-hub placeholder:text-muted-hub focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 transition-colors';

const formatDateTime = (iso) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

function CommentItem({ comment, canEdit, saving, onEdit, onDelete }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const [confirming, setConfirming] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const content = String(comment.content || '');
    const long = content.length > LONG_TEXT;

    const startEdit = () => { setDraft(content); setEditing(true); setConfirming(false); };
    const save = async () => {
        if (!draft.trim()) return;
        const ok = await onEdit(comment.id, draft);
        if (ok) setEditing(false);
    };

    return (
        <div className="rounded-xl border border-subtle bg-surface p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-bold text-primary-hub truncate">
                    {comment.authorName}
                    {comment.authorRole && <span className="ml-1.5 font-medium text-muted-hub">• {comment.authorRole}</span>}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-muted-hub">{formatDateTime(comment.createdAt)}</span>
                    {canEdit && !editing && !confirming && (
                        <>
                            <button type="button" aria-label="Editar relato" title="Editar" onClick={startEdit} className="p-1 rounded-lg text-secondary-hub hover:text-primary-hub hover:bg-subtle cursor-pointer"><Edit2 className="w-3.5 h-3.5" /></button>
                            <button type="button" aria-label="Excluir relato" title="Excluir" onClick={() => setConfirming(true)} className="p-1 rounded-lg text-secondary-hub hover:text-rose-600 hover:bg-subtle cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                    )}
                </span>
            </div>

            {editing ? (
                <div className="space-y-2">
                    <textarea rows={4} value={draft} onChange={e => setDraft(e.target.value)} maxLength={MAX_COMMENT_LENGTH} autoFocus aria-label="Editar relato" className={cn(inputCls, 'resize-y')} />
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
                        <Button size="sm" icon={Save} loading={saving} disabled={!draft.trim()} onClick={save}>Salvar relato</Button>
                    </div>
                </div>
            ) : (
                <>
                    <p className={cn('text-sm text-secondary-hub whitespace-pre-wrap break-words', long && !expanded && 'line-clamp-5')}>{content}</p>
                    {long && (
                        <button type="button" onClick={() => setExpanded(v => !v)} className="mt-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer">
                            {expanded ? 'Ver menos' : 'Ver relato completo'}
                        </button>
                    )}
                    {comment.editedAt && <p className="mt-1 text-[10px] text-muted-hub">Editado em {formatDateTime(comment.editedAt)}{comment.editedBy ? ` por ${comment.editedBy}` : ''}</p>}
                </>
            )}

            {confirming && (
                <div className="mt-2 flex flex-wrap items-center justify-end gap-2 text-[11px]">
                    <span className="mr-auto text-rose-600 dark:text-rose-400 font-medium">Excluir este relato? Não dá para desfazer.</span>
                    <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={saving}>Não</Button>
                    <Button variant="danger" size="sm" loading={saving} onClick={async () => { await onDelete(comment.id); setConfirming(false); }}>Sim, excluir</Button>
                </div>
            )}
        </div>
    );
}

/** Relatos do cliente: o campo de novo relato fica no topo, a lista vai do mais novo ao mais antigo, com busca e "mostrar mais". */
export default function SmartPreComments({ comments = [], canEdit, submitting, savingComment, onSubmit, onEdit, onDelete }) {
    const [text, setText] = useState('');
    const [query, setQuery] = useState('');
    const [visible, setVisible] = useState(PAGE);

    const shown = useMemo(() => filterComments(comments, query), [comments, query]);
    const page = shown.slice(0, visible);

    const submit = async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        if (await onSubmit(text)) { setText(''); setVisible(PAGE); }
    };

    return (
        <section>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="flex items-center gap-2 text-sm font-bold text-primary-hub">
                    <MessageSquare className="w-4 h-4 text-rose-500" /> Relatos e acompanhamento
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-subtle border border-subtle text-secondary-hub">{comments.length}</span>
                </h3>
                {comments.length > PAGE && (
                    <div className="relative w-full sm:w-52">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-hub" />
                        <input value={query} onChange={e => { setQuery(e.target.value); setVisible(PAGE); }} placeholder="Buscar nos relatos…" aria-label="Buscar nos relatos" className={cn(inputCls, 'pl-8 py-1.5 text-xs')} />
                    </div>
                )}
            </div>

            {canEdit ? (
                <form onSubmit={submit} className="mb-3 space-y-2 rounded-2xl border border-subtle bg-subtle/40 p-3">
                    <textarea
                        rows={2}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        maxLength={MAX_COMMENT_LENGTH}
                        placeholder="Registre um relato: o que o cliente informou, o que foi feito, próximos passos…"
                        className={cn(inputCls, 'resize-y')}
                    />
                    <div className="flex justify-end">
                        <Button type="submit" size="sm" icon={Send} loading={submitting} disabled={!text.trim()}>Registrar relato</Button>
                    </div>
                </form>
            ) : (
                <p className="mb-3 text-[11px] text-muted-hub">Seu perfil tem acesso somente de leitura nesta tela.</p>
            )}

            <div className="space-y-2.5">
                {comments.length === 0 ? (
                    <p className="text-xs text-muted-hub py-5 text-center rounded-xl border border-dashed border-subtle">Nenhum relato registrado ainda.</p>
                ) : shown.length === 0 ? (
                    <p className="text-xs text-muted-hub py-5 text-center rounded-xl border border-dashed border-subtle">Nenhum relato encontrado para “{query}”.</p>
                ) : page.map(c => (
                    <CommentItem key={c.id} comment={c} canEdit={canEdit} saving={savingComment} onEdit={onEdit} onDelete={onDelete} />
                ))}
            </div>

            {shown.length > visible && (
                <button type="button" onClick={() => setVisible(v => v + 10)} className="mt-3 w-full py-2 rounded-xl border border-subtle text-xs font-semibold text-secondary-hub hover:bg-subtle cursor-pointer">
                    Mostrar mais relatos ({shown.length - visible} restantes)
                </button>
            )}
        </section>
    );
}

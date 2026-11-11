import React, { useState, useEffect, useMemo } from 'react';
import { Wifi, Plus, Search, LayoutDashboard, List, Loader2, MessageSquare, Clock, ShieldCheck } from 'lucide-react';
import { collection, doc, addDoc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';
import { subscribeSharedCollection } from '../services/dataCache';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionsContext';
import { Button, Badge, Tabs, EmptyState } from '../components/ui';
import SmartPreDashboard from '../components/smartpre/SmartPreDashboard';
import SmartPreFormModal from '../components/smartpre/SmartPreFormModal';
import SmartPreDetailModal from '../components/smartpre/SmartPreDetailModal';
import {
    SMART_PRE_STATUSES, SMART_PRE_RESOLUTIONS, SMART_PRE_ISSUES, SMART_PRE_PERIODS,
    getStatusMeta, getResolutionMeta, getDaysToFirstContact, normalizeIssues, getIssueLabel,
    filterByPeriod, matchesSearch, buildSmartPrePayload, createSmartPreComment, toDateKey
} from '../utils/smartPre';

const PAGE_SIZE = 40;
const selectCls = 'h-9 px-3 rounded-xl bg-surface border border-subtle text-xs font-medium text-primary-hub focus:outline-none focus:ring-2 focus:ring-rose-500/30 cursor-pointer';

const formatDate = (value) => {
    const key = toDateKey(value);
    if (!key) return '—';
    const [y, m, d] = key.split('-');
    return `${d}/${m}/${y}`;
};

export default function SmartPre() {
    const { showToast } = useNotification();
    const { currentUser } = useAuth();
    const { canEdit, normalizedRole } = usePermissions();
    const hasEditPermission = canEdit('smart_pre');

    const [allClients, setAllClients] = useState([]);
    const [loaded, setLoaded] = useState(false);

    const [tab, setTab] = useState('dashboard');
    const [period, setPeriod] = useState('all');
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [resolutionFilter, setResolutionFilter] = useState('all');
    const [issueFilter, setIssueFilter] = useState('all');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const [formOpen, setFormOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [viewingId, setViewingId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [submittingUpdate, setSubmittingUpdate] = useState(false);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        const unsubscribe = subscribeSharedCollection('smart_pre_clients', (items) => {
            setAllClients(items || []);
            setLoaded(true);
        });
        return () => unsubscribe && unsubscribe();
    }, []);

    const periodClients = useMemo(() => filterByPeriod(allClients, period), [allClients, period]);

    const filtered = useMemo(() => periodClients
        .filter(c => matchesSearch(c, search))
        .filter(c => statusFilter === 'all' || (c.status || 'monitoring') === statusFilter)
        .filter(c => resolutionFilter === 'all' || c.resolutionType === resolutionFilter)
        .filter(c => issueFilter === 'all' || normalizeIssues(c).includes(issueFilter))
        .sort((a, b) => String(b.installedAt || '').localeCompare(String(a.installedAt || ''))),
    [periodClients, search, statusFilter, resolutionFilter, issueFilter]);

    const viewing = viewingId ? allClients.find(c => c.id === viewingId) || null : null;

    const author = useMemo(() => ({
        authorId: currentUser?.firestoreId || currentUser?.uid || 'user',
        authorName: currentUser?.name || currentUser?.displayName || currentUser?.email || 'Usuário',
        authorRole: currentUser?.role || normalizedRole || ''
    }), [currentUser, normalizedRole]);

    const openNew = () => { setEditingClient(null); setFormOpen(true); };
    const openEdit = (client) => { setEditingClient(client); setViewingId(null); setFormOpen(true); };
    const closeForm = () => { if (!saving) setFormOpen(false); };

    const handleSave = async (form) => {
        if (!hasEditPermission) return;
        setSaving(true);
        try {
            const payload = buildSmartPrePayload(form);
            const now = new Date();
            if (editingClient) {
                await updateDoc(doc(db, 'smart_pre_clients', editingClient.id), {
                    ...payload, updatedAt: now, lastActivityAt: now, lastUpdatedBy: author.authorName
                });
                showToast('Cliente atualizado.', 'success');
            } else {
                await addDoc(collection(db, 'smart_pre_clients'), {
                    ...payload,
                    comments: [],
                    createdAt: now,
                    updatedAt: now,
                    lastActivityAt: now,
                    createdBy: author.authorId,
                    createdByName: author.authorName,
                    lastUpdatedBy: author.authorName
                });
                showToast('Cliente cadastrado no acompanhamento do Smart Pre.', 'success');
            }
            setFormOpen(false);
        } catch (error) {
            console.error('Erro ao salvar cliente Smart Pre:', error);
            showToast(error?.code === 'permission-denied' ? 'Sem permissão para salvar. Verifique as regras do Firestore.' : 'Não foi possível salvar o cliente.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Relato (comentário) e/ou mudança de situação feitos no detalhe do cliente
    const handleSubmitUpdate = async ({ text, status, resolutionType }) => {
        if (!viewing || !hasEditPermission) return false;
        setSubmittingUpdate(true);
        try {
            const now = new Date();
            const update = { updatedAt: now, lastActivityAt: now, lastUpdatedBy: author.authorName };
            if (text.trim()) update.comments = arrayUnion(createSmartPreComment({ ...author, text, now }));
            if (viewing.contacted) {
                update.status = status;
                update.resolutionType = resolutionType;
            }
            await updateDoc(doc(db, 'smart_pre_clients', viewing.id), update);
            showToast(text.trim() ? 'Relato registrado.' : 'Andamento atualizado.', 'success');
            return true;
        } catch (error) {
            console.error('Erro ao atualizar cliente Smart Pre:', error);
            showToast('Não foi possível registrar a atualização.', 'error');
            return false;
        } finally {
            setSubmittingUpdate(false);
        }
    };

    const handleDelete = async (client) => {
        if (!hasEditPermission) return;
        setDeleting(true);
        try {
            await deleteDoc(doc(db, 'smart_pre_clients', client.id));
            setViewingId(null);
            showToast('Cliente excluído.', 'success');
        } catch (error) {
            console.error('Erro ao excluir cliente Smart Pre:', error);
            showToast('Não foi possível excluir o cliente.', 'error');
        } finally {
            setDeleting(false);
        }
    };

    const clearFilters = () => {
        setSearch(''); setStatusFilter('all'); setResolutionFilter('all'); setIssueFilter('all'); setVisibleCount(PAGE_SIZE);
    };
    const hasFilters = search || statusFilter !== 'all' || resolutionFilter !== 'all' || issueFilter !== 'all';

    return (
        <div className="flex-1 p-3 sm:p-5 lg:p-6 bg-subtle h-full overflow-y-auto font-sans">
            <div className="w-full max-w-none space-y-4 sm:space-y-5">
                {/* Cabeçalho */}
                <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-rose-500 uppercase tracking-wider">
                            <Wifi className="w-3.5 h-3.5" />
                            <span>Pós-venda & Acompanhamento</span>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="font-brand text-2xl sm:text-3xl font-bold text-primary-hub tracking-tight">Smart Pre</h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-subtle text-secondary-hub border border-subtle">
                                {allClients.length} {allClients.length === 1 ? 'cliente' : 'clientes'}
                            </span>
                            {!hasEditPermission && (
                                <Badge variant="neutral" icon={ShieldCheck}>Somente leitura</Badge>
                            )}
                        </div>
                        <p className="text-sm text-secondary-hub mt-1.5 max-w-3xl">
                            Acompanhe os clientes que entram na base com o Smart Pre: quem entrou em contato após a instalação, o problema relatado e se foi resolvido remotamente, por visita técnica ou pelo TI.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <select aria-label="Período" className={selectCls} value={period} onChange={e => { setPeriod(e.target.value); setVisibleCount(PAGE_SIZE); }}>
                            {SMART_PRE_PERIODS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                        </select>
                        {hasEditPermission && <Button icon={Plus} onClick={openNew}>Novo cliente</Button>}
                    </div>
                </header>

                <Tabs
                    id="smart-pre-tabs"
                    activeTab={tab}
                    onChange={setTab}
                    tabs={[
                        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
                        { id: 'clients', label: 'Clientes', icon: List, badge: periodClients.length }
                    ]}
                />

                {!loaded ? (
                    <div className="py-20 flex flex-col items-center text-muted-hub">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-xs mt-2">Carregando acompanhamento…</span>
                    </div>
                ) : tab === 'dashboard' ? (
                    <SmartPreDashboard clients={periodClients} allClients={allClients} onOpenClient={setViewingId} />
                ) : (
                    <div className="space-y-4">
                        {/* Filtros */}
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative w-full sm:w-72">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-hub" />
                                <input
                                    value={search}
                                    onChange={e => { setSearch(e.target.value); setVisibleCount(PAGE_SIZE); }}
                                    placeholder="Buscar por nome, código, telefone ou cidade"
                                    className="w-full h-9 pl-8 pr-3 rounded-xl bg-surface border border-subtle text-xs text-primary-hub placeholder:text-muted-hub focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                                />
                            </div>
                            <select aria-label="Situação" className={selectCls} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}>
                                <option value="all">Todas as situações</option>
                                {SMART_PRE_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                            <select aria-label="Tratativa" className={selectCls} value={resolutionFilter} onChange={e => { setResolutionFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}>
                                <option value="all">Todas as tratativas</option>
                                {SMART_PRE_RESOLUTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                            </select>
                            <select aria-label="Problema" className={selectCls} value={issueFilter} onChange={e => { setIssueFilter(e.target.value); setVisibleCount(PAGE_SIZE); }}>
                                <option value="all">Todos os problemas</option>
                                {SMART_PRE_ISSUES.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}
                            </select>
                            {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}>Limpar filtros</Button>}
                        </div>

                        {filtered.length === 0 ? (
                            <EmptyState
                                icon={Wifi}
                                title={allClients.length === 0 ? 'Nenhum cliente cadastrado' : 'Nenhum cliente encontrado'}
                                description={allClients.length === 0
                                    ? 'Cadastre os clientes que entram na base com o Smart Pre para começar o acompanhamento.'
                                    : 'Ajuste os filtros ou o período para ver outros clientes.'}
                                actionLabel={allClients.length === 0 && hasEditPermission ? 'Cadastrar primeiro cliente' : undefined}
                                onAction={openNew}
                            />
                        ) : (
                            <>
                                <ul className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                                    {filtered.slice(0, visibleCount).map(c => {
                                        const status = getStatusMeta(c.status);
                                        const resolution = getResolutionMeta(c.resolutionType);
                                        const days = getDaysToFirstContact(c);
                                        const issues = normalizeIssues(c);
                                        const commentCount = Array.isArray(c.comments) ? c.comments.length : 0;
                                        return (
                                            <li key={c.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => setViewingId(c.id)}
                                                    className="w-full text-left rounded-2xl border border-subtle bg-surface hover:border-strong hover:shadow-xs p-4 transition-all cursor-pointer"
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-sm text-primary-hub truncate">{c.clientName}</p>
                                                            <p className="text-[11px] text-muted-hub mt-0.5 truncate">
                                                                Instalado em {formatDate(c.installedAt)}{c.erpCode ? ` • ${c.erpCode}` : ''}{c.city ? ` • ${c.city}` : ''}
                                                            </p>
                                                        </div>
                                                        <div className="flex flex-wrap justify-end gap-1.5 shrink-0">
                                                            <Badge variant={status.variant} size="sm" dot>{status.label}</Badge>
                                                            {resolution && <Badge variant="purple" size="sm">{resolution.short}</Badge>}
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-secondary-hub">
                                                        <span className="flex items-center gap-1.5">
                                                            <Clock className="w-3 h-3 text-muted-hub" />
                                                            {c.contacted
                                                                ? (days === null ? 'Entrou em contato' : days === 0 ? 'Contato no mesmo dia' : `Contato após ${days} dia${days > 1 ? 's' : ''}`)
                                                                : 'Sem contato após a instalação'}
                                                        </span>
                                                        <span className="flex items-center gap-1.5">
                                                            <MessageSquare className="w-3 h-3 text-muted-hub" />
                                                            {commentCount} {commentCount === 1 ? 'relato' : 'relatos'}
                                                        </span>
                                                    </div>

                                                    {issues.length > 0 && (
                                                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                                                            {issues.map(id => <Badge key={id} variant="neutral" size="sm">{getIssueLabel(id)}</Badge>)}
                                                        </div>
                                                    )}
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>

                                {filtered.length > visibleCount && (
                                    <div className="flex justify-center">
                                        <Button variant="secondary" size="sm" onClick={() => setVisibleCount(n => n + PAGE_SIZE)}>
                                            Mostrar mais ({filtered.length - visibleCount} restantes)
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            {formOpen && (
                <SmartPreFormModal
                    key={editingClient?.id || 'new'}
                    isOpen
                    onClose={closeForm}
                    client={editingClient}
                    onSave={handleSave}
                    saving={saving}
                />
            )}

            {viewing && (
                <SmartPreDetailModal
                    key={viewing.id}
                    client={viewing}
                    onClose={() => setViewingId(null)}
                    canEdit={hasEditPermission}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onSubmitUpdate={handleSubmitUpdate}
                    submitting={submittingUpdate}
                    deleting={deleting}
                />
            )}
        </div>
    );
}

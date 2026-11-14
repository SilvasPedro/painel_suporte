/**
 * Regras puras do modal de chamados: status canônicos, eventos da linha do tempo,
 * linha do tempo unificada (abertura + eventos + comentários), datas das etapas e tempo parado.
 *
 * Eventos ficam em `report.events` (gravados com arrayUnion, junto de `comments`):
 *   { id, type: 'status'|'assigned'|'watcher_added'|'watcher_removed', actorId, actorName, actorRole,
 *     from, to, targetName, createdAt (ISO) }
 */

export const STATUS_OPTIONS = [
    { id: 'Pendente', label: 'Pendente', hint: 'Fila de triagem' },
    { id: 'Em Andamento', label: 'Em andamento', hint: 'Em análise ou execução' },
    { id: 'Suspenso', label: 'Suspenso', hint: 'Em pausa, aguardando retorno' },
    { id: 'Resolvido', label: 'Resolvido', hint: 'Demanda solucionada' },
    { id: 'Cancelado', label: 'Cancelado', hint: 'Cancelado ou recusado' }
];

/** Nomes antigos (Concluído, Recusado…) viram os cinco status atuais. */
export const normalizeStatus = (status) => {
    const s = String(status || '').trim().toLowerCase();
    if (['resolvido', 'concluído', 'concluido', 'fechado', 'resolved', 'completed'].includes(s)) return 'Resolvido';
    if (['cancelado', 'recusado', 'canceled', 'cancelled'].includes(s)) return 'Cancelado';
    if (['em andamento', 'em análise', 'em analise', 'in_progress', 'in progress'].includes(s)) return 'Em Andamento';
    if (s === 'suspenso') return 'Suspenso';
    return 'Pendente';
};

export const getStatusLabel = (status) => STATUS_OPTIONS.find(o => o.id === normalizeStatus(status))?.label || 'Pendente';
export const isClosedStatus = (status) => ['Resolvido', 'Cancelado'].includes(normalizeStatus(status));

/** Epoch em ms de ISO, Date, número ou Timestamp do Firestore; null se inválido. */
export const toMillis = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return toMillis(value.toDate());
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    const ms = new Date(value).getTime();
    return Number.isNaN(ms) ? null : ms;
};

const pad = (n) => String(n).padStart(2, '0');

/** Data (sem hora) em dd/mm/aaaa. 'AAAA-MM-DD' é lido como data local, sem deslocar o dia por fuso. */
export const formatDateOnly = (value) => {
    if (!value) return '--';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split('-');
        return `${d}/${m}/${y}`;
    }
    const ms = toMillis(value);
    if (ms === null) return typeof value === 'string' ? value : '--';
    const d = new Date(ms);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

/** "Hoje às 14:20" ou "10/11/2026 às 14:20". */
export const formatDateTime = (value, now = new Date()) => {
    const ms = toMillis(value);
    if (ms === null) return '';
    const d = new Date(ms);
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (d.toDateString() === now.toDateString()) return `Hoje às ${time}`;
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${time}`;
};

/** dd/mm às hh:mm, para as etapas do passo a passo. */
export const formatShortDateTime = (value) => {
    const ms = toMillis(value);
    if (ms === null) return '';
    const d = new Date(ms);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const newId = (prefix, now) => `${prefix}_${now.getTime()}_${Math.random().toString(36).slice(2, 7)}`;

/** Evento do sistema para a linha do tempo. */
export const createEvent = ({ type, actor = {}, from = '', to = '', targetName = '', now = new Date() }) => ({
    id: newId('evt', now),
    type,
    actorId: String(actor.id || ''),
    actorName: String(actor.name || 'Usuário'),
    actorRole: String(actor.role || ''),
    from: String(from || ''),
    to: String(to || ''),
    targetName: String(targetName || ''),
    createdAt: now.toISOString()
});

/** Comentário. `kind: 'opinion'` marca o parecer da liderança (com o status definido nele). */
export const createComment = ({ text, actor = {}, isStaff = false, kind = 'comment', status = '', now = new Date() }) => ({
    id: newId('cmt', now),
    kind,
    authorId: String(actor.id || ''),
    authorName: String(actor.name || 'Usuário'),
    authorRole: String(actor.role || ''),
    isStaff: Boolean(isStaff),
    content: String(text || '').trim(),
    ...(status ? { status: normalizeStatus(status) } : {}),
    createdAt: now.toISOString()
});

export const getOfficialOpinion = (report) => report?.adminComment || report?.closingComment || report?.solution || '';

const LEGACY_OPINION = /^\[Parecer da Gestão[^\]]*\]\n?/;

/** Comentários antigos de parecer vinham com um prefixo "[Parecer da Gestão • Status: X]". */
export const parseComment = (comment) => {
    const content = String(comment?.content || '');
    if (comment?.kind === 'opinion') return { ...comment, isOpinion: true, text: content };
    if (LEGACY_OPINION.test(content)) return { ...comment, isOpinion: true, text: content.replace(LEGACY_OPINION, '') };
    return { ...comment, isOpinion: false, text: content };
};

/**
 * Linha do tempo única, do mais antigo ao mais recente.
 * Itens: { key, kind: 'created'|'event'|'comment', at (ms|null), ... }
 */
export const buildActivityFeed = (report) => {
    if (!report) return [];
    const items = [];
    const createdMs = toMillis(report.createdAt) ?? toMillis(report.date);
    items.push({
        key: 'created', kind: 'created', at: createdMs,
        actorName: report.creatorName || 'Autor desconhecido', createdAt: report.createdAt
    });
    (Array.isArray(report.events) ? report.events : []).forEach((e, i) => {
        items.push({ ...e, key: e.id || `evt_${i}`, kind: 'event', at: toMillis(e.createdAt) });
    });
    (Array.isArray(report.comments) ? report.comments : []).forEach((c, i) => {
        items.push({ ...parseComment(c), key: c.id || `cmt_${i}`, kind: 'comment', at: toMillis(c.createdAt) });
    });
    // estável: itens sem data ficam na ordem original, depois dos datados do mesmo instante
    return items
        .map((item, index) => ({ item, index }))
        .sort((a, b) => {
            const ta = a.item.at ?? Number.POSITIVE_INFINITY;
            const tb = b.item.at ?? Number.POSITIVE_INFINITY;
            return ta === tb ? a.index - b.index : ta - tb;
        })
        .map(x => x.item);
};

/** Datas (ms) de cada etapa do passo a passo, a partir dos eventos de status. */
export const getStageDates = (report) => {
    const events = (Array.isArray(report?.events) ? report.events : [])
        .filter(e => e.type === 'status')
        .map(e => ({ to: normalizeStatus(e.to), at: toMillis(e.createdAt) }))
        .filter(e => e.at !== null)
        .sort((a, b) => a.at - b.at);
    const lastOf = (status) => [...events].reverse().find(e => e.to === status)?.at ?? null;
    return {
        registered: toMillis(report?.createdAt) ?? toMillis(report?.date),
        progress: events.find(e => e.to === 'Em Andamento')?.at ?? null,
        paused: lastOf('Suspenso'),
        closed: lastOf('Resolvido') ?? lastOf('Cancelado')
    };
};

/** Instante da última movimentação (atualização, atividade, evento ou comentário). */
export const getLastActivityMillis = (report) => {
    const candidates = [
        toMillis(report?.lastActivityAt), toMillis(report?.updatedAt),
        ...(Array.isArray(report?.events) ? report.events.map(e => toMillis(e.createdAt)) : []),
        ...(Array.isArray(report?.comments) ? report.comments.map(c => toMillis(c.createdAt)) : [])
    ].filter(v => v !== null);
    return candidates.length ? Math.max(...candidates) : toMillis(report?.createdAt);
};

/** "Sem movimentação há 3h" para chamados abertos parados há pelo menos 1h; null nos demais casos. */
export const getIdleLabel = (report, nowMs = Date.now()) => {
    if (!report || isClosedStatus(report.status)) return null;
    const last = getLastActivityMillis(report);
    if (last === null) return null;
    const minutes = Math.floor((nowMs - last) / 60000);
    if (minutes < 60) return null;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `Sem movimentação há ${hours}h`;
    return `Sem movimentação há ${Math.floor(hours / 24)} dias`;
};

/** Texto do evento para a linha do tempo. */
export const describeEvent = (event) => {
    const who = event.actorName || 'Alguém';
    switch (event.type) {
        case 'status': return { who, text: `mudou o status para ${getStatusLabel(event.to)}`, detail: event.from ? `Antes: ${getStatusLabel(event.from)}` : '' };
        case 'assigned': return event.targetName
            ? { who, text: `atribuiu o chamado a ${event.targetName}`, detail: event.from ? `Antes: ${event.from}` : '' }
            : { who, text: 'devolveu o chamado para a fila da liderança', detail: event.from ? `Antes: ${event.from}` : '' };
        case 'watcher_added': return { who, text: `adicionou ${event.targetName || 'um colaborador'} como visualizador`, detail: '' };
        case 'watcher_removed': return { who, text: `removeu ${event.targetName || 'um colaborador'} dos visualizadores`, detail: '' };
        default: return { who, text: 'registrou uma atualização', detail: '' };
    }
};

/**
 * Valida o envio do compositor.
 * @returns {string[]} mensagens de erro
 */
export const validateComposer = ({ tab, text, status, currentStatus }) => {
    const errors = [];
    const hasText = Boolean(String(text || '').trim());
    const target = normalizeStatus(status);
    const changed = target !== normalizeStatus(currentStatus);
    if (tab === 'opinion') {
        if (isClosedStatus(target) && !hasText) errors.push('Para encerrar o chamado, registre o parecer da liderança.');
        else if (target === 'Suspenso' && changed && !hasText) errors.push('Informe o motivo da suspensão.');
        else if (!hasText && !changed) errors.push('Escreva o parecer ou escolha um novo status.');
    } else if (!hasText) {
        errors.push('Escreva a mensagem antes de enviar.');
    }
    return errors;
};

export const getDraftKey = (reportId) => `hubdesk_report_draft_${reportId}`;

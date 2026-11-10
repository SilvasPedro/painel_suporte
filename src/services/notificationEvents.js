import { collection, doc, getDoc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { getCachedCollection, buildCollectionKey } from './dataCache';

/**
 * EVENTOS DE NOTIFICAÇÃO (v4.7)
 *
 * Em vez de cada usuário baixar coleções inteiras (feedbacks, avaliações...) só para descobrir
 * se há algo novo, quem LANÇA o item grava junto um aviso na coleção `notifications`, endereçado
 * ao destinatário. O app do destinatário escuta apenas os próprios avisos não lidos.
 *
 * Opcionalmente, o mesmo evento também é enviado a um canal da equipe (Discord, Slack, Teams,
 * Google Chat ou URL genérica) configurado em Configurações > Notificações.
 *
 * Observação: o projeto está no plano Spark, que não executa Cloud Functions. Por isso o envio
 * ao canal é feito pelo navegador de quem lança o item (melhor esforço, sem retentativas).
 */

export const NOTIFICATION_EVENTS = {
    weekly_evaluation: {
        label: 'Avaliação semanal',
        subtab: 'metrics',
        icon: '📊',
        color: 0x3b82f6
    },
    feedback: {
        label: 'Feedback',
        subtab: 'feedbacks',
        icon: '📢',
        color: 0xf59e0b
    },
    monthly_evaluation: {
        label: 'Avaliação 1:1 mensal',
        subtab: 'monthly',
        icon: '🎯',
        color: 0x8b5cf6
    }
};

export const NOTIFICATION_EVENT_IDS = Object.keys(NOTIFICATION_EVENTS);

export const WEBHOOK_PROVIDERS = [
    { id: 'discord', label: 'Discord', hint: 'Configurações do canal > Integrações > Webhooks' },
    { id: 'slack', label: 'Slack', hint: 'App "Incoming Webhooks" do Slack' },
    { id: 'teams', label: 'Microsoft Teams', hint: 'Fluxo do Workflows com gatilho "Quando uma solicitação de webhook é recebida"' },
    { id: 'googlechat', label: 'Google Chat', hint: 'Espaço > Aplicativos e integrações > Webhooks' },
    { id: 'generic', label: 'URL genérica (JSON)', hint: 'Recebe um POST em JSON; o destino precisa aceitar chamadas do navegador (CORS)' }
];

export const WEBHOOK_CONFIG_COLLECTION = 'integrations';
export const WEBHOOK_CONFIG_DOC = 'team_webhook';

export const DEFAULT_WEBHOOK_CONFIG = {
    enabled: false,
    provider: 'discord',
    url: '',
    link: '',      // endereço enviado nos avisos (vazio = endereço do site atual + /home?tab=my_history)
    messages: {},  // textos personalizados por evento (vazio = texto padrão)
    events: { weekly_evaluation: true, feedback: true, monthly_evaluation: true }
};

// Mensagens genéricas para canais de aviso: nunca citam nomes, notas ou conteúdo.
// {link} é substituído pelo endereço do Hubdesk.
export const DEFAULT_WEBHOOK_MESSAGES = {
    weekly_evaluation: {
        title: '📊 Avaliações semanais disponíveis',
        text: 'Atenção, pessoal! Foram lançadas as avaliações semanais de desempenho. Acessem {link} para visualizar!'
    },
    feedback: {
        title: '📢 Novos feedbacks disponíveis',
        text: 'Atenção, pessoal! Há novos feedbacks disponíveis. Acessem {link} para conferir!'
    },
    monthly_evaluation: {
        title: '🎯 Avaliações 1:1 disponíveis',
        text: 'Atenção, pessoal! Foram registradas novas avaliações 1:1 mensais. Acessem {link} para ler e confirmar ciência!'
    }
};

// Evita repetir o mesmo aviso genérico várias vezes seguidas (ex.: vários feedbacks em sequência)
export const WEBHOOK_COOLDOWN_MS = {
    weekly_evaluation: 10 * 60 * 1000,
    feedback: 30 * 60 * 1000,
    monthly_evaluation: 30 * 60 * 1000
};

export const DEFAULT_LINK_PATH = '/home?tab=my_history';

export const getDefaultLink = () => (
    typeof window !== 'undefined' ? `${window.location.origin}${DEFAULT_LINK_PATH}` : ''
);

/**
 * Monta o texto final: troca {link} pelo endereço; se o modelo não tiver {link}, acrescenta o endereço numa nova linha.
 */
export const renderWebhookText = (template, link) => {
    const base = String(template || '').trim();
    if (!link) return base.replace(/\s*\{link\}\s*/g, ' ').replace(/ +/g, ' ').trim();
    if (base.includes('{link}')) return base.split('{link}').join(link);
    return `${base}\n${link}`;
};

// Eventos que acendem o indicador de "Meu Histórico"
export const HISTORY_EVENT_IDS = NOTIFICATION_EVENT_IDS;

// Mesmas opções em todo o app => um único listener compartilhado por usuário (ver dataCache)
export const inboxOptions = (userId) => ({
    where: [['toUserId', '==', userId], ['read', '==', false]]
});

/**
 * Monta o documento de aviso de um destinatário.
 */
export const buildNotification = ({ event, toUserId, toUserName = '', refId = '', title, body, authorName = '', meta = {} }) => {
    const def = NOTIFICATION_EVENTS[event];
    if (!def) throw new Error(`Evento de notificação desconhecido: ${event}`);
    if (!toUserId) throw new Error('Destinatário obrigatório para criar a notificação');

    return {
        toUserId: String(toUserId),
        toUserName,
        event,
        refId: refId || '',
        title: title || `${def.icon} ${def.label}`,
        body: body || '',
        subtab: def.subtab,
        authorName,
        meta,
        read: false,
        createdAt: new Date().toISOString()
    };
};

/**
 * Inclui o aviso em um lote (writeBatch) já existente: o aviso é gravado junto com o item,
 * de forma atômica.
 */
export const addNotificationToBatch = (batch, notification) => {
    batch.set(doc(collection(db, 'notifications')), notification);
};

/**
 * Grava um aviso isolado (usado quando o item já foi gravado antes, ex.: precisa do id do documento).
 */
export const createNotification = async (notification) => {
    await setDoc(doc(collection(db, 'notifications')), notification);
};

/**
 * Marca como lidos os avisos pendentes do usuário. Usa a lista já mantida em memória pelo
 * listener compartilhado, então não gera leituras extras no banco.
 */
export const markNotificationsRead = async (userId, events = HISTORY_EVENT_IDS) => {
    if (!userId) return 0;
    const key = buildCollectionKey('notifications', inboxOptions(userId));
    const pending = (getCachedCollection(key) || []).filter(n => events.includes(n.event) && n.id);
    if (pending.length === 0) return 0;

    const readAt = new Date().toISOString();
    for (let i = 0; i < pending.length; i += 400) {
        const batch = writeBatch(db);
        pending.slice(i, i + 400).forEach(n => batch.update(doc(db, 'notifications', n.id), { read: true, readAt }));
        await batch.commit();
    }
    return pending.length;
};

// -------------------------------------------------------------------------------------------
// WEBHOOK DO CANAL DA EQUIPE
// -------------------------------------------------------------------------------------------

let configCache = { value: null, at: 0 };
const CONFIG_TTL_MS = 5 * 60 * 1000;

export const invalidateWebhookConfigCache = () => {
    configCache = { value: null, at: 0 };
};

/**
 * Lê a configuração do webhook (1 leitura a cada 5 minutos por sessão).
 * Somente a equipe de gestão consegue ler (regras do Firestore); para os demais retorna null.
 */
export const getWebhookConfig = async () => {
    if (configCache.value && Date.now() - configCache.at < CONFIG_TTL_MS) return configCache.value;
    try {
        const snap = await getDoc(doc(db, WEBHOOK_CONFIG_COLLECTION, WEBHOOK_CONFIG_DOC));
        const value = snap.exists() ? { ...DEFAULT_WEBHOOK_CONFIG, ...snap.data() } : { ...DEFAULT_WEBHOOK_CONFIG };
        configCache = { value, at: Date.now() };
        return value;
    } catch {
        return null;
    }
};

const isValidWebhookUrl = (url) => {
    try {
        const u = new URL(url);
        return u.protocol === 'https:';
    } catch {
        return false;
    }
};

// Corpo da mensagem no formato esperado por cada serviço.
// O texto já vem com o endereço embutido (ver renderWebhookText); `link` serve ao botão do Teams e ao JSON genérico.
export const buildWebhookRequest = (provider, { event, title, text, link }) => {
    switch (provider) {
        case 'discord':
            // Texto simples (não incorporado): permite mencionar @everyone/@here no modelo da mensagem
            return {
                contentType: 'application/json',
                body: JSON.stringify({ username: 'Hubdesk', content: text })
            };
        case 'slack':
            // Slack não aceita a pré-validação CORS: o formato "payload=" é uma requisição simples
            return {
                contentType: 'application/x-www-form-urlencoded',
                body: `payload=${encodeURIComponent(JSON.stringify({ text: `*${title}*\n${text}` }))}`,
                simpleOnly: true
            };
        case 'teams':
            return {
                contentType: 'application/json',
                body: JSON.stringify({
                    type: 'message',
                    attachments: [{
                        contentType: 'application/vnd.microsoft.card.adaptive',
                        content: {
                            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
                            type: 'AdaptiveCard',
                            version: '1.4',
                            body: [
                                { type: 'TextBlock', text: title, weight: 'Bolder', size: 'Medium', wrap: true },
                                { type: 'TextBlock', text, wrap: true }
                            ],
                            ...(link ? { actions: [{ type: 'Action.OpenUrl', title: 'Abrir no Hubdesk', url: link }] } : {})
                        }
                    }]
                })
            };
        case 'googlechat':
            return { contentType: 'application/json', body: JSON.stringify({ text: `*${title}*\n${text}` }) };
        default:
            return {
                contentType: 'application/json',
                body: JSON.stringify({ source: 'hubdesk', event, title, text, link: link || null, sentAt: new Date().toISOString() })
            };
    }
};

/**
 * Envia uma mensagem ao webhook configurado.
 * @returns {'ok'|'sent_unverified'|'error'}
 *   ok: o serviço confirmou o recebimento; sent_unverified: enviado, mas o navegador não deixa
 *   ler a resposta (CORS); error: URL inválida ou falha de rede.
 */
export const postToWebhook = async (config, message) => {
    if (!config?.url || !isValidWebhookUrl(config.url)) return 'error';
    const req = buildWebhookRequest(config.provider, message);

    if (!req.simpleOnly) {
        try {
            const res = await fetch(config.url, { method: 'POST', headers: { 'Content-Type': req.contentType }, body: req.body });
            return res.ok ? 'ok' : 'error';
        } catch {
            // Sem CORS no destino: tenta novamente como requisição simples (sem confirmação de entrega)
        }
    }

    try {
        await fetch(config.url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': req.simpleOnly ? req.contentType : 'text/plain;charset=UTF-8' },
            body: req.body
        });
        return 'sent_unverified';
    } catch {
        return 'error';
    }
};

const cooldownKey = (event) => `hubdesk_webhook_last_${event}`;

const isInCooldown = (event) => {
    try {
        const last = Number(localStorage.getItem(cooldownKey(event)) || 0);
        return Date.now() - last < (WEBHOOK_COOLDOWN_MS[event] || 0);
    } catch {
        return false;
    }
};

const markDispatched = (event) => {
    try { localStorage.setItem(cooldownKey(event), String(Date.now())); } catch { /* sem armazenamento */ }
};

/**
 * Despacha um aviso GENÉRICO do evento ao canal da equipe, se o webhook estiver ativo e o evento habilitado.
 * - O texto vem da configuração (ou do padrão) e nunca contém dados de pessoas, notas ou conteúdo.
 * - Repetições do mesmo evento em poucos minutos são ignoradas, para não lotar o canal.
 * - Nunca lança erro: a falha do webhook não pode atrapalhar o salvamento do item.
 * `title`, `text` e `link` são opcionais e sobrescrevem a configuração.
 */
export const dispatchTeamWebhook = async ({ event, title, text, link }) => {
    try {
        const config = await getWebhookConfig();
        if (!config?.enabled || !config.url) return 'skipped';
        if (config.events && config.events[event] === false) return 'skipped';
        if (isInCooldown(event)) return 'skipped';

        const defaults = DEFAULT_WEBHOOK_MESSAGES[event] || {
            title: 'Hubdesk',
            text: 'Atenção, pessoal! Há novidades no Hubdesk. Acessem {link}'
        };
        const finalLink = link || config.link || getDefaultLink();
        const finalText = renderWebhookText(text || config.messages?.[event] || defaults.text, finalLink);

        const result = await postToWebhook(config, {
            event,
            title: title || defaults.title,
            text: finalText,
            link: finalLink
        });
        if (result !== 'error') markDispatched(event);
        return result;
    } catch {
        return 'error';
    }
};

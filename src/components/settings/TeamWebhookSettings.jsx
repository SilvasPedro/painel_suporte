import React, { useEffect, useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { Webhook, Send, Save, Loader2, ShieldCheck, Eye, EyeOff, Info } from 'lucide-react';
import { db } from '../../services/firebase';
import { useNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionsContext';
import {
    NOTIFICATION_EVENTS,
    NOTIFICATION_EVENT_IDS,
    WEBHOOK_PROVIDERS,
    WEBHOOK_CONFIG_COLLECTION,
    WEBHOOK_CONFIG_DOC,
    DEFAULT_WEBHOOK_CONFIG,
    getWebhookConfig,
    invalidateWebhookConfigCache,
    postToWebhook
} from '../../services/notificationEvents';

/**
 * Configuração do webhook do canal da equipe (Configurações > Notificações).
 * A URL fica em `integrations/team_webhook`, legível apenas pela equipe de gestão (regras do Firestore).
 */
const TeamWebhookSettings = () => {
    const { showToast } = useNotification();
    const { currentUser } = useAuth();
    const { canEdit } = usePermissions();
    const canManage = canEdit('settings');

    const [config, setConfig] = useState(DEFAULT_WEBHOOK_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [showUrl, setShowUrl] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getWebhookConfig().then((value) => {
            if (cancelled) return;
            if (value) setConfig(value);
            setLoading(false);
        });
        return () => { cancelled = true; };
    }, []);

    const provider = WEBHOOK_PROVIDERS.find(p => p.id === config.provider) || WEBHOOK_PROVIDERS[0];
    const urlIsValid = (() => {
        try { return new URL(config.url).protocol === 'https:'; } catch { return false; }
    })();

    const update = (patch) => setConfig(prev => ({ ...prev, ...patch }));
    const toggleEvent = (eventId) => update({ events: { ...config.events, [eventId]: !config.events?.[eventId] } });

    const handleSave = async () => {
        if (config.enabled && !urlIsValid) {
            showToast('Informe uma URL válida que comece com https:// para ativar o webhook.', 'warning');
            return;
        }
        setSaving(true);
        try {
            await setDoc(doc(db, WEBHOOK_CONFIG_COLLECTION, WEBHOOK_CONFIG_DOC), {
                enabled: Boolean(config.enabled),
                provider: config.provider,
                url: config.url.trim(),
                events: config.events,
                updatedAt: new Date().toISOString(),
                updatedBy: currentUser?.name || currentUser?.email || ''
            }, { merge: true });
            invalidateWebhookConfigCache();
            showToast('Webhook do canal salvo com sucesso!', 'success');
        } catch (error) {
            showToast('Erro ao salvar o webhook: ' + error.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!urlIsValid) {
            showToast('Informe uma URL válida (https://) antes de testar.', 'warning');
            return;
        }
        setTesting(true);
        const result = await postToWebhook(config, {
            event: 'feedback',
            title: '✅ Teste do Hubdesk',
            text: `Webhook configurado por ${currentUser?.name || 'um gestor'}. Se você está vendo esta mensagem, as notificações da equipe chegarão neste canal.`,
            link: window.location.origin
        });
        setTesting(false);

        if (result === 'ok') {
            showToast('Mensagem de teste enviada e confirmada pelo serviço.', 'success');
        } else if (result === 'sent_unverified') {
            showToast('Teste enviado. O navegador não permite confirmar a entrega neste serviço: confira se a mensagem chegou ao canal.', 'info');
        } else {
            showToast('Não foi possível enviar o teste. Verifique a URL e o tipo de serviço.', 'error');
        }
    };

    return (
        <div className="w-full bg-surface rounded-3xl border border-subtle shadow-xs p-6 lg:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-subtle pb-4">
                <div>
                    <h2 className="text-base sm:text-lg font-bold text-primary-hub flex items-center gap-2">
                        <Webhook className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                        Webhook do Canal da Equipe
                    </h2>
                    <p className="text-xs text-secondary-hub mt-0.5">
                        Avisa um canal (Discord, Slack, Teams, Google Chat ou outra URL) quando houver nova avaliação semanal, feedback ou avaliação 1:1.
                    </p>
                </div>

                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={Boolean(config.enabled)}
                        disabled={!canManage || loading}
                        onChange={(e) => update({ enabled: e.target.checked })}
                        className="w-4 h-4"
                    />
                    <span className={`text-xs font-bold ${config.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-hub'}`}>
                        {config.enabled ? 'Webhook ativo' : 'Webhook desativado'}
                    </span>
                </label>
            </div>

            {loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-hub">
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando configuração...
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-secondary-hub mb-1">Serviço de destino</label>
                            <select
                                value={config.provider}
                                disabled={!canManage}
                                onChange={(e) => update({ provider: e.target.value })}
                                className="w-full p-2.5 text-xs font-semibold bg-subtle border border-subtle rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-primary-hub"
                            >
                                {WEBHOOK_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                            </select>
                            <p className="text-[11px] text-muted-hub mt-1">{provider.hint}</p>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-secondary-hub mb-1">URL do webhook (https)</label>
                            <div className="relative">
                                <input
                                    type={showUrl ? 'text' : 'password'}
                                    value={config.url}
                                    disabled={!canManage}
                                    onChange={(e) => update({ url: e.target.value })}
                                    placeholder="https://..."
                                    autoComplete="off"
                                    className="w-full pl-3 pr-10 py-2.5 text-xs font-mono bg-subtle border border-subtle rounded-xl outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-primary-hub"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowUrl(v => !v)}
                                    className="absolute right-2.5 top-2.5 text-muted-hub hover:text-primary-hub cursor-pointer"
                                    aria-label={showUrl ? 'Ocultar URL' : 'Mostrar URL'}
                                >
                                    {showUrl ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {config.url && !urlIsValid && (
                                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">A URL precisa começar com https://</p>
                            )}
                        </div>

                        <div>
                            <span className="block text-xs font-bold text-secondary-hub mb-2">Eventos enviados ao canal</span>
                            <div className="space-y-1.5">
                                {NOTIFICATION_EVENT_IDS.map(eventId => (
                                    <label key={eventId} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-subtle border border-subtle cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={config.events?.[eventId] !== false}
                                            disabled={!canManage}
                                            onChange={() => toggleEvent(eventId)}
                                            className="w-4 h-4"
                                        />
                                        <span className="text-xs font-semibold text-primary-hub">
                                            {NOTIFICATION_EVENTS[eventId].icon} {NOTIFICATION_EVENTS[eventId].label}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        {canManage ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    Salvar webhook
                                </button>
                                <button
                                    type="button"
                                    onClick={handleTest}
                                    disabled={testing || !config.url}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-strong text-secondary-hub hover:bg-subtle text-xs font-bold cursor-pointer disabled:opacity-50"
                                >
                                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    Enviar teste
                                </button>
                            </div>
                        ) : (
                            <p className="text-[11px] text-muted-hub">Somente a gestão pode alterar o webhook.</p>
                        )}
                    </div>

                    <div className="space-y-3">
                        <div className="p-4 rounded-2xl bg-subtle border border-subtle space-y-2">
                            <h3 className="text-xs font-bold text-primary-hub flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Privacidade
                            </h3>
                            <p className="text-[11px] text-secondary-hub leading-relaxed">
                                O canal recebe apenas um resumo do evento (quem lançou e o tipo). O conteúdo de feedbacks e de avaliações 1:1 nunca é enviado.
                                A URL fica visível somente para a gestão, porque quem tem a URL consegue postar mensagens no canal.
                            </p>
                        </div>
                        <div className="p-4 rounded-2xl bg-subtle border border-subtle space-y-2">
                            <h3 className="text-xs font-bold text-primary-hub flex items-center gap-1.5">
                                <Info className="w-4 h-4 text-blue-500" /> Como o envio funciona
                            </h3>
                            <ul className="text-[11px] text-secondary-hub leading-relaxed list-disc list-inside space-y-1">
                                <li>O aviso sai do navegador de quem lança o item, no momento em que ele salva.</li>
                                <li>Não há nova tentativa automática: se o envio falhar, a mensagem não é reenviada.</li>
                                <li>Alguns serviços não permitem confirmar a entrega pelo navegador; use "Enviar teste" e confira o canal.</li>
                                <li>Cada colaborador continua recebendo o próprio aviso dentro do Hubdesk, independentemente do webhook.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamWebhookSettings;

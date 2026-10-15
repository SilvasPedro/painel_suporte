/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/purity */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Info, X, Bell, Volume2, VolumeX, ArrowRight, Sparkles } from 'lucide-react';
import { 
    getNotificationPermission, 
    requestBrowserNotificationPermission, 
    dispatchBrowserNotification 
} from '../services/browserNotifications';
import { isSoundEnabled, setSoundEnabled, playNotificationChime } from '../services/notificationSound';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const [notifications, setNotifications] = useState([]);
    const [permission, setPermission] = useState(() => getNotificationPermission());
    const [soundOn, setSoundOn] = useState(() => isSoundEnabled());

    // Atualiza status de permissão reactivamente
    const refreshPermission = useCallback(() => {
        setPermission(getNotificationPermission());
    }, []);

    useEffect(() => {
        const handlePermissionChange = (e) => {
            if (e.detail?.permission) {
                setPermission(e.detail.permission);
            } else {
                refreshPermission();
            }
        };

        window.addEventListener('HUBDESK_NOTIFICATION_PERMISSION_CHANGE', handlePermissionChange);
        window.addEventListener('focus', refreshPermission);

        return () => {
            window.removeEventListener('HUBDESK_NOTIFICATION_PERMISSION_CHANGE', handlePermissionChange);
            window.removeEventListener('focus', refreshPermission);
        };
    }, [refreshPermission]);

    const toggleSound = (enabled) => {
        const next = typeof enabled === 'boolean' ? enabled : !soundOn;
        setSoundOn(next);
        setSoundEnabled(next);
        if (next) {
            playNotificationChime('test');
        }
    };

    const requestPermission = async (currentUser = null) => {
        const result = await requestBrowserNotificationPermission(currentUser);
        setPermission(result.status);
        return result;
    };

    /**
     * Exibe toast na interface
     */
    const showToast = (message, type = 'success', options = {}) => {
        const id = Date.now() + Math.random();
        const duration = options.duration || 5000;
        const newToast = {
            id,
            message,
            type,
            title: options.title,
            action: options.action, // { label: string, onClick: fn }
            icon: options.icon
        };

        setNotifications((prev) => [...prev, newToast]);
        setTimeout(() => removeToast(id), duration);
        return id;
    };

    const removeToast = (id) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    /**
     * Envia uma notificação completa (Push nativo no navegador + Toast na tela + Som)
     */
    const notify = async ({
        title,
        body,
        type = 'feedback',
        tag,
        data = {},
        action = null,
        onClick = null
    }) => {
        // 1. Toca som
        playNotificationChime(type === 'test' ? 'test' : 'feedback');

        // 2. Dispara notificação nativa do navegador
        const nativeShown = await dispatchBrowserNotification({
            title,
            body,
            tag,
            data,
            onClick: () => {
                if (typeof onClick === 'function') onClick(data);
                if (action?.onClick) action.onClick();
            },
            playSound: false // Já tocado acima
        });

        // 3. Exibe Toast em destaque no canto inferior direito
        showToast(body, type === 'test' ? 'info' : 'success', {
            title,
            duration: 8000,
            action: action || (onClick ? { label: 'Visualizar', onClick: () => onClick(data) } : null)
        });

        return nativeShown;
    };

    /**
     * Teste manual acionado pelo usuário
     */
    const testNotification = async () => {
        if (permission !== 'granted') {
            const req = await requestPermission();
            if (req.status !== 'granted') {
                showToast("Permissão de notificação não foi concedida no navegador.", "error");
                return false;
            }
        }

        return await notify({
            title: '🔔 Teste de Notificação HubDesk',
            body: 'Seu navegador está configurado! Você receberá alertas em tempo real de novos feedbacks e despachos.',
            type: 'test',
            tag: 'hubdesk-test-notification'
        });
    };

    return (
        <NotificationContext.Provider value={{
            showToast,
            notify,
            permission,
            requestPermission,
            testNotification,
            soundEnabled: soundOn,
            toggleSound,
            refreshPermission
        }}>
            {children}
            
            {/* CONTAINER DOS TOASTS FLUTUANTES COM DESIGN ELEGANTE */}
            <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-3 max-w-sm w-full pointer-events-none p-3 sm:p-0">
                {notifications.map((n) => (
                    <div 
                        key={n.id} 
                        className={`pointer-events-auto flex flex-col gap-2 p-4 rounded-2xl shadow-2xl border backdrop-blur-md transition-all animate-in slide-in-from-right-full duration-300 ${
                            n.type === 'success' 
                                ? 'bg-white/95 border-emerald-200 text-zinc-900 shadow-emerald-950/10' 
                                : n.type === 'error' 
                                ? 'bg-white/95 border-red-200 text-zinc-900 shadow-red-950/10' 
                                : 'bg-zinc-950/95 border-zinc-800 text-white shadow-black/30'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className="shrink-0 mt-0.5">
                                {n.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                                {n.type === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
                                {n.type === 'info' && <Bell className="w-5 h-5 text-blue-400" />}
                            </div>

                            <div className="flex-1 min-w-0">
                                {n.title && (
                                    <h4 className="text-xs font-black uppercase tracking-wider mb-0.5 flex items-center gap-1.5 opacity-90">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                        {n.title}
                                    </h4>
                                )}
                                <p className="text-xs font-medium leading-relaxed break-words opacity-90">{n.message}</p>
                            </div>

                            <button 
                                onClick={() => removeToast(n.id)} 
                                className="opacity-40 hover:opacity-100 transition-opacity p-1 text-inherit"
                                title="Fechar notificação"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Botão de ação opcional (ex: Ver Feedback) */}
                        {n.action && (
                            <div className="pt-2 border-t border-black/5 dark:border-white/10 flex justify-end">
                                <button
                                    onClick={() => {
                                        removeToast(n.id);
                                        n.action.onClick();
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
                                >
                                    <span>{n.action.label}</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
};

export const useNotification = () => useContext(NotificationContext);
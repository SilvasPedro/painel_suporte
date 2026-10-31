/* eslint-disable react-refresh/only-export-components */
/* eslint-disable react-hooks/purity */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { 
    CheckCircle, XCircle, Bell, Sparkles, ArrowRight, X
} from 'lucide-react';
import { 
    getNotificationPermission, 
    requestBrowserNotificationPermission, 
    dispatchBrowserNotification 
} from '../services/browserNotifications';
import { isSoundEnabled, setSoundEnabled, playNotificationChime } from '../services/notificationSound';
import { useAuth } from './AuthContext';
import { subscribeSharedCollection } from '../services/dataCache';

const NotificationContext = createContext();

const getStorageKey = (userId) => `hubdesk_notifications_history_${userId || 'guest'}`;

const loadInitialHistory = (userId) => {
    if (!userId) return [];
    try {
        const raw = localStorage.getItem(getStorageKey(userId));
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        console.warn('[NotificationContext] Erro ao carregar histórico:', e);
    }
    return [];
};

export const NotificationProvider = ({ children }) => {
    // Auth context (agora NotificationProvider está dentro de AuthProvider)
    const auth = useAuth?.() || {};
    const currentUser = auth.currentUser;
    const currentUserId = currentUser?.firestoreId || currentUser?.uid;

    const [notifications, setNotifications] = useState([]); // Toasts ativos na tela
    const [history, setHistory] = useState(() => loadInitialHistory(currentUserId));
    const [prevUserId, setPrevUserId] = useState(currentUserId);

    // Ajusta o histórico quando o usuário alternar
    if (prevUserId !== currentUserId) {
        setPrevUserId(currentUserId);
        setHistory(loadInitialHistory(currentUserId));
    }

    const [permission, setPermission] = useState(() => getNotificationPermission());
    const [soundOn, setSoundOn] = useState(() => isSoundEnabled());

    // Estados da bolinha vermelha pulsante na barra lateral (v3.8.3)
    const [pulseHistory, setPulseHistory] = useState(false); // Opção "Meu Histórico"
    const [pulseReports, setPulseReports] = useState(false); // Opção "Tarefas & Relatórios"

    // Salva histórico no localStorage
    const saveHistory = useCallback((newHistory) => {
        setHistory(newHistory);
        if (currentUserId) {
            try {
                localStorage.setItem(getStorageKey(currentUserId), JSON.stringify(newHistory.slice(0, 100)));
            } catch (e) {
                console.warn('[NotificationContext] Erro ao salvar histórico:', e);
            }
        }
    }, [currentUserId]);

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

    // Monitora feedbacks não lidos do usuário para acionar a bolinha pulsante em "Meu Histórico"
    useEffect(() => {
        if (!currentUserId) return;

        const unsubFeedbacks = subscribeSharedCollection('feedbacks', (items) => {
            if (!Array.isArray(items)) return;
            const hasUnread = items.some(f => 
                (f.colabId === currentUserId || f.collaboratorId === currentUserId) && 
                !f.read
            );
            if (hasUnread) {
                setPulseHistory(true);
            }
        });

        const unsubMonthly = subscribeSharedCollection('monthly_evaluations', (items) => {
            if (!Array.isArray(items)) return;
            const hasUnread = items.some(f => 
                (f.colabId === currentUserId || f.collaboratorId === currentUserId) && 
                !f.read
            );
            if (hasUnread) {
                setPulseHistory(true);
            }
        });

        return () => {
            unsubFeedbacks();
            unsubMonthly();
        };
    }, [currentUserId]);

    // Escuta eventos customizados de trigger e clear da bolinha pulsante
    useEffect(() => {
        const handleTriggerPulse = (e) => {
            const target = e.detail?.target;
            if (target === 'history' || target === 'feedback') {
                setPulseHistory(true);
            }
            if (target === 'reports' || target === 'report') {
                setPulseReports(true);
            }
        };

        const handleClearPulse = (e) => {
            const target = e.detail?.target;
            if (target === 'history') {
                setPulseHistory(false);
            }
            if (target === 'reports') {
                setPulseReports(false);
            }
        };

        const handleFeedbackRead = (e) => {
            const readId = e.detail?.id;
            if (readId) {
                // Marca notificação correspondente como lida no histórico
                setHistory(prev => {
                    const next = prev.map(item => 
                        (item.data?.feedback?.id === readId || item.id === `feedback-${readId}`)
                            ? { ...item, read: true }
                            : item
                    );
                    if (currentUserId) {
                        try {
                            localStorage.setItem(getStorageKey(currentUserId), JSON.stringify(next.slice(0, 100)));
                        } catch (err) {
                            console.warn('[NotificationContext] Erro ao salvar histórico:', err);
                        }
                    }
                    return next;
                });
            }
        };

        window.addEventListener('HUBDESK_TRIGGER_PULSE', handleTriggerPulse);
        window.addEventListener('HUBDESK_CLEAR_PULSE', handleClearPulse);
        window.addEventListener('HUBDESK_FEEDBACK_READ', handleFeedbackRead);

        return () => {
            window.removeEventListener('HUBDESK_TRIGGER_PULSE', handleTriggerPulse);
            window.removeEventListener('HUBDESK_CLEAR_PULSE', handleClearPulse);
            window.removeEventListener('HUBDESK_FEEDBACK_READ', handleFeedbackRead);
        };
    }, [currentUserId]);

    const toggleSound = (enabled) => {
        const next = typeof enabled === 'boolean' ? enabled : !soundOn;
        setSoundOn(next);
        setSoundEnabled(next);
        if (next) {
            playNotificationChime('test');
        }
    };

    const requestPermission = async (user = currentUser) => {
        const result = await requestBrowserNotificationPermission(user);
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
            action: options.action,
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
     * Envia uma notificação completa:
     * - Push nativo no navegador (Service Worker / Notification API)
     * - Som de alerta sintetizado
     * - Toast flutuante na tela
     * - Registro persistente no histórico de notificações recentes (v3.8.3)
     * - Ativação da bolinha pulsante na barra lateral ("Meu Histórico" ou "Tarefas & Relatórios")
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
            playSound: false
        });

        // 3. Exibe Toast em destaque no canto inferior direito
        showToast(body, type === 'test' ? 'info' : 'success', {
            title,
            duration: 8000,
            action: action || (onClick ? { label: 'Visualizar', onClick: () => onClick(data) } : null)
        });

        // 4. Registra no HISTÓRICO RECENTE de notificações (v3.8.3)
        const historyItem = {
            id: tag || `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: title || 'Notificação HubDesk',
            message: body || '',
            type, // 'feedback' | 'report' | 'report_status' | 'test' | 'info'
            timestamp: Date.now(),
            read: false,
            data: data || {},
            actionLabel: action?.label || (type === 'feedback' ? 'Ver Feedback' : type.includes('report') ? 'Ver Relatório' : null)
        };

        setHistory(prev => {
            // Evita duplicatas pelo id
            const filtered = prev.filter(n => n.id !== historyItem.id);
            const next = [historyItem, ...filtered].slice(0, 100);
            if (currentUserId) {
                try {
                    localStorage.setItem(getStorageKey(currentUserId), JSON.stringify(next));
                } catch (err) {
                    console.warn('[NotificationContext] Erro ao salvar histórico:', err);
                }
            }
            return next;
        });

        // 5. Ativação da bolinha vermelha pulsante na barra lateral (v3.8.3)
        if (type === 'feedback') {
            setPulseHistory(true);
        } else if (type === 'report' || type === 'report_status') {
            setPulseReports(true);
        }

        return nativeShown;
    };

    /**
     * Métodos de gerenciamento do Histórico de Notificações (v3.8.3)
     */
    const markAsRead = useCallback((id) => {
        setHistory(prev => {
            const next = prev.map(item => item.id === id ? { ...item, read: true } : item);
            saveHistory(next);
            return next;
        });
    }, [saveHistory]);

    const markAllAsRead = useCallback(() => {
        setHistory(prev => {
            const next = prev.map(item => ({ ...item, read: true }));
            saveHistory(next);
            return next;
        });
    }, [saveHistory]);

    const deleteNotification = useCallback((id) => {
        setHistory(prev => {
            const next = prev.filter(item => item.id !== id);
            saveHistory(next);
            return next;
        });
    }, [saveHistory]);

    const clearAllNotifications = useCallback(() => {
        saveHistory([]);
    }, [saveHistory]);

    const clearPulseHistory = useCallback(() => {
        setPulseHistory(false);
    }, []);

    const clearPulseReports = useCallback(() => {
        setPulseReports(false);
    }, []);

    const triggerPulse = useCallback((target) => {
        if (target === 'history' || target === 'feedback') setPulseHistory(true);
        if (target === 'reports' || target === 'report') setPulseReports(true);
    }, []);

    // Total de notificações não lidas no histórico
    const unreadCount = useMemo(() => {
        return history.filter(n => !n.read).length;
    }, [history]);

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
            body: 'Seu navegador está configurado! Você receberá alertas em tempo real de novos feedbacks e despachos de relatórios.',
            type: 'test',
            tag: `hubdesk-test-${Date.now()}`
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
            refreshPermission,
            // Histórico recente (v3.8.3)
            notificationHistory: history,
            unreadCount,
            markAsRead,
            markAllAsRead,
            deleteNotification,
            clearAllNotifications,
            // Bolinhas vermelhas pulsantes na barra lateral (v3.8.3)
            pulseHistory,
            pulseReports,
            clearPulseHistory,
            clearPulseReports,
            triggerPulse
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
                                className="opacity-40 hover:opacity-100 transition-opacity p-1 text-inherit cursor-pointer"
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
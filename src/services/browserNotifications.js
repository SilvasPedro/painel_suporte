import { playNotificationChime } from './notificationSound';
import { messaging, db } from './firebase';
import { getToken } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';

const VAPID_KEY = 'BGK2ZQE-DyWlwEk00nwgXppWc8kmJfidnErECA81peK1iUHkgf32D_9NgXxL73N7mED68U1ZEzRvT43tGQ1x0Vg';

/**
 * Retorna o status atual da permissão de notificações do navegador
 * @returns {'granted' | 'denied' | 'default' | 'unsupported'}
 */
export const getNotificationPermission = () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return 'unsupported';
    }
    return Notification.permission;
};

/**
 * Registra o Service Worker do Firebase Messaging se suportado
 */
export const registerMessagingServiceWorker = async () => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        return null;
    }
    try {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            scope: '/'
        });
        return registration;
    } catch (err) {
        console.warn('Falha ao registrar Service Worker de notificações:', err);
        return null;
    }
};

/**
 * Solicita permissão do navegador para exibir notificações
 */
export const requestBrowserNotificationPermission = async (currentUser = null) => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return { status: 'unsupported', token: null };
    }

    try {
        // Solicita permissão nativa
        const permission = await Notification.requestPermission();
        
        // Dispara evento global para re-renderizar componentes de UI inscritos
        window.dispatchEvent(new CustomEvent('HUBDESK_NOTIFICATION_PERMISSION_CHANGE', {
            detail: { permission }
        }));

        let fcmToken = null;

        if (permission === 'granted') {
            // Garante que o service worker está ativo
            await registerMessagingServiceWorker();

            // Tenta obter token FCM para redundância
            if (messaging) {
                try {
                    fcmToken = await getToken(messaging, { vapidKey: VAPID_KEY });
                    if (fcmToken && currentUser?.firestoreId) {
                        try {
                            await updateDoc(doc(db, 'collaborators', currentUser.firestoreId), {
                                fcmToken,
                                notificationsEnabled: true,
                                fcmUpdatedAt: new Date().toISOString()
                            });
                        } catch (e) {
                            console.warn('Aviso ao salvar token no Firestore:', e);
                        }
                    }
                } catch (fcmErr) {
                    console.warn('Aviso ao obter FCM token (notificação nativa web continuará ativa):', fcmErr);
                }
            }
        }

        return { status: permission, token: fcmToken };
    } catch (err) {
        console.error('Erro ao solicitar permissão de notificações:', err);
        return { status: 'denied', error: err.message };
    }
};

/**
 * Dispara uma notificação nativa do navegador (Web Push / Notification API)
 */
export const dispatchBrowserNotification = async ({
    title,
    body,
    icon = '/favicon_red.png',
    badge = '/favicon_red.png',
    tag,
    data = {},
    onClick = null,
    playSound = true
}) => {
    // 1. Toca o sinal sonoro suave sintetizado
    if (playSound) {
        playNotificationChime(data?.type === 'test' ? 'test' : 'feedback');
    }

    const permission = getNotificationPermission();
    if (permission !== 'granted') {
        return false;
    }

    const options = {
        body,
        icon,
        badge,
        tag: tag || `hubdesk-notif-${Date.now()}`,
        renotify: true,
        vibrate: [200, 100, 200],
        requireInteraction: false,
        data: {
            ...data,
            timestamp: Date.now()
        }
    };

    let notificationShown = false;

    // 2. Método moderno: Tenta disparar via Service Worker Registration (funciona com abas em segundo plano)
    try {
        if ('serviceWorker' in navigator) {
            const reg = await navigator.serviceWorker.ready;
            if (reg && reg.showNotification) {
                await reg.showNotification(title, options);
                notificationShown = true;
            }
        }
    } catch (swErr) {
        console.warn('Aviso ao disparar notificação via Service Worker:', swErr);
    }

    // 3. Método padrão de fallback: new Notification()
    if (!notificationShown) {
        try {
            const notif = new Notification(title, options);
            notif.onclick = function (event) {
                event.preventDefault();
                window.focus();
                notif.close();

                if (typeof onClick === 'function') {
                    onClick(data);
                }

                window.dispatchEvent(new CustomEvent('HUBDESK_OPEN_NOTIFICATION', {
                    detail: { ...data, title, body }
                }));
            };
            notificationShown = true;
        } catch (notifErr) {
            console.warn('Aviso ao disparar notificação via Notification API:', notifErr);
        }
    }

    return notificationShown;
};

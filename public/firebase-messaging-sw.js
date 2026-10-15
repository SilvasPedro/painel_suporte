/* eslint-disable no-undef */
// Service Worker para Notificações Push e Background Messaging (v3.8.0)
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyDyJHliLhSH5Oxq9iS5m1WA2yfFNgfQQAE",
    authDomain: "prodigyapp-73141.firebaseapp.com",
    projectId: "prodigyapp-73141",
    storageBucket: "prodigyapp-73141.firebasestorage.app",
    messagingSenderId: "573565202933",
    appId: "1:573565202933:web:c0615b224663a0931430bc",
    measurementId: "G-TD5TN22MEN"
};

try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // Lida com notificações recebidas via FCM quando o navegador está em segundo plano
    messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Notificação FCM em segundo plano:', payload);
        
        const title = payload?.notification?.title || payload?.data?.title || '📢 HubDesk • Novo Alerta';
        const options = {
            body: payload?.notification?.body || payload?.data?.body || 'Você possui uma nova atualização.',
            icon: '/favicon_red.png',
            badge: '/favicon_red.png',
            vibrate: [200, 100, 200],
            tag: payload?.data?.tag || `hubdesk-fcm-${Date.now()}`,
            data: payload?.data || {},
            actions: [
                { action: 'open', title: 'Ver Agora' }
            ]
        };

        self.registration.showNotification(title, options);
    });
} catch (err) {
    console.warn('[firebase-messaging-sw.js] Firebase Messaging não inicializado:', err);
}

// Evento ao clicar na notificação nativa do sistema operacional ou navegador
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const notificationData = event.notification.data || {};

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Se já existir uma aba do HubDesk aberta, foca nela e envia mensagem para abrir o item
            for (const client of clientList) {
                if ('focus' in client) {
                    client.postMessage({
                        type: 'HUBDESK_NOTIFICATION_CLICK',
                        data: notificationData
                    });
                    return client.focus();
                }
            }
            // Se nenhuma janela estiver aberta, abre a tela de histórico
            if (self.clients.openWindow) {
                return self.clients.openWindow('/?tab=history');
            }
        })
    );
});
// Importa os scripts do Firebase compatíveis com Service Workers
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "mock-api-key",
    authDomain: "mock-app.firebaseapp.com",
    projectId: "mock-project-id",
    storageBucket: "mock-app.firebasestorage.app",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:000000000000000000",
    measurementId: "G-0000000000"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Lida com as notificações quando o app está em SEGUNDO PLANO
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Notificação recebida em segundo plano ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.png' 
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
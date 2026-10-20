import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getMessaging } from "firebase/messaging";

// Substitua pelos seus dados reais do console ou arquivo de variáveis de ambiente
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDyJHliLhSH5Oxq9iS5m1WA2yfFNgfQQAE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "prodigyapp-73141.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "prodigyapp-73141",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "prodigyapp-73141.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "573565202933",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:573565202933:web:c0615b224663a0931430bc",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-TD5TN22MEN"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa Firestore com Cache Persistente Local em IndexedDB (Multi-Aba)
// Reduz drasticamente as leituras no Firebase servindo dados do cache local
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  console.warn("Aviso ao inicializar cache persistente do Firestore, usando fallback padrão:", e);
  firestoreDb = getFirestore(app);
}

// Exporta as instâncias para usar nos componentes
export const db = firestoreDb;
export const auth = getAuth(app);

let messagingInstance = null;
try {
  if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
    messagingInstance = getMessaging(app);
  }
} catch (e) {
  console.warn('Firebase Messaging não suportado neste navegador:', e);
}
export const messaging = messagingInstance;

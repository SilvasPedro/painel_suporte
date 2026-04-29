import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Substitua pelos seus dados reais do console
export const firebaseConfig = {
  apiKey: "AIzaSyDyJHliLhSH5Oxq9iS5m1WA2yfFNgfQQAE",
  authDomain: "prodigyapp-73141.firebaseapp.com",
  projectId: "prodigyapp-73141",
  storageBucket: "prodigyapp-73141.firebasestorage.app",
  messagingSenderId: "573565202933",
  appId: "1:573565202933:web:65794d32184aeeab1430bc",
  measurementId: "G-SLMR72TY9F"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta as instâncias para usar nos componentes
export const db = getFirestore(app);
export const auth = getAuth(app);
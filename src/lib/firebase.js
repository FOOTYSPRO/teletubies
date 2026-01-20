// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage"; // <--- IMPORTANTE

const firebaseConfig = {
  // ... TUS CLAVES DE FIREBASE AQUÍ (NO LAS BORRES) ...
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

// Inicializar Firebase (Singleton)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app); // <--- INICIALIZAR STORAGE

export { db, storage }; // <--- EXPORTAR AMBOS
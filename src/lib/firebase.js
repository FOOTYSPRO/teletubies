import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// ⚠️ SUSTITUYE ESTO CON TUS DATOS REALES DE FIREBASE
// (Copia y pega tal cual te lo da Firebase, con las comillas)
const firebaseConfig = {
  apiKey: "AIzaSyD.... (TU API KEY LARGA)",
  authDomain: "teletubies-....firebaseapp.com",
  projectId: "teletubies-....",
  storageBucket: "teletubies-....appspot.com",
  messagingSenderId: "123456...",
  appId: "1:123456..."
};

// Inicialización segura (evita errores al recargar)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// Chivato para ver si carga en la consola (F12)
console.log("🔥 Firebase Iniciado con Project ID:", firebaseConfig.projectId);

export { db };
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Tus claves reales (Configuración Hardcoded para que funcione sí o sí)
const firebaseConfig = {
  apiKey: "AIzaSyAAwbdCeErhek15NTBGXB91f8EFT6FKXKA",
  authDomain: "teletubies-59d65.firebaseapp.com",
  projectId: "teletubies-59d65",
  storageBucket: "teletubies-59d65.firebasestorage.app",
  messagingSenderId: "1069837715964",
  appId: "1:1069837715964:web:5d172d77c667a2e8bbca79"
};

// Inicializar Firebase (Patrón Singleton para evitar errores al recargar)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Servicios
const db = getFirestore(app);
const storage = getStorage(app);

// Chivato en consola para confirmar conexión
console.log("🔥 Firebase Conectado a:", firebaseConfig.projectId);

export { db, storage };
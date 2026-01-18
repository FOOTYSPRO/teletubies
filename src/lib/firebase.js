import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // 👈 Esto es clave para la base de datos

const firebaseConfig = {
  apiKey: "AIzaSyAAwbdCeErhek15NTBGXB91f8EFT6FKXKA",
  authDomain: "teletubies-59d65.firebaseapp.com",
  projectId: "teletubies-59d65",
  storageBucket: "teletubies-59d65.firebasestorage.app",
  messagingSenderId: "1069837715964",
  appId: "1:1069837715964:web:5d172d77c667a2e8bbca79"
};

// Inicializamos la App
const app = initializeApp(firebaseConfig);

// Inicializamos y exportamos la Base de Datos
export const db = getFirestore(app);
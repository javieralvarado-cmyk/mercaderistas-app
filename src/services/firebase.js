// ============================================================
// CONFIGURACIÓN FIREBASE
// Reemplaza estos valores con los de tu proyecto Firebase
// Ve a: https://console.firebase.google.com
// → Crear proyecto → Agregar app web → Copiar config
// ============================================================
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyDHcBHrCPxJFkSXF4LDmI1NmKqJjAqQiRY",
  authDomain: "mercaderistas-d83a2.firebaseapp.com",
  projectId: "mercaderistas-d83a2",
  storageBucket: "mercaderistas-d83a2.firebasestorage.app",
  messagingSenderId: "173977791145",
  appId: "1:173977791145:web:b4a94ee72911a7d254d7b8",
  measurementId: "G-XM0HDRFQBK"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)

export default app

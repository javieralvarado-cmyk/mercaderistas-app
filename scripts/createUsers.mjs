/**
 * FreshCo — Script para crear cuentas reales de usuarios
 *
 * Uso:
 *   node scripts/createUsers.mjs
 *
 * Requisitos:
 *   1. Descarga la clave de servicio desde Firebase Console:
 *      Project Settings → Service Accounts → "Generate new private key"
 *      Guárdala como: scripts/serviceAccount.json
 *   2. npm install firebase-admin (ya hecho)
 */

import { readFileSync } from 'fs'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// ─── Configuración ─────────────────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = new URL('./serviceAccount.json', import.meta.url).pathname

// Contraseña inicial para todos los usuarios (se puede cambiar desde la app o la consola Firebase)
const CLAVE_INICIAL = 'FreshCo2025!'

// Lista de usuarios a crear
// Agrega transportistas aquí cuando tengas sus datos
const USUARIOS = [
  {
    name:  'Darkiris',
    email: 'darkiris@freshcopty.com',
    role:  'mercaderista',
  },
  {
    name:  'Digna',
    email: 'digna@freshcopty.com',
    role:  'mercaderista',
  },
  // Descomenta y edita cuando tengas los datos reales:
  // {
  //   name:  'Nombre Transportista 1',
  //   email: 'transportista1@freshcopty.com',
  //   role:  'transportista',
  // },
  // {
  //   name:  'Nombre Transportista 2',
  //   email: 'transportista2@freshcopty.com',
  //   role:  'transportista',
  // },
]

// ─── Inicializar Firebase Admin ─────────────────────────────────────────────
let serviceAccount
try {
  serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))
} catch {
  console.error('❌  No se encontró scripts/serviceAccount.json')
  console.error('    Descárgala desde Firebase Console → Project Settings → Service Accounts')
  process.exit(1)
}

initializeApp({ credential: cert(serviceAccount) })
const auth = getAuth()
const db   = getFirestore()

// ─── Crear usuarios ─────────────────────────────────────────────────────────
console.log('\n🚀  Creando cuentas de FreshCo...\n')

for (const u of USUARIOS) {
  try {
    // 1. Crear (o reutilizar) el usuario en Firebase Auth
    let uid
    try {
      const existing = await auth.getUserByEmail(u.email)
      uid = existing.uid
      console.log(`⚠️   ${u.name} (${u.email}) ya existe → uid: ${uid}`)
    } catch {
      const created = await auth.createUser({
        email:         u.email,
        password:      CLAVE_INICIAL,
        displayName:   u.name,
        emailVerified: true,
      })
      uid = created.uid
      console.log(`✅  Creado en Auth: ${u.name} (${u.email}) → uid: ${uid}`)
    }

    // 2. Crear / actualizar el documento en Firestore /users/{uid}
    await db.collection('users').doc(uid).set({
      name:  u.name,
      email: u.email,
      role:  u.role,
    }, { merge: true })

    console.log(`    📄  /users/${uid} guardado en Firestore`)
  } catch (err) {
    console.error(`❌  Error con ${u.name}: ${err.message}`)
  }
}

console.log(`
─────────────────────────────────────────────
✅  Proceso terminado.

Contraseña inicial de todos: ${CLAVE_INICIAL}

👉  Recuerda pedirle a cada persona que cambie
    su contraseña la primera vez que entren.
─────────────────────────────────────────────
`)

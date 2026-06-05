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
 *
 * Resultado: genera un link por persona para que cada una cree su propia contraseña.
 *            Mándalos por WhatsApp — el link expira en 1 hora.
 */

import { readFileSync } from 'fs'
import { cert, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import crypto from 'crypto'

// ─── Usuarios a crear ───────────────────────────────────────────────────────
// Agrega transportistas descomentando las líneas de abajo
const USUARIOS = [
  { name: 'darkiris', email: 'darkiris@freshcopty.com', role: 'mercaderista' },
  { name: 'digna',    email: 'digna@freshcopty.com',    role: 'mercaderista' },
  // { name: 'transportista1', email: 'transportista1@freshcopty.com', role: 'transportista' },
  // { name: 'transportista2', email: 'transportista2@freshcopty.com', role: 'transportista' },
]

// ─── Inicializar Firebase Admin ─────────────────────────────────────────────
const SERVICE_ACCOUNT_PATH = new URL('./serviceAccount.json', import.meta.url).pathname

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

// ─── Crear usuarios y generar links ─────────────────────────────────────────
console.log('\n🚀  Creando cuentas de FreshCo...\n')

const links = []

for (const u of USUARIOS) {
  try {
    let uid

    try {
      const existing = await auth.getUserByEmail(u.email)
      uid = existing.uid
      console.log(`⚠️   ${u.name} ya existe → uid: ${uid}`)
    } catch {
      const created = await auth.createUser({
        email:         u.email,
        password:      crypto.randomBytes(16).toString('hex'), // temporal, se reemplaza al usar el link
        displayName:   u.name,
        emailVerified: true,
      })
      uid = created.uid
      console.log(`✅  Cuenta creada: ${u.name} (${u.email})`)
    }

    await db.collection('users').doc(uid).set(
      { name: u.name, email: u.email, role: u.role },
      { merge: true }
    )

    const link = await auth.generatePasswordResetLink(u.email)
    links.push({ name: u.name, email: u.email, link })
    console.log(`    🔗  Link de contraseña generado para ${u.name}`)

  } catch (err) {
    console.error(`❌  Error con ${u.name}: ${err.message}`)
  }
}

// ─── Imprimir links para copiar/pegar en WhatsApp ────────────────────────────
console.log(`
══════════════════════════════════════════════
  LINKS PARA ENVIAR POR WHATSAPP (expiran en 1h)
══════════════════════════════════════════════
`)

for (const { name, email, link } of links) {
  console.log(`👤  ${name.toUpperCase()} (${email})`)
  console.log(`    Hola ${name}, aquí está tu link para crear tu contraseña de FreshCo:`)
  console.log(`    ${link}`)
  console.log()
}

console.log(`══════════════════════════════════════════════
Una vez que entren, el usuario es su email
y la contraseña la crean ellas mismas.
══════════════════════════════════════════════
`)

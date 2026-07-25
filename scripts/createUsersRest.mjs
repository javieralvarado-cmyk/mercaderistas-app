// Crea usuarios de FreshCo usando la API REST de Firebase (sin serviceAccount.json)
import crypto from 'crypto'

const API_KEY    = 'AIzaSyDHcBHrCPxJFkSXF4LDmI1NmKqJjAqQiRY'
const PROJECT_ID = 'mercaderistas-d83a2'

const USUARIOS = [
  { name: 'darkiris', email: 'darkiris@freshcopty.com', role: 'mercaderista' },
  { name: 'digna',    email: 'digna@freshcopty.com',    role: 'mercaderista' },
]

for (const u of USUARIOS) {
  console.log(`\n→ Creando ${u.name}...`)

  // 1. Crear en Firebase Auth
  const signUp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: u.email,
        password: crypto.randomBytes(16).toString('hex'),
        returnSecureToken: true,
      }),
    }
  ).then(r => r.json())

  if (signUp.error) {
    console.error(`  ❌ Auth error: ${signUp.error.message}`)
    continue
  }

  const { localId: uid, idToken } = signUp
  console.log(`  ✅ Auth creado: uid=${uid}`)

  // 2. Crear documento en Firestore /users/{uid}
  const fs = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          name:  { stringValue: u.name },
          email: { stringValue: u.email },
          role:  { stringValue: u.role },
        },
      }),
    }
  ).then(r => r.json())

  if (fs.error) {
    console.error(`  ❌ Firestore error: ${fs.error.message}`)
  } else {
    console.log(`  ✅ Firestore: /users/${uid}`)
  }

  // 3. Enviar email para que creen su contraseña
  const reset = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email: u.email }),
    }
  ).then(r => r.json())

  if (reset.error) {
    console.error(`  ⚠️  Reset email error: ${reset.error.message}`)
  } else {
    console.log(`  ✅ Email de contraseña enviado a ${u.email}`)
  }
}

console.log('\n══════════════════════════════════════════')
console.log('Listo. Darkiris y Digna recibirán un email')
console.log('para crear su contraseña y entrar a la app.')
console.log('══════════════════════════════════════════')

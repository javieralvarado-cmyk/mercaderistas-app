/**
 * FreshCo — Script para borrar TODOS los datos de prueba
 *
 * Borra:
 *   - Todas las visitas (/visits)
 *   - Todas las órdenes de compra (/purchaseOrders)
 *
 * Uso:
 *   node scripts/clearTestData.mjs
 *
 * Requisito: scripts/serviceAccount.json debe existir
 * (Firebase Console → Project Settings → Service Accounts → Generate new private key)
 */

import { readFileSync } from 'fs'
import { cert, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const SERVICE_ACCOUNT_PATH = new URL('./serviceAccount.json', import.meta.url).pathname

let serviceAccount
try {
  serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'))
} catch {
  console.error('❌  No se encontró scripts/serviceAccount.json')
  process.exit(1)
}

initializeApp({ credential: cert(serviceAccount) })
const db = getFirestore()

async function borrarColeccion(nombre) {
  const snap = await db.collection(nombre).get()
  if (snap.empty) {
    console.log(`   ${nombre}: ya está vacía`)
    return 0
  }
  // Firestore borra en lotes de 500
  const lotes = []
  let lote = db.batch()
  let cuenta = 0
  snap.docs.forEach((d, i) => {
    lote.delete(d.ref)
    cuenta++
    if ((i + 1) % 500 === 0) { lotes.push(lote); lote = db.batch() }
  })
  lotes.push(lote)
  await Promise.all(lotes.map(l => l.commit()))
  return cuenta
}

console.log('\n🗑️   Borrando datos de prueba de FreshCo...\n')

const visitas = await borrarColeccion('visits')
console.log(`✅  visits: ${visitas} registros eliminados`)

const ordenes = await borrarColeccion('purchaseOrders')
console.log(`✅  purchaseOrders: ${ordenes} registros eliminados`)

console.log('\n─────────────────────────────')
console.log('✅  Listo. Firestore queda limpio.')
console.log('    (Los usuarios /users y tiendas /supermarkets NO se tocaron)')
console.log('─────────────────────────────\n')

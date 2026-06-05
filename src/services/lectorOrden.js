// Lee una orden de compra (PDF/imagen) usando el mini-servidor de IA
import { PRODUCTOS, aUnidades } from './datos'

// En producción: VITE_PROXY_URL viene de .env.production (URL de Render)
// En desarrollo: cae al localhost por defecto
const PROXY_URL = import.meta.env.VITE_PROXY_URL || 'http://localhost:3001/leer-orden'

function archivoABase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1]) // quita "data:...;base64,"
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Llama al servidor → devuelve { ordenes: [...] }
export async function leerOrden(file) {
  const fileBase64 = await archivoABase64(file)
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileBase64, mediaType: file.type }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ? JSON.stringify(err.error) : 'Error leyendo la orden')
  }
  return res.json()
}

function normalizar(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Empareja el texto del "ship to" con una tienda del catálogo (por palabras compartidas)
export function emparejarTienda(tiendaDestino, tiendas) {
  const destino = normalizar(tiendaDestino)
  const palabrasDestino = new Set(destino.split(/[^a-z0-9]+/).filter(w => w.length > 2))
  let mejor = null, mejorScore = 0
  tiendas.forEach(t => {
    const texto = normalizar(`${t.name} ${t.ciudad} ${t.provincia}`)
    const palabras = texto.split(/[^a-z0-9]+/)
    let score = 0
    palabras.forEach(w => { if (w.length > 2 && palabrasDestino.has(w)) score++ })
    if (score > mejorScore) { mejorScore = score; mejor = t }
  })
  return mejorScore > 0 ? mejor : null
}

// Empareja la descripción de un ítem con un producto del catálogo
export function emparejarProducto(descripcion) {
  const desc = normalizar(descripcion)
  // 1) por código de barras si aparece
  const porBarras = PRODUCTOS.find(p => p.codBarras && desc.includes(p.codBarras))
  if (porBarras) return porBarras
  // 2) por palabras clave de la marca + nombre
  let mejor = null, mejorScore = 0
  PRODUCTOS.forEach(p => {
    const claves = normalizar(`${p.marca} ${p.nombre}`).split(/[^a-z0-9]+/).filter(w => w.length > 2)
    let score = 0
    claves.forEach(w => { if (desc.includes(w)) score++ })
    if (score > mejorScore) { mejorScore = score; mejor = p }
  })
  return mejorScore > 0 ? mejor : null
}

// Convierte una orden leída en items listos para guardar (cantidades en unidades)
export function prepararItems(itemsLeidos) {
  const items = []
  const noReconocidos = []
  ;(itemsLeidos || []).forEach(it => {
    const prod = emparejarProducto(it.descripcion)
    if (!prod) { noReconocidos.push(it.descripcion); return }
    items.push({
      productoId: prod.id,
      nombre: prod.nombre,
      marca: prod.marca,
      cantidad: aUnidades(it.cantidad, it.unidad, prod),
      precioUnitario: Number(it.precioUnitario) || 0,
      descripcionOriginal: it.descripcion,
    })
  })
  return { items, noReconocidos }
}

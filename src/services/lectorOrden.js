// ════════════════════════════════════════════════════════════
// Lector de órdenes de compra GRATIS — 100% en el navegador.
// Extrae el texto del PDF con pdf.js (sin servidor, sin API, sin costo)
// y arma las órdenes localmente. Para fotos/imágenes usa la carga manual.
// ════════════════════════════════════════════════════════════
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PRODUCTOS, aUnidades } from './datos'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// ─── Utilidades de texto ────────────────────────────────────────
function normalizar(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

// Número en formato latino: el PUNTO es decimal, no separador de miles.
// "24.000" → 24 · "2.500" → 2.5 · "1.13" → 1.13
function aNumero(token) {
  const t = (token || '').replace(/[^0-9.,]/g, '').replace(/,/g, '')
  if (!t) return NaN
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : NaN
}

// ─── Extraer texto del PDF, reconstruyendo líneas por posición ──
async function paginasDePDF(file) {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const paginas = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    // Agrupar los fragmentos por su coordenada Y (misma fila) y ordenarlos por X
    const filas = {}
    tc.items.forEach(it => {
      if (!it.str || !it.str.trim()) return
      const y = Math.round(it.transform[5])            // posición vertical
      const x = it.transform[4]                         // posición horizontal
      const key = Math.round(y / 3) * 3                 // tolerancia de ±3px
      ;(filas[key] = filas[key] || []).push({ x, str: it.str })
    })
    const lineas = Object.keys(filas)
      .sort((a, b) => Number(b) - Number(a))            // de arriba hacia abajo
      .map(k => filas[k].sort((a, b) => a.x - b.x).map(o => o.str).join(' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    paginas.push(lineas)
  }
  return paginas
}

// ─── Extraer un campo con una lista de etiquetas posibles ───────
function buscarCampo(lineas, etiquetas) {
  const et = etiquetas.map(normalizar)
  for (const linea of lineas) {
    const norm = normalizar(linea)
    for (const e of et) {
      const i = norm.indexOf(e)
      if (i >= 0) {
        const resto = linea.slice(i + e.length).replace(/^[:\s#.\-]+/, '').trim()
        if (resto) return resto
      }
    }
  }
  return ''
}

// ─── Parsear una página → una orden ─────────────────────────────
function parsearOrden(lineas) {
  const texto = lineas.join('\n')

  const numeroOrden = buscarCampo(lineas, ['No. Pedido', 'No Pedido', 'Nº Pedido', 'Numero de Pedido', 'Pedido', 'Orden', 'PO', 'Order'])
    .split(/\s/)[0] || ''
  const proveedor = buscarCampo(lineas, ['Proveedor', 'Vendor', 'Suplidor'])
  const fechaMatch = texto.match(/(\d{2}[./-]\d{2}[./-]\d{4})/)
  const fecha = fechaMatch ? fechaMatch[1] : ''

  // Tienda destino: la etiqueta + lo que sigue en esa línea y la siguiente
  let tiendaDestino = ''
  const etTienda = ['Direccion de Entrega', 'Dirección de Entrega', 'Ship to', 'Ship To', 'Entregar en', 'Destino']
    .map(normalizar)
  for (let i = 0; i < lineas.length; i++) {
    const norm = normalizar(lineas[i])
    const hit = etTienda.find(e => norm.includes(e))
    if (hit) {
      const idx = norm.indexOf(hit)
      const resto = lineas[i].slice(idx + hit.length).replace(/^[:\s#.\-]+/, '').trim()
      tiendaDestino = [resto, lineas[i + 1] || ''].join(' ').trim()
      break
    }
  }

  // Items: por cada línea que empareje con un producto del catálogo,
  // sacar cantidad (número antes de UN/CJ) y precio (número después).
  const items = []
  lineas.forEach(linea => {
    const prod = emparejarProducto(linea)
    if (!prod) return
    const tokens = linea.split(/\s+/)
    const idxUM = tokens.findIndex(t => /^(un|cj|und|unidad|caja|cjs?)\.?$/i.test(t))
    let cantidad = NaN, unidad = 'UN', precioUnitario = 0
    if (idxUM >= 0) {
      unidad = /cj|caja/i.test(tokens[idxUM]) ? 'CJ' : 'UN'
      cantidad = aNumero(tokens[idxUM - 1])
      precioUnitario = aNumero(tokens[idxUM + 1])
    } else {
      // Sin columna UM: tomar el primer número "de cantidad" tras la descripción
      const nums = tokens.map(aNumero).filter(n => Number.isFinite(n))
      cantidad = nums.length ? nums[0] : NaN
    }
    if (!Number.isFinite(cantidad) || cantidad <= 0) return
    items.push({
      descripcion: linea,
      cantidad,
      unidad,
      precioUnitario: Number.isFinite(precioUnitario) ? precioUnitario : 0,
    })
  })

  return { proveedor, numeroOrden, fecha, tiendaDestino, items }
}

// ─── API pública: leer un archivo → { ordenes: [...] } ──────────
// Misma forma que devolvía el servidor de IA, para no tocar el resto de la app.
export async function leerOrden(file) {
  const esPdf = (file.type || '').includes('pdf') || /\.pdf$/i.test(file.name || '')
  if (!esPdf) {
    throw new Error('Por ahora el lector gratis funciona con PDF. Para una foto, usa "Nueva orden de compra" y llena las cantidades a mano.')
  }
  const paginas = await paginasDePDF(file)
  const textoTotal = paginas.flat().join('').trim()
  if (!textoTotal) {
    throw new Error('El PDF no tiene texto seleccionable (parece escaneado como imagen). Usa "Nueva orden de compra" para cargarlo a mano.')
  }
  const ordenes = paginas
    .map(parsearOrden)
    .filter(o => o.items.length > 0 || o.numeroOrden || o.tiendaDestino)
  return { ordenes }
}

// ─── Emparejadores (sin cambios) ────────────────────────────────
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
  // 2) por palabras clave de la marca + nombre (al menos 2 coincidencias para evitar falsos positivos)
  let mejor = null, mejorScore = 0
  PRODUCTOS.forEach(p => {
    const claves = normalizar(`${p.marca} ${p.nombre}`).split(/[^a-z0-9]+/).filter(w => w.length > 2)
    let score = 0
    claves.forEach(w => { if (desc.includes(w)) score++ })
    if (score > mejorScore) { mejorScore = score; mejor = p }
  })
  return mejorScore >= 2 ? mejor : null
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

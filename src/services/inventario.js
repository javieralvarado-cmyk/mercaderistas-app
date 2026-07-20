// ════════════════════════════════════════════════════════════
// Lógica de inventario y comisiones (pura, sin UI)
//   - stockCentral: entradas de almacén − salidas por órdenes de compra
//   - stockAnaquel: stock actual en tienda (última visita de cada súper)
//   - comisionesPorMercaderista: vendidos × comisión por categoría
//   - ventasPorDia / ventasPorProducto: para las gráficas de tendencia
// ════════════════════════════════════════════════════════════
import { PRODUCTOS, comisionUnidad } from './datos'

const num = (x) => Number(x) || 0

// Estados de orden que SÍ descuentan del almacén (una "compra" que salió o va en camino).
// 'no_entregada' NO descuenta: el producto no salió / regresó.
const SALIDA_ESTADOS = new Set(['pendiente', 'entregado', 'faltante'])

// Empareja un item/producto de visita u orden con el catálogo maestro.
function prodDe(idOrItem) {
  const id = typeof idOrItem === 'object' ? (idOrItem.productoId ?? idOrItem.id) : idOrItem
  return PRODUCTOS.find(p => p.id === id) || null
}

// ─── INVENTARIO CENTRAL (almacén) ───────────────────────────────
// entradas: [{ productoId, cantidad }]  (colección inventarioEntradas)
// ordenes:  [{ estado, items:[{ productoId, cantidad }] }]  (purchaseOrders)
// → devuelve una fila por producto con entrada, salida y stock actual.
export function stockCentral(entradas = [], ordenes = []) {
  const filas = PRODUCTOS.map(p => ({
    ...p, entrada: 0, salida: 0, stock: 0,
  }))
  const byId = Object.fromEntries(filas.map(f => [f.id, f]))

  entradas.forEach(e => {
    const f = byId[e.productoId]
    if (f) f.entrada += num(e.cantidad)
  })

  ordenes.forEach(o => {
    if (!SALIDA_ESTADOS.has(o.estado)) return
    ;(o.items || []).forEach(it => {
      const f = byId[it.productoId]
      if (f) f.salida += num(it.cantidad)
    })
  })

  filas.forEach(f => { f.stock = f.entrada - f.salida })
  return filas
}

// ─── INVENTARIO EN ANAQUEL (por tienda) ─────────────────────────
// visitas: visitas 'completada' (de un rango). Toma la MÁS RECIENTE por tienda.
// → { porProducto:[{...prod, unidades}], porTienda:[{supermercadoName, fecha, productos:[{id,nombre,unidades}]}] }
export function stockAnaquel(visitas = []) {
  const completadas = visitas.filter(v => v.estado === 'completada')
  // última visita por tienda (por fecha + hora)
  const ultimaPorTienda = {}
  completadas.forEach(v => {
    const key = v.supermercadoId || v.supermercadoName
    const prev = ultimaPorTienda[key]
    const stamp = (v.fecha || '') + (v.horaEntrada || '')
    const prevStamp = prev ? (prev.fecha || '') + (prev.horaEntrada || '') : ''
    if (!prev || stamp > prevStamp) ultimaPorTienda[key] = v
  })

  const totales = Object.fromEntries(PRODUCTOS.map(p => [p.id, 0]))
  const porTienda = Object.values(ultimaPorTienda).map(v => {
    const productos = (v.productos || []).map(p => {
      const unidades = num(p.stockGondola) + num(p.stockBodega)
      if (totales[p.id] != null) totales[p.id] += unidades
      return { id: p.id, nombre: p.nombre, unidades }
    })
    return { supermercadoName: v.supermercadoName, fecha: v.fecha, productos }
  }).sort((a, b) => (a.supermercadoName || '').localeCompare(b.supermercadoName || ''))

  const porProducto = PRODUCTOS.map(p => ({ ...p, unidades: totales[p.id] || 0 }))
  return { porProducto, porTienda }
}

// ─── COMISIONES ─────────────────────────────────────────────────
// visitas: 'completada' de un rango. Suma vendidos × comisión por mercaderista y categoría.
export function comisionesPorMercaderista(visitas = []) {
  const porMerc = {}
  const catVacia = () => ({ jugo: { u: 0, c: 0 }, picante: { u: 0, c: 0 }, cafe: { u: 0, c: 0 } })

  visitas.filter(v => v.estado === 'completada').forEach(v => {
    const key = v.mercaderistaId || v.mercaderistaName || 'desconocido'
    if (!porMerc[key]) porMerc[key] = { mercaderistaId: v.mercaderistaId, mercaderistaName: v.mercaderistaName || key, cat: catVacia(), totalU: 0, totalC: 0 }
    ;(v.productos || []).forEach(p => {
      const prod = prodDe(p) || p
      const cat = prod.categoria
      if (!cat || !porMerc[key].cat[cat]) return
      const u = num(p.vendidos)
      if (u <= 0) return
      const c = u * comisionUnidad(prod)
      porMerc[key].cat[cat].u += u
      porMerc[key].cat[cat].c += c
      porMerc[key].totalU += u
      porMerc[key].totalC += c
    })
  })

  const filas = Object.values(porMerc)
    .filter(m => m.totalU > 0)
    .sort((a, b) => b.totalC - a.totalC)
  const totalComision = filas.reduce((s, m) => s + m.totalC, 0)
  const totalUnidades = filas.reduce((s, m) => s + m.totalU, 0)
  return { filas, totalComision, totalUnidades }
}

// ─── TENDENCIA ──────────────────────────────────────────────────
// Unidades vendidas agrupadas por fecha (para gráfica de línea).
// → { fechas:[...], series:{ jugo:[...], picante:[...], cafe:[...], total:[...] } }
export function ventasPorDia(visitas = []) {
  const porFecha = {}
  visitas.filter(v => v.estado === 'completada').forEach(v => {
    const f = v.fecha
    if (!f) return
    if (!porFecha[f]) porFecha[f] = { jugo: 0, picante: 0, cafe: 0, total: 0 }
    ;(v.productos || []).forEach(p => {
      const prod = prodDe(p) || p
      const u = num(p.vendidos)
      if (u <= 0) return
      if (porFecha[f][prod.categoria] != null) porFecha[f][prod.categoria] += u
      porFecha[f].total += u
    })
  })
  const fechas = Object.keys(porFecha).sort()
  return {
    fechas,
    series: {
      jugo:    fechas.map(f => porFecha[f].jugo),
      picante: fechas.map(f => porFecha[f].picante),
      cafe:    fechas.map(f => porFecha[f].cafe),
      total:   fechas.map(f => porFecha[f].total),
    },
  }
}

// Unidades vendidas totales por producto (para ranking / barras).
export function ventasPorProducto(visitas = []) {
  const tot = Object.fromEntries(PRODUCTOS.map(p => [p.id, 0]))
  visitas.filter(v => v.estado === 'completada').forEach(v => {
    ;(v.productos || []).forEach(p => {
      if (tot[p.id] != null) tot[p.id] += num(p.vendidos)
    })
  })
  return PRODUCTOS.map(p => ({ ...p, unidades: tot[p.id] || 0 }))
}

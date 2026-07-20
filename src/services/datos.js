// Datos maestros del sistema

// Comisión que gana la mercaderista por unidad vendida, según categoría.
export const COMISION_POR_CATEGORIA = { jugo: 0.20, picante: 0.10, cafe: 0.10 }
export const CATEGORIA_LABEL = { jugo: 'Jugos', picante: 'Picante', cafe: 'Café' }

// Productos reales (de la orden de compra). unidadesPorCaja: para convertir cajas → unidades.
// categoria: 'jugo' | 'picante' | 'cafe' → define la comisión (ver COMISION_POR_CATEGORIA).
// ⚠️ CAFÉ (id 5 y 6): confirmar nombre exacto y código de barras con Javier.
export const PRODUCTOS = [
  { id: 1, marca: 'FreshCo',        nombre: 'Bebida Pitahaya 345ml',        unidadesPorCaja: 25, codBarras: '7481111100081', categoria: 'jugo' },
  { id: 2, marca: 'FreshCo',        nombre: 'Bebida Limonada Rosa 345ml',   unidadesPorCaja: 25, codBarras: '7481111200050', categoria: 'jugo' },
  { id: 3, marca: 'Hot Chombo',     nombre: 'Salsa Picante Habanero 150ml', unidadesPorCaja: 24, codBarras: '7481106400060', categoria: 'picante' },
  { id: 4, marca: 'Hot Chombo',     nombre: 'Salsa Picante Roja 150ml',     unidadesPorCaja: 24, codBarras: '7481106400059', categoria: 'picante' },
  { id: 5, marca: 'Palmira Estates',nombre: 'Café Palmira Estates',         unidadesPorCaja: 12, codBarras: '',              categoria: 'cafe' },
  { id: 6, marca: 'Tabira',         nombre: 'Café Tabira',                  unidadesPorCaja: 12, codBarras: '',              categoria: 'cafe' },
]

// Comisión por unidad de un producto (0 si la categoría no tiene tarifa).
export function comisionUnidad(prod) {
  return COMISION_POR_CATEGORIA[prod?.categoria] ?? 0
}

// Tamaños de caja por marca (referencia para cuando se agreguen más productos):
//   FreshCo = 25 · Hot Chombo (Salsa Picante) = 24 · Palmira Estates = 12 · Tabira = 12

// Convierte una cantidad en cajas (CJ) o unidades (UN) a unidades totales
export function aUnidades(cantidad, unidad, producto) {
  const n = Number(cantidad) || 0
  const porCaja = producto?.unidadesPorCaja || 1
  return /cj|caja/i.test(unidad || '') ? n * porCaja : n
}

export const MARCAS = [...new Set(PRODUCTOS.map(p => p.marca))]

export const POSICIONES_GONDOLA = ['Alto', 'Medio', 'Bajo']

export const ESTADOS_ANAQUEL = [
  'Bien stockeado',
  'Bajo stock',
  'Vacío',
  'Mal puesto'
]

// Motivos de merma (producto retirado del anaquel).
export const MOTIVOS_MERMA = ['Vencido', 'Dañado', 'Empaque roto', 'Otro']

// Crea un objeto vacío de inventario por producto
export function inventarioVacio() {
  return PRODUCTOS.map(p => ({
    ...p,
    // Bloque 1
    stockGondola: '',
    stockBodega: '',
    reposicion: '',        // unidades recibidas por orden de compra (opcional)
    vendidos: '',          // CALCULADO automáticamente (no lo edita la mercaderista)
    stockAnterior: null,   // total de la visita anterior (para calcular vendidos)
    precioAnaquel: '',
    precioAnterior: null,  // precio registrado en la visita anterior
    promoActiva: null,
    promoPct: '',          // % de descuento de la promo
    precioPromo: '',       // precio con descuento (calculado)
    fotoAnaquel: null,
    // Bloque 2
    posicionGondola: '',
    nFrentes: '',
    fechaVencimiento: '',
    estadoAnaquel: '',
    observaciones: '',
    fotoExtra: null,
  }))
}

// Vendidos automático = (stock anterior + reposición/orden de compra) − stock actual
export function calcularVendidos(prod) {
  const anterior = Number(prod.stockAnterior) || 0
  const reposicion = Number(prod.reposicion) || 0
  const actual = (Number(prod.stockGondola) || 0) + (Number(prod.stockBodega) || 0)
  if (prod.stockAnterior == null) return ''   // sin dato previo aún
  return Math.max(0, anterior + reposicion - actual)
}

// Precio con promoción = precio × (1 − %/100)
export function calcularPrecioPromo(precio, pct) {
  const p = Number(precio)
  const d = Number(pct)
  if (!p || !d) return ''
  return Math.round(p * (1 - d / 100) * 100) / 100
}

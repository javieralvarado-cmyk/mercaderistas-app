import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

// FreshCo brand colors (ARGB)
const AZUL_FC   = 'FF0096DB'
const MARINO_FC = 'FF0A3D7A'
const AZUL_CLR  = 'FFE0F4FF'
const AMRLL_CLR = 'FFFFF3CC'
const GRIS      = 'FFF5F5F5'
const ROJO_CLR  = 'FFFFE0E0'
const VERDE_CLR = 'FFE6F9EE'

const BORDE = {
  top:    { style: 'thin' },
  left:   { style: 'thin' },
  bottom: { style: 'thin' },
  right:  { style: 'thin' },
}
const F_BLANCO = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } }
const F_HEAD   = { bold: true, size: 10, color: { argb: MARINO_FC } }

// 11 columnas: A … K
const COLS = [
  { width: 5  }, // A  #
  { width: 16 }, // B  Marca
  { width: 22 }, // C  Producto
  { width: 12 }, // D  Stock Góndola
  { width: 12 }, // E  Stock Bodega
  { width: 11 }, // F  Reposición
  { width: 10 }, // G  Vendidos
  { width: 11 }, // H  Precio ($)
  { width: 9  }, // I  ¿Promo?
  { width: 10 }, // J  % Promo
  { width: 12 }, // K  Precio Promo
]
const LAST = 'K'
const NCOLS = 11

function fill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function styleHeader(cell, fillArgb) {
  cell.font      = F_BLANCO
  cell.fill      = fill(fillArgb)
  cell.alignment = { horizontal: 'center', vertical: 'middle' }
  cell.border    = BORDE
}

function sum(productos, field) {
  return productos?.reduce((s, p) => s + (Number(p[field]) || 0), 0) ?? 0
}

export async function exportarVisitaExcel(visita) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Formulario', {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  })

  ws.columns = COLS

  // ─── TÍTULO ─────────────────────────────────────────────────────────────────
  ws.mergeCells(`A1:${LAST}1`)
  const titulo = ws.getCell('A1')
  titulo.value     = 'REGISTRO DE VISITA  —  CONTROL DE MERCADERISMO  ·  FreshCo'
  titulo.font      = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  titulo.fill      = fill(MARINO_FC)
  titulo.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30

  // ─── DATOS GENERALES ─────────────────────────────────────────────────────────
  const gpsLat = visita.gpsEntrada?.lat?.toFixed(5) ?? ''
  const gpsLng = visita.gpsEntrada?.lng?.toFixed(5) ?? ''

  ws.mergeCells('A2:C2'); ws.getCell('A2').value = `Mercaderista: ${visita.mercaderistaName}`
  ws.mergeCells('D2:F2'); ws.getCell('D2').value = `Fecha: ${visita.fecha}`
  ws.mergeCells('G2:I2'); ws.getCell('G2').value = `Supermercado: ${visita.supermercadoName}`
  ws.mergeCells('J2:K2'); ws.getCell('J2').value = `Ciudad: ${visita.supermercado?.ciudad ?? ''}`

  ws.mergeCells('A3:C3'); ws.getCell('A3').value = `Hora entrada: ${visita.horaEntrada}`
  ws.mergeCells('D3:F3'); ws.getCell('D3').value = `Hora salida: ${visita.horaSalida ?? ''}`
  ws.mergeCells('G3:I3'); ws.getCell('G3').value = `Tiempo en local: ${visita.tiempoEnLocal ?? 0} min`
  ws.mergeCells('J3:K3'); ws.getCell('J3').value = gpsLat ? `GPS: ${gpsLat}, ${gpsLng}` : 'GPS: —'

  ;[2, 3].forEach(r => {
    ws.getRow(r).eachCell(c => {
      c.fill   = fill(GRIS)
      c.border = BORDE
      c.font   = { size: 10 }
    })
  })

  // ─── BLOQUE 1: INVENTARIO Y PRECIOS ──────────────────────────────────────────
  ws.mergeCells(`A4:${LAST}4`)
  styleHeader(ws.getCell('A4'), AZUL_FC)
  ws.getCell('A4').value = 'BLOQUE 1 — INVENTARIO Y PRECIOS'

  const h1 = ws.addRow([
    '#', 'Marca', 'Producto',
    'Stock Góndola', 'Stock Bodega', 'Reposición', 'Vendidos',
    'Precio ($)', '¿Promo?', '% Promo', 'Precio Promo',
  ])
  h1.eachCell(c => {
    c.font      = F_HEAD
    c.fill      = fill(AZUL_CLR)
    c.border    = BORDE
    c.alignment = { horizontal: 'center', wrapText: true }
  })

  visita.productos?.forEach((prod, i) => {
    const tienePromo = prod.promoActiva === true
    const row = ws.addRow([
      i + 1,
      prod.marca  ?? '',
      prod.nombre ?? '',
      prod.stockGondola ?? '',
      prod.stockBodega  ?? '',
      prod.reposicion   ?? '',
      prod.vendidos     ?? '',
      prod.precioAnaquel != null ? `$${Number(prod.precioAnaquel).toFixed(2)}` : '',
      tienePromo ? 'Sí' : prod.promoActiva === false ? 'No' : '',
      tienePromo && prod.promoPct    != null ? `${prod.promoPct}%`                         : '',
      tienePromo && prod.precioPromo != null ? `$${Number(prod.precioPromo).toFixed(2)}`   : '',
    ])

    row.eachCell(c => {
      c.border    = BORDE
      c.font      = { size: 10 }
      c.alignment = { horizontal: 'center' }
    })
    row.getCell(3).alignment = { horizontal: 'left' }

    // Resaltar columnas de promo en amarillo
    if (tienePromo) {
      ;[9, 10, 11].forEach(col => { row.getCell(col).fill = fill(AMRLL_CLR) })
    }
  })

  // Fila de totales
  const totales = ws.addRow([
    'TOTAL', '', '',
    sum(visita.productos, 'stockGondola'),
    sum(visita.productos, 'stockBodega'),
    sum(visita.productos, 'reposicion'),
    sum(visita.productos, 'vendidos'),
    '', '', '', '',
  ])
  totales.eachCell(c => {
    c.font      = { bold: true, size: 10 }
    c.fill      = fill(GRIS)
    c.border    = BORDE
    c.alignment = { horizontal: 'center' }
  })

  // ─── BLOQUE 2: EXHIBICIÓN Y VENCIMIENTOS ─────────────────────────────────────
  const b2r = ws.addRow(['BLOQUE 2 — EXHIBICIÓN, VENCIMIENTO Y OBSERVACIONES'])
  ws.mergeCells(`A${b2r.number}:${LAST}${b2r.number}`)
  styleHeader(b2r.getCell(1), AZUL_FC)

  const h2 = ws.addRow([
    '#', 'Marca', 'Producto',
    'Posición Góndola', 'N° Frentes', 'Fecha Venc.',
    'Estado Anaquel', 'Observaciones', '', '', '',
  ])
  h2.eachCell(c => {
    c.font      = F_HEAD
    c.fill      = fill(AZUL_CLR)
    c.border    = BORDE
    c.alignment = { horizontal: 'center', wrapText: true }
  })

  visita.productos?.forEach((prod, i) => {
    const row = ws.addRow([
      i + 1, prod.marca ?? '', prod.nombre ?? '',
      prod.posicionGondola  ?? '',
      prod.nFrentes         ?? '',
      prod.fechaVencimiento ?? '',
      prod.estadoAnaquel    ?? '',
      prod.observaciones    ?? '',
      '', '', '',
    ])
    row.eachCell(c => { c.border = BORDE; c.font = { size: 10 } })
    row.getCell(3).alignment = { horizontal: 'left' }
    row.getCell(8).alignment = { horizontal: 'left', wrapText: true }
  })

  // ─── DEGUSTACIÓN ─────────────────────────────────────────────────────────────
  if (visita.degustacion?.hubo) {
    const degTitR = ws.addRow(['DEGUSTACIÓN'])
    ws.mergeCells(`A${degTitR.number}:${LAST}${degTitR.number}`)
    styleHeader(degTitR.getCell(1), AZUL_FC)

    ws.mergeCells(`A${degTitR.number + 1}:C${degTitR.number + 1}`)
    ws.mergeCells(`D${degTitR.number + 1}:F${degTitR.number + 1}`)
    ws.mergeCells(`G${degTitR.number + 1}:${LAST}${degTitR.number + 1}`)
    const infoR = ws.addRow([
      `Hora inicio: ${visita.degustacion.horaInicio ?? ''}`,
      '', '',
      `Hora fin: ${visita.degustacion.horaFin ?? ''}`,
      '', '',
      `Notas: ${visita.degustacion.notas ?? ''}`,
    ])
    infoR.eachCell(c => { c.fill = fill(GRIS); c.border = BORDE; c.font = { size: 10 } })

    const hDeg = ws.addRow(['Producto', 'Marca', 'Unidades vendidas en degustación', '', '', '', '', '', '', '', ''])
    hDeg.eachCell(c => { c.font = { bold: true, size: 10 }; c.fill = fill(GRIS); c.border = BORDE })

    visita.degustacion.productos
      ?.filter(p => (p.vendidos ?? 0) > 0)
      .forEach(p => {
        ws.addRow([p.nombre ?? '', p.marca ?? '', p.vendidos ?? '', '', '', '', '', '', '', '', ''])
          .eachCell(c => { c.border = BORDE; c.font = { size: 10 } })
      })
  }

  // ─── NOTAS GENERALES ─────────────────────────────────────────────────────────
  const notasR = ws.addRow([`Notas generales: ${visita.notasGenerales ?? ''}`])
  ws.mergeCells(`A${notasR.number}:${LAST}${notasR.number}`)
  notasR.getCell(1).fill   = fill(GRIS)
  notasR.getCell(1).border = BORDE
  notasR.getCell(1).font   = { size: 10, italic: true }

  // ─── GUARDAR ─────────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob(
    [buffer],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  )
  const nombre = `visita_${visita.mercaderistaName}_${visita.fecha}_${visita.supermercadoName}.xlsx`
  saveAs(blob, nombre)
}

// ─── REPORTE DIARIO ─────────────────────────────────────────────────────────
export async function exportarReporteDiarioExcel({ visitas, cumplimiento, fecha, totalesDeg, degustaciones }) {
  const wb = new ExcelJS.Workbook()

  function sheetHeader(ws, titulo) {
    ws.addRow([titulo])
    ws.mergeCells(`A1:H1`)
    const c = ws.getCell('A1')
    c.font      = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
    c.fill      = fill(MARINO_FC)
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(1).height = 28
  }

  function headRow(ws, cols) {
    const r = ws.addRow(cols)
    r.eachCell(c => {
      c.font      = F_HEAD
      c.fill      = fill(AZUL_CLR)
      c.border    = BORDE
      c.alignment = { horizontal: 'center', wrapText: true }
    })
    return r
  }

  function dataRow(ws, values, bgArgb) {
    const r = ws.addRow(values)
    r.eachCell(c => {
      c.border    = BORDE
      c.font      = { size: 10 }
      c.alignment = { horizontal: 'center' }
      if (bgArgb) c.fill = fill(bgArgb)
    })
    return r
  }

  // ── Hoja 1: Resumen ────────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet('Resumen')
  ws1.columns = [
    { width: 22 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 16 }, { width: 20 },
  ]
  sheetHeader(ws1, `REPORTE DIARIO · FRESHCO · ${fecha}`)

  const completadas   = visitas.filter(v => v.estado === 'completada').length
  const enCurso       = visitas.filter(v => v.estado === 'en_curso').length
  const totalProg     = cumplimiento.reduce((s, c) => s + c.total, 0)
  const totalVisit    = cumplimiento.reduce((s, c) => s + c.visitadas, 0)
  const pctGral       = totalProg > 0 ? Math.round(totalVisit / totalProg * 100) : 0
  const conTiempo     = visitas.filter(v => v.tiempoEnLocal)
  const tiempoProm    = conTiempo.length > 0
    ? Math.round(conTiempo.reduce((s, v) => s + v.tiempoEnLocal, 0) / conTiempo.length) : 0

  // Métricas generales
  ws1.addRow([])
  ws1.addRow(['MÉTRICAS GENERALES']).eachCell(c => { c.font = { bold: true, size: 11, color: { argb: MARINO_FC } } })
  headRow(ws1, ['Programadas', 'Completadas', 'En curso', 'Cumplimiento', 'Tiempo prom.', 'Degustaciones', '', ''])
  dataRow(ws1, [totalProg, completadas, enCurso, `${pctGral}%`, tiempoProm > 0 ? `${tiempoProm} min` : '—', degustaciones.length, '', ''],
    pctGral === 100 ? VERDE_CLR : pctGral >= 50 ? AMRLL_CLR : ROJO_CLR)

  // Por mercaderista
  ws1.addRow([])
  ws1.addRow(['POR MERCADERISTA']).eachCell(c => { c.font = { bold: true, size: 11, color: { argb: MARINO_FC } } })
  headRow(ws1, ['Mercaderista', 'Programadas', 'Completadas', 'Cumplimiento', 'Tiempo prom.', 'Sin visitar', '', ''])
  cumplimiento.forEach(c => {
    const vm      = visitas.filter(v => v.mercaderistaName === c.nombre)
    const ctm     = vm.filter(v => v.tiempoEnLocal)
    const promM   = ctm.length > 0 ? Math.round(ctm.reduce((s, v) => s + v.tiempoEnLocal, 0) / ctm.length) : 0
    const falt    = c.faltantes.map(t => t.name).join(', ')
    const r       = dataRow(ws1, [c.nombre, c.total, c.visitadas, `${c.pct}%`,
      promM > 0 ? `${promM} min` : '—', falt || '✅ Ninguna', '', ''],
      c.pct === 100 ? VERDE_CLR : c.pct >= 50 ? AMRLL_CLR : ROJO_CLR)
    r.getCell(1).alignment = { horizontal: 'left' }
    r.getCell(6).alignment = { horizontal: 'left' }
  })

  // ── Hoja 2: Visitas ────────────────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Visitas')
  ws2.columns = [
    { width: 20 }, { width: 22 }, { width: 10 }, { width: 10 },
    { width: 12 }, { width: 10 }, { width: 18 }, { width: 16 },
  ]
  sheetHeader(ws2, `DETALLE DE VISITAS · ${fecha}`)
  ws2.addRow([])
  headRow(ws2, ['Mercaderista', 'Tienda', 'Hora entrada', 'Hora salida', 'Tiempo (min)', 'Estado', 'GPS entrada', 'Notas'])
  visitas.forEach(v => {
    const gps = v.gpsEntrada ? `${v.gpsEntrada.lat?.toFixed(4)}, ${v.gpsEntrada.lng?.toFixed(4)}` : '—'
    const r = dataRow(ws2, [
      v.mercaderistaName, v.supermercadoName,
      v.horaEntrada ?? '—', v.horaSalida ?? '—',
      v.tiempoEnLocal ?? '—',
      v.estado === 'completada' ? '✅ Completada' : v.estado === 'en_curso' ? '⏳ En curso' : v.estado,
      gps, v.notasGenerales ?? '',
    ], v.estado === 'completada' ? VERDE_CLR : v.estado === 'en_curso' ? AMRLL_CLR : null)
    r.getCell(1).alignment = { horizontal: 'left' }
    r.getCell(2).alignment = { horizontal: 'left' }
    r.getCell(8).alignment = { horizontal: 'left', wrapText: true }
  })

  // ── Hoja 3: Stock Crítico ──────────────────────────────────────────────────
  const ws3 = wb.addWorksheet('Stock Crítico')
  ws3.columns = [{ width: 20 }, { width: 22 }, { width: 20 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }]
  sheetHeader(ws3, `STOCK CRÍTICO · ${fecha}`)
  ws3.addRow([])
  headRow(ws3, ['Tipo de alerta', 'Producto', 'Tienda', 'Mercaderista', 'Estado anaquel', 'Días p/ vencer', '', ''])

  visitas.forEach(v => {
    v.productos?.forEach(p => {
      let tipo = null
      let diasVenc = ''
      if (p.estadoAnaquel === 'Vacío')      tipo = '🚨 Góndola vacía'
      else if (p.estadoAnaquel === 'Bajo stock') tipo = '⚠️ Bajo stock'
      if (p.fechaVencimiento) {
        const dias = Math.ceil((new Date(p.fechaVencimiento) - new Date()) / 86400000)
        if (dias <= 0)       { tipo = '❌ Vencido'; diasVenc = `${Math.abs(dias)}d vencido` }
        else if (dias <= 30) { tipo = tipo || '📅 Por vencer'; diasVenc = `${dias}d` }
      }
      if (!tipo) return
      const r = dataRow(ws3, [tipo, p.nombre, v.supermercadoName, v.mercaderistaName, p.estadoAnaquel ?? '', diasVenc, '', ''],
        tipo.startsWith('🚨') || tipo.startsWith('❌') ? ROJO_CLR : AMRLL_CLR)
      r.getCell(1).alignment = { horizontal: 'left' }
      r.getCell(2).alignment = { horizontal: 'left' }
      r.getCell(3).alignment = { horizontal: 'left' }
    })
  })
  if (ws3.rowCount <= 3) {
    ws3.addRow(['✅ Sin alertas de stock para este día.'])
      .getCell(1).font = { italic: true, color: { argb: 'FF888888' } }
  }

  // ── Hoja 4: Ventas ────────────────────────────────────────────────────────
  const ws4 = wb.addWorksheet('Ventas')
  ws4.columns = [{ width: 28 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }]
  sheetHeader(ws4, `VENTAS DEL DÍA · ${fecha}`)
  ws4.addRow([])
  headRow(ws4, ['Producto', 'Unidades vendidas', 'En degustación', '', '', '', '', ''])

  const ventasPorProd = {}
  visitas.forEach(v => v.productos?.forEach(p => {
    if (Number(p.vendidos) > 0) ventasPorProd[p.nombre] = (ventasPorProd[p.nombre] || 0) + Number(p.vendidos)
  }))
  const ordVentas = Object.entries(ventasPorProd).sort(([, a], [, b]) => b - a)
  ordVentas.forEach(([nombre, cant]) => {
    const deg = totalesDeg[nombre] || 0
    const r   = dataRow(ws4, [nombre, cant, deg > 0 ? deg : '—', '', '', '', '', ''])
    r.getCell(1).alignment = { horizontal: 'left' }
  })
  if (ordVentas.length === 0) {
    ws4.addRow(['Sin ventas registradas para este día.'])
      .getCell(1).font = { italic: true, color: { argb: 'FF888888' } }
  }

  // ── Guardar ────────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `reporte_diario_${fecha}.xlsx`,
  )
}

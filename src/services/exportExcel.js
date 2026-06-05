import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

// FreshCo brand colors (ARGB)
const AZUL_FC   = 'FF0096DB'   // azul principal
const MARINO_FC = 'FF0A3D7A'   // azul marino
const AZUL_CLR  = 'FFE0F4FF'   // azul muy claro (cabeceras)
const AMRLL_CLR = 'FFFFF3CC'   // amarillo claro (fila con promo)
const GRIS      = 'FFF5F5F5'

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

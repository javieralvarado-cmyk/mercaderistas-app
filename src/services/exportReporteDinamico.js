import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import {
  Chart,
  BarController, BarElement,
  DoughnutController, ArcElement,
  CategoryScale, LinearScale,
  Tooltip, Legend, Title,
} from 'chart.js'

Chart.register(BarController, BarElement, DoughnutController, ArcElement,
  CategoryScale, LinearScale, Tooltip, Legend, Title)

// Colores FreshCo
const AZUL    = '#0096DB'
const MARINO  = '#0A3D7A'
const VERDE   = '#22c55e'
const AMARLLO = '#eab308'
const ROJO    = '#ef4444'
const GRIS    = '#94a3b8'

const MARINO_ARGB  = 'FF0A3D7A'
const AZUL_ARGB    = 'FF0096DB'
const AZUL_CLR     = 'FFE0F4FF'
const VERDE_CLR    = 'FFE6F9EE'
const ROJO_CLR     = 'FFFFE0E0'
const AMRLL_CLR    = 'FFFFF3CC'
const GRIS_CLR     = 'FFF5F5F5'

const BORDE = {
  top: { style: 'thin' }, left: { style: 'thin' },
  bottom: { style: 'thin' }, right: { style: 'thin' },
}

function fill(argb) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

// Renderiza un Chart.js a base64 PNG (offscreen canvas)
async function chartImg(type, data, options = {}, w = 700, h = 380) {
  const canvas = document.createElement('canvas')
  canvas.width  = w
  canvas.height = h
  const chart = new Chart(canvas.getContext('2d'), {
    type,
    data,
    options: {
      animation: false,
      responsive: false,
      plugins: {
        legend: { labels: { font: { size: 13 }, color: '#1e293b' } },
        title:  { display: !!options.title, text: options.title || '', font: { size: 14, weight: 'bold' }, color: MARINO },
      },
      ...options,
    },
  })
  // Espera un frame para que renderice
  await new Promise(r => requestAnimationFrame(r))
  const b64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '')
  chart.destroy()
  return b64
}

function addSheetHeader(ws, texto, ncols = 10) {
  const last = String.fromCharCode(64 + ncols)
  ws.mergeCells(`A1:${last}1`)
  const c = ws.getCell('A1')
  c.value     = texto
  c.font      = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
  c.fill      = fill(MARINO_ARGB)
  c.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 30
}

function addTableHeader(ws, cols, bgArgb = AZUL_CLR) {
  const r = ws.addRow(cols)
  r.eachCell(c => {
    c.font      = { bold: true, size: 10, color: { argb: MARINO_ARGB } }
    c.fill      = fill(bgArgb)
    c.border    = BORDE
    c.alignment = { horizontal: 'center', wrapText: true }
  })
  return r
}

function addDataRow(ws, values, bgArgb) {
  const r = ws.addRow(values)
  r.eachCell(c => {
    c.border    = BORDE
    c.font      = { size: 10 }
    c.alignment = { horizontal: 'center' }
    if (bgArgb) c.fill = fill(bgArgb)
  })
  return r
}

export async function exportarReporteDinamicoExcel({ visitas, cumplimiento, fecha, totalesDeg, degustaciones }) {
  const wb = new ExcelJS.Workbook()
  wb.creator  = 'FreshCo Mercaderistas'
  wb.created  = new Date()
  wb.modified = new Date()

  const completadas   = visitas.filter(v => v.estado === 'completada')
  const totalProg     = cumplimiento.reduce((s, c) => s + c.total, 0)
  const totalVisit    = cumplimiento.reduce((s, c) => s + c.visitadas, 0)
  const pctGral       = totalProg > 0 ? Math.round(totalVisit / totalProg * 100) : 0
  const conTiempo     = visitas.filter(v => v.tiempoEnLocal > 0)
  const tiempoProm    = conTiempo.length > 0
    ? Math.round(conTiempo.reduce((s, v) => s + v.tiempoEnLocal, 0) / conTiempo.length) : 0

  // Ventas por producto
  const ventasPorProd = {}
  visitas.forEach(v => v.productos?.forEach(p => {
    if (Number(p.vendidos) > 0)
      ventasPorProd[p.nombre] = (ventasPorProd[p.nombre] || 0) + Number(p.vendidos)
  }))
  const ventasOrdenadas = Object.entries(ventasPorProd).sort(([, a], [, b]) => b - a)

  // Stock crítico
  const stockItems = []
  visitas.forEach(v => v.productos?.forEach(p => {
    let tipo = null
    if (p.estadoAnaquel === 'Vacío')       tipo = 'Góndola vacía'
    else if (p.estadoAnaquel === 'Bajo stock') tipo = 'Bajo stock'
    if (p.fechaVencimiento) {
      const dias = Math.ceil((new Date(p.fechaVencimiento) - new Date()) / 86400000)
      if      (dias <= 0)  tipo = 'Vencido'
      else if (dias <= 30) tipo = tipo || 'Por vencer'
    }
    if (tipo) stockItems.push({ tipo, prod: p.nombre, super: v.supermercadoName, merc: v.mercaderistaName })
  }))

  // ── Generar gráficas ──────────────────────────────────────────────────────

  // 1. Cumplimiento por mercaderista (barras)
  const imgCumplimiento = await chartImg('bar', {
    labels: cumplimiento.map(c => c.nombre),
    datasets: [{
      label: '% Cumplimiento de ruta',
      data: cumplimiento.map(c => c.pct),
      backgroundColor: cumplimiento.map(c =>
        c.pct === 100 ? VERDE : c.pct >= 50 ? AMARLLO : ROJO),
      borderRadius: 6,
    }],
  }, {
    title: 'Cumplimiento de Ruta por Mercaderista',
    scales: {
      y: { min: 0, max: 100, ticks: { callback: v => `${v}%` } },
      x: { ticks: { font: { size: 12 } } },
    },
    plugins: { legend: { display: false } },
  })

  // 2. Ventas por producto (barras horizontales)
  const imgVentas = ventasOrdenadas.length > 0 ? await chartImg('bar', {
    labels: ventasOrdenadas.map(([n]) => n),
    datasets: [{
      label: 'Unidades vendidas',
      data: ventasOrdenadas.map(([, c]) => c),
      backgroundColor: AZUL,
      borderRadius: 6,
    }],
  }, {
    title: 'Unidades Vendidas por Producto',
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: { x: { beginAtZero: true } },
  }, 700, Math.max(300, ventasOrdenadas.length * 45 + 80)) : null

  // 3. Estado de visitas (doughnut)
  const enCurso = visitas.filter(v => v.estado === 'en_curso').length
  const imgEstados = await chartImg('doughnut', {
    labels: ['Completadas', 'En curso', 'Sin visitar'],
    datasets: [{
      data: [completadas.length, enCurso, Math.max(0, totalProg - completadas.length - enCurso)],
      backgroundColor: [VERDE, AMARLLO, ROJO],
      borderWidth: 2,
    }],
  }, { title: 'Estado de Visitas', cutout: '60%' }, 500, 350)

  // 4. Tiempo promedio por mercaderista (barras)
  const tiemposPorMerc = cumplimiento.map(c => {
    const vm  = visitas.filter(v => v.mercaderistaName === c.nombre && v.tiempoEnLocal > 0)
    const avg = vm.length > 0 ? Math.round(vm.reduce((s, v) => s + v.tiempoEnLocal, 0) / vm.length) : 0
    return { nombre: c.nombre, avg }
  }).filter(x => x.avg > 0)

  const imgTiempos = tiemposPorMerc.length > 0 ? await chartImg('bar', {
    labels: tiemposPorMerc.map(x => x.nombre),
    datasets: [{
      label: 'Tiempo promedio (min)',
      data: tiemposPorMerc.map(x => x.avg),
      backgroundColor: tiemposPorMerc.map(x =>
        x.avg >= 15 && x.avg <= 45 ? VERDE : x.avg < 15 ? ROJO : AMARLLO),
      borderRadius: 6,
    }],
  }, {
    title: 'Tiempo Promedio en Tienda (min) · Óptimo: 15–45 min',
    scales: { y: { beginAtZero: true, ticks: { callback: v => `${v} min` } } },
    plugins: { legend: { display: false } },
  }) : null

  // ── Hoja 1: Dashboard ────────────────────────────────────────────────────
  const ws1 = wb.addWorksheet('📊 Dashboard')
  ws1.columns = Array(10).fill({ width: 14 })
  ws1.getColumn(1).width = 22

  addSheetHeader(ws1, `REPORTE DIARIO · FRESHCO · ${fecha}`, 10)

  // KPIs
  ws1.addRow([])
  addTableHeader(ws1, ['Programadas', 'Completadas', 'En curso', 'Cumplimiento', '% General', 'Tiempo prom.', 'Degustaciones', '', '', ''])
  const kpiRow = addDataRow(ws1, [
    totalProg, completadas.length, enCurso,
    `${totalVisit}/${totalProg}`, `${pctGral}%`,
    tiempoProm > 0 ? `${tiempoProm} min` : '—',
    degustaciones.length, '', '', '',
  ], pctGral === 100 ? VERDE_CLR : pctGral >= 50 ? AMRLL_CLR : ROJO_CLR)
  kpiRow.height = 22
  ws1.addRow([])

  // Gráfica cumplimiento
  const imgId1 = wb.addImage({ base64: imgCumplimiento, extension: 'png' })
  const row1Start = ws1.rowCount + 1
  ws1.addRow(['Cumplimiento por mercaderista →'])
  ws1.getRow(row1Start).getCell(1).font = { bold: true, size: 11, color: { argb: MARINO_ARGB } }
  ws1.addImage(imgId1, { tl: { col: 0, row: row1Start }, br: { col: 9, row: row1Start + 18 } })
  for (let i = 0; i < 19; i++) ws1.addRow([])

  // Gráfica estados
  const imgId3 = wb.addImage({ base64: imgEstados, extension: 'png' })
  const row3Start = ws1.rowCount + 1
  ws1.addRow(['Estado de visitas →'])
  ws1.getRow(row3Start).getCell(1).font = { bold: true, size: 11, color: { argb: MARINO_ARGB } }
  ws1.addImage(imgId3, { tl: { col: 0, row: row3Start }, br: { col: 6, row: row3Start + 17 } })
  for (let i = 0; i < 18; i++) ws1.addRow([])

  // ── Hoja 2: Cumplimiento por mercaderista ────────────────────────────────
  const ws2 = wb.addWorksheet('👥 Mercaderistas')
  ws2.columns = [
    { width: 22 }, { width: 14 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 16 }, { width: 22 }, { width: 14 }, { width: 14 }, { width: 14 },
  ]
  addSheetHeader(ws2, `CUMPLIMIENTO POR MERCADERISTA · ${fecha}`, 10)
  ws2.addRow([])
  addTableHeader(ws2, ['Mercaderista', 'Programadas', 'Completadas', 'Cumplimiento', 'Tiempo prom.', 'Puntaje', 'Sin visitar', '', '', ''])

  cumplimiento.forEach(c => {
    const vm    = visitas.filter(v => v.mercaderistaName === c.nombre && v.tiempoEnLocal > 0)
    const avg   = vm.length > 0 ? Math.round(vm.reduce((s, v) => s + v.tiempoEnLocal, 0) / vm.length) : null
    const falt  = c.faltantes.map(t => t.name).join(', ')
    const score = Math.round(c.pct * 0.6) + (avg ? (avg >= 15 && avg <= 45 ? 40 : avg < 15 ? Math.round((avg / 15) * 40) : Math.max(0, Math.round(40 - ((avg - 45) / 45) * 40))) : 0)
    const r = addDataRow(ws2, [c.nombre, c.total, c.visitadas, `${c.pct}%`, avg ? `${avg} min` : '—', score, falt || '✅ Ninguna', '', '', ''],
      c.pct === 100 ? VERDE_CLR : c.pct >= 50 ? AMRLL_CLR : ROJO_CLR)
    r.getCell(1).alignment = { horizontal: 'left' }
    r.getCell(7).alignment = { horizontal: 'left' }
  })

  ws2.addRow([])
  if (imgTiempos) {
    const imgId4 = wb.addImage({ base64: imgTiempos, extension: 'png' })
    const rT = ws2.rowCount + 1
    ws2.addRow(['Tiempo promedio por mercaderista →'])
    ws2.getRow(rT).getCell(1).font = { bold: true, size: 11, color: { argb: MARINO_ARGB } }
    ws2.addImage(imgId4, { tl: { col: 0, row: rT }, br: { col: 9, row: rT + 18 } })
    for (let i = 0; i < 19; i++) ws2.addRow([])
  }

  // ── Hoja 3: Visitas del día ───────────────────────────────────────────────
  const ws3 = wb.addWorksheet('📋 Visitas')
  ws3.columns = [
    { width: 20 }, { width: 24 }, { width: 12 }, { width: 12 },
    { width: 13 }, { width: 16 }, { width: 20 }, { width: 22 }, { width: 14 }, { width: 14 },
  ]
  addSheetHeader(ws3, `DETALLE DE VISITAS · ${fecha}`, 10)
  ws3.addRow([])
  addTableHeader(ws3, ['Mercaderista', 'Tienda', 'Hora entrada', 'Hora salida', 'Tiempo (min)', 'Estado', 'GPS entrada', 'Notas generales', '', ''])

  visitas.forEach(v => {
    const gps = v.gpsEntrada ? `${v.gpsEntrada.lat?.toFixed(4)}, ${v.gpsEntrada.lng?.toFixed(4)}` : '—'
    const estado = v.estado === 'completada' ? '✅ Completada' : v.estado === 'en_curso' ? '⏳ En curso' : v.estado
    const r = addDataRow(ws3, [
      v.mercaderistaName, v.supermercadoName,
      v.horaEntrada ?? '—', v.horaSalida ?? '—',
      v.tiempoEnLocal ?? '—', estado, gps, v.notasGenerales ?? '', '', '',
    ], v.estado === 'completada' ? VERDE_CLR : v.estado === 'en_curso' ? AMRLL_CLR : null)
    r.getCell(1).alignment = { horizontal: 'left' }
    r.getCell(2).alignment = { horizontal: 'left' }
    r.getCell(8).alignment = { horizontal: 'left', wrapText: true }
  })

  // ── Hoja 4: Ventas + gráfica ─────────────────────────────────────────────
  const ws4 = wb.addWorksheet('📈 Ventas')
  ws4.columns = Array(10).fill({ width: 18 })
  ws4.getColumn(1).width = 28
  addSheetHeader(ws4, `VENTAS DEL DÍA · ${fecha}`, 10)
  ws4.addRow([])
  addTableHeader(ws4, ['Producto', 'Unidades vendidas', 'En degustación', 'Total', '', '', '', '', '', ''])

  ventasOrdenadas.forEach(([nombre, cant]) => {
    const deg = totalesDeg[nombre] || 0
    const r   = addDataRow(ws4, [nombre, cant - deg, deg > 0 ? deg : 0, cant, '', '', '', '', '', ''])
    r.getCell(1).alignment = { horizontal: 'left' }
  })
  if (ventasOrdenadas.length === 0) {
    ws4.addRow(['Sin ventas registradas.']).getCell(1).font = { italic: true, color: { argb: '88888888' } }
  }

  if (imgVentas) {
    ws4.addRow([])
    const imgId2 = wb.addImage({ base64: imgVentas, extension: 'png' })
    const rV = ws4.rowCount + 1
    ws4.addRow(['Ventas por producto →'])
    ws4.getRow(rV).getCell(1).font = { bold: true, size: 11, color: { argb: MARINO_ARGB } }
    const chartRows = Math.max(16, Math.round(ventasOrdenadas.length * 3.5))
    ws4.addImage(imgId2, { tl: { col: 0, row: rV }, br: { col: 9, row: rV + chartRows } })
    for (let i = 0; i < chartRows + 1; i++) ws4.addRow([])
  }

  // ── Hoja 5: Stock crítico ────────────────────────────────────────────────
  const ws5 = wb.addWorksheet('⚠️ Stock Crítico')
  ws5.columns = [{ width: 18 }, { width: 24 }, { width: 24 }, { width: 20 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 14 }]
  addSheetHeader(ws5, `STOCK CRÍTICO · ${fecha}`, 10)
  ws5.addRow([])
  addTableHeader(ws5, ['Tipo de alerta', 'Producto', 'Tienda', 'Mercaderista', '', '', '', '', '', ''])

  if (stockItems.length === 0) {
    ws5.addRow(['✅ Sin alertas de stock para este día.'])
      .getCell(1).font = { italic: true, color: { argb: '88888888' } }
  } else {
    stockItems.forEach(s => {
      const bg = s.tipo === 'Góndola vacía' || s.tipo === 'Vencido' ? ROJO_CLR : AMRLL_CLR
      const r = addDataRow(ws5, [s.tipo, s.prod, s.super, s.merc, '', '', '', '', '', ''], bg)
      r.getCell(1).alignment = { horizontal: 'left' }
      r.getCell(2).alignment = { horizontal: 'left' }
      r.getCell(3).alignment = { horizontal: 'left' }
      r.getCell(4).alignment = { horizontal: 'left' }
    })
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  saveAs(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `freshco_reporte_${fecha}.xlsx`,
  )
}

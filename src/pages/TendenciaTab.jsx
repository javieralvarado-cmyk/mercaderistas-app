import { useState, useEffect, useRef } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'
import { format, subDays } from 'date-fns'
import {
  Chart, LineController, LineElement, PointElement,
  BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js'
import { ventasPorDia, ventasPorProducto } from '../services/inventario'

Chart.register(LineController, LineElement, PointElement, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const COLORES = { jugo: '#0096DB', picante: '#F7941E', cafe: '#8B5E3C', total: '#0A3D7A' }

// Tendencia de ventas: evolución de unidades vendidas en el tiempo.
export default function TendenciaTab() {
  const [dias, setDias] = useState(30)
  const [cargando, setCargando] = useState(true)
  const [serie, setSerie] = useState({ fechas: [], series: { jugo: [], picante: [], cafe: [], total: [] } })
  const [porProd, setPorProd] = useState([])
  const lineaRef = useRef(null)
  const barrasRef = useRef(null)
  const lineaChart = useRef(null)
  const barrasChart = useRef(null)

  useEffect(() => { cargar() }, [dias])

  async function cargar() {
    setCargando(true)
    try {
      const desde = format(subDays(new Date(), dias), 'yyyy-MM-dd')
      const snap = await getDocs(query(collection(db, 'visits'), where('fecha', '>=', desde)))
      const visitas = snap.docs.map(d => d.data())
      setSerie(ventasPorDia(visitas))
      setPorProd(ventasPorProducto(visitas).filter(p => p.unidades > 0))
    } catch (err) {
      console.error('Error cargando tendencia:', err)
    }
    setCargando(false)
  }

  // Gráfica de línea (unidades por día y categoría)
  useEffect(() => {
    if (cargando || !lineaRef.current) return
    lineaChart.current?.destroy()
    lineaChart.current = new Chart(lineaRef.current, {
      type: 'line',
      data: {
        labels: serie.fechas.map(f => f.slice(5)), // MM-DD
        datasets: [
          { label: 'Jugos', data: serie.series.jugo, borderColor: COLORES.jugo, backgroundColor: COLORES.jugo, tension: .3 },
          { label: 'Picante', data: serie.series.picante, borderColor: COLORES.picante, backgroundColor: COLORES.picante, tension: .3 },
          { label: 'Café', data: serie.series.cafe, borderColor: COLORES.cafe, backgroundColor: COLORES.cafe, tension: .3 },
          { label: 'Total', data: serie.series.total, borderColor: COLORES.total, backgroundColor: COLORES.total, borderDash: [5, 4], tension: .3 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Unidades vendidas' } } } },
    })
    return () => lineaChart.current?.destroy()
  }, [serie, cargando])

  // Gráfica de barras (total por producto)
  useEffect(() => {
    if (cargando || !barrasRef.current) return
    barrasChart.current?.destroy()
    barrasChart.current = new Chart(barrasRef.current, {
      type: 'bar',
      data: {
        labels: porProd.map(p => p.nombre),
        datasets: [{ label: 'Unidades vendidas', data: porProd.map(p => p.unidades), backgroundColor: porProd.map(p => COLORES[p.categoria] || '#999') }],
      },
      options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } },
    })
    return () => barrasChart.current?.destroy()
  }, [porProd, cargando])

  const totalPeriodo = serie.series.total.reduce((s, n) => s + n, 0)

  return (
    <div>
      <div className="seccion-titulo">📈 Tendencia de ventas</div>
      <div style={{ display: 'flex', gap: 8, margin: '10px 0', flexWrap: 'wrap' }}>
        {[7, 15, 30, 60, 90].map(d => (
          <button key={d} onClick={() => setDias(d)} style={chip(dias === d)}>{d} días</button>
        ))}
      </div>

      {cargando ? <div className="spinner" /> : (
        <>
          <div className="alerta alerta-info" style={{ fontSize: 12 }}>
            {totalPeriodo} unidades vendidas en los últimos {dias} días (según visitas completadas).
          </div>

          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 12, margin: '12px 0', height: 300 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Unidades por día</div>
            <div style={{ height: 250 }}><canvas ref={lineaRef} /></div>
          </div>

          <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 12, height: 260 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Total por producto</div>
            <div style={{ height: 210 }}><canvas ref={barrasRef} /></div>
          </div>
        </>
      )}
    </div>
  )
}

const chip = (on) => ({
  padding: '7px 13px', borderRadius: 20, fontWeight: 700, cursor: 'pointer', fontSize: 12,
  border: on ? '2px solid var(--marca-azul, #0096DB)' : '1.5px solid #ddd',
  background: on ? 'var(--marca-azul, #0096DB)' : '#fff', color: on ? '#fff' : '#555',
})

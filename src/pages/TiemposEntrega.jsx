import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'
import { format } from 'date-fns'

// Convierte "yyyy-MM-dd HH:mm" a Date
function parseFecha(str) {
  if (!str) return null
  const [f, h] = str.split(' ')
  const [Y, M, D] = f.split('-').map(Number)
  const [hh, mm] = (h || '00:00').split(':').map(Number)
  return new Date(Y, M - 1, D, hh, mm)
}

export default function TiemposEntrega() {
  const [entregas, setEntregas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [fecha, setFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [factor, setFactor] = useState(1.5) // umbral de alerta = promedio × factor

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    try {
      const snap = await getDocs(query(collection(db, 'purchaseOrders'), where('estado', 'in', ['entregado', 'no_entregada'])))
      setEntregas(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(o => o.fechaEntrega))
    } catch (err) { console.error(err) }
    setCargando(false)
  }

  // Filtra por fecha y agrupa por transportista → paradas únicas (super + hora)
  const delDia = entregas.filter(e => (e.fechaEntrega || '').startsWith(fecha))
  const porTransportista = {}
  delDia.forEach(e => {
    const t = e.transportistaName || 'Sin asignar'
    if (!porTransportista[t]) porTransportista[t] = {}
    // una parada por super (toma la primera hora de entrega de ese super)
    const key = e.supermercadoName || e.supermercadoId
    if (!porTransportista[t][key] || e.fechaEntrega < porTransportista[t][key].fechaEntrega) {
      porTransportista[t][key] = { super: e.supermercadoName, fechaEntrega: e.fechaEntrega }
    }
  })

  // Para cada transportista: ordenar paradas por hora y calcular tramos
  const reportes = Object.entries(porTransportista).map(([transportista, paradasObj]) => {
    const paradas = Object.values(paradasObj).sort((a, b) => a.fechaEntrega.localeCompare(b.fechaEntrega))
    const tramos = []
    for (let i = 1; i < paradas.length; i++) {
      const t0 = parseFecha(paradas[i - 1].fechaEntrega)
      const t1 = parseFecha(paradas[i].fechaEntrega)
      const minutos = Math.round((t1 - t0) / 60000)
      tramos.push({ de: paradas[i - 1].super, a: paradas[i].super, minutos, hora: paradas[i].fechaEntrega.split(' ')[1] })
    }
    const promedio = tramos.length ? Math.round(tramos.reduce((s, t) => s + t.minutos, 0) / tramos.length) : 0
    return { transportista, paradas, tramos, promedio }
  })

  if (cargando) return <div className="spinner" />

  return (
    <div>
      <div className="seccion-titulo">⏱️ Tiempos entre supermercados</div>

      <div className="card" style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="campo-mini">
          <label>Fecha</label>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
        <div className="campo-mini">
          <label>Alertar si supera el promedio ×</label>
          <select value={factor} onChange={e => setFactor(Number(e.target.value))}>
            <option value={1.3}>1.3 (estricto)</option>
            <option value={1.5}>1.5 (normal)</option>
            <option value={2}>2.0 (flexible)</option>
          </select>
        </div>
      </div>

      {reportes.length === 0 && (
        <div className="alerta alerta-info">No hay entregas registradas para esta fecha.</div>
      )}

      {reportes.map(r => {
        const umbral = Math.round(r.promedio * factor)
        const fueraDePromedio = r.tramos.filter(t => t.minutos > umbral && r.promedio > 0)
        return (
          <div key={r.transportista} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontWeight: 800, fontSize: '16px' }}>🚛 {r.transportista}</div>
              <div style={{ fontSize: '13px', color: 'var(--gris)' }}>
                {r.paradas.length} parada(s) · prom. <b>{r.promedio} min</b>
              </div>
            </div>

            {/* Alertas */}
            {fueraDePromedio.length > 0 && (
              <div className="alerta alerta-warning" style={{ marginBottom: '10px' }}>
                ⚠️ {fueraDePromedio.length} tramo(s) por encima de lo normal (más de {umbral} min)
              </div>
            )}

            {/* Tramos */}
            {r.tramos.length === 0 && (
              <div style={{ fontSize: '13px', color: 'var(--gris)' }}>Solo 1 parada — aún no hay tramos para comparar.</div>
            )}
            {r.tramos.map((t, i) => {
              const alerta = t.minutos > umbral && r.promedio > 0
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', marginBottom: '6px', borderRadius: '8px',
                  background: alerta ? 'var(--rojo-claro)' : '#F7FAFF',
                }}>
                  <span style={{ fontSize: '14px' }}>
                    {t.de} <span style={{ color: 'var(--gris)' }}>→</span> {t.a}
                    <span style={{ color: 'var(--gris)', fontSize: '12px' }}> · llegó {t.hora}</span>
                  </span>
                  <b style={{ color: alerta ? 'var(--rojo)' : 'var(--azul)', fontSize: '15px' }}>
                    {alerta ? '🔴 ' : ''}{t.minutos} min
                  </b>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

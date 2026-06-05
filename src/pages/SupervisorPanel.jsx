import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../hooks/useAuth'
import { format, subDays, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { exportarVisitaExcel } from '../services/exportExcel'
import CatalogoAdmin from './CatalogoAdmin'
import OrdenesAdmin from './OrdenesAdmin'
import TiemposEntrega from './TiemposEntrega'
import PedidoSugerido from './PedidoSugerido'
import ReporteDiario from './ReporteDiario'
import Logo from '../components/Logo'

// Fix icono leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Pin de color (rojo / verde) para el mapa
const pinColor = (color) => L.divIcon({
  className: '',
  html: `<div style="background:${color};width:20px;height:20px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
  iconSize: [20, 20], iconAnchor: [10, 20], popupAnchor: [0, -18],
})

// Ajusta el mapa para que se vean todos los pines
function AjustarMapa({ puntos }) {
  const map = useMap()
  useEffect(() => {
    if (puntos.length > 0) {
      map.fitBounds(puntos.map(p => [p.lat, p.lng]), { padding: [40, 40], maxZoom: 12 })
    }
  }, [puntos])
  return null
}

// Distancia en metros entre dos coordenadas (para validar el GPS de la visita)
function distanciaMetros(a, b) {
  const R = 6371000, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad
  const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*rad) * Math.cos(b.lat*rad) * Math.sin(dLng/2)**2
  return 2 * R * Math.asin(Math.sqrt(s))
}
const RADIO_ALERTA_GPS = 300 // metros: si la visita se marcó más lejos, alerta

// Quita acentos y pasa a minúsculas: "Miércoles" -> "miercoles"
function normalizar(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export default function SupervisorPanel() {
  const { logout, perfil } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('dashboard')
  const [visitas, setVisitas] = useState([])
  const [filtroFecha, setFiltroFecha] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [filtroMercaderista, setFiltroMercaderista] = useState('')
  const [cargando, setCargando] = useState(true)
  const [mercaderistas, setMercaderistas] = useState([])
  const [catalogo, setCatalogo] = useState([])
  const [visitadosSemana, setVisitadosSemana] = useState(new Set())
  const [visitasRecientes, setVisitasRecientes] = useState([])
  const [ordenesAlerta, setOrdenesAlerta]       = useState([])

  useEffect(() => {
    cargarMercaderistas()
    cargarMapaSemana()
    cargarAlertas14Dias()
    // Auto-navegar al reporte diario si ya son las 18:00 o más
    const hora = new Date().getHours()
    const hoy  = format(new Date(), 'yyyy-MM-dd')
    if (hora >= 18 && filtroFecha === hoy) setTab('reporte')
  }, [])

  async function cargarMapaSemana() {
    try {
      // Todas las tiendas del catálogo (para los pines)
      const snap = await getDocs(collection(db, 'supermarkets'))
      setCatalogo(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      // Visitas completadas desde el lunes de esta semana
      const inicioSemana = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const vsnap = await getDocs(query(collection(db, 'visits'), where('fecha', '>=', inicioSemana)))
      const set = new Set()
      vsnap.docs.forEach(d => {
        const v = d.data()
        if (v.estado === 'completada' && v.supermercadoId) set.add(v.supermercadoId)
      })
      setVisitadosSemana(set)
    } catch (err) {
      console.error('Error cargando mapa semanal:', err)
    }
  }

  useEffect(() => {
    setCargando(true)
    // Filtramos solo por fecha (sin orderBy) para no requerir índice compuesto.
    // El orden por hora se hace en el navegador.
    const q = query(
      collection(db, 'visits'),
      where('fecha', '==', filtroFecha)
    )
    const unsub = onSnapshot(
      q,
      snap => {
        let datos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        datos.sort((a, b) => (a.horaEntrada || '').localeCompare(b.horaEntrada || ''))
        if (filtroMercaderista) datos = datos.filter(v => v.mercaderistaId === filtroMercaderista)
        setVisitas(datos)
        setCargando(false)
      },
      err => {
        console.error('Error cargando visitas:', err)
        setVisitas([])
        setCargando(false)
      }
    )
    return unsub
  }, [filtroFecha, filtroMercaderista])

  async function cargarMercaderistas() {
    try {
      const snap = await getDocs(query(collection(db, 'users'), where('role', '==', 'mercaderista')))
      setMercaderistas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error('Error cargando mercaderistas:', err)
    }
  }

  async function cargarAlertas14Dias() {
    try {
      const hace14 = format(subDays(new Date(), 14), 'yyyy-MM-dd')
      const [vSnap, oSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'visits'),
          where('fecha', '>=', hace14),
          where('estado', '==', 'completada'),
        )),
        getDocs(query(
          collection(db, 'purchaseOrders'),
          where('estado', 'in', ['no_entregada', 'faltante']),
        )),
      ])
      setVisitasRecientes(vSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      setOrdenesAlerta(oSnap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error('Error cargando alertas 14 días:', err)
    }
  }

  // ─── Cumplimiento de ruta ─────────────────────────────────────────────────
  const diaFiltro = normalizar(format(new Date(filtroFecha + 'T12:00:00'), 'EEEE', { locale: es }))
  const nombresMerc = [...new Set(catalogo.map(t => t.mercaderista).filter(m => m && m !== 'Sin asignar'))]
  const cumplimiento = nombresMerc.map(nombre => {
    const asignadas = catalogo.filter(t => t.mercaderista === nombre && normalizar(t.dia) === diaFiltro)
    const visitada = t => visitas.some(v => v.supermercadoId === t.id && v.estado === 'completada')
    const visitadas = asignadas.filter(visitada)
    const faltantes = asignadas.filter(t => !visitada(t))
    const pct = asignadas.length ? Math.round(visitadas.length / asignadas.length * 100) : 0
    return { nombre, total: asignadas.length, visitadas: visitadas.length, faltantes, pct }
  }).filter(c => c.total > 0)

  // ─── Degustaciones ────────────────────────────────────────────────────────
  const degustaciones = visitas.filter(v => v.degustacion?.hubo === true)
  const totalesDeg = {}
  degustaciones.forEach(v => (v.degustacion.productos || []).forEach(p => {
    const n = Number(p.vendidos) || 0
    if (n > 0) totalesDeg[p.nombre] = (totalesDeg[p.nombre] || 0) + n
  }))

  // ─── Contexto temporal ────────────────────────────────────────────────────
  const horaActual   = new Date().getHours()
  const esHoy        = filtroFecha === format(new Date(), 'yyyy-MM-dd')
  const hoyDia       = new Date().getDate()
  const ultimoDiaMes = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const esQuincena   = hoyDia === 15 || hoyDia === ultimoDiaMes

  // ─── Alertas ──────────────────────────────────────────────────────────────
  const alertas = []

  visitas.forEach(v => {
    v.productos?.forEach(p => {
      // Stock y vencimiento
      if (p.estadoAnaquel === 'Vacío')
        alertas.push({ tipo: 'rojo', texto: `🚨 Góndola VACÍA: ${p.nombre} en ${v.supermercadoName}` })
      if (p.estadoAnaquel === 'Bajo stock')
        alertas.push({ tipo: 'amarillo', texto: `⚠️ Bajo stock: ${p.nombre} en ${v.supermercadoName}` })
      if (p.fechaVencimiento) {
        const dias = Math.ceil((new Date(p.fechaVencimiento) - new Date()) / 86400000)
        if (dias <= 30 && dias > 0)
          alertas.push({ tipo: 'amarillo', texto: `📅 Por vencer (${dias}d): ${p.nombre} en ${v.supermercadoName}` })
        if (dias <= 0)
          alertas.push({ tipo: 'rojo', texto: `❌ VENCIDO: ${p.nombre} en ${v.supermercadoName}` })
      }
      // Precio cayó >15% vs. visita anterior
      if (p.precioAnaquel && Number(p.precioAnterior) > 0) {
        const caida = (Number(p.precioAnterior) - Number(p.precioAnaquel)) / Number(p.precioAnterior)
        if (caida > 0.15)
          alertas.push({ tipo: 'rojo', texto: `💰 Precio cayó ${Math.round(caida * 100)}%: ${p.nombre} en ${v.supermercadoName} ($${p.precioAnterior} → $${p.precioAnaquel})` })
      }
    })

    // GPS sospechoso (solo tiendas con ubicación exacta)
    const tiendaCat = catalogo.find(t => t.id === v.supermercadoId)
    if (tiendaCat?.gps?.lat && !tiendaCat.gpsAprox && v.gpsEntrada?.lat) {
      const m = distanciaMetros(v.gpsEntrada, tiendaCat.gps)
      if (m > RADIO_ALERTA_GPS)
        alertas.push({ tipo: 'rojo', texto: `📍 GPS sospechoso: ${v.mercaderistaName} marcó "${v.supermercadoName}" a ${Math.round(m)} m de la tienda` })
    }
    // Visita muy corta (<5 min en completadas)
    if (v.estado === 'completada' && v.tiempoEnLocal > 0 && v.tiempoEnLocal < 5)
      alertas.push({ tipo: 'amarillo', texto: `⏱️ Visita muy corta (${v.tiempoEnLocal} min): ${v.mercaderistaName} en ${v.supermercadoName}` })
    // Visita muy larga (>90 min)
    if (v.tiempoEnLocal > 90)
      alertas.push({ tipo: 'amarillo', texto: `⏱️ Visita larga (${v.tiempoEnLocal} min): ${v.mercaderistaName} en ${v.supermercadoName}` })
    // Productos sin foto de anaquel en visitas completadas
    if (v.estado === 'completada') {
      const sinFoto = (v.productos || []).filter(p => !p.fotoAnaquel?.url)
      if (sinFoto.length > 0)
        alertas.push({ tipo: 'amarillo', texto: `📷 Sin foto de anaquel en ${v.supermercadoName}: ${sinFoto.map(p => p.nombre).join(', ')}` })
    }
  })

  // Mercaderista sin ninguna visita iniciada (solo después de las 11am en el día de hoy)
  if (esHoy && horaActual >= 11) {
    cumplimiento.forEach(c => {
      if (c.total > 0 && !visitas.some(v => v.mercaderistaName === c.nombre))
        alertas.push({ tipo: 'rojo', texto: `🏃 ${c.nombre} no ha iniciado ninguna visita (${c.total} tiendas asignadas para hoy)` })
    })
  }
  // Quincena sin degustación registrada
  if (esHoy && esQuincena && !visitas.some(v => v.degustacion?.hubo === true))
    alertas.push({ tipo: 'amarillo', texto: `🎉 Hoy es día de quincena (${hoyDia}/${new Date().getMonth() + 1}) y no hay degustaciones registradas (3:00 PM – 8:00 PM)` })

  // Tiendas asignadas sin visita en los últimos 14 días
  const visitasUlt14 = [...visitasRecientes, ...visitas.filter(v => v.estado === 'completada')]
  const tiendasSinVisita = catalogo.filter(t =>
    t.mercaderista && t.mercaderista !== 'Sin asignar' &&
    !visitasUlt14.some(v => v.supermercadoId === t.id)
  )
  if (tiendasSinVisita.length > 3) {
    alertas.push({ tipo: 'rojo', texto: `🏪 ${tiendasSinVisita.length} tiendas sin visita en más de 14 días: ${tiendasSinVisita.slice(0, 3).map(t => t.name).join(', ')}…` })
  } else {
    tiendasSinVisita.forEach(t =>
      alertas.push({ tipo: 'rojo', texto: `🏪 Sin visita en +14 días: ${t.name} (${t.mercaderista})` })
    )
  }
  // Órdenes no entregadas o con faltantes (cargadas al inicio)
  ordenesAlerta.forEach(o => {
    const motivo = o.motivoNoEntrega ? ` — ${o.motivoNoEntrega}` : ''
    alertas.push({
      tipo: o.estado === 'no_entregada' ? 'rojo' : 'amarillo',
      texto: `📦 Orden ${o.estado === 'no_entregada' ? 'no entregada' : 'con faltantes'}: ${o.supermercadoName}${motivo}`,
    })
  })

  // Puntos para el mapa
  const puntosGPS = visitas
    .filter(v => v.gpsEntrada?.lat)
    .map(v => ({ ...v, lat: v.gpsEntrada.lat, lng: v.gpsEntrada.lng }))

  const tabs = [
    { id: 'dashboard',    label: '📊 Dashboard' },
    { id: 'visitas',      label: '📋 Visitas' },
    { id: 'mapa',         label: '🗺️ Mapa' },
    { id: 'alertas',      label: `🚨 Alertas${alertas.length > 0 ? ` (${alertas.length})` : ''}` },
    { id: 'catalogo',     label: '🏪 Catálogo' },
    { id: 'ordenes',      label: '📦 Órdenes' },
    { id: 'tiempos',      label: '⏱️ Tiempos' },
    { id: 'degustaciones',label: '🎉 Degust.' },
    { id: 'pedido',       label: '🧮 Pedido sugerido' },
    { id: 'reporte',      label: '📄 Reporte' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gris-claro)' }}>
      {/* Header */}
      <div className="header">
        <Logo size="sm" light />
        <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '12px' }}>
          <div style={{ fontSize: '12px', opacity: 0.85 }}>Panel de Supervisor</div>
          <div style={{ fontSize: '16px', fontWeight: 800 }}>{perfil?.name || 'Control'}</div>
        </div>
        <button onClick={logout}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
            padding: '8px 14px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
          Salir
        </button>
      </div>

      {/* Tabs */}
      <div style={{ background: 'white', display: 'flex', borderBottom: '2px solid var(--azul-claro)', overflowX: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '12px 8px', border: 'none', background: 'none',
              color: tab === t.id ? 'var(--azul-osc)' : 'var(--gris)',
              fontWeight: tab === t.id ? 700 : 400,
              borderBottom: tab === t.id ? '3px solid var(--marca-amarillo)' : '3px solid transparent',
              fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap'
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      {tab !== 'catalogo' && tab !== 'ordenes' && tab !== 'tiempos' && tab !== 'pedido' && tab !== 'reporte' && (
      <div style={{ background: 'white', padding: '12px 16px', display: 'flex', gap: '10px', borderBottom: '1px solid #EEE' }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '11px', color: 'var(--gris)', display: 'block', marginBottom: '4px' }}>Fecha</label>
          <input type="date" value={filtroFecha} onChange={e => setFiltroFecha(e.target.value)}
            style={{ width: '100%', padding: '8px', border: '1.5px solid #E0E0E0', borderRadius: '8px', fontSize: '14px' }} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: '11px', color: 'var(--gris)', display: 'block', marginBottom: '4px' }}>Mercaderista</label>
          <select value={filtroMercaderista} onChange={e => setFiltroMercaderista(e.target.value)}
            style={{ width: '100%', padding: '8px', border: '1.5px solid #E0E0E0', borderRadius: '8px', fontSize: '14px' }}>
            <option value="">Todas</option>
            {mercaderistas.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      )}

      <div className="contenedor" style={{ paddingTop: '16px' }}>
        {cargando && tab !== 'catalogo' && tab !== 'ordenes' && tab !== 'tiempos' && tab !== 'pedido' && tab !== 'reporte' && <div className="spinner" />}

        {/* ─── TAB: DASHBOARD ─── */}
        {tab === 'dashboard' && !cargando && (
          <>
            {/* Vista previa de la app de mercaderista */}
            <div className="card" style={{ marginBottom: '16px', background: '#F5F9FF' }}>
              <div style={{ fontWeight: 700, marginBottom: '8px', fontSize: '14px' }}>
                👁️ Ver la app como la ve la mercaderista
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }}
                  onClick={() => navigate('/vista-mercaderista', { state: { previewMerc: 'Darkiris' } })}>
                  👤 Ver como Darkiris
                </button>
                <button className="btn btn-outline btn-sm" style={{ flex: 1 }}
                  onClick={() => navigate('/vista-mercaderista', { state: { previewMerc: 'Digna' } })}>
                  👤 Ver como Digna
                </button>
              </div>
              <button className="btn btn-outline btn-sm" style={{ width: '100%', marginTop: '8px' }}
                onClick={() => navigate('/vista-transportista', { state: { previewTransportista: 'Transportista 1' } })}>
                🚛 Ver app del transportista
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              {[
                { label: 'Visitas hoy',      valor: visitas.length,                                          icono: '📋', color: 'var(--azul)' },
                { label: 'Completadas',       valor: visitas.filter(v => v.estado === 'completada').length,  icono: '✅', color: 'var(--verde)' },
                { label: 'En curso',          valor: visitas.filter(v => v.estado === 'en_curso').length,    icono: '🟡', color: 'var(--amarillo)' },
                { label: 'Tiempo prom. (min)',valor: visitas.filter(v => v.tiempoEnLocal).length > 0
                    ? Math.round(visitas.reduce((s, v) => s + (v.tiempoEnLocal || 0), 0) / visitas.filter(v => v.tiempoEnLocal).length)
                    : 0,                                                                                       icono: '⏱️', color: 'var(--azul)' },
              ].map(m => (
                <div key={m.label} className="card" style={{ textAlign: 'center', padding: '16px', marginBottom: 0 }}>
                  <div style={{ fontSize: '30px' }}>{m.icono}</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: m.color, margin: '4px 0' }}>{m.valor}</div>
                  <div style={{ fontSize: '12px', color: 'var(--gris)' }}>{m.label}</div>
                </div>
              ))}
            </div>

            {alertas.length > 0 && (
              <>
                <div className="seccion-titulo">🚨 Alertas del día</div>
                {alertas.slice(0, 5).map((a, i) => (
                  <div key={i} className={`alerta alerta-${a.tipo === 'rojo' ? 'error' : 'warning'}`}>{a.texto}</div>
                ))}
                {alertas.length > 5 && (
                  <div style={{ textAlign: 'center', color: 'var(--gris)', fontSize: '13px' }}>
                    +{alertas.length - 5} alertas más → ver pestaña Alertas
                  </div>
                )}
              </>
            )}

            {cumplimiento.length > 0 && (
              <>
                <div className="seccion-titulo">🎯 Cumplimiento de ruta</div>
                {cumplimiento.map(c => (
                  <div key={c.nombre} className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <b>👤 {c.nombre}</b>
                      <span style={{ fontWeight: 800, color: c.pct === 100 ? 'var(--verde)' : c.pct >= 50 ? 'var(--amarillo)' : 'var(--rojo)' }}>{c.pct}%</span>
                    </div>
                    <div style={{ height: 8, background: '#E6EEF5', borderRadius: 4, overflow: 'hidden', marginBottom: '8px' }}>
                      <div style={{ height: '100%', width: `${c.pct}%`, background: c.pct === 100 ? 'var(--verde)' : 'var(--azul)', transition: 'width .3s' }} />
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--gris)' }}>{c.visitadas}/{c.total} visitadas</div>
                    {c.faltantes.length > 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--rojo)', marginTop: '4px' }}>
                        ❌ Falta visitar: {c.faltantes.map(t => t.name).join(', ')}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            <div className="seccion-titulo">📋 Visitas recientes</div>
            {visitas.slice(0, 5).map(v => (
              <div key={v.id} className="card" style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/supervisor/visita/${v.id}`)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{v.supermercadoName}</div>
                    <div style={{ fontSize: '13px', color: 'var(--gris)' }}>
                      {v.mercaderistaName} · {v.horaEntrada}{v.horaSalida && ` → ${v.horaSalida}`}
                      {v.tiempoEnLocal && ` (${v.tiempoEnLocal} min)`}
                    </div>
                  </div>
                  <span className={`badge ${v.estado === 'completada' ? 'badge-verde' : 'badge-amarillo'}`}>
                    {v.estado === 'completada' ? '✅ Lista' : '🟡 En curso'}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ─── TAB: VISITAS ─── */}
        {tab === 'visitas' && !cargando && (
          <>
            <div className="seccion-titulo">📋 Todas las visitas — {format(new Date(filtroFecha + 'T12:00:00'), "d 'de' MMMM", { locale: es })}</div>
            {visitas.length === 0 && (
              <div className="alerta alerta-info">No hay visitas registradas para este filtro.</div>
            )}
            {visitas.map(v => (
              <div key={v.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '16px' }}>{v.supermercadoName}</div>
                    <div style={{ fontSize: '13px', color: 'var(--gris)' }}>👤 {v.mercaderistaName}</div>
                    <div style={{ fontSize: '12px', color: 'var(--gris)' }}>
                      🕐 {v.horaEntrada} → {v.horaSalida || '(en curso)'}
                      {v.tiempoEnLocal && ` · ⏱️ ${v.tiempoEnLocal} min`}
                    </div>
                    {v.gpsEntrada && (() => {
                      const tc = catalogo.find(t => t.id === v.supermercadoId)
                      const m = (tc?.gps?.lat && !tc.gpsAprox) ? distanciaMetros(v.gpsEntrada, tc.gps) : null
                      const lejos = m != null && m > RADIO_ALERTA_GPS
                      return (
                        <div style={{ fontSize: '11px', color: lejos ? 'var(--rojo)' : 'var(--verde)', marginTop: '2px' }}>
                          📍 {m != null ? `a ${Math.round(m)} m de la tienda ${lejos ? '⚠️' : '✓'}` : `${v.gpsEntrada.lat?.toFixed(4)}, ${v.gpsEntrada.lng?.toFixed(4)}`}
                        </div>
                      )
                    })()}
                  </div>
                  <span className={`badge ${v.estado === 'completada' ? 'badge-verde' : 'badge-amarillo'}`}>
                    {v.estado === 'completada' ? '✅' : '🟡'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-outline btn-sm" style={{ flex: 1 }}
                    onClick={() => navigate(`/supervisor/visita/${v.id}`)}>
                    👁️ Ver detalle
                  </button>
                  {v.estado === 'completada' && (
                    <button className="btn btn-verde btn-sm" style={{ flex: 1 }}
                      onClick={() => exportarVisitaExcel(v)}>
                      📥 Excel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ─── TAB: MAPA ─── */}
        {tab === 'mapa' && (() => {
          const pines = catalogo.filter(t => t.gps?.lat).map(t => ({ ...t, lat: t.gps.lat, lng: t.gps.lng }))
          const visitados = pines.filter(p => visitadosSemana.has(p.id)).length
          return (
            <div>
              <div className="seccion-titulo">🗺️ Mapa de tiendas — esta semana</div>
              {/* Leyenda */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '10px', fontSize: '13px' }}>
                <span>🟢 Visitado ({visitados})</span>
                <span>🔴 Sin visitar ({pines.length - visitados})</span>
              </div>
              {pines.length === 0 ? (
                <div className="alerta alerta-info">
                  No hay tiendas con ubicación. Carga el catálogo en la pestaña 🏪 Catálogo.
                </div>
              ) : (
                <div className="mapa-container" style={{ height: '70vh' }}>
                  <MapContainer center={[8.7, -80.5]} zoom={8} style={{ height: '100%', width: '100%' }}>
                    <TileLayer attribution='© OpenStreetMap'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <AjustarMapa puntos={pines} />
                    {pines.map(p => {
                      const visitado = visitadosSemana.has(p.id)
                      return (
                        <Marker key={p.id} position={[p.lat, p.lng]}
                          icon={pinColor(visitado ? '#2E7D32' : '#D32F2F')}>
                          <Popup>
                            <strong>{p.name}</strong><br/>
                            {p.ciudad} · {p.provincia}<br/>
                            {p.mercaderista && p.mercaderista !== 'Sin asignar' && <>👤 {p.mercaderista}<br/></>}
                            {visitado ? '🟢 Visitado esta semana' : '🔴 Sin visitar esta semana'}
                          </Popup>
                        </Marker>
                      )
                    })}
                  </MapContainer>
                </div>
              )}
            </div>
          )
        })()}

        {/* ─── TAB: ALERTAS ─── */}
        {tab === 'alertas' && (
          <>
            <div className="seccion-titulo">🚨 Todas las alertas ({alertas.length})</div>
            {alertas.length === 0 && (
              <div className="alerta alerta-ok">✅ ¡Sin alertas! Todo está en orden.</div>
            )}
            {alertas.map((a, i) => (
              <div key={i} className={`alerta alerta-${a.tipo === 'rojo' ? 'error' : 'warning'}`}>
                {a.texto}
              </div>
            ))}
          </>
        )}

        {/* ─── TAB: CATÁLOGO ─── */}
        {tab === 'catalogo' && <CatalogoAdmin />}

        {/* ─── TAB: ÓRDENES ─── */}
        {tab === 'ordenes' && <OrdenesAdmin />}

        {/* ─── TAB: TIEMPOS ─── */}
        {tab === 'tiempos' && <TiemposEntrega />}

        {/* ─── TAB: PEDIDO SUGERIDO ─── */}
        {tab === 'pedido' && <PedidoSugerido />}

        {/* ─── TAB: REPORTE DIARIO ─── */}
        {tab === 'reporte' && (
          <ReporteDiario
            visitas={visitas}
            catalogo={catalogo}
            alertas={alertas}
            degustaciones={degustaciones}
            totalesDeg={totalesDeg}
            cumplimiento={cumplimiento}
            fecha={filtroFecha}
          />
        )}

        {/* ─── TAB: DEGUSTACIONES ─── */}
        {tab === 'degustaciones' && !cargando && (
          <>
            <div className="seccion-titulo">🎉 Degustaciones</div>
            {degustaciones.length === 0 && (
              <div className="alerta alerta-info">No hay degustaciones registradas para este filtro.</div>
            )}
            {Object.keys(totalesDeg).length > 0 && (
              <div className="card" style={{ background: '#FFF8E1' }}>
                <div style={{ fontWeight: 800, marginBottom: '8px' }}>📊 Total vendido en degustaciones</div>
                {Object.entries(totalesDeg).map(([n, c]) => (
                  <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span>{n}</span><b style={{ color: 'var(--azul)' }}>{c} u</b>
                  </div>
                ))}
              </div>
            )}
            {degustaciones.map(v => (
              <div key={v.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <b>{v.supermercadoName}</b>
                  <span style={{ fontSize: '12px', color: 'var(--gris)' }}>
                    {v.degustacion.horaInicio || '—'}–{v.degustacion.horaFin || '—'}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--gris)', marginBottom: '6px' }}>👤 {v.mercaderistaName}</div>
                {(v.degustacion.productos || []).filter(p => Number(p.vendidos) > 0).map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span>{p.nombre}</span><b>{p.vendidos} u</b>
                  </div>
                ))}
                {v.degustacion.notas && <div style={{ fontSize: '12px', color: 'var(--gris)', marginTop: '6px' }}>📝 {v.degustacion.notas}</div>}
                {v.degustacion.foto?.url && (
                  <a className="btn btn-outline btn-sm" href={v.degustacion.foto.url} target="_blank" rel="noreferrer" style={{ marginTop: '8px' }}>📷 Ver foto</a>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

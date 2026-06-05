import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { subirImagen } from '../services/cloudinary'
import { useAuth } from '../hooks/useAuth'
import { getGPS } from '../services/gps'
import { PRODUCTOS } from '../services/datos'
import { format } from 'date-fns'
import Logo from '../components/Logo'

// Punto de partida fijo (almacén)
const ORIGEN = { nombre: 'Panamá Viejo Business Center', lat: 9.0080, lng: -79.4870 }

// Muestra la cantidad en cajas + unidades sueltas (ej. "1 caja + 12 u")
function formatCarga(unidades, productoId) {
  const prod = PRODUCTOS.find(p => p.id === productoId)
  const porCaja = prod?.unidadesPorCaja || 1
  if (porCaja > 1) {
    const cajas = Math.floor(unidades / porCaja)
    const resto = unidades % porCaja
    const partes = []
    if (cajas > 0) partes.push(`${cajas} caja${cajas !== 1 ? 's' : ''}`)
    if (resto > 0) partes.push(`${resto} u`)
    return partes.join(' + ') || '0 u'
  }
  return `${unidades} u`
}

function distanciaKm(a, b) {
  if (!a || !b) return 9999
  const R = 6371, rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad
  const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*rad) * Math.cos(b.lat*rad) * Math.sin(dLng/2)**2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// Ruta: el super MÁS LEJOS del origen primero, terminando en el MÁS CERCANO al origen.
// Así el repartidor sale lejos y regresa acercándose a Panamá Viejo Business Center.
function ordenarRuta(paradas) {
  const conGps = paradas.filter(p => p.gps?.lat)
  const sinGps = paradas.filter(p => !p.gps?.lat)
  conGps.sort((a, b) => distanciaKm(ORIGEN, b.gps) - distanciaKm(ORIGEN, a.gps))
  // distancia de cada super AL ALMACÉN (va bajando: lejos → cerca)
  conGps.forEach(p => { p.distanciaKm = distanciaKm(ORIGEN, p.gps) })
  return [...conGps, ...sinGps]
}

export default function TransportistaHome() {
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const preview = location.state?.previewTransportista || null
  const nombre = preview || perfil?.name || 'Transportista'

  const [paradas, setParadas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [fase, setFase] = useState('carga')         // 'carga' | 'ruta'
  const [accion, setAccion] = useState(null)
  const [motivoOpen, setMotivoOpen] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [compUrl, setCompUrl] = useState('')
  const [subiendoComp, setSubiendoComp] = useState(false)
  const [fotosEntrega, setFotosEntrega] = useState({}) // storeId -> url
  const [subFoto, setSubFoto] = useState(null)          // storeId subiendo foto

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    try {
      const snap = await getDocs(query(collection(db, 'purchaseOrders'), where('estado', '==', 'pendiente')))
      const ordenes = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(o => o.transportistaName === nombre || o.transportistaName === 'Sin asignar' || !o.transportistaName)

      const tiendasSnap = await getDocs(collection(db, 'supermarkets'))
      const gpsPorId = {}
      tiendasSnap.docs.forEach(d => { gpsPorId[d.id] = d.data().gps })

      const porTienda = {}
      ordenes.forEach(o => {
        const key = o.supermercadoId || o.supermercadoName
        if (!porTienda[key]) {
          porTienda[key] = { storeId: o.supermercadoId, name: o.supermercadoName, gps: gpsPorId[o.supermercadoId], ordenes: [], totales: {} }
        }
        porTienda[key].ordenes.push(o)
        ;(o.items || []).forEach(it => {
          const t = porTienda[key].totales[it.productoId] || { nombre: it.nombre, cantidad: 0, productoId: it.productoId }
          t.cantidad += Number(it.cantidad) || 0
          porTienda[key].totales[it.productoId] = t
        })
      })
      setParadas(ordenarRuta(Object.values(porTienda)))
    } catch (err) { console.error(err) }
    setCargando(false)
  }

  // Carga total del día (sumando todos los supers)
  const cargaDia = {}
  paradas.forEach(p => Object.values(p.totales).forEach(t => {
    const c = cargaDia[t.productoId] || { nombre: t.nombre, cantidad: 0, productoId: t.productoId }
    c.cantidad += t.cantidad
    cargaDia[t.productoId] = c
  }))

  async function marcar(parada, entregada) {
    if (preview) { alert('👁️ Vista previa — no se guardan datos.'); return }
    if (entregada && !fotosEntrega[parada.storeId]) { alert('📷 Toma la foto de entrega antes de confirmar.'); return }
    if (!entregada && !motivo.trim()) { alert('Escribe el motivo de no entrega.'); return }
    setAccion(parada.storeId)
    let gps = null
    try { gps = await getGPS() } catch {}
    if (!gps?.lat) {
      alert('📍 Necesitas activar la ubicación (GPS) para registrar la entrega. No se puede continuar sin ella.')
      setAccion(null)
      return
    }
    try {
      for (const o of parada.ordenes) {
        await updateDoc(doc(db, 'purchaseOrders', o.id), entregada ? {
          estado: 'entregado', transportistaName: nombre,
          entregadoItems: (o.items || []).map(i => ({ productoId: i.productoId, nombre: i.nombre, cantidadEntregada: i.cantidad, cantidadPedida: i.cantidad })),
          fotoEntregaUrl: fotosEntrega[parada.storeId] || '',
          gpsEntrega: gps, fechaEntrega: format(new Date(), 'yyyy-MM-dd HH:mm'),
        } : {
          estado: 'no_entregada', transportistaName: nombre, motivoNoEntrega: motivo,
          comprobanteUrl: compUrl || '',
          gpsEntrega: gps, fechaEntrega: format(new Date(), 'yyyy-MM-dd HH:mm'),
        })
      }
      setParadas(prev => prev.filter(p => p !== parada))
      setMotivoOpen(null); setMotivo(''); setCompUrl('')
    } catch (err) { alert('Error al guardar.'); console.error(err) }
    setAccion(null)
  }

  const linkRutaCompleta = () => {
    const conGps = paradas.filter(p => p.gps?.lat)
    if (conGps.length === 0) return null
    const origin = `${ORIGEN.lat},${ORIGEN.lng}`
    const destination = `${conGps[conGps.length-1].gps.lat},${conGps[conGps.length-1].gps.lng}`
    const waypoints = conGps.slice(0, -1).map(p => `${p.gps.lat},${p.gps.lng}`).join('|')
    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`
    if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`
    return url
  }

  if (cargando) return <div className="spinner" style={{ height: '100vh' }} />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gris-claro)' }}>
      {preview && (
        <div className="preview-banner">
          👁️ Vista previa — app del transportista <b>{preview}</b>
          <button onClick={() => navigate('/supervisor')}>← Volver al panel</button>
        </div>
      )}

      <div className="header">
        <Logo size="sm" light />
        <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '12px' }}>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>Transportista</div>
          <div style={{ fontSize: '18px', fontWeight: 800 }}>{nombre}</div>
        </div>
        {!preview && (
          <button onClick={logout}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
              padding: '8px 14px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
            Salir
          </button>
        )}
      </div>

      <div className="contenedor" style={{ paddingTop: '20px' }}>
        {paradas.length === 0 && (
          <div className="alerta alerta-info">✅ No tienes entregas pendientes hoy.</div>
        )}

        {/* ───────── FASE 1: CARGA ───────── */}
        {paradas.length > 0 && fase === 'carga' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: '6px', fontSize: '22px', fontWeight: 800 }}>
              1️⃣ Carga del día
            </div>
            <div style={{ textAlign: 'center', color: 'var(--gris)', fontSize: '14px', marginBottom: '16px' }}>
              Carga TODO esto en el almacén ({ORIGEN.nombre}) antes de salir.
            </div>

            <div className="card" style={{ background: 'var(--amarillo-claro)', border: '1.5px solid rgba(200,134,11,0.2)' }}>
              {Object.values(cargaDia).map(c => (
                <div key={c.productoId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid #F0E6C0' }}>
                  <span style={{ fontSize: '16px' }}>📦 {c.nombre}</span>
                  <b style={{ fontSize: '20px', color: 'var(--azul)' }}>{formatCarga(c.cantidad, c.productoId)}</b>
                </div>
              ))}
            </div>

            <button className="btn btn-verde" style={{ fontSize: '18px', padding: '18px', marginTop: '8px' }}
              onClick={() => setFase('ruta')}>
              ✅ Ya cargué todo → Empezar ruta ({paradas.length} supers)
            </button>
          </>
        )}

        {/* ───────── FASE 2: RUTA / ENTREGAS ───────── */}
        {paradas.length > 0 && fase === 'ruta' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '20px', fontWeight: 800 }}>2️⃣ Ruta · {paradas.length} supers</div>
              <button className="btn btn-outline btn-sm" onClick={() => setFase('carga')}>← Carga</button>
            </div>

            <div className="card" style={{ background: 'var(--verde-claro)', border: '1.5px solid rgba(95,165,22,0.2)' }}>
              <div style={{ fontSize: '13px' }}>🏁 <b>Salida:</b> {ORIGEN.nombre}</div>
              {linkRutaCompleta() && (
                <a className="btn btn-primario" style={{ marginTop: '8px' }} href={linkRutaCompleta()} target="_blank" rel="noreferrer">
                  🧭 Abrir ruta completa en Google Maps
                </a>
              )}
            </div>

            {paradas.map((p, i) => (
              <div key={p.storeId || p.name} className="card" style={{ borderLeft: '4px solid var(--azul)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div style={{ fontWeight: 700, fontSize: '17px' }}>
                    <span style={{ background: 'var(--azul)', color: 'white', borderRadius: '50%', padding: '2px 10px', marginRight: '8px', fontSize: '15px' }}>{i + 1}</span>
                    {p.name}
                  </div>
                  {p.distanciaKm != null && <span style={{ fontSize: '12px', color: 'var(--gris)' }}>~{p.distanciaKm.toFixed(1)} km del almacén</span>}
                </div>

                {/* Qué bajar (en cajas) */}
                <div style={{ background: 'var(--azul-claro)', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gris)', marginBottom: '6px' }}>📥 BAJAR AQUÍ:</div>
                  {Object.values(p.totales).map(t => (
                    <div key={t.productoId} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: '16px' }}>
                      <span>{t.nombre}</span>
                      <b style={{ color: 'var(--azul)' }}>{formatCarga(t.cantidad, t.productoId)}</b>
                    </div>
                  ))}
                </div>

                {p.gps?.lat && (
                  <a className="btn btn-outline btn-sm" href={`https://www.google.com/maps/dir/?api=1&destination=${p.gps.lat},${p.gps.lng}`} target="_blank" rel="noreferrer" style={{ marginBottom: '8px' }}>
                    🧭 Navegar a este super
                  </a>
                )}

                {motivoOpen === p.storeId ? (
                  <div style={{ marginTop: '8px' }}>
                    <input value={motivo} onChange={e => setMotivo(e.target.value)}
                      placeholder="Motivo: cerrado, rechazado, sin espacio…"
                      style={{ width: '100%', padding: '10px', border: '1.5px solid #E0E0E0', borderRadius: '8px', marginBottom: '8px' }} />
                    <label style={{ fontSize: '12px', color: 'var(--gris)', display: 'block', marginBottom: '4px' }}>
                      🧾 Comprobante de factura fiscal (foto)
                    </label>
                    <input type="file" accept="image/*,application/pdf" style={{ marginBottom: '4px' }}
                      onChange={async e => {
                        const f = e.target.files?.[0]; if (!f) return
                        setSubiendoComp(true)
                        try { setCompUrl(await subirImagen(f, 'comprobantes')) } catch { alert('No se pudo subir.') }
                        setSubiendoComp(false)
                      }} />
                    {subiendoComp && <div style={{ fontSize: '12px', color: 'var(--azul)' }}>Subiendo…</div>}
                    {compUrl && <div style={{ fontSize: '12px', color: 'var(--verde)', marginBottom: '4px' }}>✅ Comprobante cargado</div>}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button className="btn btn-rojo btn-sm" style={{ flex: 1 }} disabled={accion === p.storeId}
                        onClick={() => marcar(p, false)}>Confirmar no entrega</button>
                      <button className="btn btn-outline btn-sm" onClick={() => { setMotivoOpen(null); setMotivo(''); setCompUrl('') }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '10px', padding: '10px', borderRadius: '10px',
                      background: fotosEntrega[p.storeId] ? 'var(--verde-claro)' : '#FFF4F4',
                      border: `1.5px solid ${fotosEntrega[p.storeId] ? 'var(--verde)' : '#F3C5C5'}` }}>
                      <label style={{ fontSize: '13px', fontWeight: 700, color: fotosEntrega[p.storeId] ? 'var(--verde)' : 'var(--rojo)', display: 'block', marginBottom: '6px' }}>
                        📷 Foto de entrega (obligatoria)
                      </label>
                      <input type="file" accept="image/*" capture="environment"
                        onChange={async e => {
                          const f = e.target.files?.[0]; if (!f) return
                          setSubFoto(p.storeId)
                          try { const url = await subirImagen(f, 'entregas'); setFotosEntrega(prev => ({ ...prev, [p.storeId]: url })) }
                          catch { alert('No se pudo subir la foto.') }
                          setSubFoto(null)
                        }} />
                      {subFoto === p.storeId && <span style={{ fontSize: '12px', color: 'var(--azul)' }}> subiendo…</span>}
                      {fotosEntrega[p.storeId] && <span style={{ fontSize: '12px', color: 'var(--verde)', fontWeight: 700 }}> ✅ foto lista</span>}
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-verde" style={{ flex: 1, opacity: fotosEntrega[p.storeId] ? 1 : 0.55 }}
                        disabled={accion === p.storeId}
                        onClick={() => marcar(p, true)}>
                        {accion === p.storeId ? '📍 Guardando…' : '✅ Entregada'}
                      </button>
                      <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setMotivoOpen(p.storeId); setMotivo('') }}>
                        ❌ No entregada
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

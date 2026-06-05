import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'
import { subirImagen } from '../services/cloudinary'
import { useAuth } from '../hooks/useAuth'
import { getGPS } from '../services/gps'
import { inventarioVacio, MARCAS, PRODUCTOS, POSICIONES_GONDOLA, ESTADOS_ANAQUEL, calcularVendidos, calcularPrecioPromo } from '../services/datos'
import FotoConGPS from '../components/FotoConGPS'
import SignatureCanvas from 'react-signature-canvas'
import Logo from '../components/Logo'
import { format } from 'date-fns'

const PASOS = ['📦 Inventario', '🏷️ Exhibición', '🎉 Degustación', '✍️ Cierre']

export default function VisitaForm() {
  const { supermercadoId } = useParams()
  const { state } = useLocation()
  const supermercado = state?.supermercado
  const preview = state?.preview || false
  const nombreTienda = supermercado?.name || supermercado?.nombre || 'Visita'
  const { user, perfil } = useAuth()
  const navigate = useNavigate()
  const sigRef = useRef()

  const [paso, setPaso] = useState(0)
  const [visitaId, setVisitaId] = useState(null)
  const [gpsEntrada, setGpsEntrada] = useState(null)
  const [gpsError, setGpsError] = useState(false)
  const [horaEntrada] = useState(format(new Date(), 'HH:mm'))
  const [productos, setProductos] = useState(inventarioVacio())
  const [degustacion, setDegustacion] = useState({
    hubo: null,
    horaInicio: '',
    horaFin: '',
    productos: PRODUCTOS.map(p => ({ ...p, vendidos: '' })),
    notas: '',
    foto: null
  })
  const [notasGenerales, setNotasGenerales] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const draftKey = `draft_visita_${supermercadoId}`

  // Al cargar: restaurar borrador, cargar visita anterior, capturar GPS y crear visita
  useEffect(() => {
    restaurarBorrador()
    if (preview) {
      cargarVisitaAnterior()
      return
    }
    iniciarVisita()
    cargarVisitaAnterior()
  }, [])

  // ── AUTOGUARDADO: guarda el borrador en el teléfono cada vez que algo cambia ──
  useEffect(() => {
    if (preview) return
    const draft = { productos, degustacion, notasGenerales, paso, ts: Date.now() }
    try { localStorage.setItem(draftKey, JSON.stringify(draft)) } catch {}
  }, [productos, degustacion, notasGenerales, paso])

  function restaurarBorrador() {
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const d = JSON.parse(raw)
        if (d.productos) setProductos(d.productos)
        if (d.degustacion) setDegustacion(d.degustacion)
        if (d.notasGenerales) setNotasGenerales(d.notasGenerales)
        if (typeof d.paso === 'number') setPaso(d.paso)
      }
    } catch {}
  }

  // Carga la última visita completada de esta tienda → precio y stock anteriores
  async function cargarVisitaAnterior() {
    try {
      const snap = await getDocs(
        query(collection(db, 'visits'), where('supermercadoId', '==', supermercadoId))
      )
      const completadas = snap.docs.map(d => d.data())
        .filter(v => v.estado === 'completada' && Array.isArray(v.productos))
        .sort((a, b) => (b.fecha + (b.horaEntrada||'')).localeCompare(a.fecha + (a.horaEntrada||'')))
      const anterior = completadas[0] || null
      const fechaCorte = anterior ? anterior.fecha : '0000-00-00'
      const mapa = {}
      if (anterior) {
        anterior.productos.forEach(p => {
          mapa[p.id] = {
            stockTotal: (Number(p.stockGondola)||0) + (Number(p.stockBodega)||0),
            precio: p.precioAnaquel
          }
        })
      }

      // Mercadería entregada (órdenes de compra) desde la última visita → reposición automática
      const reposicionPorProd = {}
      try {
        const oSnap = await getDocs(query(collection(db, 'purchaseOrders'), where('supermercadoId', '==', supermercadoId)))
        oSnap.docs.map(d => d.data())
          .filter(o => (o.estado === 'entregado' || o.estado === 'faltante') && (o.fechaEntrega || '') >= fechaCorte)
          .forEach(o => (o.entregadoItems || []).forEach(it => {
            reposicionPorProd[it.productoId] = (reposicionPorProd[it.productoId] || 0) + (Number(it.cantidadEntregada) || 0)
          }))
      } catch (e) { console.error('Reposición POs:', e) }

      if (!anterior && Object.keys(reposicionPorProd).length === 0) return

      setProductos(prev => prev.map(p => {
        const ant = mapa[p.id]
        const repo = reposicionPorProd[p.id]
        return {
          ...p,
          stockAnterior: ant ? ant.stockTotal : p.stockAnterior,
          precioAnterior: ant ? ant.precio : p.precioAnterior,
          reposicion: repo != null ? repo : p.reposicion,
          precioAnaquel: (p.precioAnaquel === '' && ant) ? (ant.precio ?? '') : p.precioAnaquel
        }
      }))
    } catch (err) {
      console.error('No se pudo cargar visita anterior:', err)
    }
  }

  async function iniciarVisita() {
    try {
      const gps = await getGPS()
      if (!gps?.lat) throw new Error('sin gps')
      setGpsEntrada(gps)
      setGpsError(false)

      const docRef = await addDoc(collection(db, 'visits'), {
        mercaderistaId: user.uid,
        mercaderistaName: perfil?.name || user.email,
        supermercadoId,
        supermercadoName: nombreTienda,
        fecha: format(new Date(), 'yyyy-MM-dd'),
        horaEntrada: format(new Date(), 'HH:mm'),
        gpsEntrada: gps,
        estado: 'en_curso',
        createdAt: serverTimestamp()
      })
      setVisitaId(docRef.id)
    } catch (err) {
      setGpsError(true)
      console.error(err)
    }
  }

  function actualizarProducto(idx, campo, valor) {
    setProductos(prev => {
      const nuevo = [...prev]
      nuevo[idx] = { ...nuevo[idx], [campo]: valor }
      return nuevo
    })
  }

  function actualizarDegProducto(idx, valor) {
    setDegustacion(prev => {
      const prods = [...prev.productos]
      prods[idx] = { ...prods[idx], vendidos: valor }
      return { ...prev, productos: prods }
    })
  }

  async function finalizarVisita() {
    if (preview) { alert('👁️ Esto es solo una vista previa. La visita real se guarda cuando la mercaderista la realiza desde su cuenta.'); return }
    if (!visitaId) { setError('Error: la visita no se inició correctamente.'); return }
    setGuardando(true)
    setError('')
    try {
      // Capturar GPS de salida
      let gpsSalida = null
      try { gpsSalida = await getGPS() } catch {}

      const horaSalida = format(new Date(), 'HH:mm')
      const [hE, mE] = horaEntrada.split(':').map(Number)
      const [hS, mS] = horaSalida.split(':').map(Number)
      const tiempoEnLocal = (hS * 60 + mS) - (hE * 60 + mE)

      // Guardar firma
      let firmaUrl = null
      if (sigRef.current && !sigRef.current.isEmpty()) {
        const firmaData = sigRef.current.toDataURL('image/png')
        firmaUrl = await subirImagen(firmaData, 'firmas')
      }

      // Calcular vendidos y precio de promo automáticamente
      const productosFinal = productos.map(p => ({
        ...p,
        vendidos: calcularVendidos(p),
        precioPromo: p.promoActiva ? calcularPrecioPromo(p.precioAnaquel, p.promoPct) : ''
      }))

      await updateDoc(doc(db, 'visits', visitaId), {
        horaSalida,
        gpsSalida,
        tiempoEnLocal,
        productos: productosFinal,
        degustacion,
        notasGenerales,
        firmaUrl,
        estado: 'completada'
      })

      try { localStorage.removeItem(draftKey) } catch {}
      navigate('/inicio')
    } catch (err) {
      setError('Error al guardar la visita. Intenta de nuevo.')
      console.error(err)
    } finally {
      setGuardando(false)
    }
  }

  // ─────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────

  // Bloqueo: sin GPS no se puede iniciar la visita (obligatorio)
  if (!preview && gpsError && !visitaId) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--gris-claro)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="card" style={{ maxWidth: '360px', textAlign: 'center' }}>
          <div style={{ fontSize: '52px', marginBottom: '8px' }}>📍</div>
          <h2 style={{ color: 'var(--azul-osc)', marginBottom: '8px' }}>Activa tu ubicación</h2>
          <p style={{ color: 'var(--gris)', fontSize: '14px', marginBottom: '16px' }}>
            Para iniciar la visita necesitas tener el <b>GPS activado</b> y dar permiso de ubicación.
            Sin ubicación no se puede registrar la visita.
          </p>
          <button className="btn btn-primario" onClick={() => { setGpsError(false); iniciarVisita() }}>
            🔄 Reintentar
          </button>
          <button className="btn btn-outline btn-sm" style={{ marginTop: '8px' }} onClick={() => navigate('/inicio')}>
            ← Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gris-claro)', paddingBottom: '100px' }}>
      {/* Banner vista previa */}
      {preview && (
        <div style={{ background: '#FFF3CD', color: '#856404', padding: '8px 16px', fontSize: '13px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          👁️ Vista previa del formulario — no se guardan datos
          <button onClick={() => navigate(-1)}
            style={{ background: 'none', border: '1px solid #856404', color: '#856404',
              borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>
            ← Volver
          </button>
        </div>
      )}

      {/* Header */}
      <div className="header">
        <span className="icono-back" onClick={() => navigate(preview ? -1 : '/inicio')}>←</span>
        <Logo size="sm" light />
        <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '10px' }}>
          <div style={{ fontSize: '11px', opacity: 0.8 }}>Visita</div>
          <div style={{ fontSize: '16px', fontWeight: 800, lineHeight: 1.2 }}>{nombreTienda}</div>
        </div>
      </div>

      <div className="contenedor" style={{ paddingTop: '16px' }}>
        {/* Info GPS */}
        {gpsEntrada && (
          <div className="alerta alerta-ok" style={{ marginBottom: '12px' }}>
            📍 GPS capturado · Entrada: {horaEntrada}
          </div>
        )}
        {preview && (
          <div className="alerta alerta-info" style={{ marginBottom: '12px' }}>
            📍 En la visita real, aquí se captura el GPS y la hora de entrada automáticamente.
          </div>
        )}
        {error && <div className="alerta alerta-error">{error}</div>}

        {/* Barra de progreso */}
        <div style={{ marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            {PASOS.map((p, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{
                  width: 28, height: 28,
                  borderRadius: '50%',
                  background: i < paso ? 'var(--verde)' : i === paso ? 'var(--azul)' : '#E0E0E0',
                  color: i <= paso ? 'white' : 'var(--gris)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 800,
                  boxShadow: i === paso ? '0 0 0 3px rgba(0,150,219,0.2)' : 'none',
                  transition: 'all 0.25s',
                }}>
                  {i < paso ? '✓' : i + 1}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: i === paso ? 'var(--azul)' : i < paso ? 'var(--verde)' : 'var(--gris)',
                  fontWeight: i === paso ? 700 : 400,
                  textAlign: 'center',
                  lineHeight: 1.2,
                }}>
                  {p.replace(/^\S+\s/, '')}
                </div>
              </div>
            ))}
          </div>
          <div className="progreso-barra">
            <div className="progreso-fill" style={{ width: `${(paso / (PASOS.length - 1)) * 100}%`, background: 'var(--azul)' }} />
          </div>
        </div>

        {/* ─── PASO 1: INVENTARIO ─── */}
        {paso === 0 && (
          <>
            <div className="seccion-titulo">📦 Inventario y Precios</div>
            {MARCAS.map(marca => (
              <div key={marca} className="tabla-producto">
                <div className="marca-header">🏷️ {marca}</div>
                {productos.filter(p => p.marca === marca).map((prod) => {
                  const idx = productos.findIndex(p => p.id === prod.id)
                  return (
                    <div key={prod.id} className="producto-fila">
                      <div className="producto-nombre">🥤 {prod.nombre}</div>
                      {/* Stock actual */}
                      <div className="campos-grid">
                        <div className="campo-mini">
                          <label>Stock Góndola</label>
                          <input type="number" inputMode="numeric" value={prod.stockGondola}
                            onChange={e => actualizarProducto(idx, 'stockGondola', e.target.value)} placeholder="0" />
                        </div>
                        <div className="campo-mini">
                          <label>Stock Bodega</label>
                          <input type="number" inputMode="numeric" value={prod.stockBodega}
                            onChange={e => actualizarProducto(idx, 'stockBodega', e.target.value)} placeholder="0" />
                        </div>
                      </div>

                      {/* (Vendidos se calcula solo en segundo plano — la mercaderista no lo ve.
                          La "mercadería nueva/orden de compra" la llena el transportista en su sección.) */}

                      {/* Precio con memoria */}
                      <div className="campo-mini" style={{ marginTop: '10px' }}>
                        <label>Precio ($){prod.precioAnterior != null && prod.precioAnterior !== '' && (
                          <span style={{ color: 'var(--gris)', fontWeight: 400 }}> · anterior: ${prod.precioAnterior}</span>
                        )}</label>
                        <input type="number" inputMode="decimal" value={prod.precioAnaquel}
                          onChange={e => actualizarProducto(idx, 'precioAnaquel', e.target.value)}
                          placeholder={prod.precioAnterior != null ? String(prod.precioAnterior) : '0.00'} />
                      </div>

                      {/* Promo */}
                      <div style={{ marginTop: '10px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--gris)', marginBottom: '6px' }}>
                          ¿Promoción activa?
                        </div>
                        <div className="toggle-grupo">
                          {['Sí', 'No'].map(v => (
                            <button
                              key={v} type="button"
                              className={`toggle-btn ${prod.promoActiva === (v === 'Sí') ? (v === 'Sí' ? 'activo-si' : 'activo-no') : ''}`}
                              onClick={() => actualizarProducto(idx, 'promoActiva', v === 'Sí')}
                            >
                              {v === 'Sí' ? '🏷️ Sí' : '❌ No'}
                            </button>
                          ))}
                        </div>

                        {/* % de promo → calcula precio con descuento */}
                        {prod.promoActiva === true && (
                          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginTop: '10px' }}>
                            <div className="campo-mini" style={{ width: '120px' }}>
                              <label>% descuento</label>
                              <input type="number" inputMode="numeric" value={prod.promoPct}
                                onChange={e => actualizarProducto(idx, 'promoPct', e.target.value)} placeholder="0" />
                            </div>
                            <div style={{ flex: 1, padding: '10px', background: '#E8F5E9', borderRadius: '8px',
                              fontSize: '15px', fontWeight: 700, color: 'var(--verde)' }}>
                              💲 Precio promo: {calcularPrecioPromo(prod.precioAnaquel, prod.promoPct)
                                ? `$${calcularPrecioPromo(prod.precioAnaquel, prod.promoPct)}` : '—'}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Foto del anaquel con GPS */}
                      <div style={{ marginTop: '10px' }}>
                        <FotoConGPS
                          etiqueta="Foto del anaquel"
                          storageRuta={`visitas/${visitaId}/productos`}
                          onFoto={datos => actualizarProducto(idx, 'fotoAnaquel', datos)}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </>
        )}

        {/* ─── PASO 2: EXHIBICIÓN ─── */}
        {paso === 1 && (
          <>
            <div className="seccion-titulo">🏷️ Exhibición y Vencimientos</div>
            {MARCAS.map(marca => (
              <div key={marca} className="tabla-producto">
                <div className="marca-header">🏷️ {marca}</div>
                {productos.filter(p => p.marca === marca).map((prod) => {
                  const idx = productos.findIndex(p => p.id === prod.id)
                  return (
                    <div key={prod.id} className="producto-fila">
                      <div className="producto-nombre">🥤 {prod.nombre}</div>

                      {/* Posición */}
                      <div className="campo-mini" style={{ marginBottom: '10px' }}>
                        <label>Posición en Góndola</label>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          {POSICIONES_GONDOLA.map(pos => (
                            <button
                              key={pos} type="button"
                              onClick={() => actualizarProducto(idx, 'posicionGondola', pos)}
                              style={{
                                flex: 1, padding: '8px 4px', border: '2px solid',
                                borderColor: prod.posicionGondola === pos ? 'var(--azul)' : '#E0E0E0',
                                background: prod.posicionGondola === pos ? 'var(--azul-claro)' : 'white',
                                color: prod.posicionGondola === pos ? 'var(--azul)' : '#757575',
                                borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                              }}
                            >
                              {pos}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="campos-grid" style={{ marginBottom: '10px' }}>
                        <div className="campo-mini">
                          <label>N° Frentes</label>
                          <input
                            type="number" inputMode="numeric"
                            value={prod.nFrentes}
                            onChange={e => actualizarProducto(idx, 'nFrentes', e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className="campo-mini">
                          <label>Fecha Vencimiento</label>
                          <input
                            type="date"
                            value={prod.fechaVencimiento}
                            onChange={e => actualizarProducto(idx, 'fechaVencimiento', e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Estado del anaquel */}
                      <div className="campo-mini" style={{ marginBottom: '10px' }}>
                        <label>Estado del Anaquel</label>
                        <select
                          value={prod.estadoAnaquel}
                          onChange={e => actualizarProducto(idx, 'estadoAnaquel', e.target.value)}
                        >
                          <option value="">Seleccionar...</option>
                          {ESTADOS_ANAQUEL.map(e => (
                            <option key={e} value={e}>{e}</option>
                          ))}
                        </select>
                      </div>

                      {/* Observaciones */}
                      <div className="campo-mini" style={{ marginBottom: '10px' }}>
                        <label>Observaciones</label>
                        <input
                          type="text"
                          value={prod.observaciones}
                          onChange={e => actualizarProducto(idx, 'observaciones', e.target.value)}
                          placeholder="Notas adicionales..."
                        />
                      </div>

                      {/* Foto extra */}
                      <FotoConGPS
                        etiqueta="Foto extra (opcional)"
                        storageRuta={`visitas/${visitaId}/exhibicion`}
                        onFoto={datos => actualizarProducto(idx, 'fotoExtra', datos)}
                      />
                    </div>
                  )
                })}
              </div>
            ))}
          </>
        )}

        {/* ─── PASO 3: DEGUSTACIÓN ─── */}
        {paso === 2 && (() => {
          const hoyDia = new Date().getDate()
          const ultimoDia = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
          const esQuincena = hoyDia === 15 || hoyDia === ultimoDia
          return (
          <>
            <div className="seccion-titulo">🎉 Degustación</div>

            {/* Recordatorio de quincena */}
            <div className={`alerta ${esQuincena ? 'alerta-ok' : 'alerta-info'}`} style={{ marginBottom: '12px' }}>
              {esQuincena
                ? '🎉 ¡Hoy es día de quincena! Recuerda registrar la degustación (3:00 PM – 8:00 PM).'
                : '📅 Las degustaciones se hacen los días de quincena (día 15 y último del mes), de 3:00 PM a 8:00 PM.'}
            </div>

            <div className="card">
              <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
                ¿Hubo degustación hoy?
              </div>
              <div className="toggle-grupo">
                {['Sí', 'No'].map(v => (
                  <button
                    key={v} type="button"
                    className={`toggle-btn ${degustacion.hubo === (v === 'Sí') ? (v === 'Sí' ? 'activo-si' : 'activo-no') : ''}`}
                    onClick={() => setDegustacion(prev => ({ ...prev, hubo: v === 'Sí' }))}
                    style={{ padding: '16px', fontSize: '18px' }}
                  >
                    {v === 'Sí' ? '🎉 Sí' : '❌ No'}
                  </button>
                ))}
              </div>
            </div>

            {degustacion.hubo === true && (
              <>
                {/* Horario */}
                <div className="card">
                  <div className="seccion-titulo" style={{ marginTop: 0 }}>🕐 Horario de degustación</div>
                  <div className="campos-grid">
                    <div className="campo-mini">
                      <label>Hora inicio</label>
                      <input
                        type="time"
                        value={degustacion.horaInicio}
                        onChange={e => setDegustacion(prev => ({ ...prev, horaInicio: e.target.value }))}
                      />
                    </div>
                    <div className="campo-mini">
                      <label>Hora fin</label>
                      <input
                        type="time"
                        value={degustacion.horaFin}
                        onChange={e => setDegustacion(prev => ({ ...prev, horaFin: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Productos vendidos en degustación */}
                <div className="tabla-producto">
                  <div className="marca-header">📊 Productos vendidos en degustación</div>
                  {degustacion.productos.map((prod, idx) => (
                    <div key={prod.id} className="producto-fila">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{prod.nombre}</div>
                          <div style={{ fontSize: '12px', color: 'var(--gris)' }}>{prod.marca}</div>
                        </div>
                        <div className="campo-mini" style={{ width: '100px' }}>
                          <label style={{ textAlign: 'right' }}>Unidades</label>
                          <input
                            type="number" inputMode="numeric"
                            value={prod.vendidos}
                            onChange={e => actualizarDegProducto(idx, e.target.value)}
                            placeholder="0"
                            style={{ textAlign: 'center' }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Notas y foto */}
                <div className="card">
                  <div className="campo">
                    <label>Notas de degustación</label>
                    <textarea
                      rows={3}
                      value={degustacion.notas}
                      onChange={e => setDegustacion(prev => ({ ...prev, notas: e.target.value }))}
                      placeholder="Comentarios sobre la degustación..."
                      style={{ width: '100%', padding: '12px', border: '2px solid #E0E0E0',
                        borderRadius: '10px', fontSize: '16px', resize: 'none' }}
                    />
                  </div>
                  <FotoConGPS
                    etiqueta="Foto del punto de degustación"
                    storageRuta={`visitas/${visitaId}/degustacion`}
                    onFoto={datos => setDegustacion(prev => ({ ...prev, foto: datos }))}
                  />
                </div>
              </>
            )}
          </>
          )
        })()}

        {/* ─── PASO 4: CIERRE ─── */}
        {paso === 3 && (
          <>
            <div className="seccion-titulo">✍️ Cierre de visita</div>
            <div className="card">
              <div className="campo">
                <label>Notas generales de la visita</label>
                <textarea
                  rows={4}
                  value={notasGenerales}
                  onChange={e => setNotasGenerales(e.target.value)}
                  placeholder="Escribe cualquier observación general..."
                  style={{ width: '100%', padding: '12px', border: '2px solid #E0E0E0',
                    borderRadius: '10px', fontSize: '16px', resize: 'none' }}
                />
              </div>
            </div>

            {/* Firma */}
            <div className="card">
              <div style={{ fontWeight: 600, marginBottom: '10px' }}>✍️ Firma del mercaderista</div>
              <div style={{ border: '2px solid #E0E0E0', borderRadius: '10px', overflow: 'hidden', background: '#FAFAFA' }}>
                <SignatureCanvas
                  ref={sigRef}
                  canvasProps={{ width: 500, height: 150, style: { width: '100%', height: '150px' } }}
                  backgroundColor="rgba(0,0,0,0)"
                />
              </div>
              <button
                type="button"
                onClick={() => sigRef.current?.clear()}
                style={{ marginTop: '8px', fontSize: '13px', color: 'var(--gris)',
                  background: 'none', border: 'none', cursor: 'pointer' }}
              >
                🗑️ Limpiar firma
              </button>
            </div>

            {error && <div className="alerta alerta-error">{error}</div>}

            <button
              className="btn btn-verde"
              onClick={finalizarVisita}
              disabled={guardando}
              style={{ fontSize: '20px', padding: '20px' }}
            >
              {guardando ? '⏳ Guardando...' : '✅ FINALIZAR VISITA'}
            </button>
          </>
        )}

        {/* Navegación entre pasos */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          {paso > 0 && (
            <button className="btn btn-outline btn-sm" onClick={() => setPaso(p => p - 1)} style={{ flex: 1 }}>
              ← Anterior
            </button>
          )}
          {paso < PASOS.length - 1 && (
            <button className="btn btn-primario btn-sm" onClick={() => setPaso(p => p + 1)} style={{ flex: 2 }}>
              Siguiente →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

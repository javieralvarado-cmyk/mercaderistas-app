import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'
import { subirImagen } from '../services/cloudinary'
import { useAuth } from '../hooks/useAuth'
import { getGPS, distanciaMetros } from '../services/gps'
import { inventarioVacio, MARCAS, PRODUCTOS, POSICIONES_GONDOLA, ESTADOS_ANAQUEL, MOTIVOS_MERMA, calcularVendidos, calcularPrecioPromo } from '../services/datos'
import FotoConGPS from '../components/FotoConGPS'
import SignatureCanvas from 'react-signature-canvas'
import Logo from '../components/Logo'
import { format } from 'date-fns'

export default function VisitaForm() {
  const { supermercadoId } = useParams()
  const { state } = useLocation()
  const supermercado = state?.supermercado
  const preview = state?.preview || false
  const nombreTienda = supermercado?.name || supermercado?.nombre || 'Visita'
  const { user, perfil } = useAuth()
  const navigate = useNavigate()
  const sigRef = useRef()

  const [visitaId, setVisitaId]       = useState(null)
  const [gpsEntrada, setGpsEntrada]   = useState(null)
  const [gpsError, setGpsError]       = useState(false)
  const [gpsLejos, setGpsLejos]       = useState(null) // metros si está lejos de la tienda
  const [horaEntrada]                 = useState(format(new Date(), 'HH:mm'))
  const [productos, setProductos]     = useState(inventarioVacio())
  const [degAbierto, setDegAbierto]   = useState(false)
  const [degustacion, setDegustacion] = useState({
    hubo: null, horaInicio: '', horaFin: '',
    productos: PRODUCTOS.map(p => ({ ...p, vendidos: '' })),
    notas: '', foto: null,
  })
  const [notasGenerales, setNotasGenerales] = useState('')
  const [mermaAbierto, setMermaAbierto] = useState(false)
  const [merma, setMerma] = useState(PRODUCTOS.map(p => ({ id: p.id, nombre: p.nombre, marca: p.marca, cantidad: '', motivo: '' })))
  const [guardando, setGuardando]     = useState(false)
  const [error, setError]             = useState('')

  const draftKey = `draft_visita_${supermercadoId}`

  const hoyDia      = new Date().getDate()
  const ultimoDia   = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const esQuincena  = hoyDia === 15 || hoyDia === ultimoDia

  useEffect(() => {
    restaurarBorrador()
    if (preview) { cargarVisitaAnterior(); return }
    iniciarVisita()
    cargarVisitaAnterior()
  }, [])

  useEffect(() => {
    if (preview) return
    try { localStorage.setItem(draftKey, JSON.stringify({ productos, degustacion, notasGenerales, merma, ts: Date.now() })) } catch {}
  }, [productos, degustacion, notasGenerales, merma])

  function restaurarBorrador() {
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const d = JSON.parse(raw)
        if (d.productos)      setProductos(d.productos)
        if (d.degustacion)    setDegustacion(d.degustacion)
        if (d.notasGenerales) setNotasGenerales(d.notasGenerales)
        if (d.merma) setMerma(d.merma)
      }
    } catch {}
  }

  async function cargarVisitaAnterior() {
    try {
      const snap = await getDocs(query(collection(db, 'visits'), where('supermercadoId', '==', supermercadoId)))
      const completadas = snap.docs.map(d => d.data())
        .filter(v => v.estado === 'completada' && Array.isArray(v.productos))
        .sort((a, b) => (b.fecha + (b.horaEntrada||'')).localeCompare(a.fecha + (a.horaEntrada||'')))
      const anterior = completadas[0] || null
      const fechaCorte = anterior ? anterior.fecha : '0000-00-00'
      const mapa = {}
      if (anterior) anterior.productos.forEach(p => {
        mapa[p.id] = { stockTotal: (Number(p.stockGondola)||0) + (Number(p.stockBodega)||0), precio: p.precioAnaquel }
      })

      const reposicionPorProd = {}
      try {
        const oSnap = await getDocs(query(collection(db, 'purchaseOrders'), where('supermercadoId', '==', supermercadoId)))
        oSnap.docs.map(d => d.data())
          .filter(o => (o.estado === 'entregado' || o.estado === 'faltante') && (o.fechaEntrega || '') >= fechaCorte)
          .forEach(o => (o.entregadoItems || []).forEach(it => {
            reposicionPorProd[it.productoId] = (reposicionPorProd[it.productoId] || 0) + (Number(it.cantidadEntregada) || 0)
          }))
      } catch {}

      if (!anterior && Object.keys(reposicionPorProd).length === 0) return

      setProductos(prev => prev.map(p => {
        const ant = mapa[p.id], repo = reposicionPorProd[p.id]
        return {
          ...p,
          stockAnterior:  ant  ? ant.stockTotal : p.stockAnterior,
          precioAnterior: ant  ? ant.precio     : p.precioAnterior,
          reposicion:     repo != null ? repo   : p.reposicion,
          precioAnaquel:  (p.precioAnaquel === '' && ant) ? (ant.precio ?? '') : p.precioAnaquel,
        }
      }))
    } catch (err) { console.error('No se pudo cargar visita anterior:', err) }
  }

  async function iniciarVisita() {
    try {
      const gps = await getGPS()
      if (!gps?.lat) throw new Error('sin gps')
      setGpsEntrada(gps)
      setGpsError(false)
      if (supermercado?.gps?.lat && supermercado?.gpsAprox === false) {
        const metros = distanciaMetros(gps, supermercado.gps)
        if (metros > 300) setGpsLejos(Math.round(metros))
      }
      const docRef = await addDoc(collection(db, 'visits'), {
        mercaderistaId:   user.uid,
        mercaderistaName: perfil?.name || user.email,
        supermercadoId,
        supermercadoName: nombreTienda,
        fecha:            format(new Date(), 'yyyy-MM-dd'),
        horaEntrada:      format(new Date(), 'HH:mm'),
        gpsEntrada:       gps,
        estado:           'en_curso',
        createdAt:        serverTimestamp(),
      })
      setVisitaId(docRef.id)
    } catch (err) {
      setGpsError(true)
      console.error(err)
    }
  }

  function actualizarProducto(idx, campo, valor) {
    setProductos(prev => { const n = [...prev]; n[idx] = { ...n[idx], [campo]: valor }; return n })
  }

  function actualizarDegProducto(idx, valor) {
    setDegustacion(prev => {
      const prods = [...prev.productos]
      prods[idx] = { ...prods[idx], vendidos: valor }
      return { ...prev, productos: prods }
    })
  }

  async function finalizarVisita() {
    if (preview) { alert('👁️ Vista previa — la visita real la registra la mercaderista desde su cuenta.'); return }
    if (!visitaId) { setError('Error: la visita no se inició correctamente.'); return }

    // Validar foto de anaquel obligatoria
    const sinFoto = productos.filter(p => !p.fotoAnaquel?.url)
    if (sinFoto.length > 0) {
      setError(`📷 Falta foto de anaquel: ${sinFoto.map(p => p.nombre).join(', ')}`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setGuardando(true)
    setError('')
    try {
      let gpsSalida = null
      try { gpsSalida = await getGPS() } catch {}
      const horaSalida = format(new Date(), 'HH:mm')
      const [hE, mE]   = horaEntrada.split(':').map(Number)
      const [hS, mS]   = horaSalida.split(':').map(Number)
      const tiempoEnLocal = (hS * 60 + mS) - (hE * 60 + mE)

      let firmaUrl = null
      if (sigRef.current && !sigRef.current.isEmpty()) {
        firmaUrl = await subirImagen(sigRef.current.toDataURL('image/png'), 'firmas')
      }

      const productosFinal = productos.map(p => ({
        ...p,
        vendidos:    calcularVendidos(p),
        precioPromo: p.promoActiva ? calcularPrecioPromo(p.precioAnaquel, p.promoPct) : '',
      }))

      const mermaFinal = merma
        .filter(m => Number(m.cantidad) > 0)
        .map(m => ({ id: m.id, nombre: m.nombre, marca: m.marca, cantidad: Number(m.cantidad), motivo: m.motivo || 'Otro' }))

      await updateDoc(doc(db, 'visits', visitaId), {
        horaSalida, gpsSalida, tiempoEnLocal,
        productos: productosFinal, degustacion, notasGenerales, merma: mermaFinal, firmaUrl,
        estado: 'completada',
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

  // ── GPS bloqueante ──────────────────────────────────────────────────────────
  if (!preview && gpsError && !visitaId) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--gris-claro)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div className="card" style={{ maxWidth: '360px', textAlign: 'center' }}>
          <div style={{ fontSize: '52px', marginBottom: '8px' }}>📍</div>
          <h2 style={{ color: 'var(--rojo)', marginBottom: '8px' }}>GPS requerido</h2>
          <p style={{ color: 'var(--gris)', fontSize: '14px', marginBottom: '8px' }}>
            <b>No puedes iniciar la visita sin GPS.</b>
          </p>
          <p style={{ color: 'var(--gris)', fontSize: '13px', marginBottom: '16px' }}>
            Activa la ubicación en tu teléfono y da permiso al navegador. Sin ubicación no se registra la visita.
          </p>
          <button className="btn btn-primario" onClick={() => { setGpsError(false); iniciarVisita() }}>
            🔄 Reintentar con GPS
          </button>
          <button className="btn btn-outline btn-sm" style={{ marginTop: '8px' }} onClick={() => navigate('/inicio')}>
            ← Volver
          </button>
        </div>
      </div>
    )
  }

  // ── RENDER PRINCIPAL ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--gris-claro)', paddingBottom: '120px' }}>
      {preview && (
        <div style={{ background: '#FFF3CD', color: '#856404', padding: '8px 16px', fontSize: '13px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          👁️ Vista previa — no se guardan datos
          <button onClick={() => navigate(-1)}
            style={{ background: 'none', border: '1px solid #856404', color: '#856404',
              borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px' }}>← Volver</button>
        </div>
      )}

      <div className="header">
        <span className="icono-back" onClick={() => navigate(preview ? -1 : '/inicio')}>←</span>
        <Logo size="sm" light />
        <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '10px' }}>
          <div style={{ fontSize: '11px', opacity: 0.8 }}>Visita</div>
          <div style={{ fontSize: '16px', fontWeight: 800, lineHeight: 1.2 }}>{nombreTienda}</div>
        </div>
      </div>

      <div className="contenedor" style={{ paddingTop: '16px' }}>
        {/* Status GPS */}
        {gpsEntrada ? (
          <div className="alerta alerta-ok" style={{ marginBottom: '12px' }}>
            📍 GPS capturado · Entrada: {horaEntrada}
          </div>
        ) : preview ? (
          <div className="alerta alerta-info" style={{ marginBottom: '12px' }}>
            📍 En la visita real, el GPS y la hora de entrada se capturan automáticamente.
          </div>
        ) : (
          <div className="alerta alerta-warning" style={{ marginBottom: '12px' }}>
            ⏳ Capturando GPS...
          </div>
        )}

        {gpsLejos && (
          <div className="alerta alerta-warning" style={{ marginBottom: '12px' }}>
            ⚠️ <b>Estás a {gpsLejos} m de la tienda.</b> Verifica que estés en el lugar correcto antes de registrar la visita.
          </div>
        )}

        {error && (
          <div className="alerta alerta-error" style={{ marginBottom: '12px' }}>{error}</div>
        )}

        {/* ── PRODUCTOS ─────────────────────────────────────────────────── */}
        {MARCAS.map(marca => (
          <div key={marca} className="tabla-producto">
            <div className="marca-header">🏷️ {marca}</div>

            {productos.filter(p => p.marca === marca).map(prod => {
              const idx = productos.findIndex(p => p.id === prod.id)
              const fotoOk = !!prod.fotoAnaquel?.url

              return (
                <div key={prod.id} className="producto-fila">
                  <div className="producto-nombre">🥤 {prod.nombre}</div>

                  {/* Stock */}
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

                  {/* Precio */}
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
                    <div style={{ fontSize: '12px', color: 'var(--gris)', marginBottom: '6px' }}>¿Promoción activa?</div>
                    <div className="toggle-grupo">
                      {['Sí', 'No'].map(v => (
                        <button key={v} type="button"
                          className={`toggle-btn ${prod.promoActiva === (v === 'Sí') ? (v === 'Sí' ? 'activo-si' : 'activo-no') : ''}`}
                          onClick={() => actualizarProducto(idx, 'promoActiva', v === 'Sí')}>
                          {v === 'Sí' ? '🏷️ Sí' : '❌ No'}
                        </button>
                      ))}
                    </div>
                    {prod.promoActiva === true && (
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', marginTop: '10px' }}>
                        <div className="campo-mini" style={{ width: '120px' }}>
                          <label>% descuento</label>
                          <input type="number" inputMode="numeric" value={prod.promoPct}
                            onChange={e => actualizarProducto(idx, 'promoPct', e.target.value)} placeholder="0" />
                        </div>
                        <div style={{ flex: 1, padding: '10px', background: '#E8F5E9', borderRadius: '8px',
                          fontSize: '15px', fontWeight: 700, color: 'var(--verde)' }}>
                          💲 {calcularPrecioPromo(prod.precioAnaquel, prod.promoPct)
                            ? `$${calcularPrecioPromo(prod.precioAnaquel, prod.promoPct)}` : '—'}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Exhibición */}
                  <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #E0E0E0' }}>
                    {/* Posición góndola */}
                    <div className="campo-mini" style={{ marginBottom: '10px' }}>
                      <label>Posición en Góndola</label>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        {POSICIONES_GONDOLA.map(pos => (
                          <button key={pos} type="button"
                            onClick={() => actualizarProducto(idx, 'posicionGondola', pos)}
                            style={{ flex: 1, padding: '8px 4px', border: '2px solid',
                              borderColor: prod.posicionGondola === pos ? 'var(--azul)' : '#E0E0E0',
                              background: prod.posicionGondola === pos ? 'var(--azul-claro)' : 'white',
                              color: prod.posicionGondola === pos ? 'var(--azul)' : '#757575',
                              borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                            {pos}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="campos-grid" style={{ marginBottom: '10px' }}>
                      <div className="campo-mini">
                        <label>N° Frentes</label>
                        <input type="number" inputMode="numeric" value={prod.nFrentes}
                          onChange={e => actualizarProducto(idx, 'nFrentes', e.target.value)} placeholder="0" />
                      </div>
                      <div className="campo-mini">
                        <label>Fecha Vencimiento</label>
                        <input type="date" value={prod.fechaVencimiento}
                          onChange={e => actualizarProducto(idx, 'fechaVencimiento', e.target.value)} />
                      </div>
                    </div>

                    <div className="campo-mini" style={{ marginBottom: '10px' }}>
                      <label>Estado del Anaquel</label>
                      <select value={prod.estadoAnaquel}
                        onChange={e => actualizarProducto(idx, 'estadoAnaquel', e.target.value)}>
                        <option value="">Seleccionar...</option>
                        {ESTADOS_ANAQUEL.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Foto obligatoria */}
                  <div style={{ marginTop: '10px', padding: '12px',
                    background: fotoOk ? '#E8F5E9' : '#FFF3E0',
                    borderRadius: '10px', border: `1.5px solid ${fotoOk ? 'var(--verde)' : 'var(--amarillo)'}` }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px',
                      color: fotoOk ? 'var(--verde)' : '#E65100' }}>
                      {fotoOk ? '✅ Foto de anaquel subida' : '📷 Foto de anaquel (obligatoria)'}
                    </div>
                    {!fotoOk && (
                      <FotoConGPS
                        etiqueta="Foto anaquel"
                        storageRuta={`visitas/${visitaId}/productos`}
                        onFoto={datos => actualizarProducto(idx, 'fotoAnaquel', datos)}
                        obligatoria={true}
                      />
                    )}
                    {fotoOk && (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <img src={prod.fotoAnaquel.url} alt="anaquel"
                          style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />
                        <button type="button" onClick={() => actualizarProducto(idx, 'fotoAnaquel', null)}
                          style={{ fontSize: '12px', color: 'var(--rojo)', background: 'none', border: 'none', cursor: 'pointer' }}>
                          🗑️ Cambiar foto
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Comentarios */}
                  <div style={{ marginTop: '10px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gris)', display: 'block', marginBottom: '4px' }}>
                      💬 Comentarios
                    </label>
                    <textarea rows={2} value={prod.observaciones || ''}
                      onChange={e => actualizarProducto(idx, 'observaciones', e.target.value)}
                      placeholder="Observaciones sobre este producto..."
                      style={{ width: '100%', padding: '10px', border: '1.5px solid #E0E0E0',
                        borderRadius: '8px', fontSize: '14px', resize: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              )
            })}
          </div>
        ))}

        {/* ── DEGUSTACIÓN ──────────────────────────────────────────────── */}
        <div className="card" style={{ marginTop: '8px', padding: 0, overflow: 'hidden' }}>
          <button type="button"
            onClick={() => setDegAbierto(v => !v)}
            style={{ width: '100%', padding: '16px', background: degAbierto ? 'var(--azul)' : 'white',
              color: degAbierto ? 'white' : 'var(--azul-osc)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700, fontSize: '16px' }}>
            <span>🎉 Modo Degustación {esQuincena && <span style={{ fontSize: '12px', background: '#FFD400', color: '#333', padding: '2px 8px', borderRadius: '10px', marginLeft: 8 }}>¡Hoy toca!</span>}</span>
            <span>{degAbierto ? '▲' : '▼'}</span>
          </button>

          {degAbierto && (
            <div style={{ padding: '16px' }}>
              {!esQuincena && (
                <div className="alerta alerta-info" style={{ marginBottom: '12px' }}>
                  📅 Las degustaciones son los días 15 y último del mes, de 3:00 PM a 8:00 PM.
                </div>
              )}

              <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px' }}>¿Hubo degustación hoy?</div>
              <div className="toggle-grupo" style={{ marginBottom: '16px' }}>
                {['Sí', 'No'].map(v => (
                  <button key={v} type="button"
                    className={`toggle-btn ${degustacion.hubo === (v === 'Sí') ? (v === 'Sí' ? 'activo-si' : 'activo-no') : ''}`}
                    onClick={() => setDegustacion(prev => ({ ...prev, hubo: v === 'Sí' }))}
                    style={{ padding: '14px', fontSize: '16px' }}>
                    {v === 'Sí' ? '🎉 Sí' : '❌ No'}
                  </button>
                ))}
              </div>

              {degustacion.hubo === true && (
                <>
                  <div className="campos-grid" style={{ marginBottom: '12px' }}>
                    <div className="campo-mini">
                      <label>Hora inicio</label>
                      <input type="time" value={degustacion.horaInicio}
                        onChange={e => setDegustacion(prev => ({ ...prev, horaInicio: e.target.value }))} />
                    </div>
                    <div className="campo-mini">
                      <label>Hora fin</label>
                      <input type="time" value={degustacion.horaFin}
                        onChange={e => setDegustacion(prev => ({ ...prev, horaFin: e.target.value }))} />
                    </div>
                  </div>

                  <div className="marca-header" style={{ marginBottom: '8px' }}>📊 Unidades vendidas en degustación</div>
                  {degustacion.productos.map((prod, idx) => (
                    <div key={prod.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 0', borderBottom: '1px solid #F0F0F0' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{prod.nombre}</div>
                        <div style={{ fontSize: '12px', color: 'var(--gris)' }}>{prod.marca}</div>
                      </div>
                      <div className="campo-mini" style={{ width: '90px' }}>
                        <input type="number" inputMode="numeric" value={prod.vendidos}
                          onChange={e => actualizarDegProducto(idx, e.target.value)}
                          placeholder="0" style={{ textAlign: 'center' }} />
                      </div>
                    </div>
                  ))}

                  <div style={{ marginTop: '12px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gris)', display: 'block', marginBottom: '4px' }}>
                      💬 Notas de degustación
                    </label>
                    <textarea rows={3} value={degustacion.notas}
                      onChange={e => setDegustacion(prev => ({ ...prev, notas: e.target.value }))}
                      placeholder="Comentarios sobre la degustación..."
                      style={{ width: '100%', padding: '10px', border: '1.5px solid #E0E0E0',
                        borderRadius: '8px', fontSize: '14px', resize: 'none', boxSizing: 'border-box' }} />
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <FotoConGPS
                      etiqueta="Foto del punto de degustación"
                      storageRuta={`visitas/${visitaId}/degustacion`}
                      onFoto={datos => setDegustacion(prev => ({ ...prev, foto: datos }))}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── MERMA / PRODUCTO RETIRADO ────────────────────────────────── */}
        <div className="card" style={{ marginTop: '8px', padding: 0, overflow: 'hidden' }}>
          <button type="button" onClick={() => setMermaAbierto(v => !v)}
            style={{ width: '100%', padding: '16px', background: mermaAbierto ? 'var(--rojo)' : 'white',
              color: mermaAbierto ? 'white' : 'var(--azul-osc)', border: 'none', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700, fontSize: '15px' }}>
            <span>🗑️ Merma / producto retirado</span>
            <span>{mermaAbierto ? '▲' : '▼'}</span>
          </button>
          {mermaAbierto && (
            <div style={{ padding: '12px 16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--gris)', marginBottom: '10px' }}>
                Registra solo si retiraste producto vencido o dañado del anaquel. Deja en blanco lo que no aplique.
              </div>
              {merma.map((m, idx) => (
                <div key={m.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ flex: 1, fontSize: '13px' }}>{m.nombre}</span>
                  <input type="number" min="0" value={m.cantidad} placeholder="0"
                    onChange={e => setMerma(prev => prev.map((x, i) => i === idx ? { ...x, cantidad: e.target.value } : x))}
                    style={{ width: '64px', padding: '8px', border: '1.5px solid #E0E0E0', borderRadius: '8px', fontSize: '14px' }} />
                  <select value={m.motivo}
                    onChange={e => setMerma(prev => prev.map((x, i) => i === idx ? { ...x, motivo: e.target.value } : x))}
                    style={{ padding: '8px', border: '1.5px solid #E0E0E0', borderRadius: '8px', fontSize: '13px' }}>
                    <option value="">Motivo…</option>
                    {MOTIVOS_MERMA.map(mo => <option key={mo} value={mo}>{mo}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── COMENTARIOS GENERALES ────────────────────────────────────── */}
        <div className="card" style={{ marginTop: '8px' }}>
          <div style={{ fontWeight: 700, marginBottom: '8px' }}>💬 Comentarios generales de la visita</div>
          <textarea rows={4} value={notasGenerales}
            onChange={e => setNotasGenerales(e.target.value)}
            placeholder="Escribe cualquier observación general sobre la tienda, el equipo, incidencias..."
            style={{ width: '100%', padding: '12px', border: '1.5px solid #E0E0E0',
              borderRadius: '10px', fontSize: '15px', resize: 'none', boxSizing: 'border-box' }} />
        </div>

        {/* ── FIRMA ────────────────────────────────────────────────────── */}
        <div className="card" style={{ marginTop: '8px' }}>
          <div style={{ fontWeight: 600, marginBottom: '10px' }}>✍️ Firma del mercaderista</div>
          <div style={{ border: '2px solid #E0E0E0', borderRadius: '10px', overflow: 'hidden', background: '#FAFAFA' }}>
            <SignatureCanvas ref={sigRef}
              canvasProps={{ width: 500, height: 150, style: { width: '100%', height: '150px' } }}
              backgroundColor="rgba(0,0,0,0)" />
          </div>
          <button type="button" onClick={() => sigRef.current?.clear()}
            style={{ marginTop: '8px', fontSize: '13px', color: 'var(--gris)',
              background: 'none', border: 'none', cursor: 'pointer' }}>
            🗑️ Limpiar firma
          </button>
        </div>

        {error && <div className="alerta alerta-error" style={{ marginTop: '8px' }}>{error}</div>}

        <button className="btn btn-verde" onClick={finalizarVisita} disabled={guardando}
          style={{ fontSize: '20px', padding: '20px', marginTop: '16px', width: '100%' }}>
          {guardando ? '⏳ Guardando...' : '✅ FINALIZAR VISITA'}
        </button>
      </div>
    </div>
  )
}

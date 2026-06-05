import { useState, useEffect } from 'react'
import { collection, getDocs, addDoc, doc, deleteDoc, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore'
import { db } from '../services/firebase'
import { subirImagen } from '../services/cloudinary'
import { PRODUCTOS } from '../services/datos'
import { leerOrden, emparejarTienda, prepararItems } from '../services/lectorOrden'
import { format } from 'date-fns'

const TRANSPORTISTAS = ['Sin asignar', 'Transportista 1', 'Transportista 2']

const ESTADO_BADGE = {
  pendiente:    { clase: 'badge-amarillo', txt: '🟡 Pendiente' },
  entregado:    { clase: 'badge-verde',    txt: '✅ Entregado' },
  faltante:     { clase: 'badge-rojo',     txt: '⚠️ Con faltantes' },
  no_entregada: { clase: 'badge-rojo',     txt: '❌ No entregada' },
}

export default function OrdenesAdmin() {
  const [ordenes, setOrdenes] = useState([])
  const [tiendas, setTiendas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // Form de nueva orden
  const [numeroOrden, setNumeroOrden] = useState('')
  const [tiendaId, setTiendaId] = useState('')
  const [transportista, setTransportista] = useState('Sin asignar')
  const [cantidades, setCantidades] = useState({}) // productoId -> cantidad
  const [facturaUrl, setFacturaUrl] = useState('')
  const [subiendoFactura, setSubiendoFactura] = useState(false)

  // Lector IA
  const [leyendo, setLeyendo] = useState(false)
  const [resultadoIA, setResultadoIA] = useState(null)

  useEffect(() => {
    getDocs(collection(db, 'supermarkets')).then(s =>
      setTiendas(s.docs.map(d => ({ id: d.id, ...d.data() }))))
    const unsub = onSnapshot(
      query(collection(db, 'purchaseOrders'), orderBy('createdAt', 'desc')),
      snap => { setOrdenes(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setCargando(false) },
      err => { console.error(err); setCargando(false) }
    )
    return unsub
  }, [])

  async function subirFactura(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendoFactura(true)
    try { setFacturaUrl(await subirImagen(file, 'facturas')) }
    catch { alert('No se pudo subir la factura.') }
    setSubiendoFactura(false)
  }

  async function crearOrden() {
    const tienda = tiendas.find(t => t.id === tiendaId)
    const items = PRODUCTOS
      .filter(p => Number(cantidades[p.id]) > 0)
      .map(p => ({ productoId: p.id, nombre: p.nombre, marca: p.marca, cantidad: Number(cantidades[p.id]) }))
    if (!tienda) { alert('Elige la tienda.'); return }
    if (items.length === 0) { alert('Agrega al menos un producto con cantidad.'); return }
    setGuardando(true)
    await addDoc(collection(db, 'purchaseOrders'), {
      numeroOrden: numeroOrden || `OC-${Date.now().toString().slice(-5)}`,
      supermercadoId: tienda.id,
      supermercadoName: tienda.name,
      transportistaName: transportista,
      items,
      facturaUrl,
      estado: 'pendiente',
      entregadoItems: [],
      comprobanteUrl: '',
      notasEntrega: '',
      fechaEntrega: '',
      fecha: format(new Date(), 'yyyy-MM-dd'),
      createdAt: serverTimestamp(),
    })
    // reset
    setNumeroOrden(''); setTiendaId(''); setTransportista('Sin asignar')
    setCantidades({}); setFacturaUrl(''); setCreando(false); setGuardando(false)
  }

  async function borrarOrden(id) {
    if (!confirm('¿Borrar esta orden de compra?')) return
    await deleteDoc(doc(db, 'purchaseOrders', id))
  }

  // ── Subir PDF/foto de orden → leer con IA → crear órdenes automáticamente ──
  async function subirYLeer(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLeyendo(true); setResultadoIA(null)
    try {
      const { ordenes } = await leerOrden(file)
      if (!ordenes || ordenes.length === 0) throw new Error('No se detectaron órdenes en el documento.')
      // Guardar el documento original como factura de la(s) orden(es)
      let docUrl = ''
      try { docUrl = await subirImagen(file, 'ordenes') } catch (e) { console.error('No se pudo guardar el documento:', e) }
      const creadas = []
      for (const ord of ordenes) {
        const tienda = emparejarTienda(ord.tiendaDestino, tiendas)
        const { items, noReconocidos } = prepararItems(ord.items)
        await addDoc(collection(db, 'purchaseOrders'), {
          numeroOrden: ord.numeroOrden || `OC-${Date.now().toString().slice(-5)}`,
          supermercadoId: tienda?.id || '',
          supermercadoName: tienda?.name || ord.tiendaDestino || 'Sin identificar',
          transportistaName: 'Sin asignar',
          proveedor: ord.proveedor || '',
          items,
          facturaUrl: docUrl,
          estado: 'pendiente',
          entregadoItems: [], comprobanteUrl: '', notasEntrega: '', fechaEntrega: '',
          fecha: format(new Date(), 'yyyy-MM-dd'),
          origen: 'IA',
          createdAt: serverTimestamp(),
        })
        creadas.push({
          numero: ord.numeroOrden, proveedor: ord.proveedor,
          tienda: tienda?.name, tiendaTexto: ord.tiendaDestino,
          items: items.length, noReconocidos,
        })
      }
      setResultadoIA({ ok: true, creadas })
    } catch (err) {
      setResultadoIA({ ok: false, error: String(err.message || err) })
    }
    setLeyendo(false)
    e.target.value = ''
  }

  if (cargando) return <div className="spinner" />

  return (
    <div>
      <div className="seccion-titulo">📦 Órdenes de compra</div>

      {/* ── Lector con IA: subir foto o PDF de la orden ── */}
      <div className="card" style={{ background: '#F0F7FF', marginBottom: '16px' }}>
        <div style={{ fontWeight: 700, marginBottom: '6px' }}>📸 Leer orden con IA</div>
        <div style={{ fontSize: '13px', color: 'var(--gris)', marginBottom: '10px' }}>
          Toma una foto de la orden de compra (o sube un PDF). La IA detecta la tienda, los productos
          y las cantidades, y crea la orden pendiente sola.
        </div>
        <label className="btn btn-primario" style={{ display: 'inline-block', cursor: 'pointer' }}>
          {leyendo ? '🔎 Leyendo orden…' : '📷 Subir foto / PDF de la orden'}
          <input type="file" accept="image/*,application/pdf" hidden disabled={leyendo}
            onChange={subirYLeer} />
        </label>

        {resultadoIA && resultadoIA.ok && (
          <div className="alerta alerta-ok" style={{ marginTop: '12px', textAlign: 'left' }}>
            ✅ Se {resultadoIA.creadas.length === 1 ? 'creó 1 orden' : `crearon ${resultadoIA.creadas.length} órdenes`}:
            {resultadoIA.creadas.map((c, i) => (
              <div key={i} style={{ fontSize: '13px', marginTop: '6px' }}>
                • <b>{c.numero}</b> → {c.tienda || `⚠️ "${c.tiendaTexto}" (no encontrada en catálogo)`} · {c.items} producto(s)
                {c.noReconocidos?.length > 0 && (
                  <div style={{ color: 'var(--rojo)', fontSize: '12px' }}>
                    ⚠️ No reconocí: {c.noReconocidos.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {resultadoIA && !resultadoIA.ok && (
          <div className="alerta alerta-error" style={{ marginTop: '12px' }}>
            ❌ {resultadoIA.error.includes('Failed to fetch') || resultadoIA.error.includes('NetworkError')
              ? 'No se pudo conectar al lector. ¿Está corriendo el servidor? (npm run proxy)'
              : resultadoIA.error}
          </div>
        )}
      </div>

      {!creando ? (
        <button className="btn btn-verde" style={{ marginBottom: '16px' }} onClick={() => setCreando(true)}>
          ➕ Nueva orden de compra
        </button>
      ) : (
        <div className="card" style={{ background: '#F5F9FF', marginBottom: '16px' }}>
          <div style={{ fontWeight: 700, marginBottom: '10px' }}>➕ Nueva orden</div>

          <div className="campo-mini" style={{ marginBottom: '10px' }}>
            <label>N° de orden (opcional)</label>
            <input value={numeroOrden} onChange={e => setNumeroOrden(e.target.value)} placeholder="OC-001" />
          </div>

          <div className="campo-mini" style={{ marginBottom: '10px' }}>
            <label>Supermercado</label>
            <select value={tiendaId} onChange={e => setTiendaId(e.target.value)}>
              <option value="">Elige una tienda...</option>
              {tiendas.map(t => <option key={t.id} value={t.id}>{t.name} · {t.ciudad}</option>)}
            </select>
          </div>

          <div className="campo-mini" style={{ marginBottom: '10px' }}>
            <label>Transportista</label>
            <select value={transportista} onChange={e => setTransportista(e.target.value)}>
              {TRANSPORTISTAS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 700, margin: '12px 0 6px' }}>Productos y cantidades</div>
          {PRODUCTOS.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ fontSize: '14px' }}>{p.nombre} <span style={{ color: 'var(--gris)', fontSize: '12px' }}>· {p.marca}</span></span>
              <input type="number" inputMode="numeric" value={cantidades[p.id] || ''}
                onChange={e => setCantidades(prev => ({ ...prev, [p.id]: e.target.value }))}
                placeholder="0" style={{ width: '80px', padding: '6px', border: '1.5px solid #E0E0E0', borderRadius: '8px', textAlign: 'center' }} />
            </div>
          ))}

          <div className="campo-mini" style={{ margin: '12px 0' }}>
            <label>Factura (foto o PDF)</label>
            <input type="file" accept="image/*,application/pdf" onChange={subirFactura} />
            {subiendoFactura && <div style={{ fontSize: '12px', color: 'var(--azul)' }}>Subiendo…</div>}
            {facturaUrl && <div style={{ fontSize: '12px', color: 'var(--verde)' }}>✅ Factura cargada</div>}
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-verde" style={{ flex: 1 }} disabled={guardando} onClick={crearOrden}>
              {guardando ? 'Guardando…' : '💾 Crear orden'}
            </button>
            <button className="btn btn-outline btn-sm" onClick={() => setCreando(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Lista agrupada: por súper → productos consolidados */}
      {ordenes.length === 0 && <div className="alerta alerta-info">No hay órdenes de compra todavía.</div>}
      {(() => {
        const grupos = {}
        ordenes.forEach(o => {
          const key = o.supermercadoId || o.supermercadoName || 'Sin identificar'
          if (!grupos[key]) grupos[key] = { tienda: o.supermercadoName || 'Sin identificar', ordenes: [], totales: {} }
          grupos[key].ordenes.push(o)
          ;(o.items || []).forEach(it => {
            const t = grupos[key].totales[it.productoId] || { nombre: it.nombre, pedido: 0, entregado: 0 }
            t.pedido += Number(it.cantidad) || 0
            grupos[key].totales[it.productoId] = t
          })
          ;(o.entregadoItems || []).forEach(it => {
            const t = grupos[key].totales[it.productoId]
            if (t) t.entregado += Number(it.cantidadEntregada) || 0
          })
        })
        return Object.values(grupos).map(g => {
          const pendientes = g.ordenes.filter(o => o.estado === 'pendiente').length
          return (
            <div key={g.tienda} className="card">
              {/* Súper */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontWeight: 800, fontSize: '16px' }}>🏪 {g.tienda}</div>
                <span style={{ fontSize: '12px', color: 'var(--gris)' }}>
                  {g.ordenes.length} orden(es){pendientes > 0 ? ` · ${pendientes} pendiente(s)` : ''}
                </span>
              </div>

              {/* Productos consolidados (suma de todas las órdenes de ese súper) */}
              <div style={{ fontSize: '14px', marginBottom: '10px', background: '#F7FAFF', borderRadius: '8px', padding: '8px 10px' }}>
                {Object.values(g.totales).map((t, k) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                    <span>{t.nombre}</span>
                    <b>{t.pedido} u{t.entregado > 0 ? ` · entregado ${t.entregado}` : ''}</b>
                  </div>
                ))}
              </div>

              {/* Órdenes individuales de ese súper */}
              <div style={{ borderTop: '1px solid #EEE', paddingTop: '8px' }}>
                {g.ordenes.map(o => {
                  const badge = ESTADO_BADGE[o.estado] || ESTADO_BADGE.pendiente
                  return (
                    <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontSize: '13px' }}>
                        <b>{o.numeroOrden}</b> <span style={{ color: 'var(--gris)' }}>· {o.proveedor || o.transportistaName}</span>
                      </span>
                      <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span className={`badge ${badge.clase}`}>{badge.txt}</span>
                        {o.facturaUrl && <a className="btn btn-outline btn-sm" href={o.facturaUrl} target="_blank" rel="noreferrer">📄</a>}
                        {o.comprobanteUrl && <a className="btn btn-outline btn-sm" href={o.comprobanteUrl} target="_blank" rel="noreferrer">🧾</a>}
                        {o.fotoEntregaUrl && <a className="btn btn-outline btn-sm" href={o.fotoEntregaUrl} target="_blank" rel="noreferrer">📸</a>}
                        <button className="btn btn-outline btn-sm" style={{ color: '#b00' }} onClick={() => borrarOrden(o.id)}>🗑️</button>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      })()}
    </div>
  )
}

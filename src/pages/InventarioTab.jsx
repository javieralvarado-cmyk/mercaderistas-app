import { useState, useEffect } from 'react'
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import { format, subDays } from 'date-fns'
import { PRODUCTOS, aUnidades } from '../services/datos'
import { stockCentral, stockAnaquel } from '../services/inventario'

// Inventario: central (almacén) y en anaquel (tiendas).
export default function InventarioTab() {
  const [vista, setVista] = useState('central')
  return (
    <div>
      <div className="seccion-titulo">📦 Inventario</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button onClick={() => setVista('central')} style={toggle(vista === 'central')}>🏬 Central (almacén)</button>
        <button onClick={() => setVista('anaquel')} style={toggle(vista === 'anaquel')}>🏪 Anaquel (tiendas)</button>
      </div>
      {vista === 'central' ? <Central /> : <Anaquel />}
    </div>
  )
}

// ─── CENTRAL: entradas de almacén − salidas por órdenes ──────────
function Central() {
  const [cargando, setCargando] = useState(true)
  const [filas, setFilas] = useState([])
  const [guardando, setGuardando] = useState(false)
  // form
  const [prodId, setProdId] = useState(PRODUCTOS[0]?.id || '')
  const [cant, setCant] = useState('')
  const [unidad, setUnidad] = useState('CJ')
  const [nota, setNota] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    try {
      const [eSnap, oSnap] = await Promise.all([
        getDocs(collection(db, 'inventarioEntradas')),
        getDocs(collection(db, 'purchaseOrders')),
      ])
      const entradas = eSnap.docs.map(d => d.data())
      const ordenes = oSnap.docs.map(d => d.data())
      setFilas(stockCentral(entradas, ordenes))
    } catch (err) {
      console.error('Error cargando inventario central:', err)
      setFilas([])
    }
    setCargando(false)
  }

  async function registrarEntrada(e) {
    e.preventDefault()
    const prod = PRODUCTOS.find(p => p.id === Number(prodId))
    const unidades = aUnidades(cant, unidad, prod)
    if (!prod || unidades <= 0) { alert('Elige producto y cantidad.'); return }
    setGuardando(true)
    try {
      await addDoc(collection(db, 'inventarioEntradas'), {
        productoId: prod.id, nombre: prod.nombre, marca: prod.marca,
        cantidad: unidades, nota: nota.trim(),
        fecha: format(new Date(), 'yyyy-MM-dd'), createdAt: serverTimestamp(),
      })
      setCant(''); setNota('')
      await cargar()
    } catch (err) { alert('Error al registrar la entrada.'); console.error(err) }
    setGuardando(false)
  }

  if (cargando) return <div className="spinner" />

  return (
    <>
      <div className="alerta alerta-info" style={{ fontSize: 12 }}>
        Stock del almacén = <b>entradas</b> (lo que cargas) − <b>salidas</b> (lo pedido por las tiendas en órdenes de compra, sin contar las no entregadas).
      </div>

      <div style={{ overflowX: 'auto', margin: '12px 0' }}>
        <table style={tbl}>
          <thead>
            <tr><th style={th}>Producto</th><th style={thR}>Entradas</th><th style={thR}>Salidas</th><th style={thR}>Stock</th></tr>
          </thead>
          <tbody>
            {filas.map(f => (
              <tr key={f.id}>
                <td style={td}><b>{f.nombre}</b><div style={{ fontSize: 11, color: '#999' }}>{f.marca}</div></td>
                <td style={tdR}>{f.entrada}</td>
                <td style={tdR}>{f.salida}</td>
                <td style={{ ...tdR, fontWeight: 800, color: f.stock <= 0 ? 'var(--rojo, #ef4444)' : f.stock < 24 ? 'var(--naranja, #F7941E)' : 'var(--verde, #16a34a)' }}>
                  {f.stock}{f.stock <= 0 && ' ⚠️'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={registrarEntrada} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>➕ Registrar entrada de almacén</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={lbl}>Producto
            <select value={prodId} onChange={e => setProdId(e.target.value)} style={{ ...inp, minWidth: 190 }}>
              {PRODUCTOS.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
          <label style={lbl}>Cantidad
            <input type="number" min="0" value={cant} onChange={e => setCant(e.target.value)} style={{ ...inp, width: 90 }} placeholder="0" />
          </label>
          <label style={lbl}>Unidad
            <select value={unidad} onChange={e => setUnidad(e.target.value)} style={inp}>
              <option value="CJ">Cajas</option>
              <option value="UN">Unidades</option>
            </select>
          </label>
          <label style={{ ...lbl, flex: 1, minWidth: 140 }}>Nota (opcional)
            <input value={nota} onChange={e => setNota(e.target.value)} style={inp} placeholder="Ej: producción del lunes" />
          </label>
          <button type="submit" disabled={guardando} style={btnAdd}>{guardando ? 'Guardando…' : 'Agregar'}</button>
        </div>
      </form>
    </>
  )
}

// ─── ANAQUEL: stock actual por tienda (última visita) ────────────
function Anaquel() {
  const [cargando, setCargando] = useState(true)
  const [data, setData] = useState({ porProducto: [], porTienda: [] })

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    try {
      const desde = format(subDays(new Date(), 30), 'yyyy-MM-dd')
      const snap = await getDocs(query(collection(db, 'visits'), where('fecha', '>=', desde)))
      setData(stockAnaquel(snap.docs.map(d => d.data())))
    } catch (err) {
      console.error('Error cargando anaquel:', err)
      setData({ porProducto: [], porTienda: [] })
    }
    setCargando(false)
  }

  if (cargando) return <div className="spinner" />

  return (
    <>
      <div className="alerta alerta-info" style={{ fontSize: 12 }}>
        Suma del stock en góndola + bodega según la <b>última visita</b> de cada tienda (últimos 30 días).
      </div>

      <div style={{ overflowX: 'auto', margin: '12px 0' }}>
        <table style={tbl}>
          <thead><tr><th style={th}>Producto</th><th style={thR}>En anaquel (todas las tiendas)</th></tr></thead>
          <tbody>
            {data.porProducto.map(p => (
              <tr key={p.id}>
                <td style={td}><b>{p.nombre}</b><div style={{ fontSize: 11, color: '#999' }}>{p.marca}</div></td>
                <td style={{ ...tdR, fontWeight: 800 }}>{p.unidades} u</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ fontWeight: 800, margin: '6px 0 8px' }}>Por tienda</div>
      {data.porTienda.length === 0 && <div className="alerta alerta-info">Sin visitas en los últimos 30 días.</div>}
      {data.porTienda.map((t, i) => (
        <div key={i} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <b style={{ fontSize: 14 }}>🏪 {t.supermercadoName}</b>
            <span style={{ fontSize: 11, color: '#999' }}>{t.fecha}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
            {t.productos.filter(p => p.unidades > 0).map(p => (
              <span key={p.id} style={{ fontSize: 12, background: '#f5f7fa', borderRadius: 6, padding: '3px 8px' }}>{p.nombre}: <b>{p.unidades}</b></span>
            ))}
            {t.productos.every(p => p.unidades === 0) && <span style={{ fontSize: 12, color: '#aaa' }}>Sin stock registrado</span>}
          </div>
        </div>
      ))}
    </>
  )
}

const toggle = (on) => ({
  padding: '9px 14px', borderRadius: 9, fontWeight: 700, cursor: 'pointer', fontSize: 13,
  border: on ? '2px solid var(--marca-azul, #0096DB)' : '1.5px solid #ddd',
  background: on ? 'var(--marca-azul, #0096DB)' : '#fff', color: on ? '#fff' : '#555',
})
const lbl = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, fontWeight: 600, color: '#555' }
const inp = { padding: '8px 10px', border: '1.5px solid #ddd', borderRadius: 8, fontSize: 14 }
const btnAdd = { padding: '9px 16px', background: 'var(--verde, #22c55e)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }
const tbl = { width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', borderRadius: 10, overflow: 'hidden' }
const th = { textAlign: 'left', padding: '10px 12px', background: 'var(--marca-azul, #0096DB)', color: '#fff', fontSize: 12 }
const thR = { ...th, textAlign: 'right' }
const td = { padding: '9px 12px', borderBottom: '1px solid #f0f0f0' }
const tdR = { ...td, textAlign: 'right' }

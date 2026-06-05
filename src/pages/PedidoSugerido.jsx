import { useState, useEffect } from 'react'
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../services/firebase'
import { PRODUCTOS } from '../services/datos'
import { format } from 'date-fns'

// Convierte unidades a "X caja(s)" según el tamaño de caja del producto
function enCajas(unidades, prodId) {
  const prod = PRODUCTOS.find(p => p.id === prodId)
  const porCaja = prod?.unidadesPorCaja || 1
  if (porCaja > 1) {
    const cajas = Math.round(unidades / porCaja)
    return `${cajas} caja${cajas !== 1 ? 's' : ''} (${unidades} u)`
  }
  return `${unidades} u`
}

export default function PedidoSugerido() {
  const [sugerencias, setSugerencias] = useState([])
  const [cargando, setCargando] = useState(true)
  const [creando, setCreando] = useState(null)
  const [creadas, setCreadas] = useState({})

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    try {
      const snap = await getDocs(query(collection(db, 'visits'), where('estado', '==', 'completada')))
      const visitas = snap.docs.map(d => ({ id: d.id, ...d.data() }))

      // Última visita por tienda
      const ultimaPorTienda = {}
      visitas.forEach(v => {
        const key = v.supermercadoId || v.supermercadoName
        const clave = (v.fecha || '') + (v.horaEntrada || '')
        if (!ultimaPorTienda[key] || clave > ultimaPorTienda[key]._clave) {
          ultimaPorTienda[key] = { ...v, _clave: clave }
        }
      })

      // Calcular sugerencia por tienda
      const lista = Object.values(ultimaPorTienda).map(v => {
        const items = []
        ;(v.productos || []).forEach(p => {
          const porCaja = (PRODUCTOS.find(x => x.id === p.id)?.unidadesPorCaja) || 1
          const stockActual = (Number(p.stockGondola) || 0) + (Number(p.stockBodega) || 0)
          const vendidos = Number(p.vendidos) || 0
          let sugeridoU = Math.max(0, vendidos - stockActual) // reponer lo vendido que ya no hay
          if ((p.estadoAnaquel === 'Vacío' || p.estadoAnaquel === 'Bajo stock') && sugeridoU === 0) sugeridoU = porCaja
          const cajas = Math.ceil(sugeridoU / porCaja)
          const sugeridoFinal = cajas * porCaja
          if (sugeridoFinal > 0) {
            items.push({ productoId: p.id, nombre: p.nombre, marca: p.marca, cantidad: sugeridoFinal, vendidos, stockActual, estado: p.estadoAnaquel })
          }
        })
        return { supermercadoId: v.supermercadoId, supermercadoName: v.supermercadoName, fecha: v.fecha, items }
      }).filter(s => s.items.length > 0)

      setSugerencias(lista)
    } catch (err) { console.error(err) }
    setCargando(false)
  }

  async function crearOrden(s) {
    setCreando(s.supermercadoId || s.supermercadoName)
    try {
      await addDoc(collection(db, 'purchaseOrders'), {
        numeroOrden: `SUG-${Date.now().toString().slice(-5)}`,
        supermercadoId: s.supermercadoId || '',
        supermercadoName: s.supermercadoName,
        transportistaName: 'Sin asignar',
        proveedor: 'Pedido sugerido',
        items: s.items.map(i => ({ productoId: i.productoId, nombre: i.nombre, marca: i.marca, cantidad: i.cantidad })),
        facturaUrl: '', estado: 'pendiente', entregadoItems: [], comprobanteUrl: '', notasEntrega: '', fechaEntrega: '',
        fecha: format(new Date(), 'yyyy-MM-dd'), origen: 'sugerido', createdAt: serverTimestamp(),
      })
      setCreadas(prev => ({ ...prev, [s.supermercadoId || s.supermercadoName]: true }))
    } catch (err) { alert('Error al crear la orden.'); console.error(err) }
    setCreando(null)
  }

  if (cargando) return <div className="spinner" />

  return (
    <div>
      <div className="seccion-titulo">🧮 Pedido sugerido</div>
      <div className="alerta alerta-info" style={{ fontSize: '12px' }}>
        💡 Calculado con la última visita de cada tienda: lo vendido + el stock actual.
        Sugiere cuánto reenviar (redondeado a cajas). Puedes crear la orden con 1 clic.
      </div>

      {sugerencias.length === 0 && (
        <div className="alerta alerta-info">
          Aún no hay datos suficientes. Aparecerá cuando las mercaderistas registren visitas con ventas/stock.
        </div>
      )}

      {sugerencias.map(s => {
        const key = s.supermercadoId || s.supermercadoName
        return (
          <div key={key} className="card">
            <div style={{ fontWeight: 800, fontSize: '16px', marginBottom: '4px' }}>🏪 {s.supermercadoName}</div>
            <div style={{ fontSize: '12px', color: 'var(--gris)', marginBottom: '8px' }}>Según visita del {s.fecha}</div>
            {s.items.map(i => (
              <div key={i.productoId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <span style={{ fontSize: '14px' }}>
                  {i.nombre}
                  {(i.estado === 'Vacío' || i.estado === 'Bajo stock') && <span style={{ color: 'var(--rojo)', fontSize: '11px' }}> · {i.estado}</span>}
                </span>
                <b style={{ color: 'var(--azul)' }}>{enCajas(i.cantidad, i.productoId)}</b>
              </div>
            ))}
            {creadas[key] ? (
              <div className="alerta alerta-ok" style={{ marginTop: '10px' }}>✅ Orden creada (ve a 📦 Órdenes)</div>
            ) : (
              <button className="btn btn-verde" style={{ marginTop: '10px' }} disabled={creando === key}
                onClick={() => crearOrden(s)}>
                {creando === key ? 'Creando…' : '📦 Crear orden con esto'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

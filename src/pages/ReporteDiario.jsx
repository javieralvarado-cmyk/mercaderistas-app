import { useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

// Tarjeta de métrica pequeña
function Metrica({ label, valor, color }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '12px', marginBottom: 0 }}>
      <div style={{ fontSize: '22px', fontWeight: 800, color }}>{valor}</div>
      <div style={{ fontSize: '11px', color: 'var(--gris)', marginTop: '2px' }}>{label}</div>
    </div>
  )
}

export default function ReporteDiario({ visitas, catalogo, alertas, degustaciones, totalesDeg, cumplimiento, fecha }) {
  const [ordenes, setOrdenes] = useState([])

  useEffect(() => {
    if (!fecha) return
    getDocs(query(collection(db, 'purchaseOrders'), where('fecha', '==', fecha)))
      .then(snap => setOrdenes(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => {})
  }, [fecha])

  // ─── Métricas generales ────────────────────────────────────────────────────
  const fechaLabel  = format(new Date(fecha + 'T12:00:00'), "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
  const completadas = visitas.filter(v => v.estado === 'completada').length
  const enCurso     = visitas.filter(v => v.estado === 'en_curso').length

  const totalProgramadas = cumplimiento.reduce((s, c) => s + c.total, 0)
  const totalVisitadas   = cumplimiento.reduce((s, c) => s + c.visitadas, 0)
  const pctGeneral       = totalProgramadas > 0 ? Math.round(totalVisitadas / totalProgramadas * 100) : 0

  const visitasConTiempo = visitas.filter(v => v.tiempoEnLocal)
  const tiempoPromedio   = visitasConTiempo.length > 0
    ? Math.round(visitasConTiempo.reduce((s, v) => s + v.tiempoEnLocal, 0) / visitasConTiempo.length)
    : 0

  // ─── Stock crítico ─────────────────────────────────────────────────────────
  const gondolaVacia = [], bajoStock = [], porVencer = [], vencidos = []
  visitas.forEach(v => {
    v.productos?.forEach(p => {
      const entry = { prod: p.nombre, super: v.supermercadoName }
      if (p.estadoAnaquel === 'Vacío')      gondolaVacia.push(entry)
      if (p.estadoAnaquel === 'Bajo stock') bajoStock.push(entry)
      if (p.fechaVencimiento) {
        const dias = Math.ceil((new Date(p.fechaVencimiento) - new Date()) / 86400000)
        if (dias <= 0)  vencidos.push({ ...entry, dias })
        else if (dias <= 30) porVencer.push({ ...entry, dias })
      }
    })
  })

  // ─── Ventas del día ────────────────────────────────────────────────────────
  const ventasPorProd = {}
  visitas.forEach(v => {
    v.productos?.forEach(p => {
      const n = Number(p.vendidos) || 0
      if (n > 0) ventasPorProd[p.nombre] = (ventasPorProd[p.nombre] || 0) + n
    })
  })
  const ventasOrdenadas = Object.entries(ventasPorProd).sort(([, a], [, b]) => b - a)

  // ─── Órdenes ──────────────────────────────────────────────────────────────
  const ordenesPendientes  = ordenes.filter(o => o.estado === 'pendiente')
  const ordenesEntregadas  = ordenes.filter(o => o.estado === 'entregado')
  const ordenesNoEntregadas = ordenes.filter(o => o.estado === 'no_entregada')

  const hayStockCritico = gondolaVacia.length + bajoStock.length + vencidos.length + porVencer.length > 0

  return (
    <div style={{ maxWidth: '100%' }}>
      {/* ─ Encabezado del reporte ─ */}
      <div style={{
        background: 'var(--azul-marino)',
        borderRadius: '14px',
        padding: '16px',
        textAlign: 'center',
        marginBottom: '16px',
        color: 'white',
      }}>
        <div style={{ fontSize: '11px', opacity: 0.75, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
          Reporte Diario · FreshCo
        </div>
        <div style={{ fontSize: '17px', fontWeight: 800, marginTop: '4px', textTransform: 'capitalize' }}>
          {fechaLabel}
        </div>
      </div>

      {/* ─ Resumen general ─ */}
      <div className="seccion-titulo">📊 Resumen General</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
        <Metrica label="Programadas"  valor={totalProgramadas} color="var(--azul)" />
        <Metrica label="Completadas"  valor={totalVisitadas}   color="var(--verde)" />
        <Metrica
          label="Cumplimiento"
          valor={`${pctGeneral}%`}
          color={pctGeneral === 100 ? 'var(--verde)' : pctGeneral >= 50 ? 'var(--amarillo)' : 'var(--rojo)'}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '16px' }}>
        <Metrica label="En curso"    valor={enCurso}          color="var(--amarillo)" />
        <Metrica label="Tiempo prom." valor={tiempoPromedio > 0 ? `${tiempoPromedio} min` : '—'} color="var(--azul)" />
        <Metrica
          label="Alertas"
          valor={alertas.length}
          color={alertas.filter(a => a.tipo === 'rojo').length > 0 ? 'var(--rojo)' : alertas.length > 0 ? 'var(--amarillo)' : 'var(--verde)'}
        />
      </div>

      {/* ─ Por mercaderista ─ */}
      {cumplimiento.length > 0 && (
        <>
          <div className="seccion-titulo">👥 Por Mercaderista</div>
          {cumplimiento.map(c => {
            const visitasM    = visitas.filter(v => v.mercaderistaName === c.nombre)
            const conTiempoM  = visitasM.filter(v => v.tiempoEnLocal)
            const promM       = conTiempoM.length > 0
              ? Math.round(conTiempoM.reduce((s, v) => s + v.tiempoEnLocal, 0) / conTiempoM.length)
              : 0
            return (
              <div key={c.nombre} className="card" style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <b style={{ fontSize: '15px' }}>👤 {c.nombre}</b>
                  <span style={{
                    fontWeight: 800, fontSize: '17px',
                    color: c.pct === 100 ? 'var(--verde)' : c.pct >= 50 ? 'var(--amarillo)' : 'var(--rojo)',
                  }}>{c.pct}%</span>
                </div>
                <div style={{ height: 6, background: '#E6EEF5', borderRadius: 3, overflow: 'hidden', marginBottom: '6px' }}>
                  <div style={{
                    height: '100%',
                    width: `${c.pct}%`,
                    background: c.pct === 100 ? 'var(--verde)' : 'var(--azul)',
                    transition: 'width .3s',
                  }} />
                </div>
                <div style={{ fontSize: '13px', color: 'var(--gris)', display: 'flex', gap: '14px' }}>
                  <span>✅ {c.visitadas}/{c.total} tiendas</span>
                  {promM > 0 && <span>⏱️ {promM} min prom.</span>}
                </div>
                {c.faltantes.length > 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--rojo)', marginTop: '6px' }}>
                    ❌ Sin visitar: {c.faltantes.map(t => t.name).join(', ')}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}

      {/* ─ Stock crítico ─ */}
      {hayStockCritico && (
        <>
          <div className="seccion-titulo">📦 Stock Crítico</div>
          {gondolaVacia.length > 0 && (
            <div className="alerta alerta-error">
              <b>🚨 Góndola vacía ({gondolaVacia.length}):</b>{' '}
              {gondolaVacia.map(x => `${x.prod} — ${x.super}`).join(' · ')}
            </div>
          )}
          {vencidos.length > 0 && (
            <div className="alerta alerta-error">
              <b>❌ Vencidos ({vencidos.length}):</b>{' '}
              {vencidos.map(x => `${x.prod} — ${x.super}`).join(' · ')}
            </div>
          )}
          {bajoStock.length > 0 && (
            <div className="alerta alerta-warning">
              <b>⚠️ Bajo stock ({bajoStock.length}):</b>{' '}
              {bajoStock.map(x => `${x.prod} — ${x.super}`).join(' · ')}
            </div>
          )}
          {porVencer.length > 0 && (
            <div className="alerta alerta-warning">
              <b>📅 Por vencer ({porVencer.length}):</b>{' '}
              {porVencer.map(x => `${x.prod} — ${x.super} (${x.dias}d)`).join(' · ')}
            </div>
          )}
        </>
      )}

      {/* ─ Ventas del día ─ */}
      {ventasOrdenadas.length > 0 && (
        <>
          <div className="seccion-titulo">📈 Unidades Vendidas Hoy</div>
          <div className="card">
            {ventasOrdenadas.map(([nombre, cant]) => (
              <div key={nombre} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '7px 0', borderBottom: '1px solid #F0F0F0',
              }}>
                <span style={{ fontSize: '14px' }}>{nombre}</span>
                <b style={{ color: 'var(--azul)' }}>{cant} u</b>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ─ Degustaciones ─ */}
      {degustaciones.length > 0 && (
        <>
          <div className="seccion-titulo">🎉 Degustaciones</div>
          <div className="card">
            <div style={{ fontSize: '13px', color: 'var(--gris)', marginBottom: '8px' }}>
              {degustaciones.length} degustación{degustaciones.length !== 1 ? 'es' : ''} realizadas
            </div>
            {Object.entries(totalesDeg).map(([n, c]) => (
              <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: '14px' }}>{n}</span>
                <b style={{ color: 'var(--azul)' }}>{c} u</b>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ─ Órdenes de compra ─ */}
      {ordenes.length > 0 && (
        <>
          <div className="seccion-titulo">🚚 Órdenes de Compra</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
            <Metrica label="Pendientes"    valor={ordenesPendientes.length}   color="var(--amarillo)" />
            <Metrica label="Entregadas"    valor={ordenesEntregadas.length}   color="var(--verde)" />
            <Metrica label="No entregadas" valor={ordenesNoEntregadas.length} color={ordenesNoEntregadas.length > 0 ? 'var(--rojo)' : 'var(--gris)'} />
          </div>
          {ordenesNoEntregadas.length > 0 && (
            <div className="alerta alerta-error">
              <b>🚨 No entregadas:</b>{' '}
              {ordenesNoEntregadas.map(o => o.supermercadoName).join(' · ')}
            </div>
          )}
        </>
      )}

      {/* ─ Sin visitas ─ */}
      {visitas.length === 0 && (
        <div className="alerta alerta-info">No hay visitas registradas para este día.</div>
      )}

      {/* ─ Todo OK ─ */}
      {!hayStockCritico && alertas.length === 0 && visitas.length > 0 && (
        <div className="alerta alerta-ok">✅ Sin alertas. Todo en orden.</div>
      )}

      {/* ─ Botón imprimir ─ */}
      <button
        className="btn btn-outline"
        style={{ width: '100%', marginTop: '12px', marginBottom: '8px' }}
        onClick={() => window.print()}
      >
        🖨️ Imprimir / Guardar como PDF
      </button>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../services/firebase'
import { exportarVisitaExcel } from '../services/exportExcel'

export default function VisitaDetalle() {
  const { visitaId } = useParams()
  const navigate = useNavigate()
  const [visita, setVisita] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    getDoc(doc(db, 'visits', visitaId)).then(snap => {
      if (snap.exists()) setVisita({ id: snap.id, ...snap.data() })
      setCargando(false)
    })
  }, [visitaId])

  if (cargando) return <div className="spinner" style={{ height: '100vh' }} />
  if (!visita) return <div className="contenedor"><div className="alerta alerta-error">Visita no encontrada.</div></div>

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gris-claro)', paddingBottom: '30px' }}>
      <div className="header">
        <span className="icono-back" onClick={() => navigate('/supervisor')}>←</span>
        <h1>{visita.supermercadoName}</h1>
        <button className="btn btn-sm" onClick={() => exportarVisitaExcel(visita)}
          style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}>
          📥 Excel
        </button>
      </div>

      <div className="contenedor" style={{ paddingTop: '16px' }}>
        {/* Encabezado */}
        <div className="card">
          <div className="seccion-titulo" style={{ marginTop: 0 }}>📋 Datos de la visita</div>
          {[
            ['👤 Mercaderista', visita.mercaderistaName],
            ['📅 Fecha',        visita.fecha],
            ['🕐 Entrada',      visita.horaEntrada],
            ['🕔 Salida',       visita.horaSalida || 'En curso'],
            ['⏱️ Tiempo',       visita.tiempoEnLocal ? `${visita.tiempoEnLocal} minutos` : '-'],
            ['📍 GPS entrada',  visita.gpsEntrada ? `${visita.gpsEntrada.lat?.toFixed(5)}, ${visita.gpsEntrada.lng?.toFixed(5)}` : '-'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F0F0F0' }}>
              <span style={{ color: 'var(--gris)', fontSize: '14px' }}>{k}</span>
              <span style={{ fontWeight: 600, fontSize: '14px' }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Inventario */}
        <div className="seccion-titulo">📦 Inventario</div>
        {visita.productos?.map((prod, i) => (
          <div key={i} className="card" style={{ padding: '14px' }}>
            <div style={{ fontWeight: 700, marginBottom: '8px' }}>
              {prod.marca} · {prod.nombre}
              {prod.promoActiva && <span className="badge badge-azul" style={{ marginLeft: '8px' }}>🏷️ Promo</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              {[
                ['Góndola', prod.stockGondola],
                ['Bodega',  prod.stockBodega],
                ['Vendidos',prod.vendidos],
              ].map(([k, v]) => (
                <div key={k} style={{ textAlign: 'center', background: 'var(--gris-claro)', borderRadius: '8px', padding: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700 }}>{v || 0}</div>
                  <div style={{ fontSize: '11px', color: 'var(--gris)' }}>{k}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--gris)' }}>
              {prod.posicionGondola && `📍 ${prod.posicionGondola} · `}
              {prod.nFrentes && `${prod.nFrentes} frentes · `}
              {prod.estadoAnaquel && (
                <span className={`badge badge-${prod.estadoAnaquel === 'Bien stockeado' ? 'verde' : prod.estadoAnaquel === 'Vacío' ? 'rojo' : 'amarillo'}`}>
                  {prod.estadoAnaquel}
                </span>
              )}
              {prod.fechaVencimiento && ` · Vence: ${prod.fechaVencimiento}`}
            </div>
            {prod.observaciones && (
              <div style={{ marginTop: '6px', fontSize: '13px', color: '#555', fontStyle: 'italic' }}>
                💬 {prod.observaciones}
              </div>
            )}
            {/* Fotos */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
              {prod.fotoAnaquel?.url && (
                <div>
                  <img src={prod.fotoAnaquel.url} alt="Anaquel" style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '8px' }} />
                  <div style={{ fontSize: '10px', color: 'var(--verde)' }}>📷 GPS ✓</div>
                </div>
              )}
              {prod.fotoExtra?.url && (
                <div>
                  <img src={prod.fotoExtra.url} alt="Extra" style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: '8px' }} />
                  <div style={{ fontSize: '10px', color: 'var(--gris)' }}>📷 Extra</div>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Degustación */}
        {visita.degustacion?.hubo && (
          <>
            <div className="seccion-titulo">🎉 Degustación</div>
            <div className="card">
              <div style={{ marginBottom: '10px' }}>
                🕐 {visita.degustacion.horaInicio} → {visita.degustacion.horaFin}
              </div>
              {visita.degustacion.productos?.filter(p => p.vendidos > 0).map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F0F0F0' }}>
                  <span>{p.nombre} ({p.marca})</span>
                  <span style={{ fontWeight: 700 }}>{p.vendidos} uds.</span>
                </div>
              ))}
              {visita.degustacion.notas && (
                <div style={{ marginTop: '10px', fontSize: '13px', color: '#555' }}>
                  💬 {visita.degustacion.notas}
                </div>
              )}
              {visita.degustacion.foto?.url && (
                <img src={visita.degustacion.foto.url} alt="Degustación"
                  style={{ width: '100%', borderRadius: '10px', marginTop: '10px', maxHeight: '200px', objectFit: 'cover' }} />
              )}
            </div>
          </>
        )}

        {/* Notas y firma */}
        {visita.notasGenerales && (
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: '6px' }}>📝 Notas generales</div>
            <div style={{ color: '#555' }}>{visita.notasGenerales}</div>
          </div>
        )}
        {visita.firmaUrl && (
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, marginBottom: '8px' }}>✍️ Firma</div>
            <img src={visita.firmaUrl} alt="Firma" style={{ maxWidth: '300px', border: '1px solid #EEE', borderRadius: '8px' }} />
          </div>
        )}
      </div>
    </div>
  )
}

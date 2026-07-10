import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../hooks/useAuth'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Logo from '../components/Logo'

// Quita acentos y pasa a minúsculas: "Miércoles" -> "miercoles"
function normalizar(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export default function MercaderistaHome() {
  const { user, perfil, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Modo vista previa (supervisor mirando la app como si fuera X)
  const preview = location.state?.previewMerc || null
  const mercaderistaNombre = preview || perfil?.name || 'Mercaderista'

  const [supermercados, setSupermercados] = useState([])
  const [visitasHoy, setVisitasHoy] = useState([])
  const [cargando, setCargando] = useState(true)

  const hoy = format(new Date(), 'yyyy-MM-dd')
  const diaHoy = normalizar(format(new Date(), 'EEEE', { locale: es }))

  useEffect(() => { cargarDatos() }, [preview])

  async function cargarDatos() {
    setCargando(true)
    try {
      // Tiendas asignadas a esta mercaderista para el día de hoy
      const snap = await getDocs(
        query(collection(db, 'supermarkets'), where('mercaderista', '==', mercaderistaNombre))
      )
      const todas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      const deHoy = todas.filter(t => normalizar(t.dia) === diaHoy)
      // Si no hay nada para hoy pero sí tiene tiendas, mostrarlas todas (para no dejar pantalla vacía)
      setSupermercados(deHoy)

      // Visitas de hoy de esta persona
      if (!preview && user) {
        const vSnap = await getDocs(
          query(collection(db, 'visits'),
            where('mercaderistaId', '==', user.uid),
            where('fecha', '==', hoy))
        )
        setVisitasHoy(vSnap.docs.map(d => ({ id: d.id, ...d.data() })))
      } else {
        setVisitasHoy([])
      }
    } catch (err) {
      console.error('Error cargando datos mercaderista:', err)
    }
    setCargando(false)
  }

  function estadoSuper(superId) {
    const v = visitasHoy.find(v => v.supermercadoId === superId)
    if (!v) return 'pendiente'
    if (v.horaEntrada && !v.horaSalida) return 'en_curso'
    if (v.horaSalida) return 'completada'
    return 'pendiente'
  }

  const badgeEstado = (estado) => ({
    pendiente:  { clase: 'badge-gris',     icono: '⬜', texto: 'Pendiente' },
    en_curso:   { clase: 'badge-amarillo', icono: '🟡', texto: 'En curso' },
    completada: { clase: 'badge-verde',    icono: '✅', texto: 'Completada' },
  }[estado] || { clase: 'badge-gris', icono: '⬜', texto: 'Pendiente' })

  if (cargando) return <div className="spinner" style={{ height: '100vh' }} />

  return (
    <div style={{ minHeight: '100vh', background: 'var(--gris-claro)' }}>
      {/* Banner de vista previa */}
      {preview && (
        <div className="preview-banner">
          👁️ Vista previa — así ve la app <b>{preview}</b>
          <button onClick={() => navigate('/supervisor')}>← Volver al panel</button>
        </div>
      )}

      {/* Header */}
      <div className="header">
        <Logo size="sm" light />
        <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.3)', paddingLeft: '12px' }}>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>Mercaderista</div>
          <div style={{ fontSize: '18px', fontWeight: 800 }}>{mercaderistaNombre}</div>
        </div>
        {!preview && (
          <button onClick={logout}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
              padding: '8px 14px', borderRadius: '10px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
            Salir
          </button>
        )}
      </div>

      <div className="contenedor" style={{ paddingTop: '16px' }}>
        {/* Recordatorio de credenciales (solo si la cuenta tiene clave guardada y no se ha descartado) */}
        {!preview && perfil?.clave && <RecordatorioClave email={perfil.email} clave={perfil.clave} />}

        {/* Fecha — tarjeta de bienvenida */}
        <div style={{
          background: 'var(--grad-marca)',
          borderRadius: '16px',
          padding: '16px 20px',
          marginBottom: '16px',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: 'var(--sombra-fuerte)',
        }}>
          <div>
            <div style={{ fontSize: '13px', opacity: 0.8, textTransform: 'capitalize' }}>
              {format(new Date(), "EEEE", { locale: es })}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800 }}>
              {format(new Date(), "d 'de' MMMM", { locale: es })}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--marca-amarillo)' }}>
              {visitasHoy.filter(v => v.horaSalida).length}/{supermercados.length}
            </div>
            <div style={{ fontSize: '11px', opacity: 0.85 }}>visitas listas</div>
          </div>
        </div>

        {/* Resumen del día */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '20px' }}>
          {[
            { label: 'Pendientes', count: supermercados.filter(s => estadoSuper(s.id) === 'pendiente').length, color: 'var(--gris)' },
            { label: 'En curso', count: supermercados.filter(s => estadoSuper(s.id) === 'en_curso').length, color: 'var(--amarillo)' },
            { label: 'Listas ✓', count: supermercados.filter(s => estadoSuper(s.id) === 'completada').length, color: 'var(--verde)' },
          ].map(r => (
            <div key={r.label} className="card" style={{ textAlign: 'center', padding: '14px 8px', marginBottom: 0 }}>
              <div style={{ fontSize: '28px', fontWeight: 800, color: r.color }}>{r.count}</div>
              <div style={{ fontSize: '12px', color: 'var(--gris)', marginTop: '2px' }}>{r.label}</div>
            </div>
          ))}
        </div>

        {/* Botón para ver el formulario de ejemplo (solo en vista previa) */}
        {preview && (
          <button className="btn btn-primario" style={{ marginBottom: '16px' }}
            onClick={() => navigate('/vista-visita/ejemplo', {
              state: { preview: true, supermercado: { name: 'Tienda de ejemplo', ciudad: 'Panamá' } }
            })}>
            👁️ Ver el formulario de visita (ejemplo)
          </button>
        )}

        <div className="seccion-titulo">🏪 Mis supermercados de hoy</div>

        {supermercados.length === 0 && (
          <div className="alerta alerta-info">
            ℹ️ No tienes supermercados asignados para hoy ({format(new Date(), 'EEEE', { locale: es })}).
            {preview && ' Asigna tiendas a esta mercaderista en la pestaña Catálogo (mercaderista + día).'}
          </div>
        )}

        {supermercados.map(super_ => {
          const estado = estadoSuper(super_.id)
          const badge = badgeEstado(estado)
          const visita = visitasHoy.find(v => v.supermercadoId === super_.id)

          return (
            <div key={super_.id} className="card" style={{
              borderLeft: `4px solid ${estado === 'completada' ? 'var(--verde)' : estado === 'en_curso' ? 'var(--amarillo)' : 'var(--rojo)'}`
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '17px' }}>{super_.name}</div>
                  <div style={{ color: 'var(--gris)', fontSize: '13px', marginTop: '2px' }}>📍 {super_.ciudad}</div>
                  {visita?.horaEntrada && (
                    <div style={{ color: 'var(--gris)', fontSize: '12px', marginTop: '4px' }}>
                      Entrada: {visita.horaEntrada}
                      {visita.horaSalida && ` · Salida: ${visita.horaSalida}`}
                    </div>
                  )}
                </div>
                <span className={`badge ${badge.clase}`}>{badge.icono} {badge.texto}</span>
              </div>

              {/* Botón de navegación a la tienda */}
              {(super_.mapsUrl || super_.gps?.lat) && estado !== 'completada' && (
                <a
                  className="btn btn-outline btn-sm"
                  style={{ marginBottom: '8px' }}
                  href={super_.mapsUrl || `https://www.google.com/maps/dir/?api=1&destination=${super_.gps.lat},${super_.gps.lng}`}
                  target="_blank" rel="noreferrer"
                >
                  🧭 Navegar
                </a>
              )}

              {estado !== 'completada' && (
                <button
                  className={`btn ${estado === 'en_curso' ? 'btn-verde' : 'btn-primario'}`}
                  onClick={() => preview
                    ? navigate(`/vista-visita/${super_.id}`, { state: { preview: true, supermercado: super_ } })
                    : navigate(`/visita/${super_.id}`, { state: { supermercado: super_ } })}>
                  {preview ? '👁️ Ver formulario' : estado === 'en_curso' ? '▶️ Continuar visita' : '🚀 Iniciar visita'}
                </button>
              )}
              {estado === 'completada' && (
                <div style={{ textAlign: 'center', color: 'var(--verde)', fontWeight: 600, fontSize: '15px' }}>
                  ✅ Visita completada
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function RecordatorioClave({ email, clave }) {
  const [visible, setVisible] = useState(true)
  const [verClave, setVerClave] = useState(false)
  if (!visible) return null
  return (
    <div style={{
      background: '#FFF8E1', border: '1.5px solid #FFD400',
      borderRadius: 12, padding: '12px 16px', marginBottom: 14,
      display: 'flex', alignItems: 'flex-start', gap: 10,
    }}>
      <span style={{ fontSize: 22 }}>🔑</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Tus datos de acceso</div>
        <div style={{ fontSize: 13, color: '#444' }}>👤 <b>{email.replace('@freshcopty.com', '')}</b></div>
        <div style={{ fontSize: 13, color: '#444', display: 'flex', alignItems: 'center', gap: 6 }}>
          🔒 {verClave ? clave : '••••••••'}
          <button onClick={() => setVerClave(v => !v)}
            style={{ fontSize: 11, background: '#eee', border: 'none', borderRadius: 6, padding: '2px 7px', cursor: 'pointer' }}>
            {verClave ? 'Ocultar' : 'Ver'}
          </button>
        </div>
      </div>
      <button onClick={() => setVisible(false)}
        style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#999', lineHeight: 1 }}>
        ✕
      </button>
    </div>
  )
}

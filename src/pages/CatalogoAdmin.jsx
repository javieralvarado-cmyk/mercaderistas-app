import { useState, useEffect } from 'react'
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc, writeBatch } from 'firebase/firestore'
import { db } from '../services/firebase'
import { TIENDAS_PANAMA } from '../data/tiendasPanama'

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const DIA_LABEL = {
  '': '— sin día —',
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado'
}
const MERCADERISTAS = ['Sin asignar', 'Darkiris', 'Digna', 'Solimar']

// Ruta de Darkiris según el Excel (nombre de tienda → día)
const RUTA_DARKIRIS = {
  '99 Valle Hermoso': 'lunes',
  '99 Brisas de Arraiján': 'lunes',
  'Machetazo Hato Montaña': 'lunes',
  'El Fuerte Burunga': 'martes',
  'El Fuerte Westland': 'martes',
  '99 Coronado': 'martes',
  'Machetazo Coronado': 'martes',
  '99 Penonomé': 'miercoles',
  'Machetazo Penonomé': 'miercoles',
  '99 Santiago': 'miercoles',
  'Machetazo Santiago': 'miercoles',
  '99 El Coco': 'jueves',
  '99 Town Center Arraiján': 'jueves',
  '99 Plaza Italia': 'jueves',
  '99 Chitré': 'viernes',
  'Machetazo Chitré': 'viernes',
}

// Extrae lat/lng de un link de Google Maps (varios formatos)
export function parseMapsLink(url) {
  if (!url) return null
  let m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  m = url.match(/(?:q|query|ll|destination)=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  m = url.match(/(-?\d{1,2}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  return null
}

export default function CatalogoAdmin() {
  const [tiendas, setTiendas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [filtroMerc, setFiltroMerc] = useState('Sin asignar')
  const [soloAprox, setSoloAprox] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [pickDia, setPickDia] = useState('lunes')
  const [pickSel, setPickSel] = useState(() => new Set())

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const snap = await getDocs(collection(db, 'supermarkets'))
    setTiendas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    setCargando(false)
  }

  async function cargarBaseCompleta() {
    if (!confirm('Se cargarán las ' + TIENDAS_PANAMA.length + ' tiendas (Super 99, El Machetazo y El Fuerte) a la base de datos. ¿Continuar?')) return
    setGuardando(true)
    // Firestore permite máx 500 ops por batch; aquí son ~75, un solo batch basta
    const batch = writeBatch(db)
    TIENDAS_PANAMA.forEach(t => {
      const ref = doc(collection(db, 'supermarkets'))
      batch.set(ref, {
        name: t.name, chain: t.chain, ciudad: t.ciudad, provincia: t.provincia,
        dia: '', mercaderista: 'Sin asignar',
        gps: { lat: t.lat, lng: t.lng }, gpsAprox: t.gpsAprox, mapsUrl: ''
      })
    })
    await batch.commit()
    setGuardando(false)
    cargar()
  }

  async function borrarTodo() {
    if (!confirm('⚠️ Esto BORRARÁ todas las tiendas de la base de datos. ¿Seguro?')) return
    setGuardando(true)
    const snap = await getDocs(collection(db, 'supermarkets'))
    const batch = writeBatch(db)
    snap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
    setGuardando(false)
    setTiendas([])
  }

  async function autoAsignarDarkiris() {
    const aAsignar = tiendas.filter(t => RUTA_DARKIRIS[t.name])
    if (aAsignar.length === 0) {
      alert('Primero carga la base de datos de tiendas.')
      return
    }
    if (!confirm(`Se asignarán ${aAsignar.length} tiendas a Darkiris con sus días (según el Excel). ¿Continuar?`)) return
    setGuardando(true)
    const batch = writeBatch(db)
    const actualizadas = tiendas.map(t => {
      const dia = RUTA_DARKIRIS[t.name]
      if (!dia) return t
      const nueva = { ...t, mercaderista: 'Darkiris', dia }
      const { id, ...data } = nueva
      batch.set(doc(db, 'supermarkets', id), data)
      return nueva
    })
    await batch.commit()
    setTiendas(actualizadas)
    setGuardando(false)
    setFiltroMerc('Darkiris')
  }

  function togglePick(id) {
    setPickSel(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  async function asignarSeleccionadas() {
    const ids = [...pickSel]
    if (ids.length === 0) { alert('Elige al menos una tienda.'); return }
    setGuardando(true)
    const batch = writeBatch(db)
    const actualizadas = tiendas.map(t => {
      if (!pickSel.has(t.id)) return t
      const nueva = { ...t, mercaderista: filtroMerc, dia: pickDia }
      const { id, ...data } = nueva
      batch.set(doc(db, 'supermarkets', id), data)
      return nueva
    })
    await batch.commit()
    setTiendas(actualizadas)
    setPickSel(new Set())
    setShowPicker(false)
    setGuardando(false)
  }

  async function desasignarMercaderista() {
    const suyas = tiendas.filter(t => (t.mercaderista || 'Sin asignar') === filtroMerc)
    if (suyas.length === 0) { alert(`${filtroMerc} no tiene tiendas asignadas.`); return }
    if (!confirm(`¿Liberar las ${suyas.length} tiendas de ${filtroMerc}? Volverán a "Sin asignar" (no se borra ninguna tienda).`)) return
    setGuardando(true)
    const batch = writeBatch(db)
    const actualizadas = tiendas.map(t => {
      if ((t.mercaderista || 'Sin asignar') !== filtroMerc) return t
      const nueva = { ...t, mercaderista: 'Sin asignar', dia: '' }
      const { id, ...data } = nueva
      batch.set(doc(db, 'supermarkets', id), data)
      return nueva
    })
    await batch.commit()
    setTiendas(actualizadas)
    setGuardando(false)
    setFiltroMerc('Sin asignar')
  }

  async function nuevaTienda() {
    const base = { name: 'Nueva tienda', chain: '', ciudad: '', provincia: '', dia: '',
      mercaderista: filtroMerc === 'Sin asignar' ? 'Sin asignar' : filtroMerc,
      gps: { lat: 0, lng: 0 }, gpsAprox: true, mapsUrl: '' }
    const ref = await addDoc(collection(db, 'supermarkets'), base)
    setTiendas(prev => [...prev, { id: ref.id, ...base }])
  }

  async function guardarTienda(t) {
    setGuardando(true)
    const { id, ...data } = t
    await setDoc(doc(db, 'supermarkets', id), data)
    setGuardando(false)
  }

  async function borrarTienda(id) {
    if (!confirm('¿Borrar esta tienda?')) return
    await deleteDoc(doc(db, 'supermarkets', id))
    setTiendas(prev => prev.filter(t => t.id !== id))
  }

  function actualizar(id, campo, valor) {
    setTiendas(prev => prev.map(t => t.id === id ? { ...t, [campo]: valor } : t))
  }

  function aplicarMapsLink(id, url) {
    const coords = parseMapsLink(url)
    setTiendas(prev => prev.map(t => {
      if (t.id !== id) return t
      if (coords) return { ...t, mapsUrl: url, gps: coords, gpsAprox: false }
      return { ...t, mapsUrl: url }
    }))
  }

  const visibles = tiendas.filter(t => (t.mercaderista || 'Sin asignar') === filtroMerc && (!soloAprox || t.gpsAprox))
  const conteo = m => tiendas.filter(t => (t.mercaderista || 'Sin asignar') === m).length

  // Agrupación: 'Sin asignar' → por provincia; mercaderista → por día
  let grupos
  if (filtroMerc === 'Sin asignar') {
    const ordenProv = ['Panamá', 'Panamá Oeste', 'Coclé', 'Veraguas', 'Herrera', 'Los Santos', 'Colón', 'Chiriquí', 'Bocas del Toro', 'Darién', '']
    const provincias = [...new Set(visibles.map(t => t.provincia || ''))]
      .sort((a, b) => {
        const ia = ordenProv.indexOf(a); const ib = ordenProv.indexOf(b)
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib)
      })
    grupos = provincias
      .map(p => ({ titulo: `📍 ${p || 'Sin provincia'}`, items: visibles.filter(t => (t.provincia || '') === p) }))
      .filter(g => g.items.length > 0)
  } else {
    const buckets = ['lunes','martes','miercoles','jueves','viernes','sabado','']
    grupos = buckets
      .map(d => ({ titulo: `📅 ${DIA_LABEL[d]}`, items: visibles.filter(t => (t.dia || '') === d) }))
      .filter(g => g.items.length > 0)
  }

  if (cargando) return <div className="spinner" />

  return (
    <div>
      <div className="seccion-titulo">🏪 Base de datos de tiendas</div>

      {/* Selector de mercaderista */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
        {MERCADERISTAS.map(m => (
          <button key={m} onClick={() => setFiltroMerc(m)}
            style={{
              flex: 1, padding: '10px 4px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
              border: filtroMerc === m ? '2px solid var(--azul)' : '1.5px solid #E0E0E0',
              background: filtroMerc === m ? 'var(--azul)' : 'white',
              color: filtroMerc === m ? 'white' : 'var(--gris)', fontWeight: 700
            }}>
            {m === 'Sin asignar' ? '📦' : '👤'} {m} ({conteo(m)})
          </button>
        ))}
      </div>

      {tiendas.length === 0 && (
        <div className="alerta alerta-info" style={{ marginBottom: '12px' }}>
          La base de datos está vacía. Carga todas las tiendas de Panamá con el botón verde.
        </div>
      )}

      {tiendas.length > 0 && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--gris)', marginBottom: '12px', cursor: 'pointer' }}>
          <input type="checkbox" checked={soloAprox} onChange={e => setSoloAprox(e.target.checked)} />
          Mostrar solo ubicación aproximada ⚠️ ({tiendas.filter(t => t.gpsAprox).length})
        </label>
      )}

      {/* Botones de acción */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {tiendas.length === 0 ? (
          <button className="btn btn-verde" style={{ flex: 1 }} disabled={guardando}
            onClick={cargarBaseCompleta}>
            {guardando ? 'Cargando…' : `📥 Cargar las ${TIENDAS_PANAMA.length} tiendas de Panamá`}
          </button>
        ) : (
          <>
            <button className="btn btn-verde" style={{ flex: '1 1 100%', marginBottom: '4px' }}
              disabled={guardando} onClick={autoAsignarDarkiris}>
              📋 Auto-asignar ruta de Darkiris (del Excel)
            </button>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={nuevaTienda}>
              ➕ Agregar tienda
            </button>
          </>
        )}
      </div>

      {filtroMerc === 'Sin asignar' && tiendas.length > 0 && (
        <div className="alerta alerta-info" style={{ marginBottom: '12px', fontSize: '12px' }}>
          💡 Estas son todas las tiendas. Para armar una ruta, pulsa el nombre de la mercaderista
          arriba y usa el botón <b>➕ Asignar tiendas</b>.
        </div>
      )}

      {/* ── Asignar tiendas desde el catálogo (solo en vista de mercaderista) ── */}
      {filtroMerc !== 'Sin asignar' && tiendas.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {!showPicker ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-verde" style={{ flex: 1 }} onClick={() => setShowPicker(true)}>
                ➕ Asignar tiendas a {filtroMerc}
              </button>
              <button className="btn btn-outline btn-sm" disabled={guardando}
                onClick={desasignarMercaderista}>
                🧹 {filtroMerc} renunció (liberar tiendas)
              </button>
            </div>
          ) : (
            <div className="card" style={{ background: '#F5F9FF' }}>
              <div style={{ fontWeight: 700, marginBottom: '10px' }}>
                ➕ Elige tiendas para {filtroMerc}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: 'var(--gris)' }}>Día de visita:</span>
                <select value={pickDia} onChange={e => setPickDia(e.target.value)}
                  style={{ padding: '8px', border: '1.5px solid #E0E0E0', borderRadius: '8px', fontSize: '14px' }}>
                  {DIAS.map(d => <option key={d} value={d}>{DIA_LABEL[d]}</option>)}
                </select>
              </div>
              <div style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid #E0E0E0', borderRadius: '8px', padding: '8px', marginBottom: '10px' }}>
                {tiendas.filter(t => (t.mercaderista || 'Sin asignar') === 'Sin asignar')
                  .sort((a, b) => (a.provincia + a.name).localeCompare(b.provincia + b.name))
                  .map(t => (
                    <label key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 4px', cursor: 'pointer', borderBottom: '1px solid #F0F0F0' }}>
                      <input type="checkbox" checked={pickSel.has(t.id)} onChange={() => togglePick(t.id)} />
                      <span style={{ flex: 1, fontSize: '14px' }}>
                        <b>{t.name}</b> <span style={{ color: 'var(--gris)', fontSize: '12px' }}>· {t.ciudad}, {t.provincia}</span>
                      </span>
                    </label>
                  ))}
                {tiendas.filter(t => (t.mercaderista || 'Sin asignar') === 'Sin asignar').length === 0 && (
                  <div style={{ color: 'var(--gris)', fontSize: '13px', padding: '8px' }}>
                    No quedan tiendas sin asignar.
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-verde" style={{ flex: 1 }} disabled={guardando}
                  onClick={asignarSeleccionadas}>
                  ✅ Asignar {pickSel.size > 0 ? `${pickSel.size} ` : ''}tienda(s) el {DIA_LABEL[pickDia]}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => { setShowPicker(false); setPickSel(new Set()) }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lista agrupada */}
      {grupos.map(g => (
        <div key={g.titulo} style={{ marginBottom: '18px' }}>
          <div style={{ fontWeight: 800, color: 'var(--azul)', marginBottom: '8px', fontSize: '15px' }}>
            {g.titulo} ({g.items.length})
          </div>
          {g.items.map(t => (
            <div key={t.id} className="card" style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '8px' }}>
                {t.chain && <span className="badge badge-azul" style={{ fontSize: '10px' }}>{t.chain}</span>}
                <input value={t.name} onChange={e => actualizar(t.id, 'name', e.target.value)}
                  placeholder="Nombre de la tienda"
                  style={{ flex: 1, padding: '8px', border: '1.5px solid #E0E0E0', borderRadius: '8px', fontSize: '15px', fontWeight: 700 }} />
              </div>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <input value={t.ciudad} onChange={e => actualizar(t.id, 'ciudad', e.target.value)}
                  placeholder="Ciudad"
                  style={{ flex: 1, minWidth: '90px', padding: '8px', border: '1.5px solid #E0E0E0', borderRadius: '8px', fontSize: '13px' }} />
                <select value={t.mercaderista || 'Sin asignar'} onChange={e => actualizar(t.id, 'mercaderista', e.target.value)}
                  style={{ padding: '8px', border: '1.5px solid #E0E0E0', borderRadius: '8px', fontSize: '13px' }}>
                  {MERCADERISTAS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={t.dia || ''} onChange={e => actualizar(t.id, 'dia', e.target.value)}
                  style={{ padding: '8px', border: '1.5px solid #E0E0E0', borderRadius: '8px', fontSize: '13px' }}>
                  <option value="">— sin día —</option>
                  {DIAS.map(d => <option key={d} value={d}>{DIA_LABEL[d]}</option>)}
                </select>
              </div>

              <div style={{ fontSize: '12px', marginBottom: '6px',
                color: t.gpsAprox ? 'var(--amarillo)' : 'var(--verde)' }}>
                📍 {t.gps?.lat?.toFixed(5)}, {t.gps?.lng?.toFixed(5)}
                {t.gpsAprox ? ' ⚠️ aproximada' : ' ✅ exacta'}
              </div>
              <input value={t.mapsUrl || ''} onChange={e => aplicarMapsLink(t.id, e.target.value)}
                placeholder="Pega el link de Google Maps para fijar el pin exacto"
                style={{ width: '100%', padding: '8px', border: '1.5px solid #E0E0E0', borderRadius: '8px', fontSize: '12px', marginBottom: '8px' }} />

              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-verde btn-sm" style={{ flex: 1 }} disabled={guardando}
                  onClick={() => guardarTienda(t)}>💾 Guardar</button>
                <button className="btn btn-outline btn-sm" onClick={() => borrarTienda(t.id)}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {tiendas.length > 0 && (
        <div className="alerta alerta-info" style={{ marginTop: '8px', fontSize: '12px' }}>
          💡 Las tiendas con ⚠️ tienen ubicación aproximada. Pega el link de Google Maps para fijar
          el pin exacto. El GPS real también se guarda solo en la primera visita de la mercaderista.
        </div>
      )}
    </div>
  )
}

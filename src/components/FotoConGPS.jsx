import { useState, useRef } from 'react'
import { subirImagen } from '../services/cloudinary'
import { getGPS } from '../services/gps'

// obligatoria=true → muestra botón Cámara (primario) + Galería (secundario)
// obligatoria=false → un solo botón (galería/cámara según el SO)
export default function FotoConGPS({ etiqueta, storageRuta, onFoto, obligatoria = false }) {
  const [estado, setEstado] = useState('idle')
  const [fotoData, setFotoData] = useState(null)
  const [preview, setPreview] = useState(null)
  const camaraRef = useRef()
  const galeriaRef = useRef()

  async function handleCambioFoto(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return

    setEstado('capturando')
    setPreview(URL.createObjectURL(archivo))

    try {
      const gps = await getGPS()
      setEstado('subiendo')
      const url = await subirImagen(archivo, storageRuta)
      const datos = { url, gps, timestamp: new Date().toISOString(), nombre: archivo.name }
      setFotoData(datos)
      setEstado('lista')
      onFoto(datos)
    } catch (err) {
      console.error(err)
      setEstado('error')
    }
  }

  function quitarFoto() {
    setFotoData(null)
    setPreview(null)
    setEstado('idle')
    onFoto(null)
    if (camaraRef.current) camaraRef.current.value = ''
    if (galeriaRef.current) galeriaRef.current.value = ''
  }

  return (
    <div>
      {/* Input cámara (capture=environment → abre cámara trasera en móvil) */}
      <input ref={camaraRef} type="file" accept="image/*" capture="environment"
        style={{ display: 'none' }} onChange={handleCambioFoto} />
      {/* Input galería (sin capture → abre el explorador de fotos) */}
      <input ref={galeriaRef} type="file" accept="image/*"
        style={{ display: 'none' }} onChange={handleCambioFoto} />

      {estado === 'idle' && (
        obligatoria ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-primario btn-sm" style={{ flex: 2 }}
              onClick={() => camaraRef.current?.click()}>
              📷 Cámara
            </button>
            <button type="button" className="btn btn-outline btn-sm" style={{ flex: 1, fontSize: 12 }}
              onClick={() => galeriaRef.current?.click()}>
              🖼️ Galería
            </button>
          </div>
        ) : (
          <button type="button" className="btn-camara"
            onClick={() => camaraRef.current?.click()}>
            📷 {etiqueta || 'Tomar foto'}
          </button>
        )
      )}

      {(estado === 'capturando' || estado === 'subiendo') && (
        <div style={{ textAlign: 'center', padding: '12px', color: 'var(--azul)' }}>
          {estado === 'capturando' ? '📍 Obteniendo GPS...' : '☁️ Subiendo foto...'}
        </div>
      )}

      {estado === 'error' && (
        <div>
          <div className="alerta alerta-error">⚠️ Error al subir la foto. Intenta de nuevo.</div>
          <button type="button" className="btn-camara"
            onClick={() => { setEstado('idle'); camaraRef.current?.click() }}>
            🔄 Reintentar
          </button>
        </div>
      )}

      {estado === 'lista' && preview && (
        <div>
          <img src={preview} alt="Foto tomada" className="foto-preview" />
          <div className="foto-badge-gps">
            ✅ GPS: {fotoData?.gps?.lat?.toFixed(5)}, {fotoData?.gps?.lng?.toFixed(5)}
          </div>
          <button type="button" onClick={quitarFoto}
            style={{ marginTop: '8px', fontSize: '13px', color: 'var(--rojo)',
              background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            🗑️ Quitar foto
          </button>
        </div>
      )}
    </div>
  )
}

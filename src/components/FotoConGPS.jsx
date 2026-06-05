import { useState, useRef } from 'react'
import { subirImagen } from '../services/cloudinary'
import { getGPS } from '../services/gps'

// Componente de captura de foto con GPS automático
export default function FotoConGPS({ etiqueta, storageRuta, onFoto }) {
  const [estado, setEstado] = useState('idle') // idle | capturando | subiendo | lista | error
  const [fotoData, setFotoData] = useState(null)
  const [preview, setPreview] = useState(null)
  const inputRef = useRef()

  async function handleCambioFoto(e) {
    const archivo = e.target.files?.[0]
    if (!archivo) return

    setEstado('capturando')
    setPreview(URL.createObjectURL(archivo))

    try {
      // Capturar GPS en el momento de la foto
      const gps = await getGPS()
      setEstado('subiendo')

      // Subir a Cloudinary
      const url = await subirImagen(archivo, storageRuta)

      const datos = {
        url,
        gps,
        timestamp: new Date().toISOString(),
        nombre: archivo.name
      }
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
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleCambioFoto}
      />

      {estado === 'idle' && (
        <button
          type="button"
          className="btn-camara"
          onClick={() => inputRef.current?.click()}
        >
          📷 {etiqueta || 'Tomar foto'}
        </button>
      )}

      {(estado === 'capturando' || estado === 'subiendo') && (
        <div style={{ textAlign: 'center', padding: '12px', color: 'var(--azul)' }}>
          {estado === 'capturando' ? '📍 Obteniendo GPS...' : '☁️ Subiendo foto...'}
        </div>
      )}

      {estado === 'error' && (
        <div>
          <div className="alerta alerta-error">⚠️ Error al subir la foto. Intenta de nuevo.</div>
          <button type="button" className="btn-camara" onClick={() => { setEstado('idle'); inputRef.current?.click() }}>
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
          <button
            type="button"
            onClick={quitarFoto}
            style={{ marginTop: '8px', fontSize: '13px', color: 'var(--rojo)',
              background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
          >
            🗑️ Quitar foto
          </button>
        </div>
      )}
    </div>
  )
}

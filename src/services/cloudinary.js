// ============================================================
// CONFIGURACIÓN CLOUDINARY (almacenamiento de fotos gratis)
// 1. Crea cuenta en https://cloudinary.com (gratis, sin tarjeta)
// 2. En el Dashboard copia tu "Cloud name"
// 3. Settings → Upload → Add upload preset → modo "Unsigned"
//    → copia el nombre del preset
// 4. Pega ambos valores abajo
// ============================================================

const CLOUD_NAME = "dybffw2rm"
const UPLOAD_PRESET = "mercaderistas"

// Sube una imagen (File o dataURL base64) a Cloudinary y devuelve la URL
export async function subirImagen(archivoOdataUrl, carpeta = 'mercaderistas') {
  const formData = new FormData()
  formData.append('file', archivoOdataUrl)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', carpeta)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: formData }
  )
  if (!res.ok) throw new Error('Error al subir imagen a Cloudinary')
  const data = await res.json()
  return data.secure_url
}

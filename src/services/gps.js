// Servicio de captura de ubicación GPS

export function getGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Tu dispositivo no tiene GPS'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: new Date().toISOString()
      }),
      (err) => reject(new Error('No se pudo obtener ubicación. Asegúrate de dar permiso de GPS.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    )
  })
}

// Calcula distancia en metros entre dos puntos GPS
export function distanciaMetros(gps1, gps2) {
  const R = 6371000
  const dLat = (gps2.lat - gps1.lat) * Math.PI / 180
  const dLng = (gps2.lng - gps1.lng) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 +
    Math.cos(gps1.lat * Math.PI/180) * Math.cos(gps2.lat * Math.PI/180) *
    Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

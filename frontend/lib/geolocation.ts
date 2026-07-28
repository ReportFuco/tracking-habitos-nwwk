export type UbicacionUsuario = {
  latitud: number
  longitud: number
  precision: number
}

const getGeolocationErrorMessage = (error: unknown) => {
  if (!(error instanceof GeolocationPositionError)) {
    return "Error desconocido al obtener geolocalizacion"
  }

  if (error.code === error.PERMISSION_DENIED) {
    return "Permiso de ubicacion denegado por el usuario"
  }

  if (error.code === error.POSITION_UNAVAILABLE) {
    return "La ubicacion no esta disponible"
  }

  if (error.code === error.TIMEOUT) {
    return "Tiempo de espera agotado al obtener ubicacion"
  }

  return error.message || "Error al obtener ubicacion"
}

export const obtenerUbicacion = (): Promise<UbicacionUsuario> => {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocalizacion no soportada por este navegador"))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
          precision: position.coords.accuracy,
        })
      },
      (error) => {
        reject(error)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  })
}

export const logUbicacionUsuario = async (evento: string) => {
  try {
    const ubicacion = await obtenerUbicacion()
    console.log(`[geo][${evento}]`, ubicacion)
  } catch (error) {
    console.warn(`[geo][${evento}] No fue posible obtener ubicacion: ${getGeolocationErrorMessage(error)}`)
  }
}

export type UbicacionUsuario = {
  latitud: number
  longitud: number
  precision: number
}

export const getGeolocationErrorMessage = (error: unknown) => {
  const geolocationError = error as { code?: number; message?: string }

  if (typeof geolocationError?.code !== "number") {
    if (error instanceof Error) {
      return error.message
    }
    return "Error desconocido al obtener geolocalizacion"
  }

  if (geolocationError.code === 1) {
    return "Permiso de ubicacion denegado por el usuario"
  }

  if (geolocationError.code === 2) {
    return "La ubicacion no esta disponible"
  }

  if (geolocationError.code === 3) {
    return "Tiempo de espera agotado al obtener ubicacion"
  }

  return geolocationError.message || "Error al obtener ubicacion"
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

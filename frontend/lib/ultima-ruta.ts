/**
 * Donde quedo el usuario, para retomarlo al volver a abrir la app.
 *
 * Se guarda la ultima pantalla visitada dentro de /app. Al abrir la app en su pantalla de
 * entrada (el start_url del manifest, o tras el login) se redirige ahi. Solo en la
 * entrada: si la app se abre directo en otra ruta (un aviso push, un enlace) esa manda.
 *
 * "Abrir la app" se distingue de "navegar al inicio" con sessionStorage, que nace vacio
 * en cada pestana o lanzamiento de la PWA y sobrevive a las navegaciones dentro de ella.
 *
 * Todo en try/catch: sin storage (navegacion privada, bloqueado) la app funciona igual,
 * solo que parte desde el inicio.
 */

const CLAVE_RUTA = "ritmo:ultima-ruta"
const CLAVE_ABIERTA = "ritmo:app-abierta"

/** Pasado este tiempo se parte desde el inicio: ya no es "donde quede". */
const VIGENCIA_MS = 12 * 60 * 60 * 1000

/** Pantallas de entrada: abrir la app en ellas no es elegir una pantalla. */
const RUTAS_ENTRADA = new Set(["/app", "/app/dashboard"])

type RutaGuardada = { ruta: string; usuario: number | string; at: number }

/**
 * El inicio tambien se guarda: si fue lo ultimo que se vio, volver ahi es lo correcto, y
 * `rutaParaRetomar` entonces no redirige.
 */
export const recordarRuta = (ruta: string, usuario: number | string) => {
  if (ruta !== "/app" && !ruta.startsWith("/app/")) {
    return
  }

  try {
    const valor: RutaGuardada = { ruta, usuario, at: Date.now() }
    localStorage.setItem(CLAVE_RUTA, JSON.stringify(valor))
  } catch {}
}

/**
 * La ruta a la que volver al abrir la app, o null. Sin efectos: se puede llamar al
 * renderizar. Deja de responder una vez que `marcarAppAbierta` marca el lanzamiento, asi
 * una visita posterior al inicio no vuelve a redirigir.
 */
export const rutaParaRetomar = (rutaInicial: string, usuario: number | string) => {
  try {
    if (sessionStorage.getItem(CLAVE_ABIERTA) || !RUTAS_ENTRADA.has(rutaInicial)) {
      return null
    }

    const crudo = localStorage.getItem(CLAVE_RUTA)
    if (!crudo) return null

    const guardada = JSON.parse(crudo) as Partial<RutaGuardada>
    const vigente = typeof guardada.at === "number" && Date.now() - guardada.at < VIGENCIA_MS

    if (
      !vigente ||
      guardada.usuario !== usuario ||
      typeof guardada.ruta !== "string" ||
      !guardada.ruta.startsWith("/app/") ||
      RUTAS_ENTRADA.has(guardada.ruta)
    ) {
      return null
    }

    return guardada.ruta
  } catch {
    return null
  }
}

/** El lanzamiento ya se resolvio: de aqui en adelante se navega normal. */
export const marcarAppAbierta = () => {
  try {
    sessionStorage.setItem(CLAVE_ABIERTA, "1")
  } catch {}
}

/** Al cerrar sesion: el siguiente usuario del dispositivo no hereda la pantalla. */
export const olvidarRuta = () => {
  try {
    localStorage.removeItem(CLAVE_RUTA)
    sessionStorage.removeItem(CLAVE_ABIERTA)
  } catch {}
}

// La version llega en la URL con la que se registra el SW (/sw.js?v=<build>): cambia en
// cada deploy, asi que los chunks de builds viejos se van limpiando en vez de acumularse.
const VERSION = new URL(self.location.href).searchParams.get("v") || "sin-version"
const SHELL_PREFIX = "tcl-shell-"
const SHELL_CACHE = `${SHELL_PREFIX}${VERSION}`
// Imagenes de ejercicios e iconos no dependen del build: sobreviven a los deploys para no
// volver a bajar lo que ya se miro.
const MEDIA_CACHE = "tcl-media-v1"
const OFFLINE_URL = "/offline"
const APP_ICON = "/icons/app-icon-192.png"
const SHELL_PRECACHE = [OFFLINE_URL, "/app/dashboard"]
// Con senal mala la red puede tardar decenas de segundos en fallar: pasado este tiempo se
// muestra la copia guardada y la respuesta de la red, si llega, queda para la proxima.
const NAVEGACION_TIMEOUT_MS = 3000

const isAppDocument = (pathname) =>
  pathname.startsWith("/app/") || pathname.startsWith("/administrador")

const isRscRequest = (request, url) =>
  request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")

const rscCacheKey = (url) =>
  `${url.origin}/__tcl_cache__/rsc${url.pathname}`

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_PRECACHE)),
      caches.open(MEDIA_CACHE).then((cache) => cache.add(APP_ICON)),
    ]).then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        // Se conserva el shell del build anterior: una pestana abierta antes del deploy
        // todavia puede pedir sus chunks, que en el servidor ya no existen. caches.keys()
        // devuelve los caches en orden de creacion, asi que el ultimo es el mas reciente.
        const anteriores = keys.filter(
          (key) => key.startsWith(SHELL_PREFIX) && key !== SHELL_CACHE,
        )
        const conservar = new Set([SHELL_CACHE, MEDIA_CACHE, anteriores.at(-1)])

        return Promise.all(
          keys.filter((key) => !conservar.has(key)).map((key) => caches.delete(key)),
        )
      })
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/")
  ) {
    return
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE)
        const red = fetch(request).then(async (response) => {
          if (response.ok && isAppDocument(url.pathname)) {
            await cache.put(request, response.clone()).catch(() => undefined)
          }
          return response
        })
        const guardado = await caches.match(request, { ignoreSearch: true })

        // Sin copia guardada no hay alternativa: se espera a la red lo que tarde.
        if (!guardado) {
          try {
            return await red
          } catch {
            return (await caches.match(OFFLINE_URL)) || Response.error()
          }
        }

        // La peticion sigue aunque gane la copia: asi actualiza el cache para la proxima.
        event.waitUntil(red.catch(() => undefined))
        const limite = new Promise((resolve) =>
          setTimeout(() => resolve(null), NAVEGACION_TIMEOUT_MS),
        )

        try {
          return (await Promise.race([red, limite])) || guardado
        } catch {
          return guardado
        }
      })(),
    )
    return
  }

  if (isAppDocument(url.pathname) && isRscRequest(request, url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE)
        const cacheKey = rscCacheKey(url)

        try {
          const response = await fetch(request)
          if (response.ok) {
            await cache.put(cacheKey, response.clone()).catch(() => undefined)
          }
          return response
        } catch {
          return (await cache.match(cacheKey)) || Response.error()
        }
      })(),
    )
    return
  }

  // Las imagenes del catalogo se guardan a medida que se ven, no en el install: son 43 MB
  // en total y precargarlas seria una descarga enorme por material que quiza no se
  // consulte. Asi, el ejercicio que ya se miro sigue disponible en el gimnasio sin senal.
  const destino = url.pathname.startsWith("/_next/static/")
    ? SHELL_CACHE
    : url.pathname.startsWith("/ejercicios/") || url.pathname.startsWith("/icons/")
      ? MEDIA_CACHE
      : null

  if (destino) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              void caches.open(destino).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
  }
})

self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data?.json() ?? {}
  } catch {
    payload = { notification: { body: event.data?.text() } }
  }

  const notification = payload.notification ?? payload
  const title = notification.title || "Ritmo"
  const navigate = notification.navigate || "/app/dashboard"

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: notification.body || "",
        lang: notification.lang || "es-CL",
        dir: notification.dir || "ltr",
        icon: APP_ICON,
        badge: APP_ICON,
        tag: notification.tag || "ritmo",
        renotify: true,
        data: { navigate },
      }),
      self.navigator.setAppBadge?.(1),
    ]),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = new URL(
    event.notification.data?.navigate || "/app/dashboard",
    self.location.origin,
  ).href

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        for (const client of clients) {
          if ("navigate" in client) {
            await client.navigate(target)
          }
          if ("focus" in client) {
            return client.focus()
          }
        }
        return self.clients.openWindow(target)
      }),
  )
})

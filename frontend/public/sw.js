const CACHE_VERSION = "tcl-shell-v4"
const OFFLINE_URL = "/offline"
const APP_ICON = "/icons/app-icon-192.png"
const PRECACHE_URLS = [OFFLINE_URL, "/app/dashboard", APP_ICON]

const isAppDocument = (pathname) =>
  pathname.startsWith("/app/") || pathname.startsWith("/administrador")

const isRscRequest = (request, url) =>
  request.headers.get("RSC") === "1" || url.searchParams.has("_rsc")

const rscCacheKey = (url) =>
  `${url.origin}/__tcl_cache__/rsc${url.pathname}`

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key)),
        ),
      )
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
        const cache = await caches.open(CACHE_VERSION)

        try {
          const response = await fetch(request)
          if (response.ok && isAppDocument(url.pathname)) {
            await cache.put(request, response.clone()).catch(() => undefined)
          }
          return response
        } catch {
          const cachedDocument = await cache.match(request, { ignoreSearch: true })
          return cachedDocument || (await cache.match(OFFLINE_URL)) || Response.error()
        }
      })(),
    )
    return
  }

  if (isAppDocument(url.pathname) && isRscRequest(request, url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_VERSION)
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
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/ejercicios/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              void caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
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
  const title = notification.title || "The Curated Life"
  const navigate = notification.navigate || "/app/entrenamientos/activo"

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, {
        body: notification.body || "Tienes un entrenamiento activo.",
        lang: notification.lang || "es-CL",
        dir: notification.dir || "ltr",
        icon: APP_ICON,
        badge: APP_ICON,
        tag: notification.tag || "training-reminder",
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
    event.notification.data?.navigate || "/app/entrenamientos/activo",
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

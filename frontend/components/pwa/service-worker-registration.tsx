"use client"

import { useEffect } from "react"

type NavigatorWithBadging = Navigator & {
  clearAppBadge?: () => Promise<void>
}

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        })
        await registration.update()
      } catch {
        // La app sigue funcionando online aunque el navegador rechace el SW.
      }
    }

    void register()

    const clearBadge = () => {
      if (document.visibilityState === "visible") {
        void (navigator as NavigatorWithBadging).clearAppBadge?.().catch(() => undefined)
      }
    }
    clearBadge()
    document.addEventListener("visibilitychange", clearBadge)
    return () => document.removeEventListener("visibilitychange", clearBadge)
  }, [])

  return null
}

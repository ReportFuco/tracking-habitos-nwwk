import { api } from "@/lib/api"

export interface PushConfig {
  configured: boolean
  vapid_public_key: string | null
  reminder_minutes: number[]
}

export interface PushStatus {
  configured: boolean
  training_reminders_enabled: boolean
  active_subscriptions: number
}

interface SerializedSubscription {
  endpoint: string
  keys: {
    p256dh: string
    auth: string
  }
}

export const NotificationsAPI = {
  getConfig: async () => {
    const response = await api.get<PushConfig>("/api/notifications/config")
    return response.data
  },

  getStatus: async () => {
    const response = await api.get<PushStatus>("/api/notifications/status")
    return response.data
  },

  subscribe: async (subscription: SerializedSubscription) => {
    const response = await api.post<PushStatus>(
      "/api/notifications/subscriptions",
      subscription,
    )
    return response.data
  },

  unsubscribe: async (endpoint: string) => {
    const response = await api.post<PushStatus>(
      "/api/notifications/subscriptions/unsubscribe",
      { endpoint },
    )
    return response.data
  },
}

const arrayBufferToBase64Url = (value: ArrayBuffer) => {
  const bytes = new Uint8Array(value)
  let binary = ""
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export const serializePushSubscription = (
  subscription: PushSubscription,
): SerializedSubscription => {
  const p256dh = subscription.getKey("p256dh")
  const auth = subscription.getKey("auth")
  if (!p256dh || !auth) {
    throw new Error("Safari no entrego las llaves de la suscripcion Push.")
  }
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64Url(p256dh),
      auth: arrayBufferToBase64Url(auth),
    },
  }
}

export const base64UrlToUint8Array = (value: string) => {
  const padding = "=".repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(base64)
  return Uint8Array.from(raw, (character) => character.charCodeAt(0))
}

export const disableCurrentDeviceNotifications = async () => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) {
      return
    }
    try {
      await NotificationsAPI.unsubscribe(subscription.endpoint)
    } finally {
      // Incluso offline se revoca la llave local: el servidor recibira 404/410 en el
      // siguiente intento y deshabilitara ese endpoint sin mostrar datos al equipo.
      await subscription.unsubscribe()
    }
  } catch {
    // El logout no debe quedar bloqueado si Safari o la red rechazan la limpieza.
  }
}

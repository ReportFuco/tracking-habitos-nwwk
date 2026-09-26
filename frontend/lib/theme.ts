export type ThemePreference = "system" | "light" | "dark"

export const THEME_STORAGE_KEY = "ritmo-theme"
export const THEME_COLORS = { light: "#f4f4f2", dark: "#0e0e0e" } as const

const THEME_EVENT = "ritmo-theme-change"

export function readThemePreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY)
    return value === "light" || value === "dark" ? value : "system"
  } catch {
    return "system"
  }
}

export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

/** Aplica la clase .dark y el color de la barra del sistema (PWA instalada). */
export function applyTheme(preference: ThemePreference) {
  const theme = resolveTheme(preference)
  const root = document.documentElement
  root.classList.toggle("dark", theme === "dark")
  root.style.colorScheme = theme
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", THEME_COLORS[theme]))
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Sin storage (modo privado) el tema igual cambia en esta pestaña.
  }
  applyTheme(preference)
  window.dispatchEvent(new Event(THEME_EVENT))
}

export function subscribeTheme(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)")
  const onSystemChange = () => {
    if (readThemePreference() === "system") applyTheme("system")
    callback()
  }
  media.addEventListener("change", onSystemChange)
  window.addEventListener(THEME_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    media.removeEventListener("change", onSystemChange)
    window.removeEventListener(THEME_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

/**
 * Script inline para <head>: aplica el tema antes del primer pintado y evita el destello
 * claro al abrir la app en modo oscuro. Debe ser autocontenido (no puede importar nada).
 */
export const themeInitScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;if(d)r.classList.add("dark");r.style.colorScheme=d?"dark":"light";}catch(e){}})();`

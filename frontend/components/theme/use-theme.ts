"use client"

import { useSyncExternalStore } from "react"
import {
  readThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from "@/lib/theme"

export function useThemePreference() {
  const preference = useSyncExternalStore<ThemePreference>(
    subscribeTheme,
    readThemePreference,
    () => "system",
  )
  return { preference, setPreference: setThemePreference }
}

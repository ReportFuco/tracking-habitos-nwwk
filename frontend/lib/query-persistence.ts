"use client"

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister"
import { clear, createStore, del, get, set, type UseStore } from "idb-keyval"

// Subir esta version descarta todo lo persistido. Hacerlo cuando cambie la forma de los
// datos que devuelve la API: si no, la app rehidrata objetos con el shape viejo y los
// componentes leen campos que ya no existen.
export const QUERY_CACHE_SCHEMA_VERSION = "2026-07-28.1"

const DB_NAME = "tcl-offline"
const STORE_NAME = "query-cache"
const CACHE_ENTRY_KEY = "react-query"

// Clave del persister anterior, basado en localStorage. Se limpia al cerrar sesion para
// no dejar datos del usuario en un storage que ya nadie lee.
const LEGACY_LOCALSTORAGE_KEY = "tcl-query-cache-v1"

// createStore abre la conexion a IndexedDB en el momento en que se llama, asi que se
// difiere hasta el primer acceso real: en SSR no existe indexedDB.
let store: UseStore | null = null

const getStore = () => {
  if (!store) {
    store = createStore(DB_NAME, STORE_NAME)
  }

  return store
}

export const createQueryPersister = () =>
  createAsyncStoragePersister({
    key: CACHE_ENTRY_KEY,
    throttleTime: 1000,
    storage: {
      getItem: (key) => get<string>(key, getStore()).then((value) => value ?? null),
      setItem: (key, value) => set(key, value, getStore()),
      removeItem: (key) => del(key, getStore()),
    },
  })

/**
 * Borra el cache persistido. La sesion la maneja otro modulo; esto solo se ocupa de que
 * los datos de un usuario no queden disponibles para el siguiente que entre en el mismo
 * dispositivo, por eso limpia tambien el storage legado.
 *
 * No lanza: el logout tiene que completarse aunque el storage falle. Si algo sale mal se
 * reporta por consola, porque un cache que no se limpia es una fuga de datos silenciosa.
 */
export const clearPersistedQueryCache = async () => {
  if (typeof window === "undefined") {
    return
  }

  try {
    await clear(getStore())
  } catch (error) {
    console.error("[query-persistence] no se pudo limpiar IndexedDB", error)
  }

  try {
    window.localStorage.removeItem(LEGACY_LOCALSTORAGE_KEY)
  } catch (error) {
    console.error("[query-persistence] no se pudo limpiar el storage legado", error)
  }
}

/**
 * Pide storage persistente para que el navegador no descarte el cache al necesitar
 * espacio. Safari lo concede en base a engagement y a si la PWA esta instalada, asi que
 * el resultado es informativo: si lo niega, la app sigue funcionando con storage best
 * effort.
 */
export const requestPersistentStorage = async () => {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false
  }

  try {
    if (await navigator.storage.persisted?.()) {
      return true
    }

    return await navigator.storage.persist()
  } catch {
    return false
  }
}

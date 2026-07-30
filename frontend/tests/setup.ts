// jsdom no implementa IndexedDB y el persister de queries se apoya en ella.
// fake-indexeddb/auto instala una implementacion en memoria sobre globalThis.
import "fake-indexeddb/auto"

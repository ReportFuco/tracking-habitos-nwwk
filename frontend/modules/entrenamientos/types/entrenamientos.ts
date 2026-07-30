export interface GimnasioCreate {
  nombre_gimnasio: string
  nombre_cadena: string | null
  direccion: string
  comuna: string | null
  latitud: number
  longitud: number
}

export interface GimnasioEdit {
  nombre_gimnasio?: string | null
  nombre_cadena?: string | null
  direccion?: string | null
  comuna?: string | null
  latitud?: number | null
  longitud?: number | null
}

export interface GimnasioResponse {
  id_gimnasio: number
  nombre_gimnasio: string
  nombre_cadena: string | null
  direccion: string
  comuna: string | null
  latitud: number
  longitud: number
  activo: boolean
  created_at: string
}

export interface EjercicioCreate {
  nombre: string
  id_subcategoria_musculo: number
  url_video?: string | null
}

export interface EjercicioEdit {
  nombre?: string | null
  id_subcategoria_musculo?: number | null
  url_video?: string | null
}

export interface EjercicioResponse {
  id_ejercicio: number
  nombre: string
  id_subcategoria_musculo: number | null
  url_video?: string | null
  id_musculo: number | null
  musculo_codigo: string | null
  musculo_nombre: string | null
  subcategoria_codigo: string | null
  subcategoria_nombre: string | null
  tipo?: string | null
  // Material del catalogo importado. Los ejercicios creados a mano lo traen en null, asi
  // que todo lo que lo consuma tiene que tolerar su ausencia.
  codigo_externo: string | null
  nombre_original: string | null
  equipamiento: string | null
  musculos_secundarios: string[] | null
  instrucciones: string[] | null
  url_imagen: string | null
  url_animacion: string | null
  atribucion: string | null
}

export interface SubcategoriaMusculo {
  id_subcategoria_musculo: number
  id_musculo: number
  codigo: string
  nombre: string
  activo: boolean
}

export interface Musculo {
  id_musculo: number
  codigo: string
  nombre: string
  activo: boolean
  subcategorias: SubcategoriaMusculo[]
}

export interface EjerciciosParams {
  q?: string
  id_musculo?: number
  id_subcategoria_musculo?: number
  equipamiento?: string
  tipo?: string
}

export interface EntrenoFuerzaCreate {
  observacion?: string | null
  id_gimnasio: number
}

export interface EntrenoFuerzaResponse {
  id_entrenamiento: number
  id_entrenamiento_fuerza: number
  estado: string
  inicio_at: string
  fin_at: string | null
  nombre_gimnasio?: string | null
  nombre_cadena?: string | null
  comuna?: string | null
  direccion?: string | null
  latitud?: number | null
  longitud?: number | null
}

export interface SerieFuerzaCreate {
  id_ejercicio: number
  es_calentamiento: boolean
  cantidad_peso: number
  repeticiones: number
}

export interface SerieFuerzaPatch {
  id_ejercicio?: number | null
  es_calentamiento?: boolean | null
  cantidad_peso?: number | null
  repeticiones?: number | null
}

export interface SerieFuerzaResponse {
  id_fuerza_detalle: number
  es_calentamiento: boolean
  cantidad_peso: number
  repeticiones: number
  id_ejercicio?: number | null
  nombre_ejercicio?: string | null
  tipo_ejercicio?: string | null
  subcategoria_ejercicio?: string | null
  url_video?: string | null
  // Miniatura y animacion del ejercicio. Opcionales porque una sesion cacheada de antes de
  // que el backend las expusiera se sigue leyendo, y ahi se cae al catalogo por nombre.
  url_imagen?: string | null
  url_animacion?: string | null
}

export interface EntrenoFuerzaSerieResponse {
  id_entrenamiento_fuerza: number
  estado: string
  inicio_at: string
  fin_at: string | null
  nombre_gimnasio?: string | null
  nombre_cadena?: string | null
  comuna?: string | null
  direccion?: string | null
  latitud?: number | null
  longitud?: number | null
  series?: SerieFuerzaResponse[]
}

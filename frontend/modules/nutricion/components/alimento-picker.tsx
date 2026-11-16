"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Plus, ScanBarcode, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChipSelect } from "@/components/forms/chip-select"
import { SearchableCombobox } from "@/components/forms/searchable-combobox"
import { getFriendlyErrorMessage } from "@/lib/error-messages"
import { queryKeys } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import { useProfile } from "@/modules/auth/hooks/useProfile"
import { NutricionAPI } from "@/modules/nutricion/api/nutricion.api"
import { EscanerCodigo } from "@/modules/nutricion/components/escaner-codigo"
import { useNutricion } from "@/modules/nutricion/hooks/useNutricion"
import { caloriasDeTabla, formatearKcal, normalizarUnidad } from "@/modules/nutricion/lib/calorias"
import { consumoItemSchema, UNIDADES_CONSUMO } from "@/modules/nutricion/schemas/nutricion.schema"
import type {
  CodigoBarraResponse,
  ConsumoItem,
  TablaNutricionalResponse,
} from "@/modules/nutricion/types/nutricion"

/** Lo que el picker entrega: la linea para el backend y lo que se muestra mientras tanto. */
export interface AlimentoElegido {
  item: ConsumoItem
  nombre: string
  /** Vista previa; null si el producto no tiene tabla o la unidad no calza con ella. */
  calorias: number | null
}

type Modo = "catalogo" | "libre"

/** Lo minimo para calcular: una tabla del catalogo o lo que devolvio el escaner. */
type TablaCalculo = Pick<
  TablaNutricionalResponse,
  | "porcion_cantidad"
  | "porcion_unidad"
  | "contenido_neto"
  | "unidad_contenido"
  | "calorias"
  | "proteinas"
  | "carbohidratos"
  | "grasas"
>

// ChipSelect capitaliza: "g" saldria "G" y "ml" "Ml".
const ETIQUETAS_UNIDAD: Record<string, string> = {
  porcion: "porción",
  g: "gramos",
  ml: "mililitros",
  kg: "kilos",
  l: "litros",
}

const inputClass =
  "h-12 rounded-lg border-0 bg-[color:var(--surface-variant)] px-4 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"

function numero(valor: string): number | null {
  const n = Number(valor.replace(",", "."))
  return valor.trim() === "" || Number.isNaN(n) ? null : n
}

/** La tabla mas reciente de cada producto (un producto puede tener varias versiones). */
function tablasVigentes(tablas: TablaNutricionalResponse[]) {
  const porProducto = new Map<number, TablaNutricionalResponse>()
  for (const tabla of tablas) {
    const actual = porProducto.get(tabla.id_producto)
    if (!actual || tabla.id_tabla > actual.id_tabla) porProducto.set(tabla.id_producto, tabla)
  }
  return Array.from(porProducto.values()).sort((a, b) =>
    (a.nombre_producto ?? "").localeCompare(b.nombre_producto ?? "", "es"),
  )
}

function describirPorcion(tabla: Pick<TablaCalculo, "calorias" | "porcion_cantidad" | "porcion_unidad">) {
  if (tabla.calorias === null) return "Sin calorias en la tabla"
  const porcion = tabla.porcion_cantidad ? `${tabla.porcion_cantidad} ${tabla.porcion_unidad ?? ""}`.trim() : "porcion"
  return `${formatearKcal(tabla.calorias)} kcal por ${porcion}`
}

/** Cantidad y unidad con que conviene partir: la unidad de la tabla, o el envase entero. */
function cantidadInicial(tabla: TablaCalculo | null): [string, string] {
  if (tabla?.contenido_neto && tabla.unidad_contenido && tabla.porcion_unidad !== "unidad") {
    return ["1", "unidad"]
  }
  if (tabla?.porcion_unidad && tabla.porcion_cantidad) {
    return [String(tabla.porcion_cantidad), normalizarUnidad(tabla.porcion_unidad)]
  }
  return ["1", "porcion"]
}

export function AlimentoPicker({
  onAgregar,
  disabled = false,
}: {
  onAgregar: (alimento: AlimentoElegido) => void | Promise<void>
  disabled?: boolean
}) {
  const { tablas } = useNutricion()
  const queryClient = useQueryClient()
  const { data: perfil } = useProfile()
  const esAdmin = Boolean(perfil?.is_superuser)
  const vigentes = useMemo(() => tablasVigentes(tablas), [tablas])
  const [modo, setModo] = useState<Modo>(vigentes.length > 0 ? "catalogo" : "libre")

  const [idProducto, setIdProducto] = useState("")
  const [escaneado, setEscaneado] = useState<CodigoBarraResponse | null>(null)
  const [escanerAbierto, setEscanerAbierto] = useState(false)
  const [buscandoCodigo, setBuscandoCodigo] = useState(false)
  const [nombre, setNombre] = useState("")
  const [cantidad, setCantidad] = useState("1")
  const [unidad, setUnidad] = useState("porcion")
  const [kcal, setKcal] = useState("")
  const [proteinas, setProteinas] = useState("")
  const [carbos, setCarbos] = useState("")
  const [grasas, setGrasas] = useState("")

  const tablaCatalogo = vigentes.find((t) => String(t.id_producto) === idProducto) ?? null
  // Lo escaneado manda sobre el selector mientras este a la vista.
  const tabla: TablaCalculo | null = escaneado ?? tablaCatalogo

  const unidades = useMemo(() => {
    const base: string[] = [...UNIDADES_CONSUMO]
    const propia = normalizarUnidad(tabla?.porcion_unidad)
    if (propia && !base.includes(propia)) base.splice(1, 0, propia)
    return base.map((u) => ({ value: u, label: ETIQUETAS_UNIDAD[u] ?? u }))
  }, [tabla])

  const cantidadNum = numero(cantidad)
  const previa = tabla && cantidadNum && tabla.calorias !== null ? caloriasDeTabla(cantidadNum, unidad, tabla) : null

  const aplicarCantidadInicial = (t: TablaCalculo | null) => {
    const [c, u] = cantidadInicial(t)
    setCantidad(c)
    setUnidad(u)
  }

  const elegirProducto = (valor: string) => {
    setEscaneado(null)
    setIdProducto(valor)
    aplicarCantidadInicial(vigentes.find((t) => String(t.id_producto) === valor) ?? null)
  }

  const buscarCodigo = async (codigo: string) => {
    setEscanerAbierto(false)
    setBuscandoCodigo(true)
    try {
      let resultado = await NutricionAPI.buscarCodigoBarra(codigo)
      if (esAdmin && resultado.id_producto !== null && resultado.fuente_nutricional === "openfoodfacts") {
        // El producto esta en el catalogo sin tabla: un admin la deja guardada para todos.
        try {
          resultado = await NutricionAPI.guardarTablaCodigoBarra(codigo)
          void queryClient.invalidateQueries({ queryKey: queryKeys.nutricion.tablas })
          toast.success("Tabla nutricional guardada", {
            description: `${resultado.nombre} ya tiene sus calorias en el catalogo.`,
          })
        } catch {
          // Se sigue con los datos de Open Food Facts solo para esta comida.
        }
      }
      const enLista = resultado.id_producto !== null && vigentes.some((t) => t.id_producto === resultado.id_producto)
      setModo("catalogo")
      if (enLista) {
        elegirProducto(String(resultado.id_producto))
      } else {
        setIdProducto("")
        setEscaneado(resultado)
        aplicarCantidadInicial(resultado)
      }
      if (resultado.calorias === null) {
        toast.info(`${resultado.nombre} no tiene tabla nutricional`, {
          description: "Se anota, pero no suma calorias.",
        })
      }
    } catch (error) {
      toast.error("No encontramos ese codigo", {
        description: getFriendlyErrorMessage(error),
      })
      setModo("libre")
    } finally {
      setBuscandoCodigo(false)
    }
  }

  const limpiar = () => {
    setIdProducto("")
    setEscaneado(null)
    setNombre("")
    setCantidad("1")
    setUnidad("porcion")
    setKcal("")
    setProteinas("")
    setCarbos("")
    setGrasas("")
  }

  const candidatoCatalogo = () => {
    const base = { cantidad_consumida: cantidadNum ?? 0, unidad_consumida: unidad }
    if (escaneado && escaneado.id_producto === null) {
      // De Open Food Facts: no esta en el catalogo, va como alimento libre con lo calculado.
      const nombreCompleto = escaneado.marca ? `${escaneado.nombre} (${escaneado.marca})` : escaneado.nombre
      return {
        ...base,
        id_producto: null,
        nombre_alimento: nombreCompleto.slice(0, 160),
        calorias: previa?.calorias ?? null,
        proteinas: previa?.proteinas ?? null,
        carbohidratos: previa?.carbohidratos ?? null,
        grasas: previa?.grasas ?? null,
      }
    }
    if (escaneado && escaneado.fuente_nutricional === "openfoodfacts") {
      // Producto del catalogo que aun no tiene tabla: se anota el producto con las calorias
      // de Open Food Facts explicitas (el backend no tiene con que calcularlas).
      return {
        ...base,
        id_producto: escaneado.id_producto,
        nombre_alimento: null,
        calorias: previa?.calorias ?? null,
        proteinas: previa?.proteinas ?? null,
        carbohidratos: previa?.carbohidratos ?? null,
        grasas: previa?.grasas ?? null,
      }
    }
    const id = escaneado?.id_producto ?? (idProducto ? Number(idProducto) : null)
    return { ...base, id_producto: id, nombre_alimento: null, calorias: null, proteinas: null, carbohidratos: null, grasas: null }
  }

  const agregar = async () => {
    let candidato
    if (modo === "catalogo") {
      candidato = candidatoCatalogo()
      if (candidato.id_producto === null && !candidato.nombre_alimento) {
        toast.error("Elige un producto o escanea su codigo")
        return
      }
      if (escaneado?.fuente_nutricional === "openfoodfacts" && candidato.calorias === null) {
        toast.error("Con esa unidad no se pueden calcular las calorias", {
          description: escaneado.contenido_neto
            ? "Anotalo en gramos, mililitros o unidades."
            : "Anotalo en gramos o mililitros: no sabemos cuanto trae el envase.",
        })
        return
      }
    } else {
      candidato = {
        id_producto: null,
        nombre_alimento: nombre.trim() || null,
        cantidad_consumida: cantidadNum ?? 0,
        unidad_consumida: unidad,
        calorias: numero(kcal),
        proteinas: numero(proteinas),
        carbohidratos: numero(carbos),
        grasas: numero(grasas),
      }
    }
    const parsed = consumoItemSchema.safeParse(candidato)
    if (!parsed.success) {
      toast.error("Revisa el alimento", { description: parsed.error.issues[0]?.message })
      return
    }
    const nombreMostrado =
      modo === "libre"
        ? (parsed.data.nombre_alimento ?? "Alimento")
        : (escaneado?.nombre ?? tablaCatalogo?.nombre_producto ?? "Producto")
    await onAgregar({
      item: parsed.data,
      nombre: nombreMostrado,
      calorias: modo === "catalogo" ? (previa?.calorias ?? null) : parsed.data.calorias,
    })
    limpiar()
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-[color:var(--surface-variant)]/40 p-3">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <div role="radiogroup" aria-label="Origen del alimento" className="grid grid-cols-2 gap-1 rounded-lg bg-[color:var(--surface-variant)] p-1">
          {(["catalogo", "libre"] as const).map((opcion) => (
            <button
              key={opcion}
              type="button"
              role="radio"
              aria-checked={modo === opcion}
              onClick={() => setModo(opcion)}
              className={cn(
                "rounded-md py-2 text-xs font-medium transition",
                modo === opcion ? "bg-[color:var(--surface-lowest)] text-foreground" : "text-muted-foreground",
              )}
            >
              {opcion === "catalogo" ? "Producto" : "Otro alimento"}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setEscanerAbierto(true)}
          disabled={buscandoCodigo}
          className="h-full rounded-lg px-3"
          aria-label="Escanear codigo de barras"
        >
          <ScanBarcode className="size-4" />
          <span className="text-xs">{buscandoCodigo ? "Buscando..." : "Escanear"}</span>
        </Button>
      </div>

      {modo === "catalogo" ? (
        escaneado ? (
          <div className="flex items-start justify-between gap-2 rounded-lg bg-[color:var(--surface-variant)] px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{escaneado.nombre}</p>
              <p className="text-xs text-muted-foreground">
                {[escaneado.marca, describirPorcion(escaneado)].filter(Boolean).join(" · ")}
              </p>
              {escaneado.fuente_nutricional === "openfoodfacts" ? (
                <p className="mt-0.5 text-[11px] text-muted-foreground">Calorias de Open Food Facts</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setEscaneado(null)}
              className="rounded-full p-1 text-muted-foreground hover:text-foreground"
              aria-label="Quitar producto escaneado"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <SearchableCombobox
            value={idProducto}
            onChange={elegirProducto}
            options={vigentes.map((t) => ({
              value: String(t.id_producto),
              label: t.nombre_producto ?? `Producto ${t.id_producto}`,
              description: describirPorcion(t),
            }))}
            placeholder="Busca un producto"
            title="Producto"
            searchPlaceholder="Buscar producto..."
            emptyMessage="Ningun producto con tabla nutricional coincide. Prueba escaneando su codigo."
          />
        )
      ) : (
        <Input
          placeholder="Ej: pastel de choclo"
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          className={inputClass}
          maxLength={160}
        />
      )}

      <div className="flex flex-col gap-2">
        <Input
          inputMode="decimal"
          aria-label="Cantidad"
          value={cantidad}
          onChange={(event) => setCantidad(event.target.value)}
          className={cn(inputClass, "w-28")}
        />
        {/* Sangra hasta el borde de este recuadro (p-3), no el de la pagina. */}
        <ChipSelect label="Unidad" options={unidades} value={unidad} onChange={setUnidad} className="-mx-3 px-3" />
      </div>

      {modo === "libre" ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Input inputMode="decimal" placeholder="kcal *" aria-label="Calorias" value={kcal} onChange={(e) => setKcal(e.target.value)} className={inputClass} />
          <Input inputMode="decimal" placeholder="Prot. g" aria-label="Proteinas" value={proteinas} onChange={(e) => setProteinas(e.target.value)} className={inputClass} />
          <Input inputMode="decimal" placeholder="Carbos g" aria-label="Carbohidratos" value={carbos} onChange={(e) => setCarbos(e.target.value)} className={inputClass} />
          <Input inputMode="decimal" placeholder="Grasas g" aria-label="Grasas" value={grasas} onChange={(e) => setGrasas(e.target.value)} className={inputClass} />
        </div>
      ) : tabla && tabla.calorias !== null ? (
        <p className="px-1 text-xs text-muted-foreground">
          {previa
            ? `≈ ${formatearKcal(previa.calorias)} kcal · ${Math.round(previa.proteinas)} g prot · ${Math.round(previa.carbohidratos)} g carbos · ${Math.round(previa.grasas)} g grasas`
            : `La tabla es por ${tabla.porcion_cantidad ?? ""} ${tabla.porcion_unidad ?? "porcion"}: con esta unidad no se pueden calcular las calorias.`}
        </p>
      ) : null}

      <Button type="button" variant="outline" onClick={agregar} disabled={disabled || buscandoCodigo} className="h-11 rounded-lg">
        <Plus className="size-4" />
        Agregar alimento
      </Button>

      <EscanerCodigo open={escanerAbierto} onOpenChange={setEscanerAbierto} onCodigo={buscarCodigo} />
    </div>
  )
}

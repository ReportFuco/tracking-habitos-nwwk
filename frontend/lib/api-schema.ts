import { z } from "zod"

/**
 * Convencion para adapters validados (ver docs/auditoria/PLAN_FRONTEND.md, FE-ZOD-001).
 *
 * El contrato con el backend puede cambiar o derivar sin que TypeScript se entere: los
 * tipos de `modules/<dominio>/types/*.ts` describen lo que Axios *dice* que devuelve, no
 * lo que devuelve de verdad. Sin validar, un shape roto llega al cache de React Query (y
 * de ahi se persiste hasta 7 dias) antes de que nada se de cuenta.
 *
 * Patron por dominio:
 * - `<recurso>ResponseSchema` / `<recurso>ListResponseSchema` en
 *   `modules/<dominio>/schemas/<dominio>.schema.ts`, con el tipo derivado via
 *   `z.infer<typeof schema>` (no una interface manual en paralelo).
 * - El adapter en `modules/<dominio>/api/<dominio>.api.ts` llama `parseApiResponse`
 *   sobre `response.data` antes de retornar. Nunca se valida el request: lo que el
 *   usuario tipeo ya paso por el schema de formulario antes de llegar al adapter.
 * - `types/<dominio>.ts` re-exporta los tipos inferidos en vez de declararlos de nuevo,
 *   para que un cambio de schema no pueda desalinearse del tipo que ve el resto del
 *   modulo.
 *
 * Cache/buster: si un cambio de schema vuelve incompatibles las respuestas ya
 * persistidas (un campo que pasa a requerido, un enum que cambia de valores), subir
 * `QUERY_CACHE_SCHEMA_VERSION` en `lib/query-persistence.ts` en el mismo cambio. Si solo
 * se agrega un campo opcional nuevo, no hace falta: el cache viejo sigue siendo valido.
 */
export class ApiSchemaError extends Error {
  readonly endpoint: string
  readonly issues: ReadonlyArray<{ path: string; message: string }>

  constructor(endpoint: string, issues: ReadonlyArray<{ path: string; message: string }>) {
    const detalle = issues
      .map((issue) => `${issue.path || "(raiz)"}: ${issue.message}`)
      .join("; ")
    super(`Respuesta invalida de ${endpoint} (${detalle})`)
    this.name = "ApiSchemaError"
    this.endpoint = endpoint
    this.issues = issues
  }
}

/**
 * Valida `data` contra `schema` antes de que entre al cache de React Query.
 *
 * Si no matchea, lanza `ApiSchemaError` con el endpoint y la lista de campos/mensajes
 * que fallaron -- nunca el payload completo, que puede traer datos personales del
 * usuario y terminaria en un log o en Sentry.
 */
export const parseApiResponse = <Schema extends z.ZodType>(
  schema: Schema,
  data: unknown,
  endpoint: string,
): z.infer<Schema> => {
  const result = schema.safeParse(data)

  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }))

    throw new ApiSchemaError(endpoint, issues)
  }

  return result.data
}

"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useFinanzas } from "@/modules/finanzas/hooks/useFinanzas"

export function HistoricoCards() {
  const { cuentas, movimientos } = useFinanzas()
  const sortedMovimientos = [...movimientos].sort((a, b) =>
    getMovimientoTimestamp(b.created_at) - getMovimientoTimestamp(a.created_at)
  )

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Cuentas</CardTitle>
          <CardDescription>Listado de cuentas activas del usuario.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 md:hidden">
            {cuentas.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay cuentas registradas aun.</p>
            )}
            {cuentas.map((cuenta) => (
              <div key={cuenta.id_cuenta} className="rounded-lg border p-3">
                <p className="font-medium">{cuenta.nombre_cuenta}</p>
                <p className="text-sm text-muted-foreground">{cuenta.nombre_producto ?? "-"}</p>
                <p className="text-sm text-muted-foreground">{cuenta.nombre_banco ?? "-"}</p>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cuenta</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead>Banco</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cuentas.map((cuenta) => (
                  <TableRow key={cuenta.id_cuenta}>
                    <TableCell>{cuenta.nombre_cuenta}</TableCell>
                    <TableCell>{cuenta.nombre_producto ?? "-"}</TableCell>
                    <TableCell>{cuenta.nombre_banco ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historico de Movimientos</CardTitle>
          <CardDescription>Todos los movimientos registrados del usuario.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1 md:hidden">
            {sortedMovimientos.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay movimientos registrados.</p>
            )}
            {sortedMovimientos.map((movimiento) => (
              <div key={movimiento.id_transaccion} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium capitalize">{movimiento.tipo_movimiento}</p>
                  <p className="text-sm font-semibold">${movimiento.monto}</p>
                </div>
                <p className="text-sm text-muted-foreground">{movimiento.categoria ?? "-"}</p>
                <p className="text-xs text-muted-foreground">{formatDateOnly(movimiento.created_at)}</p>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <div className="max-h-[420px] overflow-y-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Cuenta</TableHead>
                    <TableHead>Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedMovimientos.map((movimiento) => (
                    <TableRow key={movimiento.id_transaccion}>
                      <TableCell>{formatDateOnly(movimiento.created_at)}</TableCell>
                      <TableCell>{movimiento.tipo_movimiento}</TableCell>
                      <TableCell>{movimiento.categoria ?? "-"}</TableCell>
                      <TableCell>{movimiento.nombre_cuenta ?? "-"}</TableCell>
                      <TableCell>{movimiento.monto}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  )
}

function formatDateOnly(value: string) {
  const datePart = value.split("T")[0]

  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    const [year, month, day] = datePart.split("-")
    return `${day}-${month}-${year}`
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsedDate)
}

function getMovimientoTimestamp(value: string) {
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

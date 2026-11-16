"use client"

import { FormEvent, useEffect, useRef, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type EstadoCamara = "iniciando" | "escaneando" | "sin-camara"

/**
 * Lee un codigo de barras con la camara trasera. Safari en iPhone no trae BarcodeDetector,
 * asi que se decodifica con ZXing (JS puro, cargado solo al abrir). Si no hay camara o se
 * niega el permiso, queda el campo para escribir el numero a mano.
 */
export function EscanerCodigo({
  open,
  onOpenChange,
  onCodigo,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCodigo: (codigo: string) => void
}) {
  const [manual, setManual] = useState("")

  const enviarManual = (event: FormEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const codigo = manual.replace(/\D/g, "")
    if (codigo.length >= 8) {
      onCodigo(codigo)
      setManual("")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3 p-4 sm:p-5">
        <DialogTitle>Escanear codigo de barras</DialogTitle>
        <DialogDescription>Apunta la camara al codigo del envase.</DialogDescription>

        {/* El contenido del dialogo se desmonta al cerrar: la camara se apaga con el. */}
        <Camara onCodigo={onCodigo} />

        <form onSubmit={enviarManual} className="grid grid-cols-[1fr_auto] gap-2">
          <Input
            inputMode="numeric"
            placeholder="O escribe el numero"
            aria-label="Codigo de barras"
            value={manual}
            onChange={(event) => setManual(event.target.value)}
            className="h-11 rounded-lg border-0 bg-[color:var(--surface-variant)] px-4 shadow-none"
          />
          <Button type="submit" className="h-11 rounded-lg" disabled={manual.replace(/\D/g, "").length < 8}>
            Buscar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** La camara trasera decodificando hasta leer un codigo. Vive solo mientras esta montada. */
function Camara({ onCodigo }: { onCodigo: (codigo: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [estado, setEstado] = useState<EstadoCamara>("iniciando")
  // En una ref: si el padre pasa una funcion nueva en cada render, la camara no se reinicia.
  const onCodigoRef = useRef(onCodigo)
  useEffect(() => {
    onCodigoRef.current = onCodigo
  }, [onCodigo])

  useEffect(() => {
    let cancelado = false
    let detener: (() => void) | null = null

    const iniciar = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setEstado("sin-camara")
        return
      }
      try {
        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ])
        if (cancelado || !videoRef.current) return
        const hints = new Map()
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
        ])
        const lector = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 })
        const controles = await lector.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } }, audio: false },
          videoRef.current,
          (resultado) => {
            if (!resultado || cancelado) return
            cancelado = true
            controles.stop()
            navigator.vibrate?.(40)
            onCodigoRef.current(resultado.getText())
          },
        )
        detener = () => controles.stop()
        if (cancelado) detener()
        else setEstado("escaneando")
      } catch {
        if (!cancelado) setEstado("sin-camara")
      }
    }
    void iniciar()
    return () => {
      cancelado = true
      detener?.()
    }
  }, [])

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-[color:var(--surface-variant)]">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />
      {estado === "escaneando" ? (
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-[color:var(--module-nutricion-fill)]" />
      ) : (
        <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
          {estado === "iniciando"
            ? "Abriendo la camara..."
            : "No pudimos usar la camara. Revisa el permiso o escribe el numero."}
        </p>
      )}
    </div>
  )
}

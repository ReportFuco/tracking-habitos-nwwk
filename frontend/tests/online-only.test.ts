import { AxiosError } from "axios"
import { onlineManager } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OFFLINE_ACTION_MESSAGE, runOnlineOnlyAction } from "@/lib/online-only"

beforeEach(() => {
  onlineManager.setOnline(true)
})

afterEach(() => {
  onlineManager.setOnline(true)
})

describe("runOnlineOnlyAction", () => {
  it("alta de usuario offline: falla al instante sin llamar al backend ni guardar nada", async () => {
    const register = vi.fn().mockResolvedValue({ ok: true })
    onlineManager.setOnline(false)

    const result = await runOnlineOnlyAction(() => register({ email: "a@a.com", password: "x" }))

    expect(result).toEqual({ ok: false, message: OFFLINE_ACTION_MESSAGE })
    expect(register).not.toHaveBeenCalled()
  })

  it("mutacion CRUD representativa offline: falla al instante sin invocar la mutation", async () => {
    const crearCuenta = vi.fn().mockResolvedValue({ id_cuenta: 1 })
    onlineManager.setOnline(false)

    const result = await runOnlineOnlyAction(() => crearCuenta({ nombre_cuenta: "Ahorro" }))

    expect(result).toEqual({ ok: false, message: OFFLINE_ACTION_MESSAGE })
    expect(crearCuenta).not.toHaveBeenCalled()
  })

  it("navegador online pero backend inaccesible: no bloquea, deja que Axios falle rapido", async () => {
    const timeoutError = new AxiosError("timeout of 10000ms exceeded")
    timeoutError.code = "ETIMEDOUT"
    const action = vi.fn().mockRejectedValue(timeoutError)

    const result = await runOnlineOnlyAction(action)

    expect(action).toHaveBeenCalledTimes(1)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/tardando demasiado/i)
    }
  })

  it("online y exitosa: resuelve ok sin mensaje de error", async () => {
    const action = vi.fn().mockResolvedValue(undefined)

    const result = await runOnlineOnlyAction(action)

    expect(action).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ ok: true })
  })
})

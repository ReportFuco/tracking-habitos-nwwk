import { AxiosError } from "axios"

const BAD_CREDENTIALS_MESSAGES = new Set([
  "bad credentials",
  "invalid credentials",
  "incorrect username or password",
  "login bad credentials",
])

const getValidationMessage = (detail: unknown) => {
  if (!Array.isArray(detail) || detail.length === 0) {
    return null
  }

  const firstIssue = detail[0]

  if (typeof firstIssue === "string") {
    return firstIssue
  }

  if (typeof firstIssue !== "object" || firstIssue === null) {
    return null
  }

  const issueMessage =
    "msg" in firstIssue && typeof firstIssue.msg === "string" ? firstIssue.msg : null
  const issueField =
    "loc" in firstIssue && Array.isArray(firstIssue.loc)
      ? firstIssue.loc
          .filter((item: unknown): item is string => typeof item === "string")
          .filter((item: string) => item !== "body")
          .join(", ")
      : null

  if (issueMessage && issueField) {
    return `${issueField}: ${issueMessage}`
  }

  return issueMessage
}

export const getFriendlyErrorMessage = (error: unknown) => {
  if (error instanceof AxiosError) {
    const status = error.response?.status
    const detail = error.response?.data?.detail

    if (typeof detail === "string") {
      const normalized = detail.trim().toLowerCase()

      if (BAD_CREDENTIALS_MESSAGES.has(normalized)) {
        return "Usuario o contraseña equivocado"
      }

      if (normalized === "unauthorized") {
        return "Tu sesion no es valida. Vuelve a iniciar sesion."
      }

      if (normalized === "forbidden") {
        return "No tienes permisos para realizar esta accion."
      }

      return detail
    }

    const validationMessage = getValidationMessage(detail)

    if (validationMessage) {
      return validationMessage
    }

    if (status === 401) {
      return "Tu sesion no es valida. Vuelve a iniciar sesion."
    }

    if (status === 403) {
      return "No tienes permisos para realizar esta accion."
    }

    if (error.code === "ERR_NETWORK") {
      return "No fue posible conectar con el servidor."
    }

    return error.message || "Ocurrio un error inesperado."
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Ocurrio un error inesperado."
}

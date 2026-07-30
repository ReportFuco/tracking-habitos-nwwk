import { AxiosError } from "axios"

const GENERIC_MESSAGE = "Ocurrio un error inesperado."

// El backend responde con codigos de fastapi-users (LOGIN_BAD_CREDENTIALS) y con
// los detalles por defecto de Starlette en ingles (Not Found, Unauthorized).
// Se normaliza a MAYUSCULA_CON_GUION_BAJO para cubrir ambas formas con una sola tabla.
const DETAIL_MESSAGES: Record<string, string> = {
  BAD_CREDENTIALS: "Usuario o contraseña equivocado",
  INCORRECT_USERNAME_OR_PASSWORD: "Usuario o contraseña equivocado",
  INVALID_CREDENTIALS: "Usuario o contraseña equivocado",
  LOGIN_BAD_CREDENTIALS: "Usuario o contraseña equivocado",
  LOGIN_USER_NOT_VERIFIED: "Tu cuenta todavia no esta verificada.",
  REGISTER_INVALID_PASSWORD: "La clave no cumple los requisitos minimos.",
  REGISTER_USER_ALREADY_EXISTS: "El correo ya se encuentra registrado.",
  RESET_PASSWORD_BAD_TOKEN: "El enlace para recuperar la clave no es valido o ya expiro.",
  UPDATE_USER_EMAIL_ALREADY_EXISTS: "Ese correo ya esta en uso.",
  UPDATE_USER_INVALID_PASSWORD: "La clave no cumple los requisitos minimos.",
  VERIFY_USER_ALREADY_VERIFIED: "Tu cuenta ya estaba verificada.",
  VERIFY_USER_BAD_TOKEN: "El enlace de verificacion no es valido o ya expiro.",
  BAD_REQUEST: "La solicitud no es valida.",
  FORBIDDEN: "No tienes permisos para realizar esta accion.",
  INTERNAL_SERVER_ERROR: "El servidor tuvo un problema. Intenta de nuevo en unos minutos.",
  NOT_FOUND: "No se encontro lo que buscabas.",
  UNAUTHORIZED: "Tu sesion no es valida. Vuelve a iniciar sesion.",
}

const normalizeDetailCode = (detail: string) =>
  detail.trim().replace(/[\s-]+/g, "_").toUpperCase()

// Pydantic prefija los errores de model_validator con "Value error, ".
const cleanValidationMessage = (message: string) =>
  message.replace(/^value error,\s*/i, "").trim()

const getStatusMessage = (status: number | undefined) => {
  if (status === undefined) {
    return null
  }

  if (status === 401) {
    return DETAIL_MESSAGES.UNAUTHORIZED
  }

  if (status === 403) {
    return DETAIL_MESSAGES.FORBIDDEN
  }

  if (status === 404) {
    return DETAIL_MESSAGES.NOT_FOUND
  }

  if (status >= 500) {
    return DETAIL_MESSAGES.INTERNAL_SERVER_ERROR
  }

  return null
}

const getValidationMessage = (detail: unknown) => {
  if (!Array.isArray(detail) || detail.length === 0) {
    return null
  }

  const firstIssue = detail[0]

  if (typeof firstIssue === "string") {
    return cleanValidationMessage(firstIssue)
  }

  if (typeof firstIssue !== "object" || firstIssue === null) {
    return null
  }

  const issueMessage =
    "msg" in firstIssue && typeof firstIssue.msg === "string"
      ? cleanValidationMessage(firstIssue.msg)
      : null
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

// fastapi-users devuelve {"detail": {"code": "...", "reason": "..."}} en registro.
const getCodedDetailMessage = (detail: unknown) => {
  if (typeof detail !== "object" || detail === null || Array.isArray(detail)) {
    return null
  }

  const code =
    "code" in detail && typeof detail.code === "string" ? detail.code : null
  const reason =
    "reason" in detail && typeof detail.reason === "string" ? detail.reason : null

  if (code && DETAIL_MESSAGES[normalizeDetailCode(code)]) {
    return DETAIL_MESSAGES[normalizeDetailCode(code)]
  }

  return reason ?? null
}

export const getFriendlyErrorMessage = (error: unknown) => {
  if (error instanceof AxiosError) {
    if (!error.response) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
        return "El servidor esta tardando demasiado en responder. Intenta de nuevo."
      }

      return "No fue posible conectar con el servidor. Verifica que este disponible."
    }

    const status = error.response.status
    const detail = error.response.data?.detail

    if (typeof detail === "string" && detail.trim()) {
      return DETAIL_MESSAGES[normalizeDetailCode(detail)] ?? detail
    }

    const codedMessage = getCodedDetailMessage(detail)

    if (codedMessage) {
      return codedMessage
    }

    const validationMessage = getValidationMessage(detail)

    if (validationMessage) {
      return validationMessage
    }

    return getStatusMessage(status) ?? GENERIC_MESSAGE
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return GENERIC_MESSAGE
}

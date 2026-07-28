import { z } from "zod"

export const authLoginSchema = z.object({
  username: z.string().min(3, "Ingresa tu usuario o email"),
  password: z.string().min(6, "La clave debe tener al menos 6 caracteres"),
})

export const authRegisterSchema = z.object({
  email: z.string().email("Ingresa un correo valido"),
  password: z
    .string()
    .min(6, "La clave debe tener al menos 6 caracteres")
    .max(20, "La clave no debe superar 20 caracteres"),
  username: z.string().min(3).max(20),
  nombre: z.string().min(2).max(20),
  apellido: z.string().min(2).max(20),
  telefono: z.string().min(8).max(11),
})

export type AuthLoginForm = z.infer<typeof authLoginSchema>
export type AuthRegisterForm = z.infer<typeof authRegisterSchema>

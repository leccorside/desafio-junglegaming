import { z } from 'zod'

import { idSchema, isoDateTimeSchema } from './common'

/** Regras de senha de docs/BUSINESS_RULES.md. Reaproveitadas no cadastro e na troca de senha. */
export const passwordSchema = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
  .max(72, 'A senha pode ter no máximo 72 caracteres.')
  .regex(/[a-z]/, 'Inclua uma letra minúscula.')
  .regex(/[A-Z]/, 'Inclua uma letra maiúscula.')
  .regex(/\d/, 'Inclua um número.')
  .regex(/[^A-Za-z0-9]/, 'Inclua um símbolo.')

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Informe um e-mail válido.'))

/** Nome de usuário: letras, números, ponto, hífen e sublinhado. */
export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'Use pelo menos 3 caracteres.')
  .max(30, 'Use no máximo 30 caracteres.')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Use só letras, números, ponto, hífen e sublinhado.')

export const userSchema = z.object({
  id: idSchema,
  username: z.string(),
  displayName: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof userSchema>

/** Corpo do cadastro (tela "Criar conta": nome de usuário, e-mail, senha e confirmação). */
export const registerRequestSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
})
export type RegisterRequest = z.infer<typeof registerRequestSchema>

/** Formulário de cadastro: o corpo da requisição mais a confirmação de senha. */
export const registerFormSchema = registerRequestSchema
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  })
export type RegisterForm = z.infer<typeof registerFormSchema>

export const loginRequestSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha.'),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

export const sessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: isoDateTimeSchema,
  user: userSchema,
})
export type Session = z.infer<typeof sessionSchema>

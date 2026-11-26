import { z } from 'zod'

import { idSchema, isoDateTimeSchema } from './common'

/** "a, b e c", como se escreve em português. */
const listPt = (items: string[]) =>
  new Intl.ListFormat('pt-BR', { style: 'long', type: 'conjunction' }).format(items)

export const PASSWORD_MAX = 72

/** Regras de senha de docs/BUSINESS_RULES.md, na ordem em que aparecem na mensagem. */
const PASSWORD_RULES: readonly [string, (value: string) => boolean][] = [
  ['pelo menos 8 caracteres', (v) => v.length >= 8],
  ['uma letra minúscula', (v) => /[a-z]/.test(v)],
  ['uma letra maiúscula', (v) => /[A-Z]/.test(v)],
  ['um número', (v) => /\d/.test(v)],
  ['um símbolo', (v) => /[^A-Za-z0-9]/.test(v)],
]

/** Regras de senha que o valor ainda não cumpre. */
export function missingPasswordRules(value: string): string[] {
  return PASSWORD_RULES.filter(([, ok]) => !ok(value)).map(([rule]) => rule)
}

/**
 * Senha (cadastro e troca de senha). Uma mensagem só, com todas as regras que
 * faltam ("A senha precisa de: uma letra maiúscula, um número e um símbolo."),
 * em vez de uma regra por vez a cada tentativa.
 */
export const passwordSchema = z.string().superRefine((value, ctx) => {
  if (value.length > PASSWORD_MAX) {
    ctx.addIssue({
      code: 'custom',
      message: `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`,
    })
    return
  }
  const missing = missingPasswordRules(value)
  if (missing.length) {
    ctx.addIssue({ code: 'custom', message: `A senha precisa de: ${listPt(missing)}.` })
  }
})

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Informe um e-mail válido.'))

/**
 * O que está errado no nome de usuário, tudo de uma vez: tamanho (3 a 30) e
 * caracteres (letras, números, ponto, hífen e sublinhado), citando os que não
 * valem.
 */
export function usernameProblems(value: string): string[] {
  const problems: string[] = []
  if (value.length < 3) problems.push('pelo menos 3 caracteres')
  if (value.length > 30) problems.push('no máximo 30 caracteres')
  const invalid = [...new Set(value.replace(/[a-zA-Z0-9._-]/g, ''))]
  if (invalid.length) {
    const shown = invalid.map((c) => (c === ' ' ? 'espaço' : `"${c}"`))
    problems.push(
      `só letras, números, ponto, hífen e sublinhado (${listPt(shown)} não ${invalid.length === 1 ? 'vale' : 'valem'})`,
    )
  }
  return problems
}

/** Nome de usuário: letras, números, ponto, hífen e sublinhado; 3 a 30 caracteres. */
export const usernameSchema = z
  .string()
  .trim()
  .superRefine((value, ctx) => {
    const problems = usernameProblems(value)
    if (problems.length) ctx.addIssue({ code: 'custom', message: `Use ${listPt(problems)}.` })
  })

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

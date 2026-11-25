import { z } from 'zod'

import { passwordSchema, usernameSchema } from './auth'
import { idSchema, isoDateTimeSchema } from './common'
import { ensNameSchema } from './wallet'

/** Perfil do colecionador (tela "Perfil do colecionador"). */
export const profileSchema = z.object({
  id: idSchema,
  displayName: z.string(),
  username: z.string(),
  email: z.string(),
  ensName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  updatedAt: isoDateTimeSchema,
})
export type Profile = z.infer<typeof profileSchema>

/** PATCH /me/profile. O e-mail é só leitura na tela de perfil. */
export const updateProfileRequestSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Informe o nome de exibição.')
    .max(50, 'Use no máximo 50 caracteres.'),
  username: usernameSchema,
  ensName: ensNameSchema.nullable(),
})
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

/** Validação do arquivo de avatar antes do upload (`PUT /me/avatar`, multipart). */
export const avatarFileSchema = z
  .instanceof(File)
  .refine((file) => (AVATAR_MIME_TYPES as readonly string[]).includes(file.type), {
    message: 'Use uma imagem PNG, JPEG ou WebP.',
  })
  .refine((file) => file.size <= AVATAR_MAX_BYTES, { message: 'A imagem pode ter no máximo 2 MB.' })

export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual.'),
  newPassword: passwordSchema,
})
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>

/** Formulário de troca de senha: corpo da requisição mais a confirmação. */
export const changePasswordFormSchema = changePasswordRequestSchema
  .extend({ confirmPassword: z.string() })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não conferem.',
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ['newPassword'],
    message: 'A nova senha precisa ser diferente da atual.',
  })
export type ChangePasswordForm = z.infer<typeof changePasswordFormSchema>

import { z } from 'zod'

import {
  changePasswordFormSchema,
  ensNameSchema,
  updateProfileRequestSchema,
  type Profile,
  type UpdateProfileRequest,
} from '@/api/contracts'

/**
 * Formulário do perfil: dados (PATCH /me/profile) e, se algum campo de senha
 * for preenchido, a troca de senha (POST /me/password). As regras vêm dos
 * schemas do contrato, para cliente e API dizerem a mesma coisa.
 */
export interface ProfileFormValues {
  displayName: string
  username: string
  /** Sem o ".eth"; vazio = sem ENS. */
  ensName: string
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

const PASSWORD_FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const

export const wantsPasswordChange = (values: ProfileFormValues) =>
  PASSWORD_FIELDS.some((field) => values[field] !== '')

export const profileFormSchema = z
  .object({
    displayName: z.string(),
    username: z.string(),
    ensName: z.string(),
    currentPassword: z.string(),
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((values, ctx) => {
    const profile = updateProfileRequestSchema.safeParse(toProfileRequest(values))
    if (!profile.success) {
      for (const issue of profile.error.issues)
        ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message })
    }
    if (wantsPasswordChange(values)) {
      const password = changePasswordFormSchema.safeParse(values)
      if (!password.success) {
        for (const issue of password.error.issues)
          ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message })
      }
    }
  })

/** Corpo do PATCH: ENS vazio vira `null`; o resto passa pelos schemas do contrato. */
export function toProfileRequest(values: ProfileFormValues): UpdateProfileRequest {
  const ens = values.ensName.trim()
  const parsedEns = ens ? ensNameSchema.safeParse(ens) : null
  return {
    displayName: values.displayName.trim(),
    username: values.username.trim(),
    ensName: parsedEns ? (parsedEns.success ? parsedEns.data : ens) : null,
  }
}

export function profileDefaults(profile: Profile): ProfileFormValues {
  return {
    displayName: profile.displayName,
    username: profile.username,
    ensName: profile.ensName ?? '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  }
}

/** O que o PATCH mudaria em relação ao perfil salvo. */
export function profileChanged(profile: Profile, values: ProfileFormValues): boolean {
  const next = toProfileRequest(values)
  return (
    next.displayName !== profile.displayName ||
    next.username !== profile.username ||
    next.ensName !== profile.ensName
  )
}

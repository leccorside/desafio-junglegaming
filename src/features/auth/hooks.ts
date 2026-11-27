import { useMutation } from '@tanstack/react-query'

import type { LoginRequest, RegisterRequest } from '@/api/contracts'

import { authApi } from './api'
import { logout, startSession } from './session'

/**
 * `gcTime: 0` nas mutations que levam senha: a mutation (com as `variables`)
 * sai do cache do TanStack Query assim que o formulário desmonta, em vez de
 * ficar lá por 5 minutos. Enquanto o formulário está na tela, a senha fica na
 * memória dele, como no próprio campo.
 */
export const SENSITIVE_MUTATION = { gcTime: 0 } as const

export function useLoginMutation() {
  return useMutation({
    ...SENSITIVE_MUTATION,
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: (session) => startSession(session),
  })
}

export function useRegisterMutation() {
  return useMutation({
    ...SENSITIVE_MUTATION,
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: (session) => startSession(session),
  })
}

export function useLogoutMutation() {
  return useMutation({ mutationFn: logout })
}

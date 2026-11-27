import { useMutation } from '@tanstack/react-query'

import type { LoginRequest, RegisterRequest } from '@/api/contracts'
import { SENSITIVE_MUTATION } from '@/lib/sensitive-mutation'

import { authApi } from './api'
import { logout, startSession } from './session'

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

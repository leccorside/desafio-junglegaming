import { useMutation } from '@tanstack/react-query'

import type { LoginRequest, RegisterRequest } from '@/api/contracts'

import { authApi } from './api'
import { logout, startSession } from './session'

export function useLoginMutation() {
  return useMutation({
    mutationFn: (body: LoginRequest) => authApi.login(body),
    onSuccess: (session) => startSession(session),
  })
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: (body: RegisterRequest) => authApi.register(body),
    onSuccess: (session) => startSession(session),
  })
}

export function useLogoutMutation() {
  return useMutation({ mutationFn: logout })
}

import { z } from 'zod'

import { apiRequest } from '@/api/client'
import { sessionSchema, type LoginRequest, type RegisterRequest } from '@/api/contracts'

export const authApi = {
  login: (body: LoginRequest) =>
    apiRequest(sessionSchema, { method: 'POST', url: '/auth/login', data: body }),

  register: (body: RegisterRequest) =>
    apiRequest(sessionSchema, { method: 'POST', url: '/auth/register', data: body }),

  session: (signal?: AbortSignal) =>
    apiRequest(sessionSchema, { method: 'GET', url: '/auth/session', signal }),

  logout: () => apiRequest(z.null(), { method: 'POST', url: '/auth/logout' }),
}

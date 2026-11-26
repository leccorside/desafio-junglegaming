import { z } from 'zod'

import {
  profileSchema,
  walletSchema,
  walletsResponseSchema,
  type ChangePasswordRequest,
  type CreateWalletRequest,
  type UpdateProfileRequest,
  type UpdateWalletRequest,
} from '@/api/contracts'
import { apiRequest } from '@/api/client'

export const profileApi = {
  get: (signal?: AbortSignal) => apiRequest(profileSchema, { url: '/me/profile', signal }),
  update: (body: UpdateProfileRequest) =>
    apiRequest(profileSchema, { url: '/me/profile', method: 'PATCH', data: body }),
  /** `multipart/form-data` com o campo `avatar` (o navegador põe o boundary). */
  uploadAvatar: (file: File) => {
    const data = new FormData()
    data.append('avatar', file)
    return apiRequest(profileSchema, { url: '/me/avatar', method: 'PUT', data })
  },
  removeAvatar: () => apiRequest(profileSchema, { url: '/me/avatar', method: 'DELETE' }),
  changePassword: (body: ChangePasswordRequest) =>
    apiRequest(z.null(), { url: '/me/password', method: 'POST', data: body }),
}

export const walletsApi = {
  list: (signal?: AbortSignal) => apiRequest(walletsResponseSchema, { url: '/me/wallets', signal }),
  create: (body: CreateWalletRequest) =>
    apiRequest(walletSchema, { url: '/me/wallets', method: 'POST', data: body }),
  update: (id: string, body: UpdateWalletRequest) =>
    apiRequest(walletSchema, {
      url: `/me/wallets/${encodeURIComponent(id)}`,
      method: 'PATCH',
      data: body,
    }),
}

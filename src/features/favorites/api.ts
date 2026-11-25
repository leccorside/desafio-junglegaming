import { apiRequest } from '@/api/client'
import { favoriteMutationResponseSchema, favoritesResponseSchema } from '@/api/contracts'

const path = (nftId: string) => `/me/favorites/${encodeURIComponent(nftId)}`

export const favoritesApi = {
  list: (signal?: AbortSignal) =>
    apiRequest(favoritesResponseSchema, { url: '/me/favorites', signal }),

  add: (nftId: string) =>
    apiRequest(favoriteMutationResponseSchema, { url: path(nftId), method: 'PUT' }),

  remove: (nftId: string) =>
    apiRequest(favoriteMutationResponseSchema, { url: path(nftId), method: 'DELETE' }),
}

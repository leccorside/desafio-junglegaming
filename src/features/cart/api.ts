import { apiRequest } from '@/api/client'
import { cartSchema, type AddCartItemRequest } from '@/api/contracts'

export const cartApi = {
  get: (signal?: AbortSignal) => apiRequest(cartSchema, { url: '/cart', signal }),

  addItem: (body: AddCartItemRequest) =>
    apiRequest(cartSchema, { url: '/cart/items', method: 'POST', data: body }),
}

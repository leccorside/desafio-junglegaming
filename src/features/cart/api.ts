import { apiRequest } from '@/api/client'
import {
  cartSchema,
  mergeCartResponseSchema,
  quoteSchema,
  type AddCartItemRequest,
  type Network,
} from '@/api/contracts'

const item = (itemId: string) => `/cart/items/${encodeURIComponent(itemId)}`

export const cartApi = {
  get: (signal?: AbortSignal) => apiRequest(cartSchema, { url: '/cart', signal }),

  addItem: (body: AddCartItemRequest) =>
    apiRequest(cartSchema, { url: '/cart/items', method: 'POST', data: body }),

  updateItem: (itemId: string, quantity: number) =>
    apiRequest(cartSchema, { url: item(itemId), method: 'PATCH', data: { quantity } }),

  removeItem: (itemId: string) => apiRequest(cartSchema, { url: item(itemId), method: 'DELETE' }),

  applyCoupon: (code: string) =>
    apiRequest(cartSchema, { url: '/cart/coupon', method: 'PUT', data: { code } }),

  removeCoupon: () => apiRequest(cartSchema, { url: '/cart/coupon', method: 'DELETE' }),

  merge: (guestCartId: string) =>
    apiRequest(mergeCartResponseSchema, {
      url: '/cart/merge',
      method: 'POST',
      data: { guestCartId },
    }),

  quote: (network: Network, signal?: AbortSignal) =>
    apiRequest(quoteSchema, { url: '/quotes', method: 'POST', data: { network }, signal }),
}

import {
  HEADERS,
  orderSchema,
  ordersResponseSchema,
  walletConnectionSchema,
  type CreateOrderRequest,
  type OrderStatus,
} from '@/api/contracts'
import { apiRequest } from '@/api/client'

export const ordersApi = {
  /** A mesma chave com o mesmo corpo devolve o mesmo pedido (idempotência). */
  create: (body: CreateOrderRequest, idempotencyKey: string) =>
    apiRequest(orderSchema, {
      url: '/orders',
      method: 'POST',
      data: body,
      headers: { [HEADERS.idempotencyKey]: idempotencyKey },
    }),
  get: (id: string, signal?: AbortSignal) =>
    apiRequest(orderSchema, { url: `/orders/${encodeURIComponent(id)}`, signal }),
  list: (status: OrderStatus | undefined, signal?: AbortSignal) =>
    apiRequest(ordersResponseSchema, { url: '/orders', params: status ? { status } : {}, signal }),
}

export const walletConnectApi = {
  /** Conexão simulada da carteira (pode ser recusada: `WALLET_REJECTED`). */
  connect: (walletId: string) =>
    apiRequest(walletConnectionSchema, {
      url: `/me/wallets/${encodeURIComponent(walletId)}/connect`,
      method: 'POST',
    }),
}

/** Chaves com o ID do usuário (STATE_MANAGEMENT.md). */
export const orderKeys = {
  all: ['orders'] as const,
  user: (userId: string) => ['orders', userId] as const,
  detail: (userId: string, id: string) => ['orders', userId, id] as const,
  list: (userId: string, status: OrderStatus | 'all') =>
    ['orders', userId, 'list', status] as const,
}

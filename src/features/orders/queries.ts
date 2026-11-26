import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { isTerminalOrderStatus, type Order, type OrderUpdatedEvent } from '@/api/contracts'
import { useSession } from '@/features/auth/session-store'
import { cartKeys, quoteKeys } from '@/features/cart/cart-cache'
import { orderKeys, ordersApi } from '@/features/checkout/api'

/** Polling de reserva enquanto o pedido está pendente (o principal é o `order.updated`). */
export const PENDING_POLL_MS = 5000

/**
 * O pedido nunca volta de um estado terminal: uma resposta REST atrasada com
 * `pending` não desfaz um `confirmed` que já chegou pelo evento.
 */
export function keepTerminal(cached: Order | undefined, fresh: Order): Order {
  if (cached && isTerminalOrderStatus(cached.status) && !isTerminalOrderStatus(fresh.status)) {
    return cached
  }
  if (cached && cached.version > fresh.version) return cached
  return fresh
}

export function useOrder(orderId: string) {
  const queryClient = useQueryClient()
  const userId = useSession()?.user.id ?? 'anonymous'
  const key = orderKeys.detail(userId, orderId)
  return useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const cached = queryClient.getQueryData<Order>(key)
      const order = keepTerminal(cached, await ordersApi.get(orderId, signal))
      // Decidido pela consulta (o evento se perdeu numa queda, por exemplo): o
      // carrinho muda como no order.updated e precisa ser buscado de novo.
      if (cached && !isTerminalOrderStatus(cached.status) && isTerminalOrderStatus(order.status)) {
        refreshAfterSettle(queryClient, userId)
      }
      return order
    },
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? PENDING_POLL_MS : false),
    retry: (failureCount, error) =>
      failureCount < 2 &&
      !(error as { code?: string }).code?.match(/FORBIDDEN|NOT_FOUND|SESSION_EXPIRED/),
  })
}

export function usePendingOrders(enabled = true) {
  const userId = useSession()?.user.id ?? 'anonymous'
  return useQuery({
    queryKey: orderKeys.list(userId, 'pending'),
    queryFn: ({ signal }) => ordersApi.list('pending', signal),
    staleTime: 0,
    enabled,
  })
}

/**
 * Aplica um `order.updated` no cache do pedido (só versão mais nova e nunca
 * saindo de um estado terminal). Num estado terminal, o carrinho é buscado de
 * novo: confirmado tira os itens comprados; recusado devolve o estoque.
 * Devolve se o evento mudou o estado conhecido.
 */
export function applyOrderEvent(
  queryClient: QueryClient,
  userId: string,
  event: OrderUpdatedEvent,
): boolean {
  const key = orderKeys.detail(userId, event.data.orderId)
  const cached = queryClient.getQueryData<Order>(key)
  let changed = false
  if (cached) {
    if (cached.version < event.version && !isTerminalOrderStatus(cached.status)) {
      queryClient.setQueryData<Order>(key, {
        ...cached,
        status: event.data.status,
        rejectionReason: event.data.rejectionReason,
        transaction: event.data.transaction,
        version: event.version,
        updatedAt: event.occurredAt,
      })
      changed = true
    }
  } else {
    changed = true
  }
  if (isTerminalOrderStatus(event.data.status)) refreshAfterSettle(queryClient, userId)
  return changed
}

/**
 * Pedido decidido (pelo evento ou pela consulta): carrinho, cotação e listas
 * de pedidos são buscados de novo. Confirmado tira os itens comprados do
 * carrinho; recusado devolve o estoque reservado.
 */
export function refreshAfterSettle(queryClient: QueryClient, userId: string) {
  void queryClient.invalidateQueries({ queryKey: cartKeys.all })
  void queryClient.invalidateQueries({ queryKey: quoteKeys.all })
  void queryClient.invalidateQueries({
    queryKey: orderKeys.user(userId),
    predicate: (query) => query.queryKey[2] === 'list',
  })
}

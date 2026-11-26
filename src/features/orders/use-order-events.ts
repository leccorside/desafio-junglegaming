import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { useSession } from '@/features/auth/session-store'
import { onOrderUpdated } from '@/features/realtime/socket'

import { applyOrderEvent } from './queries'

/**
 * Ouve o `order.updated` em qualquer tela (no `RootLayout`): atualiza o
 * pedido no cache e, fora da tela do próprio pedido, avisa o resultado com
 * atalho para ele.
 */
export function useOrderEvents() {
  const queryClient = useQueryClient()
  const userId = useSession()?.user.id ?? null
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const pathRef = useRef(pathname)
  useEffect(() => {
    pathRef.current = pathname
  }, [pathname])

  useEffect(() => {
    if (!userId) return
    return onOrderUpdated((event) => {
      if (event.userId !== userId) return
      const changed = applyOrderEvent(queryClient, userId, event)
      const orderId = event.data.orderId
      if (!changed || event.data.status === 'pending') return
      if (pathRef.current === `/orders/${orderId}`) return
      const message =
        event.data.status === 'confirmed'
          ? `Pagamento do pedido ${orderId} confirmado.`
          : `Pagamento do pedido ${orderId} recusado. Seu carrinho continua com os itens.`
      const show = event.data.status === 'confirmed' ? toast.success : toast.error
      show(message, {
        id: `order-${orderId}-${event.data.status}`,
        action: {
          label: 'Ver pedido',
          onClick: () => void navigate({ to: '/orders/$orderId', params: { orderId } }),
        },
      })
    })
  }, [queryClient, userId, navigate])
}

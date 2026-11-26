import { createFileRoute } from '@tanstack/react-router'

import { OrderPage } from '@/features/orders/order-page'

// Situação do pedido (pendente, confirmado, recusado). O recibo no layout do Figma: Passo 11.
export const Route = createFileRoute('/_authenticated/orders/$orderId')({
  component: function OrderRoute() {
    const { orderId } = Route.useParams()
    return <OrderPage key={orderId} orderId={orderId} />
  },
})

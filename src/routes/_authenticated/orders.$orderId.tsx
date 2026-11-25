import { createFileRoute } from '@tanstack/react-router'

import { PagePlaceholder } from '@/components/feedback/page-placeholder'

// Confirmação e recibo do pedido (rota privada): Passo 11.
export const Route = createFileRoute('/_authenticated/orders/$orderId')({
  component: function OrderPage() {
    return <PagePlaceholder title="Confirmação de pedido" />
  },
})

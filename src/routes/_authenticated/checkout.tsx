import { createFileRoute } from '@tanstack/react-router'

import { PagePlaceholder } from '@/components/feedback/page-placeholder'

// Rota privada: Passo 10.
export const Route = createFileRoute('/_authenticated/checkout')({
  component: function CheckoutPage() {
    return <PagePlaceholder title="Pagamento" />
  },
})

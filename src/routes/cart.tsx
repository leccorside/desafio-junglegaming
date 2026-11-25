import { createFileRoute } from '@tanstack/react-router'

import { PagePlaceholder } from '@/components/feedback/page-placeholder'

// Carrinho (público, aceita visitante): Passo 7.
export const Route = createFileRoute('/cart')({
  component: function CartPage() {
    return <PagePlaceholder title="Carrinho de NFTs" />
  },
})

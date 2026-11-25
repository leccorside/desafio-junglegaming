import { createFileRoute } from '@tanstack/react-router'

import { CartPage } from '@/features/cart/cart-page'

// Carrinho: público, aceita visitante (X-Cart-Id) e conta.
export const Route = createFileRoute('/cart')({
  component: CartPage,
})

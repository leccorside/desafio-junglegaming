import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { AddCartItemRequest } from '@/api/contracts'
import { useSession } from '@/features/auth/session-store'

import { cartApi } from './api'
import { getGuestCartId } from './guest-cart-id'

/**
 * Chave do carrinho: o dono é o usuário logado ou o carrinho do visitante,
 * para os dois nunca dividirem cache. A tela do carrinho e o contador do
 * header entram no Passo 7.
 */
export const cartKeys = {
  all: ['cart'] as const,
  current: (owner: string) => ['cart', owner] as const,
}

export function useCartOwner(): string {
  const session = useSession()
  return session ? `user:${session.user.id}` : `guest:${getGuestCartId()}`
}

/** Adiciona um item. A resposta é o carrinho inteiro, que vai direto ao cache. */
export function useAddToCart() {
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationFn: (item: AddCartItemRequest) => cartApi.addItem(item),
    onSuccess: (cart) => {
      queryClient.setQueryData(cartKeys.current(owner), cart)
      // A cotação depende do carrinho (Passo 7).
      void queryClient.invalidateQueries({ queryKey: ['quote'] })
    },
  })
}

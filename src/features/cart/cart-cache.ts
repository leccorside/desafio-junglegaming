import type { QueryClient } from '@tanstack/react-query'

import type { Cart } from '@/api/contracts'

export const cartKeys = {
  all: ['cart'] as const,
  current: (owner: string) => ['cart', owner] as const,
  /** Chave de todas as mutations do carrinho (para saber se há alguma pendente). */
  mutation: ['cart', 'mutation'] as const,
}

export const quoteKeys = {
  all: ['quote'] as const,
  current: (owner: string, network: string, cartVersion: number) =>
    ['quote', owner, network, cartVersion] as const,
}

/**
 * Grava no cache o carrinho devolvido por uma mutation, só se ele for igual
 * ou mais novo que o que já está lá (`version`). Duas mudanças em paralelo
 * (aumentar um item, remover outro) podem responder fora de ordem: a resposta
 * mais antiga não pode desfazer a mais nova. Nesse caso o cache fica como
 * está e o carrinho é conferido de novo na API.
 *
 * As cotações antigas só são marcadas como velhas, sem buscar de novo: a
 * versão nova do carrinho já está na chave da cotação, e a tela busca a
 * cotação certa sozinha (antes, a antiga também era pedida de novo).
 */
export function writeCart(queryClient: QueryClient, owner: string, cart: Cart): boolean {
  const key = cartKeys.current(owner)
  const current = queryClient.getQueryData<Cart>(key)
  if (current && cart.id === current.id && cart.version < current.version) {
    void queryClient.invalidateQueries({ queryKey: key })
    return false
  }
  queryClient.setQueryData(key, cart)
  void queryClient.invalidateQueries({ queryKey: quoteKeys.all, refetchType: 'none' })
  return true
}

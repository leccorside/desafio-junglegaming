import {
  keepPreviousData,
  queryOptions,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import type { AddCartItemRequest, Cart, Network } from '@/api/contracts'
import { useSession } from '@/features/auth/session-store'

import { cartApi } from './api'
import { cartKeys, quoteKeys, writeCart } from './cart-cache'
import { getGuestCartId } from './guest-cart-id'

/**
 * Chaves do carrinho e da cotação (em `cart-cache.ts`): o dono é o usuário
 * logado (`user:<id>`) ou o carrinho do visitante (`guest:<X-Cart-Id>`), para
 * os dois nunca dividirem cache. A cotação inclui a versão do carrinho:
 * qualquer mudança (quantidade, item, cupom) gera outra chave e uma cotação
 * nova da API.
 */
export { cartKeys, quoteKeys }

/**
 * O carrinho não escolhe rede: a rede é do pagamento. O resumo usa a taxa
 * estimada da Ethereum, como o Figma ("0.016 ETH", "Taxa estimada").
 */
export const CART_QUOTE_NETWORK: Network = 'ethereum'

export function useCartOwner(): string {
  const session = useSession()
  return session ? `user:${session.user.id}` : `guest:${getGuestCartId()}`
}

export const cartQuery = (owner: string) =>
  queryOptions({
    queryKey: cartKeys.current(owner),
    queryFn: ({ signal }) => cartApi.get(signal),
    // Sempre confere ao abrir: estoque e preço mudam fora da tela.
    staleTime: 0,
  })

export function useCart() {
  return useQuery(cartQuery(useCartOwner()))
}

/** Total de unidades no carrinho (contador do header e da barra inferior). */
export function useCartCount(): number {
  const cart = useQuery({ ...cartQuery(useCartOwner()), staleTime: 30_000 })
  return cart.data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0
}

export function useQuote(cart: Cart | undefined) {
  const owner = useCartOwner()
  return useQuery({
    queryKey: quoteKeys.current(owner, CART_QUOTE_NETWORK, cart?.version ?? -1),
    queryFn: ({ signal }) => cartApi.quote(CART_QUOTE_NETWORK, signal),
    enabled: Boolean(cart?.items.length),
    staleTime: 0,
    // Durante a troca (quantidade, cupom) o resumo anterior fica, com indicador.
    placeholderData: keepPreviousData,
  })
}

/**
 * Toda mutation do carrinho devolve o carrinho inteiro: vai ao cache por
 * `writeCart`, que recusa uma resposta mais antiga que a já gravada.
 */
function useCartMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<Cart>) {
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationKey: cartKeys.mutation,
    mutationFn,
    onSuccess: (cart) => {
      writeCart(queryClient, owner, cart)
    },
  })
}

/** Alguma mudança do carrinho ainda esperando a API? (bloqueia "Conectar e finalizar") */
export function useCartMutating(): boolean {
  return useIsMutating({ mutationKey: cartKeys.mutation }) > 0
}

export const useAddToCart = () =>
  useCartMutation((item: AddCartItemRequest) => cartApi.addItem(item))

export const useUpdateCartItem = () =>
  useCartMutation(({ itemId, quantity }: { itemId: string; quantity: number }) =>
    cartApi.updateItem(itemId, quantity),
  )

export const useRemoveCartItem = () =>
  useCartMutation((itemId: string) => cartApi.removeItem(itemId))

export const useApplyCoupon = () => useCartMutation((code: string) => cartApi.applyCoupon(code))

export const useRemoveCoupon = () => useCartMutation(() => cartApi.removeCoupon())

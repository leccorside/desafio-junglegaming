import type { QueryClient } from '@tanstack/react-query'

import type {
  Cart,
  FavoritesResponse,
  FeaturedNftsResponse,
  Nft,
  NftListResponse,
  RealtimeSync,
} from '@/api/contracts'
import { cartKeys, quoteKeys } from '@/features/cart/cart-cache'
import { nftKeys } from '@/features/catalog/queries'

import { describeCartDiff, refreshQueries } from './apply-nft-updated'

/** Versões das cópias de NFT dentro do dado de uma query (detalhe, página, destaques, favoritos). */
function nftCopies(data: unknown): Pick<Nft, 'id' | 'version'>[] {
  if (!data || typeof data !== 'object') return []
  if ('items' in data && Array.isArray((data as NftListResponse).items)) {
    return (data as NftListResponse | FeaturedNftsResponse | FavoritesResponse).items
  }
  if ('id' in data && 'version' in data) return [data as Nft]
  return []
}

const differs = (sync: RealtimeSync, id: string, version: number) =>
  sync.nfts[id] !== undefined && sync.nfts[id] !== version

/**
 * Reconciliação pela API a cada `realtime.sync` (conexão nova, reconexão ou
 * reset dos mocks): o que mudou enquanto não havia conexão não chega por
 * evento. Busca de novo só as queries cujas cópias têm versão diferente da
 * do servidor (diferente, e não só menor: no reset dos mocks as versões
 * voltam para trás). Sem diferença, nada é buscado, então abrir a página não
 * duplica requisições. Os pedidos são sempre marcados como velhos: um pedido
 * pendente pode ter sido decidido enquanto a conexão estava fora.
 *
 * Na reconexão (`reason: 'connect'`), compara o carrinho do dono atual antes e
 * depois da busca e entrega o que mudou a `onCartChanges` (aviso). No reset
 * dos mocks não compara: o carrinho do visitante some com os dados iniciais.
 *
 * Devolve as famílias invalidadas (para teste).
 */
export function reconcileWithServer(
  queryClient: QueryClient,
  sync: RealtimeSync,
  options: { cartOwner?: string; onCartChanges?: (messages: string[]) => void } = {},
): string[] {
  const touched: string[] = []
  // Reset dos dados de demonstração: carrinho, favoritos e pedidos voltam às
  // fixtures sem mudar a versão dos NFTs (o carrinho do visitante some). Não
  // dá para decidir por versão: busca tudo de novo.
  if (sync.reason === 'reset') {
    for (const key of [nftKeys.all, ['favorites'], cartKeys.all, quoteKeys.all, ['orders']]) {
      void refreshQueries(queryClient, key)
    }
    return ['nfts', 'favorites', 'cart', 'orders']
  }
  const nftFamilies: { key: readonly unknown[]; name: string }[] = [
    { key: nftKeys.all, name: 'nfts' },
    { key: ['favorites'], name: 'favorites' },
  ]
  for (const family of nftFamilies) {
    const stale = queryClient
      .getQueriesData({ queryKey: family.key })
      .some(([, data]) => nftCopies(data).some((nft) => differs(sync, nft.id, nft.version)))
    if (stale) {
      void queryClient.invalidateQueries({
        queryKey: family.key,
        predicate: (query) =>
          nftCopies(query.state.data).some((nft) => differs(sync, nft.id, nft.version)),
      })
      touched.push(family.name)
    }
  }

  const cartStale = queryClient
    .getQueriesData<Cart>({ queryKey: cartKeys.all })
    .some(([, cart]) => cart?.items?.some((item) => differs(sync, item.nftId, item.nftVersion)))
  if (cartStale) {
    const { cartOwner, onCartChanges } = options
    const before = cartOwner
      ? queryClient.getQueryData<Cart>(cartKeys.current(cartOwner))
      : undefined
    void Promise.all([
      refreshQueries(queryClient, cartKeys.all),
      refreshQueries(queryClient, quoteKeys.all),
    ]).then(() => {
      if (sync.reason !== 'connect' || !before || !cartOwner || !onCartChanges) return
      const after = queryClient.getQueryData<Cart>(cartKeys.current(cartOwner))
      const messages = after ? describeCartDiff(before, after) : []
      if (messages.length) onCartChanges(messages)
    })
    touched.push('cart')
  }

  void queryClient.invalidateQueries({ queryKey: ['orders'] })
  return touched
}

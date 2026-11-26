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

import { refreshQueries } from './apply-nft-updated'

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
 * duplica requisições. Os pedidos ainda não têm tela (Passo 10) e são
 * sempre marcados como velhos.
 *
 * Devolve as famílias invalidadas (para teste).
 */
export function reconcileWithServer(queryClient: QueryClient, sync: RealtimeSync): string[] {
  const touched: string[] = []
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
    refreshQueries(queryClient, cartKeys.all)
    refreshQueries(queryClient, quoteKeys.all)
    touched.push('cart')
  }

  void queryClient.invalidateQueries({ queryKey: ['orders'] })
  return touched
}

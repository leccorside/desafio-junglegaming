import type { QueryClient } from '@tanstack/react-query'

import type {
  Cart,
  FavoritesResponse,
  FeaturedNftsResponse,
  Nft,
  NftListResponse,
  NftUpdatedEvent,
} from '@/api/contracts'
import { cartKeys, quoteKeys } from '@/features/cart/cart-cache'
import { nftKeys } from '@/features/catalog/queries'
import { formatEth } from '@/lib/eth'

/** O NFT com os dados do evento, só se o evento for mais novo que a cópia em cache. */
function patchNft(nft: Nft, event: NftUpdatedEvent): Nft {
  if (nft.id !== event.data.nftId || nft.version >= event.version) return nft
  const byId = new Map(event.data.editions.map((e) => [e.id, e]))
  return {
    ...nft,
    priceFrom: event.data.priceFrom,
    version: event.version,
    updatedAt: event.occurredAt,
    editions: nft.editions.map((edition) => {
      const next = byId.get(edition.id)
      return next
        ? { ...edition, price: next.price, available: next.available, status: next.status }
        : edition
    }),
  }
}

const editionLabel = (name: string) => (name === 'Aberta' ? 'edição aberta' : `edição ${name}`)

/** Itens do carrinho que o evento torna desatualizados (a cópia é mais antiga que ele). */
const outdatedItems = (cart: Cart | undefined, event: NftUpdatedEvent) =>
  cart?.items?.filter(
    (item) => item.nftId === event.data.nftId && item.nftVersion < event.version,
  ) ?? []

/** O que mudou para os itens do carrinho, em frases para o aviso. */
function cartChanges(cart: Cart, event: NftUpdatedEvent): string[] {
  const messages: string[] = []
  for (const item of outdatedItems(cart, event)) {
    const edition = event.data.editions.find((e) => e.id === item.editionId)
    if (!edition) continue
    const what = `${item.name} (${editionLabel(item.editionName)})`
    if (edition.status === 'unavailable') {
      messages.push(`${what} ficou indisponível.`)
    } else if (edition.status === 'sold_out' || edition.available === 0) {
      messages.push(`${what} esgotou.`)
    } else if (edition.available < item.quantity) {
      messages.push(
        `${what}: só ${edition.available} ${edition.available === 1 ? 'disponível' : 'disponíveis'}.`,
      )
    } else if (edition.price !== item.unitPrice) {
      messages.push(
        `${what}: o preço mudou de ${formatEth(item.unitPrice)} para ${formatEth(edition.price)}.`,
      )
    }
  }
  return messages
}

/**
 * Aplica um `nft.updated` no cache do TanStack Query: detalhe, páginas do
 * catálogo, destaques e lista de interesse que contêm o NFT (cada cópia só
 * muda se for mais antiga que o evento). Se algum carrinho em cache tem o
 * NFT numa versão mais antiga que a do evento, invalida carrinho e cotação (a
 * API recalcula preço e estoque) e devolve o que mudou no carrinho de
 * `cartOwner` (o da sessão atual), para o aviso. Um evento atrasado em relação
 * ao carrinho (versão igual ou menor) não avisa nem invalida nada.
 */
export function applyNftUpdated(
  queryClient: QueryClient,
  event: NftUpdatedEvent,
  cartOwner: string,
): string[] {
  queryClient.setQueryData<Nft>(nftKeys.detail(event.data.nftId), (nft) =>
    nft ? patchNft(nft, event) : nft,
  )
  queryClient.setQueriesData<NftListResponse>({ queryKey: [...nftKeys.all, 'list'] }, (page) =>
    page ? { ...page, items: page.items.map((nft) => patchNft(nft, event)) } : page,
  )
  queryClient.setQueryData<FeaturedNftsResponse>(nftKeys.featured(), (featured) =>
    featured ? { items: featured.items.map((nft) => patchNft(nft, event)) } : featured,
  )
  queryClient.setQueriesData<FavoritesResponse>({ queryKey: ['favorites'] }, (favorites) =>
    favorites
      ? { ...favorites, items: favorites.items.map((nft) => patchNft(nft, event)) }
      : favorites,
  )

  const carts = queryClient.getQueriesData<Cart>({ queryKey: cartKeys.all })
  if (!carts.some(([, cart]) => outdatedItems(cart, event).length)) return []
  const mine = queryClient.getQueryData<Cart>(cartKeys.current(cartOwner))
  const messages = mine?.items ? cartChanges(mine, event) : []
  refreshQueries(queryClient, cartKeys.all)
  refreshQueries(queryClient, quoteKeys.all)
  return messages
}

/**
 * Busca de novo, inclusive o que está na primeira busca. O `invalidateQueries`
 * sozinho não basta: com a primeira busca em andamento (sem dado em cache), o
 * TanStack reaproveita essa busca em vez de refazer, e a resposta, calculada
 * antes da mudança, chega e apaga a marca de "velho" (o resumo ficava com a
 * cotação antiga). Cancelar antes faz a busca começar de novo.
 */
export function refreshQueries(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
): Promise<void> {
  return queryClient
    .cancelQueries({ queryKey, predicate: (query) => query.state.data === undefined })
    .then(() => queryClient.invalidateQueries({ queryKey }))
}

/**
 * O que mudou entre duas versões do mesmo carrinho (antes e depois de buscar
 * de novo na reconexão), em frases para o aviso. Mudanças perdidas enquanto a
 * conexão estava fora não chegam por evento: sem isso, linha e resumo mudariam
 * sem nenhum aviso.
 */
export function describeCartDiff(before: Cart, after: Cart): string[] {
  const messages: string[] = []
  for (const old of before.items) {
    const item = after.items.find((i) => i.id === old.id)
    if (!item) continue
    const what = `${item.name} (${editionLabel(item.editionName)})`
    if (item.status === 'sold_out' && old.status !== 'sold_out') {
      messages.push(`${what} esgotou.`)
    } else if (item.status === 'insufficient' && item.available !== old.available) {
      messages.push(
        `${what}: só ${item.available} ${item.available === 1 ? 'disponível' : 'disponíveis'}.`,
      )
    } else if (item.unitPrice !== old.unitPrice) {
      messages.push(
        `${what}: o preço mudou de ${formatEth(old.unitPrice)} para ${formatEth(item.unitPrice)}.`,
      )
    }
  }
  return messages
}

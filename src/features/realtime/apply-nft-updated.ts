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

/** O que mudou para os itens do carrinho, em frases para o aviso. */
function cartChanges(cart: Cart, event: NftUpdatedEvent): string[] {
  const messages: string[] = []
  for (const item of cart.items) {
    if (item.nftId !== event.data.nftId) continue
    const edition = event.data.editions.find((e) => e.id === item.editionId)
    if (!edition) continue
    const what = `${item.name} (${editionLabel(item.editionName)})`
    if (edition.status !== 'available' || edition.available === 0) {
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
 * muda se for mais antiga que o evento). Se o NFT está no carrinho, invalida
 * carrinho e cotação (a API recalcula preço e estoque) e devolve o que mudou,
 * para o aviso.
 */
export function applyNftUpdated(queryClient: QueryClient, event: NftUpdatedEvent): string[] {
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
  const inCart = carts.some(([, cart]) =>
    cart?.items?.some((item) => item.nftId === event.data.nftId),
  )
  if (!inCart) return []
  const messages = carts.flatMap(([, cart]) => (cart?.items ? cartChanges(cart, event) : []))
  void queryClient.invalidateQueries({ queryKey: cartKeys.all })
  void queryClient.invalidateQueries({ queryKey: quoteKeys.all })
  return messages
}

import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { Cart, Nft, NftListResponse, OrderUpdatedEvent } from '@/api/contracts'
import { cartKeys } from '@/features/cart/cart-cache'
import { nftKeys } from '@/features/catalog/queries'
import { createNftFixtures } from '@/mocks/fixtures/nfts'
import { nftEvent } from '@/mocks/socket/server'

import { applyNftUpdated } from './apply-nft-updated'
import { createEventGate } from './event-gate'

const nfts = createNftFixtures()
const emerald = nfts.find((n) => n.id === 'nft-042') as Nft

/** O mesmo evento que o servidor simulado emite, com o NFT alterado. */
function updated(nft: Nft, patch: { version: number; price?: string; available?: number }) {
  const editions = nft.editions.map((e) =>
    e.id === `${nft.id}-open`
      ? {
          ...e,
          price: patch.price ?? e.price,
          available: patch.available ?? e.available,
          status: patch.available === 0 ? ('sold_out' as const) : e.status,
        }
      : e,
  )
  return nftEvent({
    ...nft,
    version: patch.version,
    editions,
    priceFrom: patch.price ?? nft.priceFrom,
    updatedAt: new Date(1000 * patch.version).toISOString(),
  })
}

const orderEvent = (userId: string): OrderUpdatedEvent => ({
  eventId: 'order-ord-1-v2',
  type: 'order.updated',
  resource: { type: 'order', id: 'ord-1' },
  version: 2,
  occurredAt: new Date(0).toISOString(),
  userId,
  data: { orderId: 'ord-1', status: 'confirmed', rejectionReason: null, transaction: null },
})

describe('porteiro dos eventos', () => {
  it('descarta duplicado (eventId) e antigo (version)', () => {
    const gate = createEventGate(null)
    const v2 = updated(emerald, { version: 2, price: '1.50' })
    expect(gate.check(v2)).toBe('apply')
    gate.record(v2)
    expect(gate.check(v2)).toBe('duplicate')
    // Mesmo recurso, versão menor ou igual: antigo, mesmo com outro eventId.
    expect(gate.check({ ...updated(emerald, { version: 2 }), eventId: 'outro' })).toBe('stale')
    expect(gate.check({ ...updated(emerald, { version: 1 }), eventId: 'outro-2' })).toBe('stale')
    expect(gate.check(updated(emerald, { version: 3 }))).toBe('apply')
  })

  it('descarta evento de outro usuário; cada sessão começa sem registro', () => {
    const ana = createEventGate('user-ana')
    expect(ana.check(orderEvent('user-bruno'))).toBe('other-user')
    expect(ana.check(orderEvent('user-ana'))).toBe('apply')
    ana.record(orderEvent('user-ana'))
    expect(createEventGate('user-ana').check(orderEvent('user-ana'))).toBe('apply')
    // Visitante não recebe evento de pedido.
    expect(createEventGate(null).check(orderEvent('user-ana'))).toBe('other-user')
  })
})

describe('aplicação do nft.updated no cache', () => {
  it('atualiza detalhe e listagem só com evento mais novo que a cópia', () => {
    const client = new QueryClient()
    client.setQueryData(nftKeys.detail(emerald.id), emerald)
    const page = { items: [emerald], page: 1, pageSize: 9, total: 1, totalPages: 1 }
    client.setQueryData(nftKeys.list({ feed: 'all', sort: 'recent', page: 1, pageSize: 9 }), page)

    applyNftUpdated(client, updated(emerald, { version: emerald.version + 1, price: '1.55' }))
    const detail = client.getQueryData<Nft>(nftKeys.detail(emerald.id))!
    expect(detail.priceFrom).toBe('1.55')
    expect(detail.editions.find((e) => e.id === 'nft-042-open')?.price).toBe('1.55')
    const list = client.getQueriesData<NftListResponse>({ queryKey: [...nftKeys.all, 'list'] })
    expect(list[0]?.[1]?.items[0]?.priceFrom).toBe('1.55')

    // Evento com versão igual à da cópia não volta o preço.
    applyNftUpdated(client, updated(emerald, { version: emerald.version + 1, price: '9.99' }))
    expect(client.getQueryData<Nft>(nftKeys.detail(emerald.id))?.priceFrom).toBe('1.55')
  })

  it('NFT no carrinho: devolve o aviso e invalida carrinho e cotação', () => {
    const client = new QueryClient()
    const cart: Cart = {
      id: 'cart-1',
      owner: 'guest',
      couponCode: null,
      version: 3,
      updatedAt: new Date(0).toISOString(),
      items: [
        {
          id: 'nft-042-open',
          nftId: 'nft-042',
          editionId: 'nft-042-open',
          name: 'Emerald Ape #042',
          editionName: 'Aberta',
          tokenId: '0042',
          imageUrl: '/images/nfts/nft-01-960.webp',
          unitPrice: '1.19',
          previousUnitPrice: null,
          quantity: 2,
          available: 999,
          status: 'ok',
          nftVersion: 1,
        },
      ],
    }
    client.setQueryData(cartKeys.current('guest:x'), cart)

    const price = applyNftUpdated(client, updated(emerald, { version: 2, price: '1.55' }))
    expect(price).toEqual([
      'Emerald Ape #042 (edição aberta): o preço mudou de 1.19 ETH para 1.55 ETH.',
    ])
    expect(client.getQueryState(cartKeys.current('guest:x'))?.isInvalidated).toBe(true)

    const soldOut = applyNftUpdated(client, updated(emerald, { version: 3, available: 0 }))
    expect(soldOut).toEqual(['Emerald Ape #042 (edição aberta) esgotou.'])

    // NFT fora do carrinho: nenhum aviso.
    const other = nfts.find((n) => n.id === 'nft-314') as Nft
    expect(applyNftUpdated(client, updated(other, { version: 2, price: '2' }))).toEqual([])
  })
})

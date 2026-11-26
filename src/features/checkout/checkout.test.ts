import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { CreateOrderRequest, Order, OrderUpdatedEvent, Quote } from '@/api/contracts'
import { applyOrderEvent, keepTerminal } from '@/features/orders/queries'

import { orderKeys } from './api'
import { describeQuoteDiff } from './quote-diff'
import { sameOrderBody } from './storage'

const quote = (patch: Partial<Quote> = {}): Quote => ({
  id: 'quote-1',
  version: 1,
  network: 'ethereum',
  lines: [
    {
      itemId: 'nft-042-open',
      nftId: 'nft-042',
      editionId: 'nft-042-open',
      unitPrice: '1.19',
      quantity: 2,
      lineTotal: '2.38',
    },
  ],
  subtotal: '2.38',
  discount: '0',
  networkFee: '0.016',
  total: '2.396',
  coupon: null,
  blockedItemIds: [],
  expiresAt: new Date(0).toISOString(),
  ...patch,
})

const names = { 'nft-042': 'Emerald Ape #042' }

describe('diferença entre cotações', () => {
  it('sem mudança no que se paga: nada a dizer (id e versão não contam)', () => {
    expect(describeQuoteDiff(quote(), quote({ id: 'quote-2', version: 2 }), names)).toEqual([])
  })

  it('preço, total, taxa e cupom', () => {
    const after = quote({
      lines: [{ ...quote().lines[0]!, unitPrice: '1.55', lineTotal: '3.10' }],
      subtotal: '3.10',
      networkFee: '0.004',
      total: '3.104',
      coupon: { code: 'BEMVINDO10', description: '' },
    })
    expect(describeQuoteDiff(quote(), after, names)).toEqual([
      'Emerald Ape #042: o preço mudou de 1.19 ETH para 1.55 ETH.',
      'O cupom BEMVINDO10 foi aplicado.',
      'A taxa de rede mudou de 0.016 ETH para 0.004 ETH.',
      'Total: de 2.396 ETH para 3.104 ETH.',
    ])
  })

  it('item que esgotou sai da compra', () => {
    const after = quote({ lines: [], subtotal: '0', networkFee: '0', total: '0' })
    expect(describeQuoteDiff(quote(), after, names)[0]).toBe(
      'Emerald Ape #042 ficou indisponível e saiu da compra.',
    )
  })
})

describe('tentativa de compra', () => {
  const body: CreateOrderRequest = {
    quoteId: 'quote-1',
    quoteVersion: 1,
    walletId: 'wallet-ana-primary',
    network: 'ethereum',
    buyer: { displayName: 'Ana Ribeiro', email: 'ana@example.com' },
  }

  it('mesmo corpo reaproveita a chave; cotação ou carteira diferente é outra tentativa', () => {
    expect(sameOrderBody(body, { ...body, buyer: { ...body.buyer } })).toBe(true)
    expect(sameOrderBody(body, { ...body, quoteVersion: 2 })).toBe(false)
    expect(sameOrderBody(body, { ...body, walletId: 'wallet-ana-secondary' })).toBe(false)
    expect(sameOrderBody(body, { ...body, buyer: { ...body.buyer, note: 'Presente' } })).toBe(false)
  })
})

const order = (patch: Partial<Order> = {}): Order => ({
  id: 'ord-0003',
  status: 'pending',
  rejectionReason: null,
  transaction: null,
  snapshot: {
    items: [
      {
        nftId: 'nft-042',
        editionId: 'nft-042-open',
        name: 'Emerald Ape #042',
        editionName: 'Aberta',
        tokenId: '0042',
        imageUrl: '/images/nfts/nft-01-960.webp',
        unitPrice: '1.19',
        quantity: 2,
        lineTotal: '2.38',
      },
    ],
    subtotal: '2.38',
    discount: '0',
    networkFee: '0.016',
    total: '2.396',
    couponCode: null,
    network: 'ethereum',
    wallet: { address: '0x7A42', type: 'metamask', label: 'Carteira principal' },
    buyer: { displayName: 'Ana Ribeiro', email: 'ana@example.com' },
  },
  version: 1,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  ...patch,
})

const event = (status: Order['status'], version: number): OrderUpdatedEvent => ({
  eventId: `order-ord-0003-v${version}-e0`,
  type: 'order.updated',
  resource: { type: 'order', id: 'ord-0003' },
  version,
  occurredAt: new Date(1000).toISOString(),
  userId: 'user-ana',
  data: {
    orderId: 'ord-0003',
    status,
    rejectionReason: status === 'rejected' ? 'Recusado.' : null,
    transaction: status === 'confirmed' ? { hash: '0xabc', explorerUrl: 'https://x/0xabc' } : null,
  },
})

describe('estado do pedido', () => {
  it('resposta REST atrasada não tira o pedido de um estado terminal', () => {
    const confirmed = order({ status: 'confirmed', version: 2 })
    expect(keepTerminal(confirmed, order())).toBe(confirmed)
    expect(keepTerminal(order(), confirmed)).toBe(confirmed)
    expect(keepTerminal(undefined, order())).toEqual(order())
  })

  it('order.updated aplica versão mais nova, nunca sai do terminal e marca o carrinho', () => {
    const client = new QueryClient()
    const key = orderKeys.detail('user-ana', 'ord-0003')
    client.setQueryData(key, order())
    client.setQueryData(['cart', 'user:user-ana'], { items: [] })

    expect(applyOrderEvent(client, 'user-ana', event('confirmed', 2))).toBe(true)
    expect(client.getQueryData<Order>(key)).toMatchObject({
      status: 'confirmed',
      version: 2,
      transaction: { hash: '0xabc' },
    })
    expect(client.getQueryState(['cart', 'user:user-ana'])?.isInvalidated).toBe(true)

    // Evento atrasado (versão menor) ou que tentaria voltar ao pendente: ignorado.
    expect(applyOrderEvent(client, 'user-ana', event('pending', 3))).toBe(false)
    expect(client.getQueryData<Order>(key)?.status).toBe('confirmed')
  })
})

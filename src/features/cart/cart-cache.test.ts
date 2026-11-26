import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { Cart } from '@/api/contracts'

import { cartKeys, quoteKeys, writeCart } from './cart-cache'

const cart = (version: number, quantity: number): Cart => ({
  id: 'cart-1',
  owner: 'guest',
  couponCode: null,
  version,
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
      quantity,
      available: 999,
      status: 'ok',
      nftVersion: 1,
    },
  ],
})

describe('gravação do carrinho no cache', () => {
  it('resposta mais antiga não desfaz a mais nova (respostas fora de ordem)', () => {
    const client = new QueryClient()
    expect(writeCart(client, 'guest:x', cart(6, 3))).toBe(true)
    // A resposta da versão 5 chega depois da 6: fica a 6.
    expect(writeCart(client, 'guest:x', cart(5, 2))).toBe(false)
    expect(client.getQueryData<Cart>(cartKeys.current('guest:x'))?.version).toBe(6)
    expect(client.getQueryData<Cart>(cartKeys.current('guest:x'))?.items[0]?.quantity).toBe(3)
  })

  it('versão igual ou maior é gravada; outro carrinho (merge) também', () => {
    const client = new QueryClient()
    writeCart(client, 'guest:x', cart(4, 1))
    expect(writeCart(client, 'guest:x', cart(4, 2))).toBe(true)
    expect(writeCart(client, 'guest:x', { ...cart(1, 7), id: 'cart-2' })).toBe(true)
    expect(client.getQueryData<Cart>(cartKeys.current('guest:x'))?.items[0]?.quantity).toBe(7)
  })

  it('marca as cotações como velhas sem buscar de novo', async () => {
    const client = new QueryClient()
    let calls = 0
    const key = quoteKeys.current('guest:x', 'ethereum', 4)
    await client.fetchQuery({ queryKey: key, queryFn: () => ++calls, staleTime: Infinity })
    writeCart(client, 'guest:x', cart(5, 2))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(calls).toBe(1)
    expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'

import { nftSchema, orderSchema, walletSchema } from '@/api/contracts'

import { hashPassword } from '../services/auth'
import { toOrder } from '../services/orders'
import { createSeed, FIXTURE_PASSWORD, FIXTURE_USERS, SPECIAL_NFTS } from './index'

describe('fixtures', () => {
  const seed = createSeed()

  it('são determinísticas', () => {
    expect(createSeed()).toEqual(seed)
  })

  it('têm 60 NFTs válidos pelo contrato, com IDs únicos', () => {
    expect(seed.nfts).toHaveLength(60)
    for (const nft of seed.nfts) nftSchema.parse(nft)
    expect(new Set(seed.nfts.map((n) => n.id)).size).toBe(60)
  })

  it('reproduzem os NFTs e preços do Figma', () => {
    const byName = Object.fromEntries(seed.nfts.map((n) => [n.name, n.priceFrom]))
    expect(byName).toMatchObject({
      'Emerald Ape #042': '1.19',
      'Cosmic Bloom #118': '1.29',
      'Golden Beat #207': '0.99',
      'Ivory Baron #088': '1.79',
      'Golden Signal #160': '0.39',
    })
  })

  it('cobrem variedade para filtros e paginação', () => {
    expect(new Set(seed.nfts.map((n) => n.category)).size).toBeGreaterThanOrEqual(8)
    expect(new Set(seed.nfts.map((n) => n.network))).toEqual(
      new Set(['ethereum', 'polygon', 'solana']),
    )
  })

  it('mantêm os estados especiais usados nos testes', () => {
    const find = (id: string) => seed.nfts.find((n) => n.id === id)!
    expect(find(SPECIAL_NFTS.soldOut).editions.every((e) => e.status === 'sold_out')).toBe(true)
    const partial = find(SPECIAL_NFTS.partiallyUnavailable).editions
    expect(partial.find((e) => e.name === '1/10')?.status).toBe('unavailable')
    expect(find(SPECIAL_NFTS.lowStock).editions.find((e) => e.name === '1/10')?.available).toBe(2)
  })

  it('guardam só o hash da senha, que confere com a credencial fictícia', async () => {
    for (const user of Object.values(FIXTURE_USERS)) {
      expect(JSON.stringify(seed.users)).not.toContain(FIXTURE_PASSWORD)
      expect(await hashPassword(user.passwordSalt, FIXTURE_PASSWORD)).toBe(user.passwordHash)
    }
  })

  it('têm carteiras e pedidos válidos pelo contrato', () => {
    for (const wallet of seed.wallets) walletSchema.parse(wallet)
    for (const order of seed.orders) orderSchema.parse(toOrder(order))
  })

  it('dão aos pedidos de exemplo um hash hexadecimal válido, diferente em cada pedido', () => {
    const hashes = seed.orders.map((order) => {
      const { hash, explorerUrl } = order.transaction!
      const pattern = order.snapshot.network === 'solana' ? /^[0-9a-f]{64}$/ : /^0x[0-9a-f]{64}$/
      expect(hash).toMatch(pattern)
      expect(explorerUrl.endsWith(hash)).toBe(true)
      return hash
    })
    expect(new Set(hashes).size).toBe(seed.orders.length)
  })
})

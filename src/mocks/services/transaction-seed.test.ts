import { describe, expect, it } from 'vitest'

import type { DbOrder } from '../db/state'
import { transactionSeed } from './orders'

type Item = { nftId: string; editionId: string; quantity: number; unitPrice: string }

const order = (id: string, items: Item[], total: string) =>
  ({ id, snapshot: { items, total } }) as unknown as Pick<DbOrder, 'id' | 'snapshot'>

const emerald: Item = {
  nftId: 'nft-042',
  editionId: 'nft-042-open',
  quantity: 1,
  unitPrice: '1.19',
}
const violet: Item = { nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1, unitPrice: '1.39' }

describe('semente do hash da transação', () => {
  it('é a mesma para o mesmo pedido', () => {
    expect(transactionSeed(order('ord-0003', [emerald], '1.206'))).toBe(
      transactionSeed(order('ord-0003', [emerald], '1.206')),
    )
  })

  it('muda com os itens, a quantidade, o preço e o total, mesmo com o mesmo número', () => {
    const base = transactionSeed(order('ord-0003', [emerald], '1.206'))
    expect(transactionSeed(order('ord-0003', [emerald, violet], '2.338'))).not.toBe(base)
    expect(transactionSeed(order('ord-0003', [{ ...emerald, quantity: 2 }], '1.206'))).not.toBe(
      base,
    )
    expect(
      transactionSeed(order('ord-0003', [{ ...emerald, unitPrice: '1.55' }], '1.206')),
    ).not.toBe(base)
    expect(transactionSeed(order('ord-0003', [emerald], '1.300'))).not.toBe(base)
    expect(transactionSeed(order('ord-0004', [emerald], '1.206'))).not.toBe(base)
  })

  it('é um inteiro de 32 bits sem sinal', () => {
    const seed = transactionSeed(order('ord-0003', [emerald, violet], '2.338'))
    expect(Number.isInteger(seed)).toBe(true)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThan(2 ** 32)
  })
})

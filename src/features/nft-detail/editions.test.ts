import { describe, expect, it } from 'vitest'

import type { Nft, NftEdition } from '@/api/contracts'
import { createNftFixtures, SPECIAL_NFTS } from '@/mocks/fixtures/nfts'

import {
  clampQuantity,
  defaultEdition,
  editionStatusLabel,
  isEditionSelectable,
  maxQuantity,
  resolveEdition,
} from './editions'

const nfts = createNftFixtures()
const byId = (id: string) => nfts.find((n) => n.id === id) as Nft
const edition = (nft: Nft, key: string) => nft.editions.find((e) => e.id === `${nft.id}-${key}`)!

describe('edições', () => {
  it('só edição à venda e com estoque pode ser escolhida', () => {
    const partial = byId(SPECIAL_NFTS.partiallyUnavailable)
    expect(isEditionSelectable(edition(partial, '1-1'))).toBe(false)
    expect(editionStatusLabel(edition(partial, '1-1'))).toBe('esgotada')
    expect(isEditionSelectable(edition(partial, '1-10'))).toBe(false)
    expect(editionStatusLabel(edition(partial, '1-10'))).toBe('indisponível')
    expect(editionStatusLabel(edition(partial, 'open'))).toBeNull()
  })

  it('a padrão é a mais barata disponível, que é o preço do card', () => {
    const nft = byId(SPECIAL_NFTS.available)
    expect(defaultEdition(nft)?.price).toBe(nft.priceFrom)
    expect(defaultEdition(byId(SPECIAL_NFTS.soldOut))).toBeNull()
  })

  it('edição da URL esgotada cai na padrão e avisa; ID desconhecido não avisa', () => {
    const partial = byId(SPECIAL_NFTS.partiallyUnavailable)
    const soldOut = resolveEdition(partial, `${partial.id}-1-1`)
    expect(soldOut.edition?.id).toBe(defaultEdition(partial)?.id)
    expect(soldOut.requestedUnavailable?.name).toBe('1/1')

    const unknown = resolveEdition(partial, 'nada')
    expect(unknown).toEqual({ edition: defaultEdition(partial), requestedUnavailable: null })

    const chosen = resolveEdition(partial, `${partial.id}-1-50`)
    expect(chosen.edition?.name).toBe('1/50')
  })
})

describe('quantidade', () => {
  const base: NftEdition = {
    id: 'e',
    name: '1/10',
    supply: 10,
    price: '1',
    available: 2,
    status: 'available',
  }

  it('limita pela disponibilidade da edição', () => {
    expect(maxQuantity(base)).toBe(2)
    expect(maxQuantity({ ...base, available: 999, supply: null })).toBe(999)
    expect(maxQuantity({ ...base, status: 'sold_out' })).toBe(0)
    expect(maxQuantity(null)).toBe(0)
  })

  it('mantém a quantidade entre 1 e o limite', () => {
    expect(clampQuantity(5, 2)).toBe(2)
    expect(clampQuantity(0, 2)).toBe(1)
    expect(clampQuantity(-3, 2)).toBe(1)
    expect(clampQuantity(1.7, 2)).toBe(1)
    expect(clampQuantity(Number.NaN, 2)).toBe(1)
    expect(clampQuantity(3, 0)).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'

import { DEFAULT_PAGE_SIZE } from '@/api/contracts'

import { pageWindow } from './pagination'
import {
  catalogSearchSchema,
  EMPTY_CATALOG_SEARCH,
  hasActiveFilters,
  toggleValue,
  toListParams,
} from './search'

describe('catalogSearchSchema', () => {
  it('usa os padrões quando a URL está vazia', () => {
    expect(EMPTY_CATALOG_SEARCH).toEqual({ feed: 'all', sort: 'recent', page: 1 })
  })

  it('troca valores inválidos pelo padrão em vez de falhar', () => {
    const search = catalogSearchSchema.parse({
      page: 'abc',
      sort: 'xyz',
      feed: 'nada',
      category: ['inexistente'],
      minPrice: '-1',
    })
    expect(search).toEqual({ feed: 'all', sort: 'recent', page: 1 })
  })

  it('aceita filtros válidos', () => {
    const search = catalogSearchSchema.parse({
      q: '  ape ',
      category: ['music'],
      network: ['polygon'],
      minPrice: '0.5',
      page: 3,
    })
    expect(search).toMatchObject({
      q: 'ape',
      category: ['music'],
      network: ['polygon'],
      minPrice: '0.5',
      page: 3,
    })
  })
})

describe('toListParams', () => {
  it('monta os parâmetros da API com 9 por página', () => {
    expect(toListParams({ ...EMPTY_CATALOG_SEARCH, q: '', category: [] })).toEqual({
      q: undefined,
      feed: 'all',
      category: undefined,
      network: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      sort: 'recent',
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    })
    expect(DEFAULT_PAGE_SIZE).toBe(9)
  })

  it('corrige faixa de preço invertida', () => {
    const params = toListParams({ ...EMPTY_CATALOG_SEARCH, minPrice: '5', maxPrice: '1.5' })
    expect(params).toMatchObject({ minPrice: '1.5', maxPrice: '5' })
  })
})

describe('hasActiveFilters', () => {
  it('ignora ordenação e página', () => {
    expect(hasActiveFilters({ ...EMPTY_CATALOG_SEARCH, sort: 'price_asc', page: 4 })).toBe(false)
  })

  it.each([
    { q: 'ape' },
    { feed: 'new' as const },
    { category: ['music' as const] },
    { network: ['solana' as const] },
    { maxPrice: '2' },
  ])('reconhece %o', (patch) => {
    expect(hasActiveFilters({ ...EMPTY_CATALOG_SEARCH, ...patch })).toBe(true)
  })
})

describe('toggleValue', () => {
  it('liga, desliga e tira da URL quando fica vazio', () => {
    expect(toggleValue(undefined, 'a')).toEqual(['a'])
    expect(toggleValue(['a'], 'b')).toEqual(['a', 'b'])
    expect(toggleValue(['a', 'b'], 'a')).toEqual(['b'])
    expect(toggleValue(['a'], 'a')).toBeUndefined()
  })
})

describe('pageWindow', () => {
  it('mostra todas as páginas quando são poucas', () => {
    expect(pageWindow(1, 4)).toEqual([1, 2, 3, 4])
  })

  it('usa reticências nas pontas longe da atual', () => {
    expect(pageWindow(1, 7)).toEqual([1, 2, 'gap', 7])
    expect(pageWindow(4, 7)).toEqual([1, 'gap', 3, 4, 5, 'gap', 7])
    expect(pageWindow(7, 7)).toEqual([1, 'gap', 6, 7])
  })

  it('não põe reticências entre páginas vizinhas', () => {
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 'gap', 7])
  })
})

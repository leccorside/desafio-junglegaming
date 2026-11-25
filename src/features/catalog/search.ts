import { z } from 'zod'

import {
  DEFAULT_PAGE_SIZE,
  ethAmountSchema,
  networkSchema,
  nftCategorySchema,
  nftFeedSchema,
  nftSortSchema,
  type NftListParams,
} from '@/api/contracts'
import { ethCompare } from '@/lib/eth'

/**
 * Estado do catálogo na URL (`/?q=ape&category=["music"]&sort=price_asc&page=2`).
 * Busca, abas, filtros, ordenação e página vivem aqui, então sobrevivem a
 * refresh e ao voltar/avançar do navegador. Valor inválido na URL volta ao
 * padrão em vez de quebrar a tela.
 */
export const catalogSearchSchema = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  feed: nftFeedSchema.default('all').catch('all'),
  category: z.array(nftCategorySchema).optional().catch(undefined),
  network: z.array(networkSchema).optional().catch(undefined),
  minPrice: ethAmountSchema.optional().catch(undefined),
  maxPrice: ethAmountSchema.optional().catch(undefined),
  sort: nftSortSchema.default('recent').catch('recent'),
  page: z.number().int().min(1).default(1).catch(1),
})
export type CatalogSearch = z.infer<typeof catalogSearchSchema>

/** Estado do catálogo sem nenhum filtro (tela de fundo do login no desktop). */
export const EMPTY_CATALOG_SEARCH: CatalogSearch = catalogSearchSchema.parse({})

/** Valores que não aparecem na URL (o `stripSearchParams` remove). */
export const CATALOG_SEARCH_DEFAULTS = { feed: 'all', sort: 'recent', page: 1 } as const

/** Parâmetros da API a partir da URL. Faixa de preço invertida é corrigida em vez de recusada. */
export function toListParams(search: CatalogSearch): NftListParams {
  let { minPrice, maxPrice } = search
  if (minPrice && maxPrice && ethCompare(minPrice, maxPrice) > 0) {
    ;[minPrice, maxPrice] = [maxPrice, minPrice]
  }
  return {
    q: search.q || undefined,
    feed: search.feed,
    category: search.category?.length ? search.category : undefined,
    network: search.network?.length ? search.network : undefined,
    minPrice,
    maxPrice,
    sort: search.sort,
    page: search.page,
    pageSize: DEFAULT_PAGE_SIZE,
  }
}

/** Há algum filtro aplicado (para o botão "Limpar filtros")? */
export function hasActiveFilters(search: CatalogSearch): boolean {
  return Boolean(
    search.q ||
    search.feed !== 'all' ||
    search.category?.length ||
    search.network?.length ||
    search.minPrice ||
    search.maxPrice,
  )
}

/** Liga/desliga um valor numa lista de filtro (vazia vira `undefined`, sai da URL). */
export function toggleValue<T>(list: T[] | undefined, value: T): T[] | undefined {
  const next = list?.includes(value) ? list.filter((v) => v !== value) : [...(list ?? []), value]
  return next.length ? next : undefined
}

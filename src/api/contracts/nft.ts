import { z } from 'zod'

import { ethCompare } from '@/lib/eth'

import {
  ethAmountSchema,
  idSchema,
  isoDateTimeSchema,
  nonNegativeIntSchema,
  pageSchema,
  versionSchema,
} from './common'
import { networkSchema } from './network'

/** Categorias da sidebar do catálogo no Figma. */
export const nftCategorySchema = z.enum([
  'digital-art',
  'photography',
  'music',
  '3d-art',
  'collectibles',
  'generative',
  'gaming',
  'memberships',
  'utility',
])
export type NftCategory = z.infer<typeof nftCategorySchema>

export const NFT_CATEGORY_LABELS: Record<NftCategory, string> = {
  'digital-art': 'Arte digital',
  photography: 'Fotografia',
  music: 'Música',
  '3d-art': 'Arte 3D',
  collectibles: 'Colecionáveis',
  generative: 'Generativa',
  gaming: 'Jogos',
  memberships: 'Assinaturas',
  utility: 'Utilidade',
}

export const editionStatusSchema = z.enum(['available', 'sold_out', 'unavailable'])
export type EditionStatus = z.infer<typeof editionStatusSchema>

/** Edição de um NFT ("1/1", "1/10", "1/50" ou "Aberta"), com preço e estoque próprios. */
export const nftEditionSchema = z.object({
  id: idSchema,
  name: z.string(),
  /** Tiragem total. `null` em edição aberta. */
  supply: z.number().int().positive().nullable(),
  price: ethAmountSchema,
  available: nonNegativeIntSchema,
  status: editionStatusSchema,
})
export type NftEdition = z.infer<typeof nftEditionSchema>

export const nftImageSchema = z.object({
  url: z.string(),
  alt: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
})
export type NftImage = z.infer<typeof nftImageSchema>

export const raritySchema = z.enum(['common', 'rare', 'legendary'])
export type Rarity = z.infer<typeof raritySchema>

export const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Comum',
  rare: 'Raro',
  legendary: 'Lendário',
}

export const nftSchema = z.object({
  id: idSchema,
  tokenId: z.string(),
  name: z.string(),
  description: z.string(),
  creator: z.object({ id: idSchema, name: z.string(), avatarUrl: z.string().nullable() }),
  collection: z.object({ id: idSchema, name: z.string() }),
  category: nftCategorySchema,
  network: networkSchema,
  rarity: raritySchema,
  attributes: z.array(z.string()),
  contract: z.object({
    address: z.string(),
    standard: z.enum(['ERC-721', 'ERC-1155', 'SPL']),
  }),
  /** Royalties do criador em vendas secundárias, em porcentagem. */
  royaltyPercent: z.number().nonnegative().max(100),
  rating: z.object({ average: z.number().min(0).max(5), count: nonNegativeIntSchema }),
  images: z.array(nftImageSchema).min(1),
  editions: z.array(nftEditionSchema).min(1),
  /** Menor preço entre as edições disponíveis (o que o card mostra). */
  priceFrom: ethAmountSchema,
  listedAt: isoDateTimeSchema,
  version: versionSchema,
  updatedAt: isoDateTimeSchema,
})
export type Nft = z.infer<typeof nftSchema>

/* -------------------------------------------------------------------------- */
/* Listagem                                                                   */
/* -------------------------------------------------------------------------- */

/** Abas do catálogo: "Todos os NFTs", "Novos lançamentos" e "Em alta". */
export const nftFeedSchema = z.enum(['all', 'new', 'trending'])
export type NftFeed = z.infer<typeof nftFeedSchema>

export const nftSortSchema = z.enum(['recent', 'price_asc', 'price_desc', 'popular'])
export type NftSort = z.infer<typeof nftSortSchema>

export const NFT_SORT_LABELS: Record<NftSort, string> = {
  recent: 'Listados recentemente',
  price_asc: 'Menor preço',
  price_desc: 'Maior preço',
  popular: 'Mais populares',
}

export const availabilityFilterSchema = z.enum(['available', 'sold_out'])

export const DEFAULT_PAGE_SIZE = 12
export const MAX_PAGE_SIZE = 48

/**
 * Parâmetros da listagem. É o mesmo schema que valida os search params da URL
 * do catálogo (Passo 5), por isso todos os campos têm padrão ou são opcionais.
 */
export const nftListParamsSchema = z
  .object({
    q: z.string().trim().max(80).optional(),
    feed: nftFeedSchema.default('all'),
    category: z.array(nftCategorySchema).optional(),
    network: z.array(networkSchema).optional(),
    minPrice: ethAmountSchema.optional(),
    maxPrice: ethAmountSchema.optional(),
    availability: availabilityFilterSchema.optional(),
    sort: nftSortSchema.default('recent'),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .refine(
    (p) =>
      p.minPrice === undefined ||
      p.maxPrice === undefined ||
      ethCompare(p.minPrice, p.maxPrice) <= 0,
    { path: ['maxPrice'], message: 'O preço máximo precisa ser maior que o mínimo.' },
  )
export type NftListParams = z.infer<typeof nftListParamsSchema>
export type NftListParamsInput = z.input<typeof nftListParamsSchema>

/** Contagens da sidebar ("Arte digital (33)", "Ethereum (119)") e faixa de preço do catálogo. */
export const nftFacetsSchema = z.object({
  categories: z.record(nftCategorySchema, nonNegativeIntSchema),
  networks: z.record(networkSchema, nonNegativeIntSchema),
  priceRange: z.object({ min: ethAmountSchema, max: ethAmountSchema }),
})
export type NftFacets = z.infer<typeof nftFacetsSchema>

export const nftListResponseSchema = pageSchema(nftSchema).extend({ facets: nftFacetsSchema })
export type NftListResponse = z.infer<typeof nftListResponseSchema>

export const featuredNftsResponseSchema = z.object({ items: z.array(nftSchema) })
export type FeaturedNftsResponse = z.infer<typeof featuredNftsResponseSchema>

/** Serializa os parâmetros para a query string (listas separadas por vírgula, sem padrões). */
export function toNftListQuery(params: NftListParams): URLSearchParams {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.feed !== 'all') query.set('feed', params.feed)
  if (params.category?.length) query.set('category', params.category.join(','))
  if (params.network?.length) query.set('network', params.network.join(','))
  if (params.minPrice) query.set('minPrice', params.minPrice)
  if (params.maxPrice) query.set('maxPrice', params.maxPrice)
  if (params.availability) query.set('availability', params.availability)
  if (params.sort !== 'recent') query.set('sort', params.sort)
  if (params.page !== 1) query.set('page', String(params.page))
  if (params.pageSize !== DEFAULT_PAGE_SIZE) query.set('pageSize', String(params.pageSize))
  return query
}

/** Lê a query string recebida pela API (usado pelos handlers do MSW). */
export function parseNftListQuery(query: URLSearchParams) {
  const list = (key: string) => query.get(key)?.split(',').filter(Boolean)
  const int = (key: string) => {
    const value = query.get(key)
    return value === null ? undefined : Number(value)
  }
  return nftListParamsSchema.safeParse({
    q: query.get('q') ?? undefined,
    feed: query.get('feed') ?? undefined,
    category: list('category'),
    network: list('network'),
    minPrice: query.get('minPrice') ?? undefined,
    maxPrice: query.get('maxPrice') ?? undefined,
    availability: query.get('availability') ?? undefined,
    sort: query.get('sort') ?? undefined,
    page: int('page'),
    pageSize: int('pageSize'),
  })
}

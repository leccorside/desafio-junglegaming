import {
  networkSchema,
  nftCategorySchema,
  type FeaturedNftsResponse,
  type Nft,
  type NftFacets,
  type NftListParams,
  type NftListResponse,
} from '@/api/contracts'
import { ethCompare, ethMax, ethMin } from '@/lib/eth'

import { getDb } from '../db/store'
import { fail } from '../errors'
import { isActive } from '../scenarios'

const DAY = 24 * 60 * 60 * 1000

/** Texto sem acento e em minúsculas, para a busca ignorar "Música"/"musica". */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/** Popularidade usada em "Em alta" e na ordenação `popular`. */
export function popularity(nft: Nft): number {
  return nft.rating.count * nft.rating.average
}

export function isAvailable(nft: Nft): boolean {
  return nft.editions.some((e) => e.status === 'available' && e.available > 0)
}

type Filter = (nft: Nft) => boolean

function buildFilters(all: Nft[], params: NftListParams) {
  const newest = Math.max(...all.map((n) => Date.parse(n.listedAt)))
  const scores = all.map(popularity).sort((a, b) => b - a)
  const trendingCut = scores[Math.floor(scores.length * 0.3)] ?? 0
  const query = params.q ? normalize(params.q) : null

  const filters: Record<string, Filter | null> = {
    q: query
      ? (n) =>
          [n.name, n.collection.name, n.creator.name, ...n.attributes].some((field) =>
            normalize(field).includes(query),
          )
      : null,
    feed:
      params.feed === 'new'
        ? (n) => Date.parse(n.listedAt) >= newest - 14 * DAY
        : params.feed === 'trending'
          ? (n) => popularity(n) >= trendingCut
          : null,
    category: params.category?.length ? (n) => params.category!.includes(n.category) : null,
    network: params.network?.length ? (n) => params.network!.includes(n.network) : null,
    collection: params.collection ? (n) => n.collection.id === params.collection : null,
    minPrice: params.minPrice ? (n) => ethCompare(n.priceFrom, params.minPrice!) >= 0 : null,
    maxPrice: params.maxPrice ? (n) => ethCompare(n.priceFrom, params.maxPrice!) <= 0 : null,
    availability: params.availability
      ? (n) => isAvailable(n) === (params.availability === 'available')
      : null,
  }

  /** Aplica todos os filtros, menos os indicados (para as contagens da sidebar). */
  return (except: string[] = []) =>
    all.filter((nft) =>
      Object.entries(filters).every(
        ([key, filter]) => !filter || except.includes(key) || filter(nft),
      ),
    )
}

function computeFacets(all: Nft[], apply: ReturnType<typeof buildFilters>): NftFacets {
  const categories = Object.fromEntries(
    nftCategorySchema.options.map((c) => [c, 0]),
  ) as NftFacets['categories']
  for (const nft of apply(['category'])) categories[nft.category] += 1

  const networks = Object.fromEntries(
    networkSchema.options.map((n) => [n, 0]),
  ) as NftFacets['networks']
  for (const nft of apply(['network'])) networks[nft.network] += 1

  const prices = all.map((n) => n.priceFrom)
  return {
    categories,
    networks,
    priceRange: {
      min: prices.reduce((a, b) => ethMin(a, b), prices[0] ?? '0'),
      max: prices.reduce((a, b) => ethMax(a, b), prices[0] ?? '0'),
    },
  }
}

const SORTERS: Record<NftListParams['sort'], (a: Nft, b: Nft) => number> = {
  recent: (a, b) => Date.parse(b.listedAt) - Date.parse(a.listedAt),
  price_asc: (a, b) => ethCompare(a.priceFrom, b.priceFrom),
  price_desc: (a, b) => ethCompare(b.priceFrom, a.priceFrom),
  popular: (a, b) => popularity(b) - popularity(a),
}

export function listNfts(params: NftListParams): NftListResponse {
  const all = isActive('empty-catalog') ? [] : getDb().nfts
  const apply = buildFilters(all, params)
  const filtered = apply().sort((a, b) => SORTERS[params.sort](a, b) || a.id.localeCompare(b.id))

  const start = (params.page - 1) * params.pageSize
  return {
    items: filtered.slice(start, start + params.pageSize),
    page: params.page,
    pageSize: params.pageSize,
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / params.pageSize),
    facets: computeFacets(all, apply),
  }
}

/** Destaques da tela inicial: o NFT do hero do Figma e os mais populares disponíveis. */
export function featuredNfts(): FeaturedNftsResponse {
  if (isActive('empty-catalog')) return { items: [] }
  const nfts = getDb().nfts
  const hero = nfts.find((n) => n.id === 'nft-042')
  const others = nfts
    .filter((n) => n.id !== hero?.id && isAvailable(n))
    .sort((a, b) => popularity(b) - popularity(a))
    .slice(0, hero ? 3 : 4)
  return { items: hero ? [hero, ...others] : others }
}

export function getNft(id: string): Nft {
  return (
    getDb().nfts.find((n) => n.id === id) ?? fail('NOT_FOUND', { message: 'NFT não encontrado.' })
  )
}

import { apiRequest } from '@/api/client'
import {
  featuredNftsResponseSchema,
  nftListResponseSchema,
  nftSchema,
  toNftListQuery,
  type NftListParams,
} from '@/api/contracts'

export const catalogApi = {
  list: (params: NftListParams, signal?: AbortSignal) =>
    apiRequest(nftListResponseSchema, { url: '/nfts', params: toNftListQuery(params), signal }),

  featured: (signal?: AbortSignal) =>
    apiRequest(featuredNftsResponseSchema, { url: '/nfts/featured', signal }),

  detail: (id: string, signal?: AbortSignal) =>
    apiRequest(nftSchema, { url: `/nfts/${encodeURIComponent(id)}`, signal }),
}

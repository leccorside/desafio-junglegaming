import { apiRequest } from '@/api/client'
import {
  featuredNftsResponseSchema,
  nftListResponseSchema,
  toNftListQuery,
  type NftListParams,
} from '@/api/contracts'

export const catalogApi = {
  list: (params: NftListParams, signal?: AbortSignal) =>
    apiRequest(nftListResponseSchema, { url: '/nfts', params: toNftListQuery(params), signal }),

  featured: (signal?: AbortSignal) =>
    apiRequest(featuredNftsResponseSchema, { url: '/nfts/featured', signal }),
}

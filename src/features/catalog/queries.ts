import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'

import type { Nft, NftListParams } from '@/api/contracts'

import { catalogApi } from './api'

/**
 * Query keys do catálogo (públicas). A chave inclui todos os parâmetros: uma
 * resposta atrasada de um filtro antigo nunca ocupa o lugar da consulta atual.
 */
export const nftKeys = {
  all: ['nfts'] as const,
  list: (params: NftListParams) => ['nfts', 'list', params] as const,
  featured: () => ['nfts', 'featured'] as const,
  detail: (id: string) => ['nfts', 'detail', id] as const,
}

export const nftListQuery = (params: NftListParams) =>
  queryOptions({
    queryKey: nftKeys.list(params),
    // O `signal` cancela a requisição quando os filtros mudam antes da resposta.
    queryFn: ({ signal }) => catalogApi.list(params, signal),
    staleTime: 60_000,
    // Mantém a página anterior na tela durante a troca de filtro (com indicador).
    placeholderData: keepPreviousData,
  })

export const featuredNftsQuery = () =>
  queryOptions({
    queryKey: nftKeys.featured(),
    queryFn: ({ signal }) => catalogApi.featured(signal),
    staleTime: 60_000,
  })

export const nftDetailQuery = (id: string) =>
  queryOptions({
    queryKey: nftKeys.detail(id),
    queryFn: ({ signal }) => catalogApi.detail(id, signal),
    staleTime: 30_000,
  })

/** "Mais desta coleção": até 5 NFTs da mesma coleção, sem o próprio. */
export const RELATED_LIMIT = 5

export const relatedNftsQuery = (nft: Pick<Nft, 'id' | 'collection'>) =>
  queryOptions({
    ...nftListQuery({
      feed: 'all',
      collection: nft.collection.id,
      sort: 'popular',
      page: 1,
      pageSize: RELATED_LIMIT + 1,
    }),
    // Sem a página anterior: trocar de NFT mostra o skeleton, não a coleção antiga.
    placeholderData: undefined,
    select: (page) => page.items.filter((item) => item.id !== nft.id).slice(0, RELATED_LIMIT),
  })

export function useNftList(params: NftListParams) {
  return useQuery(nftListQuery(params))
}

export function useFeaturedNfts() {
  return useQuery(featuredNftsQuery())
}

import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'

import type { NftListParams } from '@/api/contracts'

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

export function useNftList(params: NftListParams) {
  return useQuery(nftListQuery(params))
}

export function useFeaturedNfts() {
  return useQuery(featuredNftsQuery())
}

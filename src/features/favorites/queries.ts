import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { toast } from 'sonner'

import type { FavoritesResponse, Nft } from '@/api/contracts'
import { useSession } from '@/features/auth/session-store'

import { favoritesApi } from './api'

/** Chaves privadas: incluem o usuário, então duas contas nunca dividem cache. */
export const favoriteKeys = {
  all: (userId: string) => ['favorites', userId] as const,
  toggle: (userId: string) => ['favorites', userId, 'toggle'] as const,
}

export const favoritesQuery = (userId: string) =>
  queryOptions({
    queryKey: favoriteKeys.all(userId),
    queryFn: ({ signal }) => favoritesApi.list(signal),
    staleTime: 5 * 60_000,
  })

/** Lista de interesse do usuário logado (desligada para visitante). */
export function useFavorites() {
  const session = useSession()
  const userId = session?.user.id
  return useQuery({ ...favoritesQuery(userId ?? 'guest'), enabled: Boolean(userId) })
}

/** O NFT está na lista de interesse? Visitante: sempre falso. */
export function useIsFavorite(nftId: string): boolean {
  const favorites = useFavorites()
  return favorites.data?.nftIds.includes(nftId) ?? false
}

interface ToggleVariables {
  nft: Nft
  favorite: boolean
}

/** Aplica a mudança no cache: o coração muda antes da resposta da API. */
function applyToggle(
  current: FavoritesResponse | undefined,
  { nft, favorite }: ToggleVariables,
): FavoritesResponse {
  const nftIds = (current?.nftIds ?? []).filter((id) => id !== nft.id)
  const items = (current?.items ?? []).filter((item) => item.id !== nft.id)
  return favorite ? { nftIds: [...nftIds, nft.id], items: [...items, nft] } : { nftIds, items }
}

function useToggleMutation(userId: string, queryClient: QueryClient) {
  const key = favoriteKeys.all(userId)
  return useMutation({
    mutationKey: favoriteKeys.toggle(userId),
    mutationFn: ({ nft, favorite }: ToggleVariables) =>
      favorite ? favoritesApi.add(nft.id) : favoritesApi.remove(nft.id),
    onMutate: async (variables) => {
      // Uma busca em andamento não pode sobrescrever a mudança otimista.
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<FavoritesResponse>(key)
      queryClient.setQueryData<FavoritesResponse>(key, (current) => applyToggle(current, variables))
      return { previous }
    },
    onError: (_error, { nft, favorite }, context) => {
      // Volta ao estado de antes desta mudança.
      queryClient.setQueryData(key, context?.previous)
      toast.error(
        favorite
          ? `Não foi possível adicionar ${nft.name} à lista de interesse. Tente de novo.`
          : `Não foi possível tirar ${nft.name} da lista de interesse. Tente de novo.`,
      )
    },
    onSettled: () => {
      // Com cliques seguidos, só a última mutação alinha com a API: invalidar no
      // meio traria um estado intermediário de volta à tela.
      if (queryClient.isMutating({ mutationKey: favoriteKeys.toggle(userId) }) === 1) {
        void queryClient.invalidateQueries({ queryKey: key })
      }
    },
  })
}

/**
 * Favoritar e desfavoritar. Visitante vai ao login e volta para a mesma tela.
 * Logado: atualização otimista com rollback e aviso em caso de falha.
 */
export function useToggleFavorite() {
  const session = useSession()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const mutation = useToggleMutation(session?.user.id ?? 'guest', queryClient)
  const { mutate } = mutation

  const toggle = useCallback(
    (nft: Nft, favorite: boolean) => {
      if (!session) {
        void navigate({ to: '/login', search: { redirect: location.href } })
        return
      }
      mutate({ nft, favorite })
    },
    [session, navigate, location.href, mutate],
  )

  return { toggle, isGuest: !session }
}

import type { FavoriteMutationResponse, FavoritesResponse } from '@/api/contracts'

import { getDb, mutate } from '../db/store'
import { fail } from '../errors'
import { isActive } from '../scenarios'
import { getNft } from './catalog'

export function listFavorites(userId: string): FavoritesResponse {
  const state = getDb()
  const nftIds = state.favorites[userId] ?? []
  return { nftIds, items: nftIds.flatMap((id) => state.nfts.filter((n) => n.id === id)) }
}

function changeFavorite(userId: string, nftId: string, add: boolean): FavoriteMutationResponse {
  if (isActive('favorite-fails')) fail('SERVICE_UNAVAILABLE')
  getNft(nftId)

  return mutate((db) => {
    const current = db.favorites[userId] ?? []
    const next = current.filter((id) => id !== nftId)
    // Idempotente: incluir duas vezes ou remover o que não existe dá o mesmo resultado.
    db.favorites[userId] = add ? [nftId, ...next] : next
    return { nftIds: db.favorites[userId] }
  })
}

export const addFavorite = (userId: string, nftId: string) => changeFavorite(userId, nftId, true)
export const removeFavorite = (userId: string, nftId: string) =>
  changeFavorite(userId, nftId, false)

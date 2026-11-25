import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { memoryStorage } from '@/test/memory-storage'

import {
  clearPendingFavorite,
  peekPendingFavorite,
  PENDING_FAVORITE_KEY,
  PENDING_FAVORITE_TTL_MS,
  savePendingFavorite,
  takePendingFavorite,
} from './pending-favorite'

describe('intenção de favoritar do visitante', () => {
  beforeEach(() => vi.stubGlobal('sessionStorage', memoryStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it('guarda, lê e é consumida uma vez só', () => {
    savePendingFavorite({ id: 'nft-160', name: 'Golden Signal #160' }, 1000)
    expect(peekPendingFavorite(2000)).toEqual({
      nftId: 'nft-160',
      name: 'Golden Signal #160',
      createdAt: 1000,
    })
    expect(takePendingFavorite(2000)?.nftId).toBe('nft-160')
    expect(takePendingFavorite(2000)).toBeNull()
  })

  it('vence depois de 10 minutos', () => {
    savePendingFavorite({ id: 'nft-160', name: 'Golden Signal #160' }, 0)
    expect(peekPendingFavorite(PENDING_FAVORITE_TTL_MS + 1)).toBeNull()
    expect(sessionStorage.getItem(PENDING_FAVORITE_KEY)).toBeNull()
  })

  it('descarta pedido com data no futuro (não vale para sempre)', () => {
    sessionStorage.setItem(
      PENDING_FAVORITE_KEY,
      JSON.stringify({ nftId: 'nft-160', name: 'x', createdAt: 9e15 }),
    )
    expect(peekPendingFavorite(1000)).toBeNull()
    expect(sessionStorage.getItem(PENDING_FAVORITE_KEY)).toBeNull()

    savePendingFavorite({ id: 'nft-160', name: 'x' }, 5000)
    expect(peekPendingFavorite(4999)).toBeNull()
  })

  it('ignora valor corrompido ou fora do formato', () => {
    sessionStorage.setItem(PENDING_FAVORITE_KEY, '{quebrado')
    expect(peekPendingFavorite()).toBeNull()
    sessionStorage.setItem(PENDING_FAVORITE_KEY, JSON.stringify({ nftId: 42 }))
    expect(peekPendingFavorite()).toBeNull()
  })

  it('limpa', () => {
    savePendingFavorite({ id: 'nft-009', name: 'Sage Nomad #009' })
    clearPendingFavorite()
    expect(peekPendingFavorite()).toBeNull()
  })
})

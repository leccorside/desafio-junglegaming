import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** localStorage em memória, para testar a persistência em Node. */
function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

describe('persistência do banco', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage())
    vi.resetModules()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('sobrevive a um "refresh" (novo carregamento do módulo)', async () => {
    const first = await import('./store')
    first.mutate((db) => {
      db.favorites['user-ana'] = ['nft-009']
    })

    vi.resetModules()
    const reloaded = await import('./store')
    expect(reloaded.getDb().favorites['user-ana']).toEqual(['nft-009'])
  })

  it('volta às fixtures com versão de formato diferente ou JSON corrompido', async () => {
    const { DB_STORAGE_KEY } = await import('./store')
    localStorage.setItem(DB_STORAGE_KEY, JSON.stringify({ schemaVersion: -1 }))
    expect((await import('./store')).getDb().nfts).toHaveLength(60)

    vi.resetModules()
    localStorage.setItem(DB_STORAGE_KEY, '{quebrado')
    expect((await import('./store')).getDb().nfts).toHaveLength(60)
  })

  it('persiste e avisa mesmo quando a alteração termina em erro', async () => {
    const store = await import('./store')
    const listener = vi.fn()
    store.onDbChange(listener)

    // Como o cenário de preço alterado: muda o banco e depois recusa a requisição.
    expect(() =>
      store.mutate((db) => {
        db.nfts[0]!.priceFrom = '9.99'
        throw new Error('QUOTE_OUTDATED')
      }),
    ).toThrow('QUOTE_OUTDATED')
    expect(listener).toHaveBeenCalledTimes(1)

    vi.resetModules()
    const reloaded = await import('./store')
    expect(reloaded.getDb().nfts[0]?.priceFrom).toBe('9.99')
  })

  it('reset restaura as fixtures e avisa os interessados', async () => {
    const store = await import('./store')
    const listener = vi.fn()
    store.onDbChange(listener)
    store.mutate((db) => {
      db.nfts = []
    })
    store.resetDb()
    expect(store.getDb().nfts).toHaveLength(60)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})

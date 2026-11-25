/**
 * Gerador pseudoaleatório com semente (mulberry32). Mesma semente, mesma
 * sequência: fixtures e latências variáveis ficam reproduzíveis.
 */
export function createRandom(seed: number) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    int(min: number, max: number) {
      return Math.floor(next() * (max - min + 1)) + min
    },
    pick<T>(items: readonly T[]): T {
      const item = items[Math.floor(next() * items.length)]
      if (item === undefined) throw new Error('Lista vazia')
      return item
    },
    hex(length: number) {
      let out = ''
      for (let i = 0; i < length; i++) out += Math.floor(next() * 16).toString(16)
      return out
    },
  }
}

export type Random = ReturnType<typeof createRandom>

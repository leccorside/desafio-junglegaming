import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyScenarioFromUrl,
  getScenario,
  planNetwork,
  resetScenario,
  setScenario,
  updateScenarioNames,
} from './index'

describe('cenários', () => {
  beforeEach(() => resetScenario())

  it('lê a URL e avisa quando havia cenário (para o parâmetro ser removido)', () => {
    expect(applyScenarioFromUrl('?page=2')).toBe(false)
    expect(getScenario().names).toEqual([])

    expect(applyScenarioFromUrl('?scenario=slow,inexistente&scenarioRoutes=/nfts')).toBe(true)
    expect(getScenario()).toMatchObject({ names: ['slow'], options: { routes: ['/nfts'] } })
  })

  it('trocar os cenários pelo painel mantém as opções em vigor', () => {
    setScenario(['server-error'], { routes: ['/nfts'], seed: 9, settleMs: 0 })
    updateScenarioNames(['server-error', 'favorite-fails'])
    expect(getScenario()).toMatchObject({
      names: ['server-error', 'favorite-fails'],
      options: { routes: ['/nfts'], seed: 9, settleMs: 0 },
    })
  })

  it('a sequência do jitter não depende das requisições fora dele', () => {
    const jitterDelays = (interleave: boolean) => {
      setScenario(['jitter'], { seed: 3, routes: ['/nfts'] })
      return Array.from({ length: 6 }, () => {
        // Requisições de outras rotas recebem a latência padrão no navegador.
        if (interleave) planNetwork('GET', '/cart', { browser: true })
        return planNetwork('GET', '/nfts', { browser: true }).delayMs
      })
    }
    expect(jitterDelays(true)).toEqual(jitterDelays(false))
  })

  it('planeja offline, timeout, 503 e falha na primeira tentativa', () => {
    setScenario(['offline'])
    expect(planNetwork('GET', '/nfts').outcome).toBe('offline')
    setScenario(['timeout'])
    expect(planNetwork('GET', '/nfts').delayMs).toBe('infinite')
    setScenario(['server-error'])
    expect(planNetwork('GET', '/nfts').outcome).toBe('unavailable')
    setScenario(['flaky'])
    expect(planNetwork('GET', '/nfts').outcome).toBe('unavailable')
    expect(planNetwork('GET', '/nfts').outcome).toBe('continue')
  })
})

describe('cenário salvo corrompido', () => {
  beforeEach(() => vi.resetModules())
  afterEach(() => vi.unstubAllGlobals())

  it('começa sem cenário em vez de quebrar a inicialização', async () => {
    const store = new Map([['kurio:mocks:scenario', '{']])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    })
    const scenarios = await import('./index')
    expect(scenarios.getScenario()).toEqual({ names: [], options: {}, consumed: [] })
  })
})

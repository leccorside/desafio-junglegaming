import { delay, HttpResponse } from 'msw'
import { z } from 'zod'

import { API_ERROR_STATUS } from '@/api/contracts'

import { LATENCY } from '../config'
import { createRandom } from '../random'

/**
 * Cenários configuráveis e reproduzíveis da API simulada (docs/MOCKS.md).
 * Ativados por `?scenario=a,b` na URL, pelo painel de desenvolvimento ou por
 * `PUT /__mocks/scenario`. Ficam salvos até o reset.
 */

export const NETWORK_SCENARIOS = [
  'slow',
  'jitter',
  'timeout',
  'offline',
  'server-error',
  'flaky',
] as const

export const BUSINESS_SCENARIOS = [
  'empty-catalog',
  'session-expired',
  'forbidden',
  'register-conflict',
  'validation-error',
  'favorite-fails',
  'price-changed-on-checkout',
  'sold-out-on-checkout',
  'order-timeout',
  'payment-confirmed',
  'payment-rejected',
  'wallet-rejected',
  'wallet-disconnected',
] as const

export const scenarioNameSchema = z.enum([...NETWORK_SCENARIOS, ...BUSINESS_SCENARIOS])
export type ScenarioName = z.infer<typeof scenarioNameSchema>

export const SCENARIO_DESCRIPTIONS: Record<ScenarioName, string> = {
  slow: 'Latência alta fixa (2,5 s) para ver os skeletons',
  jitter: 'Latência variável com semente fixa: respostas fora de ordem',
  timeout: 'As requisições não respondem',
  offline: 'Erro de rede',
  'server-error': 'Respostas 503 (falha transitória)',
  flaky: 'Cada rota falha na primeira chamada e responde na seguinte',
  'empty-catalog': 'Catálogo sem resultados',
  'session-expired': 'A sessão expira na próxima chamada autenticada',
  forbidden: 'Pedidos e carteiras respondem 403',
  'register-conflict': 'Cadastro devolve e-mail já em uso',
  'validation-error': 'Formulários devolvem erro por campo',
  'favorite-fails': 'Favoritar e desfavoritar falham (503)',
  'price-changed-on-checkout': 'O preço sobe entre a revisão e a confirmação',
  'sold-out-on-checkout': 'Uma edição esgota durante a compra',
  'order-timeout': 'O pedido é criado, mas a primeira resposta não chega',
  'payment-confirmed': 'Pagamento confirmado (comportamento padrão)',
  'payment-rejected': 'Pagamento recusado',
  'wallet-rejected': 'O colecionador recusa a conexão da carteira',
  'wallet-disconnected': 'A carteira desconecta durante o pagamento',
}

export const scenarioOptionsSchema = z.object({
  /** Limita os cenários de rede a rotas que começam com estes caminhos (ex.: `/nfts`). */
  routes: z.array(z.string()).optional(),
  /** Latência do cenário `slow`, em ms. */
  latencyMs: z.number().int().nonnegative().optional(),
  /** Semente do cenário `jitter`. */
  seed: z.number().int().optional(),
  /** Tempo até a decisão do pagamento, em ms. */
  settleMs: z.number().int().nonnegative().optional(),
})
export type ScenarioOptions = z.infer<typeof scenarioOptionsSchema>

export const scenarioStateSchema = z.object({
  names: z.array(scenarioNameSchema),
  options: scenarioOptionsSchema,
  /** Cenários de uso único já disparados. */
  consumed: z.array(scenarioNameSchema),
})
export type ScenarioState = z.infer<typeof scenarioStateSchema>

const STORAGE_KEY = 'kurio:mocks:scenario'
const EMPTY: ScenarioState = { names: [], options: {}, consumed: [] }

let state: ScenarioState = load()
let jitterRandom = createRandom(state.options.seed ?? 7)
const flakyCalls = new Map<string, number>()

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function load(): ScenarioState {
  const raw = storage()?.getItem(STORAGE_KEY)
  if (!raw) return structuredClone(EMPTY)
  const parsed = scenarioStateSchema.safeParse(JSON.parse(raw))
  return parsed.success ? parsed.data : structuredClone(EMPTY)
}

function save() {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Sem storage: segue em memória.
  }
}

export function getScenario(): ScenarioState {
  return state
}

export function setScenario(names: ScenarioName[], options: ScenarioOptions = {}): ScenarioState {
  state = { names: Array.from(new Set(names)), options, consumed: [] }
  jitterRandom = createRandom(options.seed ?? 7)
  flakyCalls.clear()
  save()
  return state
}

export function resetScenario(): ScenarioState {
  return setScenario([])
}

export function isActive(name: ScenarioName): boolean {
  return state.names.includes(name)
}

/**
 * Para cenários de uso único: devolve true na primeira vez que o cenário
 * ativo é disparado e marca como consumido.
 */
export function consumeOnce(name: ScenarioName): boolean {
  if (!isActive(name) || state.consumed.includes(name)) return false
  state.consumed.push(name)
  save()
  return true
}

/** Lê `?scenario=slow,favorite-fails&scenarioRoutes=/nfts` da URL da página. */
export function applyScenarioFromUrl(search: string) {
  const params = new URLSearchParams(search)
  const raw = params.get('scenario')
  if (raw === null) return
  const names = raw
    .split(',')
    .map((n) => n.trim())
    .filter((n): n is ScenarioName => scenarioNameSchema.safeParse(n).success)
  const routes = params.get('scenarioRoutes')?.split(',').filter(Boolean)
  setScenario(names, routes?.length ? { routes } : {})
}

function appliesTo(path: string): boolean {
  const routes = state.options.routes
  return !routes?.length || routes.some((route) => path.startsWith(route))
}

function unavailable() {
  return HttpResponse.json(
    {
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Serviço temporariamente indisponível. Tente de novo.',
        retryable: true,
      },
    },
    { status: API_ERROR_STATUS.SERVICE_UNAVAILABLE },
  )
}

const isBrowser = typeof window !== 'undefined'

/**
 * Aplica os cenários de rede a uma requisição. Devolve uma resposta quando o
 * cenário substitui a da API (erro, offline) ou `null` para seguir normalmente.
 */
export async function applyNetworkScenario(method: string, path: string): Promise<Response | null> {
  if (!appliesTo(path)) {
    if (isBrowser) await delay(jitterRandom.int(LATENCY.default.min, LATENCY.default.max))
    return null
  }

  if (isActive('offline')) return HttpResponse.error()
  if (isActive('timeout')) {
    await delay('infinite')
    return null
  }

  if (isActive('slow')) await delay(state.options.latencyMs ?? LATENCY.slow)
  else if (isActive('jitter')) await delay(jitterRandom.int(LATENCY.jitter.min, LATENCY.jitter.max))
  else if (isBrowser) await delay(jitterRandom.int(LATENCY.default.min, LATENCY.default.max))

  if (isActive('server-error')) return unavailable()

  if (isActive('flaky')) {
    const key = `${method} ${path}`
    const calls = (flakyCalls.get(key) ?? 0) + 1
    flakyCalls.set(key, calls)
    if (calls === 1) return unavailable()
  }

  return null
}

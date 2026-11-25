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
const DEFAULT_LATENCY_SEED = 11
let defaultRandom = createRandom(DEFAULT_LATENCY_SEED)
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
  try {
    const parsed = scenarioStateSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : structuredClone(EMPTY)
  } catch {
    // JSON corrompido (gravação interrompida, edição manual): começa sem cenário.
    return structuredClone(EMPTY)
  }
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
  defaultRandom = createRandom(DEFAULT_LATENCY_SEED)
  flakyCalls.clear()
  save()
  return state
}

/** Troca só os cenários ativos, mantendo as opções (rotas, latência, semente, prazo). */
export function updateScenarioNames(names: ScenarioName[]): ScenarioState {
  return setScenario(names, state.options)
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

export const URL_SCENARIO_PARAMS = ['scenario', 'scenarioRoutes'] as const

/**
 * Lê `?scenario=slow,favorite-fails&scenarioRoutes=/nfts` da URL da página.
 * Devolve true quando a URL trazia cenário: quem chama deve remover os
 * parâmetros, para o próximo reload não sobrescrever o estado salvo.
 */
export function applyScenarioFromUrl(search: string): boolean {
  const params = new URLSearchParams(search)
  const raw = params.get('scenario')
  if (raw === null) return false
  const names = raw
    .split(',')
    .map((n) => n.trim())
    .filter((n): n is ScenarioName => scenarioNameSchema.safeParse(n).success)
  const routes = params.get('scenarioRoutes')?.split(',').filter(Boolean)
  setScenario(names, routes?.length ? { routes } : {})
  return true
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

/** O que fazer com uma requisição: esperar `delayMs` e então seguir ou trocar a resposta. */
export interface NetworkPlan {
  delayMs: number | 'infinite' | null
  outcome: 'continue' | 'offline' | 'unavailable'
}

/**
 * Decide o efeito dos cenários de rede sobre uma requisição, sem executar nada.
 * A latência padrão usa um gerador próprio: requisições fora do `jitter` não
 * deslocam a sequência dele, que fica reproduzível para a mesma semente.
 */
export function planNetwork(
  method: string,
  path: string,
  { browser = isBrowser }: { browser?: boolean } = {},
): NetworkPlan {
  const defaultDelay = () =>
    browser ? defaultRandom.int(LATENCY.default.min, LATENCY.default.max) : null

  if (!appliesTo(path)) return { delayMs: defaultDelay(), outcome: 'continue' }
  if (isActive('offline')) return { delayMs: null, outcome: 'offline' }
  if (isActive('timeout')) return { delayMs: 'infinite', outcome: 'continue' }

  const delayMs = isActive('slow')
    ? (state.options.latencyMs ?? LATENCY.slow)
    : isActive('jitter')
      ? jitterRandom.int(LATENCY.jitter.min, LATENCY.jitter.max)
      : defaultDelay()

  if (isActive('server-error')) return { delayMs, outcome: 'unavailable' }

  if (isActive('flaky')) {
    const key = `${method} ${path}`
    const calls = (flakyCalls.get(key) ?? 0) + 1
    flakyCalls.set(key, calls)
    if (calls === 1) return { delayMs, outcome: 'unavailable' }
  }

  return { delayMs, outcome: 'continue' }
}

/**
 * Aplica os cenários de rede a uma requisição. Devolve uma resposta quando o
 * cenário substitui a da API (erro, offline) ou `null` para seguir normalmente.
 */
export async function applyNetworkScenario(method: string, path: string): Promise<Response | null> {
  const plan = planNetwork(method, path)
  if (plan.outcome === 'offline') return HttpResponse.error()
  if (plan.delayMs !== null) await delay(plan.delayMs)
  return plan.outcome === 'unavailable' ? unavailable() : null
}

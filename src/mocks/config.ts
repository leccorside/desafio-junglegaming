import type { EthAmount, Network } from '@/api/contracts'
import { env } from '@/lib/env'

/** Caminho de uma rota da API para os handlers (qualquer origem, base `VITE_API_URL`). */
export function apiPath(path: string): string {
  const base = env.apiUrl.replace(/\/$/, '')
  return base.startsWith('http') ? `${base}${path}` : `*${base}${path}`
}

/** Prefixo das rotas utilitárias dos mocks (reset, cenário, disparo de eventos). */
export const MOCKS_PREFIX = '/__mocks'

/** Validade da sessão. */
export const SESSION_TTL_MS = 30 * 60 * 1000

/** Validade da cotação. */
export const QUOTE_TTL_MS = 10 * 60 * 1000

/** Tempo até a simulação confirmar ou recusar um pagamento. */
export const PAYMENT_SETTLE_MS = 3000

/** Taxa de rede estimada por rede (Figma: "Taxa de rede 0.016 ETH"). */
export const NETWORK_FEES: Record<Network, EthAmount> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}

/** Explorador simulado de cada rede, para o link do recibo. */
export const EXPLORERS: Record<Network, string> = {
  ethereum: 'https://etherscan.io/tx/',
  polygon: 'https://polygonscan.com/tx/',
  solana: 'https://solscan.io/tx/',
}

/** Latências usadas pelos cenários de rede (ms). */
export const LATENCY = {
  default: { min: 80, max: 220 },
  slow: 2500,
  jitter: { min: 100, max: 1800 },
} as const

/** Data de referência das fixtures: datas relativas a ela ficam estáveis entre execuções. */
export const FIXTURE_NOW = Date.parse('2026-11-20T12:00:00.000Z')

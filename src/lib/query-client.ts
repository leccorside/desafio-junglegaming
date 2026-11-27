import { QueryClient } from '@tanstack/react-query'

import { isApiError } from '@/api/errors'

/** Tentativas extras para falhas transitórias (rede, 503). */
export const MAX_QUERY_RETRIES = 2

/**
 * Tentativas extras quando a resposta estoura o tempo. Cada tentativa já custa
 * o timeout inteiro do Axios (15 s): com 2 repetições, o erro só aparecia em
 * cerca de 47 s. Com 1, em cerca de 31 s.
 */
export const MAX_TIMEOUT_RETRIES = 1

/**
 * Repete só o que pode dar certo de novo: erro com `retryable` (rede, timeout,
 * 503). Nunca repete 4xx nem sessão inválida. Timeout repete menos (ver
 * `MAX_TIMEOUT_RETRIES`). Ver docs/STATE_MANAGEMENT.md.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (!isApiError(error) || !error.retryable) return false
  const max = error.code === 'TIMEOUT' ? MAX_TIMEOUT_RETRIES : MAX_QUERY_RETRIES
  return failureCount < max
}

/** A última tentativa falhou por tempo esgotado (para avisar enquanto repete). */
export function isTimeoutError(error: unknown): boolean {
  return isApiError(error) && error.code === 'TIMEOUT'
}

/** Backoff exponencial: 0,5 s, 1 s, 2 s... até 4 s. */
export function retryDelay(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 4000)
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: shouldRetry,
      retryDelay,
    },
    mutations: {
      // Mutations não se repetem sozinhas: a criação de pedido repete com a mesma
      // Idempotency-Key por conta própria (features/checkout).
      retry: false,
    },
  },
})

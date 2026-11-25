import { QueryClient } from '@tanstack/react-query'

import { isApiError } from '@/api/errors'

/** Tentativas extras para falhas transitórias (rede, timeout, 503). */
export const MAX_QUERY_RETRIES = 2

/**
 * Repete só o que pode dar certo de novo: erro com `retryable` (rede, timeout,
 * 503). Nunca repete 4xx nem sessão inválida. Ver docs/STATE_MANAGEMENT.md.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return failureCount < MAX_QUERY_RETRIES && isApiError(error) && error.retryable
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
      // Idempotency-Key por conta própria (Passo 10).
      retry: false,
    },
  },
})

import { QueryClient } from '@tanstack/react-query'

/**
 * Configuração inicial do cache. A política completa (retries por tipo de
 * erro, staleTime por recurso) entra no Passo 4, conforme docs/STATE_MANAGEMENT.md.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})

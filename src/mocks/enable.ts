import { env } from '@/lib/env'

/**
 * Inicia o service worker do MSW antes da primeira renderização, para que
 * nenhuma requisição escape dos mocks. Não faz nada com os mocks desligados.
 */
export async function enableMocking(): Promise<void> {
  if (!env.enableMocks) return

  const { worker } = await import('./browser')
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
  })
}

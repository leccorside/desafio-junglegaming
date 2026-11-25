import { env } from '@/lib/env'

/**
 * Inicia o service worker do MSW antes da primeira renderização, para que
 * nenhuma requisição escape dos mocks. Não faz nada com os mocks desligados.
 * Um `?scenario=` na URL ativa cenários antes da primeira requisição.
 */
export async function enableMocking(): Promise<void> {
  if (!env.enableMocks) return

  const [{ worker }, { applyScenarioFromUrl }] = await Promise.all([
    import('./browser'),
    import('./scenarios'),
  ])
  applyScenarioFromUrl(window.location.search)

  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
  })
}

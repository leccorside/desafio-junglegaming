import { env } from '@/lib/env'

/**
 * Inicia o service worker do MSW antes da primeira renderização, para que
 * nenhuma requisição escape dos mocks. Não faz nada com os mocks desligados.
 *
 * Um `?scenario=` na URL ativa cenários antes da primeira requisição e depois
 * sai da barra de endereço: o próximo reload usa o estado salvo, sem desfazer
 * o que foi escolhido no painel nem redisparar cenários de uso único.
 */
export async function enableMocking(): Promise<void> {
  if (!env.enableMocks) return

  const [{ worker }, { applyScenarioFromUrl, URL_SCENARIO_PARAMS }] = await Promise.all([
    import('./browser'),
    import('./scenarios'),
  ])

  if (applyScenarioFromUrl(window.location.search)) {
    const url = new URL(window.location.href)
    for (const param of URL_SCENARIO_PARAMS) url.searchParams.delete(param)
    window.history.replaceState(window.history.state, '', url)
  }

  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: import.meta.env.PROD,
  })
}

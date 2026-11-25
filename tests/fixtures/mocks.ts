import type { Page } from '@playwright/test'

/**
 * Chamadas à API simulada feitas de dentro da página, para passar pelo service
 * worker do MSW (o `page.request` do Playwright não passa por ele).
 */
export async function apiFetch(
  page: Page,
  method: string,
  path: string,
  options: { body?: unknown; token?: string; cartId?: string } = {},
): Promise<{ status: number; json: unknown }> {
  return page.evaluate(
    async ({ method, path, options }) => {
      const headers: Record<string, string> = {}
      if (options.body !== undefined) headers['Content-Type'] = 'application/json'
      if (options.token) headers.Authorization = `Bearer ${options.token}`
      if (options.cartId) headers['X-Cart-Id'] = options.cartId
      const response = await fetch(`/api${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      })
      const text = await response.text()
      return { status: response.status, json: text ? JSON.parse(text) : null }
    },
    { method, path, options },
  )
}

/** Restaura fixtures e cenário padrão. */
export async function resetMocks(page: Page) {
  await apiFetch(page, 'POST', '/__mocks/reset')
}

/** Ativa cenários pela rota utilitária. */
export async function setScenario(
  page: Page,
  names: string[],
  options: Record<string, unknown> = {},
) {
  await apiFetch(page, 'PUT', '/__mocks/scenario', { body: { names, options } })
}

/** Espera a aplicação montar (o render espera o MSW iniciar). */
export async function waitForApp(page: Page) {
  await page.locator('main#conteudo').waitFor()
}

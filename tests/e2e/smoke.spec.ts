import { expect, test } from '@playwright/test'

test.describe('fumaça', () => {
  test('a aplicação abre com título, idioma e conteúdo principal', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.goto('/')

    await expect(page).toHaveTitle(/KURIO/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
    await expect(page.getByRole('main')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: /dono d/i })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('o service worker do MSW está ativo no build de demonstração', async ({ page }) => {
    await page.goto('/')

    const controlled = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      return registration.active?.scriptURL ?? null
    })

    expect(controlled).toContain('/mockServiceWorker.js')
  })
})

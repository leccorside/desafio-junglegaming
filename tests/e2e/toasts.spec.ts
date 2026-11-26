import { expect, test, type Locator, type Page } from '@playwright/test'

import { submitLogin } from '../fixtures/auth'
import { resetMocks, waitForApp } from '../fixtures/mocks'
import { settledBox } from '../fixtures/wait'

/** O toast de boas-vindas aparece logo depois do login: serve de toast real para medir. */
async function loginAndGetToast(page: Page): Promise<Locator> {
  await page.goto('/')
  await waitForApp(page)
  await resetMocks(page)
  await page.evaluate(() => localStorage.removeItem('kurio:session'))
  await page.goto('/login')
  await submitLogin(page, 'ana@example.com')
  const toast = page.locator('[data-sonner-toast]').filter({ hasText: 'Que bom ver você' })
  await expect(toast).toBeVisible()
  // Espera a animação de entrada terminar (a caixa parar de mexer) antes de medir.
  await settledBox(toast)
  return toast
}

async function box(locator: Locator) {
  const rect = await locator.boundingBox()
  if (!rect) throw new Error('elemento sem caixa')
  return { top: rect.y, bottom: rect.y + rect.height }
}

const bottomBar = (page: Page) => page.getByRole('navigation', { name: 'Navegação inferior' })

test.describe('posição dos toasts', () => {
  test('no mobile, acima da barra inferior e do botão Sair do menu lateral', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, 'só com barra inferior')
    const toast = await loginAndGetToast(page)

    // A barra visível começa onde está o topo do botão central (o elemento mais alto dela).
    const barTop = (await box(bottomBar(page).getByRole('button', { name: 'Abrir menu' }))).top
    expect((await box(toast)).bottom).toBeLessThanOrEqual(barTop)

    await bottomBar(page).getByRole('button', { name: 'Abrir menu' }).click()
    const signOut = page.getByRole('dialog').getByRole('button', { name: 'Sair' })
    await expect(signOut).toBeVisible()
    await expect(toast).toBeVisible()
    expect((await box(toast)).bottom).toBeLessThanOrEqual((await box(signOut)).top)
  })

  test.describe('entre 600 e 767 px', () => {
    // Faixa em que o Sonner já usa o layout de desktop, mas a barra inferior existe.
    test.use({ viewport: { width: 700, height: 900 } })

    test('também fica acima da barra inferior', async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile', 'um viewport só basta')
      const toast = await loginAndGetToast(page)
      const barTop = (await box(bottomBar(page).getByRole('button', { name: 'Abrir menu' }))).top
      expect((await box(toast)).bottom).toBeLessThanOrEqual(barTop)
    })
  })

  test('no desktop, no canto inferior direito', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) < 768, 'só no desktop')
    const toast = await loginAndGetToast(page)
    const viewport = page.viewportSize()!
    const rect = (await toast.boundingBox())!
    // 24 px da base e da direita (padrão do Sonner), com margem para a animação.
    expect(viewport.height - (rect.y + rect.height)).toBeGreaterThanOrEqual(16)
    expect(viewport.height - (rect.y + rect.height)).toBeLessThanOrEqual(40)
    expect(viewport.width - (rect.x + rect.width)).toBeLessThanOrEqual(40)
  })
})

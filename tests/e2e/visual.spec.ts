import { expect, test, type Page } from '@playwright/test'

import { loginViaUi } from '../fixtures/auth'
import { apiFetch, resetMocks, waitForApp } from '../fixtures/mocks'

/**
 * Regressão visual (TESTING.md): início, detalhe, carrinho e pagamento, em
 * desktop e mobile. Dados estáveis (fixtures com semente e data fixas, reset
 * antes de cada teste), animações desligadas, fontes e imagens carregadas e
 * toasts escondidos antes da captura. A captura é da primeira dobra: imagens
 * abaixo dela são `loading="lazy"` e só carregam ao rolar.
 *
 * Baselines em `tests/e2e/__screenshots__`, uma por sistema operacional (a
 * renderização de fontes muda entre Windows e Linux). Atualizar com
 * `npm run test:e2e:update`, revisando a diferença antes de versionar.
 */

const GUEST_CART = '7b6f3c2e-9d1a-4c8b-a5e2-3f4d6b8c0a1e'

const token = (page: Page) =>
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('kurio:session')!) as { token: string }).token,
  )

/** Espera a tela ficar estável: sem carregamento, fontes prontas, imagens visíveis carregadas. */
async function stable(page: Page) {
  await waitForApp(page)
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() =>
    [...document.images]
      .filter((img) => {
        const r = img.getBoundingClientRect()
        return r.bottom > 0 && r.top < window.innerHeight && r.width > 0
      })
      .every((img) => img.complete && img.naturalWidth > 0),
  )
  // Toasts (boas-vindas do login, avisos) e o anel de foco não fazem parte da tela.
  await page.addStyleTag({
    content: '[data-sonner-toaster]{display:none!important} *:focus{outline:none!important}',
  })
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
}

async function snapshot(page: Page, name: string) {
  await stable(page)
  await expect(page).toHaveScreenshot(`${name}.png`, {
    animations: 'disabled',
    caret: 'hide',
    // 0,1% da tela para diferenças de antialiasing. Com 1%, trocar a cor
    // primária passava despercebido em 3 das 8 capturas.
    maxDiffPixelRatio: 0.001,
  })
}

test.describe('regressão visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('início', async ({ page }) => {
    await page.goto('/')
    await snapshot(page, 'inicio')
  })

  test('detalhe do NFT', async ({ page }) => {
    await page.goto('/nft/nft-042')
    await snapshot(page, 'detalhe')
  })

  test('carrinho com dois itens', async ({ page }) => {
    await page.evaluate((id) => localStorage.setItem('kurio:guest-cart-id', id), GUEST_CART)
    for (const body of [
      { nftId: 'nft-042', editionId: 'nft-042-open', quantity: 2 },
      { nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 },
    ]) {
      await apiFetch(page, 'POST', '/cart/items', { cartId: GUEST_CART, body })
    }
    await page.goto('/cart')
    await snapshot(page, 'carrinho')
  })

  test('pagamento', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    const auth = await token(page)
    for (const body of [
      { nftId: 'nft-042', editionId: 'nft-042-open', quantity: 2 },
      { nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 },
    ]) {
      await apiFetch(page, 'POST', '/cart/items', { token: auth, body })
    }
    await page.goto('/checkout')
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
    await snapshot(page, 'pagamento')
  })
})

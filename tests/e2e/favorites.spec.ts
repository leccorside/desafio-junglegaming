import { expect, test, type Page } from '@playwright/test'

import { submitLogin, loginViaUi } from '../fixtures/auth'
import { resetMocks, setScenario, waitForApp } from '../fixtures/mocks'

/** Coração do NFT na tela (botão "Favoritar" no desktop, círculo sobre a imagem no mobile). */
const heart = (page: Page, name: string) =>
  page
    .getByRole('button', {
      name: new RegExp(`^(Entre para favoritar|Adicionar|Tirar) ${name.replace('#', '\\#')}`),
    })
    .filter({ visible: true })

/** Espera a API gravar o favorito: um reload antes disso cancelaria a requisição. */
const favoriteSaved = (page: Page) =>
  page.waitForResponse(
    (response) =>
      /\/api\/me\/favorites\//.test(response.url()) && response.request().method() === 'PUT',
  )

test.describe('favoritos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('visitante no detalhe: entra, volta e o favorito é concluído', async ({ page }) => {
    await page.goto('/nft/nft-009')
    await waitForApp(page)
    await heart(page, 'Sage Nomad #009').click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fnft%2Fnft-009/)

    const saved = favoriteSaved(page)
    await submitLogin(page, 'ana@example.com')
    await expect(page).toHaveURL(/\/nft\/nft-009$/)
    await expect(page.getByText('Sage Nomad #009 adicionado à lista de interesse.')).toBeVisible()
    await expect(heart(page, 'Sage Nomad #009')).toHaveAttribute('aria-pressed', 'true')
    await expect(heart(page, 'Sage Nomad #009')).toBeFocused()
    expect((await saved).status()).toBe(200)

    await page.reload()
    await waitForApp(page)
    await expect(heart(page, 'Sage Nomad #009')).toHaveAttribute('aria-pressed', 'true')
  })

  test('visitante no card abaixo da dobra: volta ao card com o favorito feito', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'O coração no card é do layout mobile')
    await page.goto('/')
    await waitForApp(page)
    const card = heart(page, 'Golden Signal #160')
    await card.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500)
    await card.click()
    await expect(page).toHaveURL(/\/login/)

    const saved = favoriteSaved(page)
    await submitLogin(page, 'ana@example.com')
    await expect(
      page.getByText('Golden Signal #160 adicionado à lista de interesse.'),
    ).toBeVisible()
    expect((await saved).status()).toBe(200)
    await expect(card).toHaveAttribute('aria-pressed', 'true')
    await expect(card).toBeFocused()
    // O card voltou para a tela (e não ficou abaixo, com a página no topo).
    await expect(card).toBeInViewport()
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(500)
  })

  test('NFT que já está na lista só recebe o aviso', async ({ page }) => {
    await page.goto('/nft/nft-042')
    await waitForApp(page)
    await heart(page, 'Emerald Ape #042').click()
    await submitLogin(page, 'ana@example.com')
    await expect(page).toHaveURL(/\/nft\/nft-042$/)
    await expect(
      page.getByText('Emerald Ape #042 já está na sua lista de interesse.'),
    ).toBeVisible()
    await expect(heart(page, 'Emerald Ape #042')).toHaveAttribute('aria-pressed', 'true')
  })

  test('visitante que desiste do login não favorita num login feito depois', async ({
    page,
    isMobile,
  }) => {
    await page.goto('/nft/nft-009')
    await waitForApp(page)
    await heart(page, 'Sage Nomad #009').click()
    await expect(page).toHaveURL(/\/login/)

    const pending = () => page.evaluate(() => sessionStorage.getItem('kurio:pending-favorite'))
    expect(await pending()).toContain('nft-009')

    // Desiste: fecha o modal (desktop) ou volta ao início pelo logo (mobile).
    if (isMobile) {
      await page.getByRole('link', { name: /KURIO/ }).first().click()
    } else {
      await expect(page.getByRole('dialog', { name: 'Entrar' })).toBeVisible()
      await page.keyboard.press('Escape')
    }
    await expect(page).toHaveURL(/\/$/)
    await expect.poll(pending).toBeNull()

    await loginViaUi(page, 'ana@example.com')
    await page.goto('/nft/nft-009')
    await waitForApp(page)
    await expect(heart(page, 'Sage Nomad #009')).toHaveAttribute('aria-pressed', 'false')
    expect(await page.getByText('adicionado à lista de interesse').count()).toBe(0)
  })

  test('favoritar persiste por usuário e aparece na lista de interesse', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    await page.goto('/nft/nft-009')
    await waitForApp(page)
    const button = heart(page, 'Sage Nomad #009')
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    const saved = favoriteSaved(page)
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(button).toHaveAccessibleName('Tirar Sage Nomad #009 da lista de interesse')
    expect((await saved).status()).toBe(200)

    await page.reload()
    await waitForApp(page)
    await expect(heart(page, 'Sage Nomad #009')).toHaveAttribute('aria-pressed', 'true')

    await page.goto('/favorites')
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Lista de interesse' })).toBeVisible()
    await expect(page.getByText('3 NFTs salvos')).toBeVisible()
    await expect(page.getByRole('link', { name: /Sage Nomad #009/ })).toBeVisible()

    // Outra conta não vê os favoritos da Ana.
    await page.evaluate(() => localStorage.removeItem('kurio:session'))
    await loginViaUi(page, 'bruno@example.com')
    await page.goto('/favorites')
    await waitForApp(page)
    await expect(page.getByText('1 NFT salvo')).toBeVisible()
    await expect(page.getByRole('link', { name: /Golden Beat #207/ })).toBeVisible()
    expect(await page.getByRole('link', { name: /Sage Nomad #009/ }).count()).toBe(0)
  })

  test('falha da API desfaz o favorito com aviso, e a nova tentativa funciona', async ({
    page,
  }) => {
    await loginViaUi(page, 'ana@example.com')
    await page.goto('/nft/nft-009')
    await waitForApp(page)
    const button = heart(page, 'Sage Nomad #009')
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    // Resposta lenta e com falha: dá para ver a mudança otimista antes do rollback.
    await setScenario(page, ['favorite-fails', 'slow'], { routes: ['/me/favorites'] })
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(
      page.getByText(
        'Não foi possível adicionar Sage Nomad #009 à lista de interesse. Tente de novo.',
      ),
    ).toBeVisible({ timeout: 10_000 })
    await expect(button).toHaveAttribute('aria-pressed', 'false')

    // Falha ao desfavoritar também volta ao estado anterior (Emerald Ape já é favorito).
    await page.goto('/nft/nft-042')
    await waitForApp(page)
    const emerald = heart(page, 'Emerald Ape #042')
    await expect(emerald).toHaveAttribute('aria-pressed', 'true', { timeout: 10_000 })
    await emerald.click()
    await expect(emerald).toHaveAttribute('aria-pressed', 'false')
    await expect(
      page.getByText(
        'Não foi possível tirar Emerald Ape #042 da lista de interesse. Tente de novo.',
      ),
    ).toBeVisible({ timeout: 10_000 })
    await expect(emerald).toHaveAttribute('aria-pressed', 'true')

    // A API volta: a nova tentativa grava e sobrevive ao refresh.
    await setScenario(page, [])
    await page.goto('/nft/nft-009')
    await waitForApp(page)
    const saved = favoriteSaved(page)
    await heart(page, 'Sage Nomad #009').click()
    await expect(heart(page, 'Sage Nomad #009')).toHaveAttribute('aria-pressed', 'true')
    expect((await saved).status()).toBe(200)
    await page.reload()
    await waitForApp(page)
    await expect(heart(page, 'Sage Nomad #009')).toHaveAttribute('aria-pressed', 'true')
  })

  test('no mobile, o coração do card do catálogo favorita sem abrir o detalhe', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'O coração no card é do layout mobile')
    await loginViaUi(page, 'ana@example.com')
    await page.goto('/')
    await waitForApp(page)
    const card = heart(page, 'Emerald Ape #042').first()
    await expect(card).toHaveAttribute('aria-pressed', 'true')
    await card.click()
    await expect(card).toHaveAttribute('aria-pressed', 'false')
    await expect(page).toHaveURL(/\/$/)
  })
})

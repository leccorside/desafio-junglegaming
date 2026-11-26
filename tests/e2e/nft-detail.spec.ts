import { expect, test, type Page } from '@playwright/test'

import { apiFetch, resetMocks, waitForApp } from '../fixtures/mocks'
import { settledBox } from '../fixtures/wait'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const quantity = (page: Page) =>
  page.getByRole('spinbutton', { name: /^(Quantidade|Qtd\.)$/ }).filter({ visible: true })
const edition = (page: Page, name: RegExp) => page.getByRole('radio', { name })

test.describe('detalhe do NFT', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('acesso direto e refresh mostram o NFT com a edição padrão', async ({ page }) => {
    await page.goto('/nft/nft-042')
    await waitForApp(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    // A padrão é a edição mais barata disponível, o mesmo preço do card.
    await expect(edition(page, /^Edição aberta, 1.19 ETH$/)).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByText('ID do token:')).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Detalhes do NFT' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    await page.reload()
    await waitForApp(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
  })

  test('NFT inexistente mostra a página própria de não encontrado', async ({ page, isMobile }) => {
    await page.goto('/nft/nft-000')
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'NFT não encontrado' })).toBeVisible()
    // Sem detalhe não há barra de compra: no mobile, a de navegação continua.
    if (isMobile) {
      await expect(page.getByRole('navigation', { name: 'Navegação inferior' })).toBeVisible()
    }
    await page.getByRole('link', { name: 'Explorar o catálogo' }).click()
    await expect(page).toHaveURL(/\/#catalogo$/)
  })

  test('edição esgotada ou indisponível não pode ser escolhida', async ({ page }) => {
    await page.goto('/nft/nft-552')
    await waitForApp(page)
    const soldOut = edition(page, /^Edição 1\/1, .*esgotada$/)
    const unavailable = edition(page, /^Edição 1\/10, .*indisponível$/)
    await expect(soldOut).toHaveAttribute('aria-disabled', 'true')
    await expect(unavailable).toHaveAttribute('aria-disabled', 'true')
    await soldOut.click({ force: true })
    await expect(soldOut).toHaveAttribute('aria-checked', 'false')

    // A escolha vai para a URL; as setas andam só entre as edições disponíveis.
    await edition(page, /^Edição 1\/50/).click()
    await expect(page).toHaveURL(/edition=nft-552-1-50/)
    await expect(edition(page, /^Edição 1\/50/)).toBeFocused()
    await page.keyboard.press('ArrowRight')
    await expect(edition(page, /^Edição aberta/)).toHaveAttribute('aria-checked', 'true')
    await page.keyboard.press('ArrowRight')
    await expect(edition(page, /^Edição 1\/50/)).toHaveAttribute('aria-checked', 'true')

    // Link para uma edição esgotada: cai na padrão com aviso.
    await page.goto('/nft/nft-552?edition=nft-552-1-1')
    await waitForApp(page)
    await expect(page.getByText('A edição 1/1 está esgotada. Mostrando a edição')).toBeVisible()
    await expect(soldOut).toHaveAttribute('aria-checked', 'false')
  })

  test('a quantidade para no limite disponível da edição', async ({ page }) => {
    await page.goto('/nft/nft-088')
    await waitForApp(page)
    await edition(page, /^Edição 1\/10/).click()
    const input = quantity(page)
    await expect(input).toHaveValue('1')
    const plus = page.getByRole('button', { name: 'Aumentar quantidade' }).filter({ visible: true })
    await plus.click()
    await expect(input).toHaveValue('2')
    await expect(plus).toBeDisabled()
    await expect(
      page
        .getByText(/^(Máximo disponível: 2 unidades\.|Máximo: 2 disponíveis\.)$/)
        .filter({ visible: true }),
    ).toBeVisible()

    // Digitar além do limite volta para o máximo; trocar de edição volta para 1.
    await input.fill('9')
    await input.press('Enter')
    await expect(input).toHaveValue('2')
    await edition(page, /^Edição 1\/50/).click()
    await expect(input).toHaveValue('1')
  })

  test('NFT todo esgotado não deixa comprar', async ({ page }) => {
    await page.goto('/nft/nft-610')
    await waitForApp(page)
    await expect(
      page.getByText('Todas as edições deste NFT estão esgotadas ou indisponíveis.'),
    ).toBeVisible()
    const buy = page.getByRole('button', { name: /^(COMPRAR|Esgotado)$/ }).filter({ visible: true })
    await expect(buy).toBeDisabled()
  })

  test('galeria: miniaturas navegáveis pelo teclado', async ({ page, isMobile }) => {
    test.skip(isMobile, 'As miniaturas só aparecem a partir de 768 px; no mobile são pontos')
    await page.goto('/nft/nft-042')
    await waitForApp(page)
    const thumbs = page.getByRole('list', { name: 'Miniaturas' }).getByRole('button')
    const count = await thumbs.count()
    test.skip(count < 2, 'NFT com uma imagem só')
    await expect(thumbs.first()).toHaveAttribute('aria-current', 'true')
    await thumbs.first().focus()
    await page.keyboard.press('ArrowDown')
    await expect(thumbs.nth(1)).toBeFocused()
    await expect(thumbs.nth(1)).toHaveAttribute('aria-current', 'true')
    await page.keyboard.press('End')
    await expect(thumbs.nth(count - 1)).toHaveAttribute('aria-current', 'true')
    await page.keyboard.press('ArrowDown')
    await expect(thumbs.first()).toHaveAttribute('aria-current', 'true')
  })

  test('comprar adiciona a edição escolhida ao carrinho', async ({ page, isMobile }) => {
    await page.goto('/nft/nft-042')
    await waitForApp(page)
    await edition(page, /^Edição 1\/10/).click()
    await page
      .getByRole('button', { name: 'Aumentar quantidade' })
      .filter({ visible: true })
      .click()

    if (isMobile) {
      // O botão do carrinho só adiciona e oferece o atalho.
      await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
      await expect(page.getByText('Emerald Ape #042 (1/10) adicionado ao carrinho.')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Ver carrinho' })).toBeVisible()
      await expect(page).toHaveURL(/\/nft\/nft-042/)
    } else {
      await page.getByRole('button', { name: 'COMPRAR', exact: true }).click()
      await expect(page).toHaveURL(/\/cart$/)
      await expect(page.getByText('Emerald Ape #042 (1/10) adicionado ao carrinho.')).toBeVisible()
    }

    const cartId = await page.evaluate(() => localStorage.getItem('kurio:guest-cart-id') ?? '')
    const cart = (await apiFetch(page, 'GET', '/cart', { cartId })).json as Json
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0]).toMatchObject({ editionId: 'nft-042-1-10', quantity: 2 })
  })

  test('no mobile, no limite da quantidade, preço e toast não colidem com a barra de compra', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Barra de compra só abaixo de 768 px')
    // Edição aberta: 999 unidades, o maior número do aviso.
    await page.goto('/nft/nft-552')
    await waitForApp(page)
    const input = page.getByRole('spinbutton', { name: 'Qtd.' })
    await input.fill('999')
    await input.press('Enter')
    await expect(page.getByText('Máximo: 999 disponíveis.')).toBeVisible()

    const bar = page
      .getByRole('button', { name: 'Comprar NFT', exact: true })
      .locator('xpath=ancestor::div[contains(@class,"fixed")][1]')
    const barBox = (await bar.boundingBox())!
    // Preço numa linha só e a barra com a altura prevista (164 px).
    const price = bar.getByText(/ETH$/)
    expect((await price.boundingBox())!.height).toBeLessThan(40)
    expect(barBox.height).toBeLessThanOrEqual(164)

    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    const toast = page.locator('[data-sonner-toast]').first()
    await expect(toast).toBeVisible()
    // Mede depois da animação de entrada do Sonner (a caixa parar de mexer).
    const toastBox = await settledBox(toast)
    expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(barBox.y - 8)
  })

  test('no mobile, a barra de compra fica no lugar da barra de navegação', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Barra de compra só abaixo de 768 px')
    await page.goto('/nft/nft-042')
    await waitForApp(page)
    await expect(page.getByRole('navigation', { name: 'Navegação inferior' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Comprar NFT', exact: true })).toBeVisible()
    // Voltar sem histórico leva ao início.
    await page.getByRole('button', { name: 'Voltar' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('navigation', { name: 'Navegação inferior' })).toBeVisible()
  })
})

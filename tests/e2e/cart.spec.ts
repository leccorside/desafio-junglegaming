import { expect, test, type Page } from '@playwright/test'

import { formatEth } from '../../src/lib/eth'
import { loginViaUi, PASSWORD, submitLogin } from '../fixtures/auth'
import { apiFetch, resetMocks, waitForApp } from '../fixtures/mocks'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const GUEST_CART = '7b6f3c2e-9d1a-4c8b-a5e2-3f4d6b8c0a1e'

/** Carrinho de visitante com ID conhecido, montado direto pela API simulada. */
async function guestCartWith(
  page: Page,
  items: { nftId: string; editionId: string; quantity: number }[],
) {
  await page.evaluate((id) => localStorage.setItem('kurio:guest-cart-id', id), GUEST_CART)
  for (const body of items) {
    const { status } = await apiFetch(page, 'POST', '/cart/items', { body, cartId: GUEST_CART })
    expect(status).toBe(200)
  }
}

/** Cotação da API para o carrinho atual (a referência dos valores na tela). */
async function quoteFor(page: Page, auth: { token?: string; cartId?: string }) {
  return (await apiFetch(page, 'POST', '/quotes', { body: { network: 'ethereum' }, ...auth }))
    .json as Json
}

/** O mesmo `formatEth` da aplicação: a tela precisa mostrar exatamente a cotação. */
const eth = (value: string) => formatEth(value)

const summary = (page: Page) =>
  page.getByRole('region', { name: /Resumo/ }).filter({ visible: true })
const row = (page: Page, name: string) =>
  page
    .getByRole('list', { name: 'Itens do carrinho' })
    .getByRole('listitem')
    .filter({ hasText: name })

async function expectTotals(page: Page, quote: Json) {
  const box = summary(page)
  await expect(box.locator('dd:not([data-summary-hint])').nth(0)).toHaveText(eth(quote.subtotal))
  await expect(box.locator('dd:not([data-summary-hint])').nth(2)).toHaveText(eth(quote.networkFee))
  await expect(box.locator('dd:not([data-summary-hint])').nth(3)).toHaveText(eth(quote.total))
}

test.describe('carrinho', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('carrinho vazio mostra o caminho de volta ao catálogo', async ({ page }) => {
    await page.goto('/cart')
    await waitForApp(page)
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
    await page.getByRole('link', { name: 'Explorar o catálogo' }).click()
    await expect(page).toHaveURL(/\/#catalogo$/)
  })

  test('quantidades, totais da cotação e persistência depois do refresh', async ({
    page,
    isMobile,
  }) => {
    await guestCartWith(page, [
      { nftId: 'nft-042', editionId: 'nft-042-1-50', quantity: 1 },
      { nftId: 'nft-314', editionId: 'nft-314-open', quantity: 2 },
    ])
    await page.goto('/cart')
    await waitForApp(page)
    await expect(row(page, 'Emerald Ape #042')).toBeVisible()
    await expectTotals(page, await quoteFor(page, { cartId: GUEST_CART }))

    // Aumenta e diminui: cada mudança vai à API e o resumo segue a cotação nova.
    const emerald = row(page, 'Emerald Ape #042')
    await emerald.getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' }).click()
    await expect(emerald.getByRole('spinbutton')).toHaveValue('2')
    await expectTotals(page, await quoteFor(page, { cartId: GUEST_CART }))

    const violet = row(page, 'Violet Nomad #314')
    await violet.getByRole('button', { name: 'Diminuir quantidade de Violet Nomad #314' }).click()
    await expect(violet.getByRole('spinbutton')).toHaveValue('1')
    await expectTotals(page, await quoteFor(page, { cartId: GUEST_CART }))

    // O contador do header segue o total de unidades (2 + 1). No mobile, a
    // barra com o carrinho não aparece nesta tela (o resumo fica no lugar).
    if (!isMobile) {
      await expect(page.getByRole('link', { name: 'Carrinho, 3 unidades' })).toBeVisible()
    }

    // Refresh: o carrinho do visitante continua igual.
    await page.reload()
    await waitForApp(page)
    await expect(row(page, 'Emerald Ape #042').getByRole('spinbutton')).toHaveValue('2')
    await expect(row(page, 'Violet Nomad #314').getByRole('spinbutton')).toHaveValue('1')
    await expectTotals(page, await quoteFor(page, { cartId: GUEST_CART }))
  })

  test('a quantidade para no estoque da edição', async ({ page }) => {
    // Ivory Baron #088, edição 1/10: só 2 unidades.
    await guestCartWith(page, [{ nftId: 'nft-088', editionId: 'nft-088-1-10', quantity: 1 }])
    await page.goto('/cart')
    await waitForApp(page)
    const ivory = row(page, 'Ivory Baron #088')
    const plus = ivory.getByRole('button', { name: 'Aumentar quantidade de Ivory Baron #088' })
    await plus.click()
    await expect(ivory.getByRole('spinbutton')).toHaveValue('2')
    await expect(plus).toBeDisabled()

    // Digitar além do limite volta ao máximo, sem erro da API.
    const input = ivory.getByRole('spinbutton')
    await input.fill('9')
    await input.press('Enter')
    await expect(input).toHaveValue('2')
    const cart = (await apiFetch(page, 'GET', '/cart', { cartId: GUEST_CART })).json as Json
    expect(cart.items[0].quantity).toBe(2)
  })

  test('remover com desfazer', async ({ page }) => {
    await guestCartWith(page, [
      { nftId: 'nft-042', editionId: 'nft-042-1-50', quantity: 3 },
      { nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 },
    ])
    await page.goto('/cart')
    await waitForApp(page)
    await row(page, 'Emerald Ape #042')
      .getByRole('button', { name: 'Remover Emerald Ape #042 (edição 1/50) do carrinho' })
      .click()
    await expect(page.getByText('Emerald Ape #042 (edição 1/50) saiu do carrinho.')).toBeVisible()
    await expect(row(page, 'Emerald Ape #042')).toHaveCount(0)
    await expectTotals(page, await quoteFor(page, { cartId: GUEST_CART }))

    await page.getByRole('button', { name: 'Desfazer' }).click()
    await expect(row(page, 'Emerald Ape #042').getByRole('spinbutton')).toHaveValue('3')
    await expectTotals(page, await quoteFor(page, { cartId: GUEST_CART }))
  })

  test('cupom: inválido e expirado no campo; válido entra no desconto e pode sair', async ({
    page,
  }) => {
    await guestCartWith(page, [{ nftId: 'nft-314', editionId: 'nft-314-open', quantity: 2 }])
    await page.goto('/cart')
    await waitForApp(page)
    const box = summary(page)
    const field = box.getByRole('textbox', { name: 'Código promocional' })
    const apply = box.getByRole('button', { name: 'Aplicar' })

    await field.fill('nada')
    await apply.click()
    await expect(box.getByRole('alert')).toHaveText('Código promocional inválido.')
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription('Código promocional inválido.')

    await field.fill('expirado')
    await apply.click()
    await expect(box.getByRole('alert')).toHaveText('Este código promocional expirou.')

    // Cupom recusado não muda o carrinho.
    let cart = (await apiFetch(page, 'GET', '/cart', { cartId: GUEST_CART })).json as Json
    expect(cart.couponCode).toBeNull()

    await field.fill('bemvindo10')
    await apply.click()
    await expect(page.getByText('Cupom BEMVINDO10 aplicado.')).toBeVisible()
    await expect(box.getByText('Cupom BEMVINDO10 aplicado')).toBeVisible()
    const quote = await quoteFor(page, { cartId: GUEST_CART })
    expect(quote.discount).not.toBe('0')
    await expect(box.getByRole('term').nth(1)).toHaveText('Desconto (BEMVINDO10)')
    await expect(box.locator('dd:not([data-summary-hint])').nth(1)).toHaveText(
      `(-) ${eth(quote.discount)}`,
    )
    await expectTotals(page, quote)

    // Refresh mantém o cupom; remover volta ao total sem desconto.
    await page.reload()
    await waitForApp(page)
    await summary(page).getByRole('button', { name: 'Remover cupom' }).click()
    await expect(page.getByText('Cupom BEMVINDO10 removido.')).toBeVisible()
    cart = (await apiFetch(page, 'GET', '/cart', { cartId: GUEST_CART })).json as Json
    expect(cart.couponCode).toBeNull()
    await expectTotals(page, await quoteFor(page, { cartId: GUEST_CART }))
  })

  test('no login, o carrinho do visitante entra no da conta, com aviso do que não coube', async ({
    page,
  }) => {
    // A Ana já tem 1 unidade da 1/10 do Ivory Baron (estoque: 2).
    const login = await apiFetch(page, 'POST', '/auth/login', {
      body: { email: 'ana@example.com', password: PASSWORD },
    })
    const token = (login.json as Json).token as string
    await apiFetch(page, 'POST', '/cart/items', {
      token,
      body: { nftId: 'nft-088', editionId: 'nft-088-1-10', quantity: 1 },
    })

    // Como visitante: as 2 unidades da mesma edição e outro NFT.
    await guestCartWith(page, [
      { nftId: 'nft-088', editionId: 'nft-088-1-10', quantity: 2 },
      { nftId: 'nft-042', editionId: 'nft-042-1-50', quantity: 1 },
    ])
    await page.goto('/cart')
    await waitForApp(page)
    await expect(row(page, 'Ivory Baron #088')).toBeVisible()

    await page.goto('/login?redirect=%2Fcart')
    await submitLogin(page, 'ana@example.com')
    await expect(page).toHaveURL(/\/cart$/)
    await expect(
      page.getByText(
        'Alguns itens do carrinho não couberam no estoque. Ivory Baron #088: entraram 1 de 2.',
      ),
    ).toBeVisible()
    await expect(row(page, 'Ivory Baron #088').getByRole('spinbutton')).toHaveValue('2')
    await expect(row(page, 'Emerald Ape #042').getByRole('spinbutton')).toHaveValue('1')

    // O carrinho de visitante foi absorvido: o próximo visitante começa vazio.
    expect(await page.evaluate(() => localStorage.getItem('kurio:guest-cart-id'))).not.toBe(
      GUEST_CART,
    )
    const session = await page.evaluate(
      () =>
        (JSON.parse(localStorage.getItem('kurio:session') ?? 'null') as { token: string }).token,
    )
    await expectTotals(page, await quoteFor(page, { token: session }))

    // Refresh com a conta: continua igual.
    await page.reload()
    await waitForApp(page)
    await expect(row(page, 'Ivory Baron #088').getByRole('spinbutton')).toHaveValue('2')
  })

  test('item esgotado bloqueia a finalização até ser removido', async ({ page }) => {
    await guestCartWith(page, [
      { nftId: 'nft-042', editionId: 'nft-042-1-50', quantity: 1 },
      { nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 },
    ])
    // A edição esgota depois de entrar no carrinho.
    await apiFetch(page, 'POST', '/__mocks/nfts/nft-042/update', {
      body: { editionId: 'nft-042-1-50', available: 0 },
    })
    await page.goto('/cart')
    await waitForApp(page)
    await expect(page.getByText('Esgotado: remova do carrinho para finalizar.')).toBeVisible()
    const finish = summary(page).getByRole('button', { name: 'Conectar e finalizar' })
    await expect(finish).toBeDisabled()

    await row(page, 'Emerald Ape #042')
      .getByRole('button', { name: /^Remover / })
      .click()
    await expect(finish).toBeEnabled()
    await expectTotals(page, await quoteFor(page, { cartId: GUEST_CART }))
  })

  test('finalizar como visitante pede login e volta ao pagamento', async ({ page }) => {
    await guestCartWith(page, [{ nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 }])
    await page.goto('/cart')
    await waitForApp(page)
    await summary(page).getByRole('button', { name: 'Conectar e finalizar' }).click()
    await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
    await submitLogin(page, 'ana@example.com')
    await expect(page).toHaveURL(/\/checkout$/)
  })

  test('no mobile, o resumo fica na base e os avisos vão para o topo', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Layout mobile')
    await guestCartWith(page, [{ nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 }])
    await page.goto('/cart')
    await waitForApp(page)
    await expect(page.getByRole('navigation', { name: 'Navegação inferior' })).toHaveCount(0)
    const finish = summary(page).getByRole('button', { name: 'Conectar e finalizar' })
    await expect(finish).toBeInViewport()

    await summary(page).getByRole('textbox', { name: 'Código promocional' }).fill('bemvindo10')
    await summary(page).getByRole('button', { name: 'Aplicar' }).click()
    const toast = page.locator('[data-sonner-toast]').first()
    await expect(toast).toBeVisible()
    const toastBox = (await toast.boundingBox())!
    const finishBox = (await finish.boundingBox())!
    expect(toastBox.y + toastBox.height).toBeLessThan(finishBox.y)
    expect(toastBox.y).toBeLessThan(200)
  })

  test('o carrinho da conta não aparece para outra conta', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    await page.goto('/nft/nft-314')
    await waitForApp(page)
    await page
      .getByRole('button', { name: /^(COMPRAR|Adicionar ao carrinho)$/ })
      .filter({ visible: true })
      .first()
      .click()
    await expect(page.getByText(/adicionado ao carrinho/)).toBeVisible()

    await page.evaluate(() => localStorage.removeItem('kurio:session'))
    await loginViaUi(page, 'bruno@example.com')
    await page.goto('/cart')
    await waitForApp(page)
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  })
})

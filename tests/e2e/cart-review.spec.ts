import { expect, test, type Page } from '@playwright/test'

import { loginViaUi, submitLogin, trackApi } from '../fixtures/auth'
import { apiFetch, resetMocks, setScenario, waitForApp } from '../fixtures/mocks'
import { settledBox } from '../fixtures/wait'

/**
 * Provas das correções do code review do Passo 7 (um teste por achado).
 * Os demais fluxos do carrinho ficam em cart.spec.ts.
 */

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

const GUEST_CART = '3c1d5e8a-2b4f-4c6d-9e7a-1f2b3c4d5e6f'

async function guestCartWith(
  page: Page,
  items: { nftId: string; editionId: string; quantity: number }[],
) {
  await page.evaluate((id) => localStorage.setItem('kurio:guest-cart-id', id), GUEST_CART)
  for (const body of items) {
    expect((await apiFetch(page, 'POST', '/cart/items', { body, cartId: GUEST_CART })).status).toBe(
      200,
    )
  }
}

const summary = (page: Page) =>
  page.getByRole('region', { name: /Resumo/ }).filter({ visible: true })
const row = (page: Page, name: string) =>
  page
    .getByRole('list', { name: 'Itens do carrinho' })
    .getByRole('listitem')
    .filter({ hasText: name })

/** Conta as requisições de um tipo feitas a partir de agora. */
function countRequests(page: Page, method: string, path: RegExp) {
  const seen: string[] = []
  page.on('request', (request) => {
    if (request.method() === method && path.test(new URL(request.url()).pathname)) {
      seen.push(request.url())
    }
  })
  return seen
}

async function openCart(page: Page) {
  await page.goto('/cart')
  await waitForApp(page)
  await expect(page.getByRole('list', { name: 'Itens do carrinho' })).toBeVisible()
  const api = trackApi(page)
  await api.idle()
  api.dispose()
}

test.describe('carrinho: correções do code review', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('"Desfazer" avisa quando o item volta e quando não dá para devolver', async ({ page }) => {
    await guestCartWith(page, [
      { nftId: 'nft-042', editionId: 'nft-042-1-50', quantity: 2 },
      { nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 },
    ])
    await openCart(page)
    const removeEmerald = () =>
      row(page, 'Emerald Ape #042')
        .getByRole('button', { name: /^Remover / })
        .click()

    await removeEmerald()
    await page.getByRole('button', { name: 'Desfazer' }).click()
    await expect(page.getByText('Emerald Ape #042 (edição 1/50) voltou ao carrinho.')).toBeVisible()
    await expect(row(page, 'Emerald Ape #042').getByRole('spinbutton')).toHaveValue('2')

    // Remove de novo e a edição esgota antes do "Desfazer".
    await removeEmerald()
    await expect(row(page, 'Emerald Ape #042')).toHaveCount(0)
    await apiFetch(page, 'POST', '/__mocks/nfts/nft-042/update', {
      body: { editionId: 'nft-042-1-50', available: 0 },
    })
    await page.getByRole('button', { name: 'Desfazer' }).click()
    await expect(
      page.getByText(/^Não foi possível devolver Emerald Ape #042 \(edição 1\/50\) ao carrinho\./),
    ).toBeVisible()
    await expect(row(page, 'Emerald Ape #042')).toHaveCount(0)
  })

  test('com uma mudança pendente, o campo não envia outra em paralelo', async ({ page }) => {
    await guestCartWith(page, [{ nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 }])
    await openCart(page)
    const patches = countRequests(page, 'PATCH', /^\/api\/cart\/items\//)
    await setScenario(page, ['slow'], { routes: ['/cart'] })

    const violet = row(page, 'Violet Nomad #314')
    await violet.getByRole('button', { name: 'Aumentar quantidade de Violet Nomad #314' }).click()
    await expect(violet).toHaveAttribute('aria-busy', 'true')
    // Valor digitado e saída do campo durante a espera (como quem digitou antes
    // de o campo ficar só leitura): não pode virar um segundo PATCH.
    await violet.getByRole('spinbutton').evaluate((input: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, '5')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
    })
    await expect(violet).not.toHaveAttribute('aria-busy', 'true', { timeout: 10_000 })
    expect(patches).toHaveLength(1)
    await expect(violet.getByRole('spinbutton')).toHaveValue('2')
  })

  test('uma mudança pede a cotação uma vez só', async ({ page }) => {
    await guestCartWith(page, [{ nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 }])
    await openCart(page)
    const quotes = countRequests(page, 'POST', /^\/api\/quotes$/)
    const api = trackApi(page)
    await row(page, 'Violet Nomad #314')
      .getByRole('button', { name: 'Aumentar quantidade de Violet Nomad #314' })
      .click()
    await expect(row(page, 'Violet Nomad #314').getByRole('spinbutton')).toHaveValue('2')
    await api.idle()
    api.dispose()
    expect(quotes).toHaveLength(1)
  })

  test('"Conectar e finalizar" espera a mudança pendente terminar', async ({ page }) => {
    await guestCartWith(page, [{ nftId: 'nft-314', editionId: 'nft-314-open', quantity: 3 }])
    await openCart(page)
    const finish = summary(page).getByRole('button', { name: 'Conectar e finalizar' })
    await expect(finish).toBeEnabled()
    await setScenario(page, ['slow'], { routes: ['/cart'] })
    await row(page, 'Violet Nomad #314')
      .getByRole('button', { name: 'Diminuir quantidade de Violet Nomad #314' })
      .click()
    await expect(finish).toBeDisabled()
    await expect(finish).toBeEnabled({ timeout: 10_000 })
  })

  test('no login, o carrinho juntado aparece sem voltar ao skeleton', async ({ page }) => {
    await guestCartWith(page, [{ nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 }])
    await page.goto('/login?redirect=%2Fcart')
    await waitForApp(page)
    // A partir do envio do login: o skeleton do carrinho chegou a aparecer?
    await page.evaluate(() => {
      const w = window as unknown as { sawCartSkeleton: boolean }
      w.sawCartSkeleton = false
      new MutationObserver(() => {
        if (document.querySelector('[data-cart-skeleton]')) w.sawCartSkeleton = true
      }).observe(document.body, { childList: true, subtree: true })
    })
    await submitLogin(page, 'ana@example.com')
    await expect(page).toHaveURL(/\/cart$/)
    await expect(row(page, 'Violet Nomad #314')).toBeVisible()
    expect(
      await page.evaluate(
        () => (window as unknown as { sawCartSkeleton: boolean }).sawCartSkeleton,
      ),
    ).toBe(false)
  })

  test('respostas fora de ordem não desfazem a mudança mais nova', async ({ page }) => {
    // Latência variável: duas mudanças em itens diferentes podem voltar trocadas.
    await guestCartWith(page, [
      { nftId: 'nft-042', editionId: 'nft-042-1-50', quantity: 1 },
      { nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 },
      { nftId: 'nft-207', editionId: 'nft-207-open', quantity: 1 },
    ])
    await openCart(page)
    await setScenario(page, ['jitter'], { routes: ['/cart'], seed: 11 })
    const api = trackApi(page)
    await row(page, 'Emerald Ape #042')
      .getByRole('button', { name: 'Aumentar quantidade de Emerald Ape #042' })
      .click()
    await row(page, 'Violet Nomad #314')
      .getByRole('button', { name: /^Remover / })
      .click()
    await row(page, 'Golden Beat #207')
      .getByRole('button', { name: 'Aumentar quantidade de Golden Beat #207' })
      .click()
    await api.idle(600)
    api.dispose()

    // A tela termina igual ao carrinho da API, qualquer que tenha sido a ordem.
    const cart = (await apiFetch(page, 'GET', '/cart', { cartId: GUEST_CART })).json as Json
    const onScreen = await page
      .getByRole('list', { name: 'Itens do carrinho' })
      .getByRole('listitem')
      .evaluateAll((items) =>
        items.map((item) => ({
          name: [...item.querySelectorAll('a')].find((a) => a.offsetParent)?.textContent,
          quantity: Number(item.querySelector('input')?.value),
        })),
      )
    expect(onScreen).toEqual(
      (cart.items as Json[]).map((item) => ({ name: item.name, quantity: item.quantity })),
    )
    expect(onScreen.map((item) => item.name)).not.toContain('Violet Nomad #314')
  })

  test('no mobile, carrinho vazio mantém a navegação', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Barra inferior só no mobile')
    await page.goto('/cart')
    await waitForApp(page)
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Navegação inferior' })).toBeVisible()
  })

  test('no mobile, o aviso de máximo não aperta o nome do NFT', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Layout mobile')
    // Ivory Baron no máximo da 1/10 (2): o aviso "Máximo: 2 disponíveis." aparece.
    await guestCartWith(page, [
      { nftId: 'nft-042', editionId: 'nft-042-open', quantity: 1 },
      { nftId: 'nft-088', editionId: 'nft-088-1-10', quantity: 2 },
    ])
    await openCart(page)
    await expect(row(page, 'Ivory Baron #088').getByText('Máximo: 2 disponíveis.')).toBeVisible()

    const nameBox = async (name: string) => {
      const link = row(page, name).getByRole('link', { name }).filter({ visible: true })
      return link.evaluate((a) => ({
        width: Math.round(a.getBoundingClientRect().width),
        clamped: a.scrollHeight > a.clientHeight + 1,
      }))
    }
    const emerald = await nameBox('Emerald Ape #042')
    const ivory = await nameBox('Ivory Baron #088')
    // A coluna do nome tem a mesma largura com e sem o aviso, e o nome cabe inteiro.
    expect(ivory.width).toBe(emerald.width)
    expect(ivory.clamped).toBe(false)
    const edition = row(page, 'Ivory Baron #088').getByText('Edição: 1/10')
    const lines = await edition.evaluate((el) =>
      Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)),
    )
    expect(lines).toBe(1)
  })

  test('no mobile, o aviso do carrinho fica abaixo do voltar e do título', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Layout mobile')
    await guestCartWith(page, [{ nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 }])
    await openCart(page)
    await summary(page).getByRole('textbox', { name: 'Código promocional' }).fill('bemvindo10')
    await summary(page).getByRole('button', { name: 'Aplicar' }).click()
    const toast = page.locator('[data-sonner-toast]').first()
    await expect(toast).toBeVisible()
    // Mede depois da animação de entrada do Sonner (a caixa parar de mexer).
    const toastTop = (await settledBox(toast)).y
    const back = (await page.getByRole('button', { name: 'Voltar' }).boundingBox())!
    const title = (await page.getByRole('heading', { name: 'Carrinho de NFTs' }).boundingBox())!
    expect(toastTop).toBeGreaterThanOrEqual(back.y + back.height)
    expect(toastTop).toBeGreaterThanOrEqual(title.y + title.height)
  })

  test('o login dos testes não deixa listeners na página', async ({ page }) => {
    // A página é um EventEmitter; o tipo público do Playwright não expõe a contagem.
    const listeners = () =>
      (page as unknown as { listenerCount(event: string): number }).listenerCount('request')
    const before = listeners()
    await loginViaUi(page, 'ana@example.com')
    expect(listeners()).toBe(before)
  })
})

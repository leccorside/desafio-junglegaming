import { expect, test, type Page } from '@playwright/test'

import { PASSWORD, isMobileViewport, loginViaUi, submitLogin } from '../fixtures/auth'
import { apiFetch, resetMocks, setScenario, waitForApp } from '../fixtures/mocks'

/**
 * Pagamento e pedido (itens 7, 9 e 10 do enunciado): revisão antes de pagar,
 * cotação revalidada, idempotência (clique repetido, timeout, refresh),
 * estados pendente/confirmado/recusado e queda de conexão.
 */

type OrderJson = {
  id: string
  status: string
  snapshot: { total: string; items: { nftId: string; unitPrice: string }[] }
}

const token = (page: Page) =>
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('kurio:session')!) as { token: string }).token,
  )

async function orders(page: Page): Promise<OrderJson[]> {
  return (
    (await apiFetch(page, 'GET', '/orders', { token: await token(page) })).json as {
      items: OrderJson[]
    }
  ).items
}

/** Ana logada, com o Emerald Ape (2) e o Violet Nomad (1) no carrinho, na tela de pagamento. */
async function openCheckout(page: Page) {
  await loginViaUi(page, 'ana@example.com')
  const auth = await token(page)
  for (const body of [
    { nftId: 'nft-042', editionId: 'nft-042-open', quantity: 2 },
    { nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 },
  ]) {
    await apiFetch(page, 'POST', '/cart/items', { token: auth, body })
  }
  await page.goto('/checkout')
  await waitForApp(page)
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
}

const reviewDialog = (page: Page) => page.getByRole('dialog', { name: 'Revise sua compra' })

async function openReview(page: Page) {
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(reviewDialog(page)).toBeVisible()
}

/** Requisições `POST /api/orders` a partir de agora, com a chave de cada uma. */
function orderPosts(page: Page) {
  const keys: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/orders') {
      keys.push(request.headers()['idempotency-key'] ?? '')
    }
  })
  return keys
}

test.describe('pagamento e pedido', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('compra com revisão: pendente, confirmado pelo evento e carrinho sem os itens comprados', async ({
    page,
  }) => {
    await openCheckout(page)
    await setScenario(page, ['payment-confirmed'], { settleMs: 1500 })
    const before = (await orders(page)).length
    await openReview(page)
    const dialog = reviewDialog(page)
    await expect(page.getByText(/^Carteira conectada: MetaMask/)).toBeAttached()
    await expect(dialog.getByText('3.786 ETH')).toBeVisible()
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()

    await expect(page).toHaveURL(/\/orders\/ord-/)
    await expect(
      page.getByRole('heading', { name: 'Aguardando a confirmação do pagamento' }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Pagamento confirmado' })).toBeVisible()
    await expect(page.getByText('Transação (simulada)')).toBeVisible()
    expect((await orders(page)).length).toBe(before + 1)
    const cart = (await apiFetch(page, 'GET', '/cart', { token: await token(page) })).json as {
      items: unknown[]
    }
    expect(cart.items).toHaveLength(0)
  })

  test('pagamento recusado: motivo, carrinho intacto e "Tentar de novo" volta ao pagamento', async ({
    page,
  }) => {
    await openCheckout(page)
    await setScenario(page, ['payment-rejected'], { settleMs: 500 })
    await openReview(page)
    await reviewDialog(page).getByRole('button', { name: 'Confirmar e pagar' }).click()

    await expect(page.getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    await expect(
      page.getByText(/O pagamento foi recusado pela carteira. Nenhum valor foi cobrado./),
    ).toBeVisible()
    const cart = (await apiFetch(page, 'GET', '/cart', { token: await token(page) })).json as {
      items: { quantity: number }[]
    }
    expect(cart.items.map((i) => i.quantity)).toEqual([2, 1])

    await page.getByRole('link', { name: 'Tentar de novo' }).click()
    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
  })

  test('clique repetido em "Confirmar e pagar" cria um pedido só', async ({ page }) => {
    await openCheckout(page)
    const before = (await orders(page)).length
    await openReview(page)
    const posts = orderPosts(page)
    const confirm = reviewDialog(page).getByRole('button', { name: 'Confirmar e pagar' })
    await confirm.dblclick()
    // Mais um clique logo depois (o botão pode já ter saído com a troca de tela).
    await confirm.click({ force: true, timeout: 500 }).catch(() => {})
    await expect(page).toHaveURL(/\/orders\/ord-/)
    expect(posts).toHaveLength(1)
    expect((await orders(page)).length).toBe(before + 1)
  })

  test('timeout depois de criar o pedido: reenvia com a mesma chave e recupera o mesmo pedido', async ({
    page,
  }) => {
    await openCheckout(page)
    const before = (await orders(page)).length
    await setScenario(page, ['order-timeout'], { settleMs: 60_000 })
    // Relógio controlado: os 15 s do timeout passam sem esperar de verdade.
    await page.clock.install()
    await page.reload()
    await waitForApp(page)
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
    await openReview(page)
    const posts = orderPosts(page)
    await reviewDialog(page).getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(reviewDialog(page).getByText('Enviando o pedido…')).toBeVisible()

    // Os 15 s do timeout passam; a nova tentativa sai sozinha, com a mesma chave
    // (o aviso de nova tentativa dura só o intervalo entre as duas).
    await page.clock.runFor(16_000)
    await page.clock.runFor(1_000)
    await expect(page).toHaveURL(/\/orders\/ord-/)

    expect(posts).toHaveLength(2)
    expect(posts[0]).toBe(posts[1])
    expect((await orders(page)).length).toBe(before + 1)
  })

  test('refresh no meio do envio: a tentativa guardada recupera o pedido sem duplicar', async ({
    page,
  }) => {
    await openCheckout(page)
    const before = (await orders(page)).length
    await setScenario(page, ['order-timeout'], { settleMs: 60_000 })
    await openReview(page)
    const posts = orderPosts(page)
    await reviewDialog(page).getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect.poll(() => posts.length).toBe(1)
    // O MSW roda na página: espera o pedido existir antes de recarregar (a
    // resposta é que nunca chega).
    await expect.poll(async () => (await orders(page)).length).toBe(before + 1)

    await page.reload()
    await waitForApp(page)
    await expect(page.getByText(/Sua última tentativa de compra não terminou/)).toBeVisible()
    await page.getByRole('button', { name: 'Verificar compra' }).click()
    await expect(page).toHaveURL(/\/orders\/ord-/)
    expect(posts).toHaveLength(2)
    expect(posts[0]).toBe(posts[1])
    expect((await orders(page)).length).toBe(before + 1)
  })

  test('cotação desatualizada na API bloqueia a confirmação até a pessoa aceitar os novos valores', async ({
    page,
  }) => {
    await openCheckout(page)
    await setScenario(page, ['price-changed-on-checkout'])
    const before = (await orders(page)).length
    await openReview(page)
    const dialog = reviewDialog(page)
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()

    const alert = dialog.getByRole('alert').filter({ hasText: 'Os valores mudaram' })
    await expect(alert).toContainText('Emerald Ape #042: o preço passou de 1.19 ETH para 1.31 ETH.')
    expect((await orders(page)).length).toBe(before)

    await dialog.getByRole('button', { name: 'Confirmar com os novos valores' }).click()
    await expect(page).toHaveURL(/\/orders\/ord-/)
    const created = (await orders(page))[0]!
    expect(created.snapshot.items.find((i) => i.nftId === 'nft-042')?.unitPrice).toBe('1.31')
  })

  test('preço muda em tempo real com a revisão aberta: diferença na tela e nova confirmação', async ({
    page,
  }) => {
    await openCheckout(page)
    await openReview(page)
    const dialog = reviewDialog(page)
    await expect(dialog.getByRole('button', { name: 'Confirmar e pagar' })).toBeVisible()

    await apiFetch(page, 'POST', '/__mocks/nfts/nft-042/update', { body: { price: '1.55' } })
    const alert = dialog.getByRole('alert').filter({ hasText: 'Os valores mudaram' })
    await expect(alert).toContainText('Emerald Ape #042: o preço mudou de 1.19 ETH para 1.55 ETH.')
    await expect(alert).toContainText('Total: de 3.786 ETH para 4.506 ETH.')
    await dialog.getByRole('button', { name: 'Confirmar com os novos valores' }).click()
    await expect(page).toHaveURL(/\/orders\/ord-/)
    const created = (await orders(page))[0]!
    expect(created.snapshot.total).toBe('4.506')
  })

  test('pedido pendente retomado depois de queda de conexão e de refresh', async ({ page }) => {
    await openCheckout(page)
    await setScenario(page, ['payment-confirmed'], { settleMs: 2500 })
    await openReview(page)
    await reviewDialog(page).getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(
      page.getByRole('heading', { name: 'Aguardando a confirmação do pagamento' }),
    ).toBeVisible()

    // Queda: o pagamento é decidido com a conexão fora (ninguém recebe o evento).
    await apiFetch(page, 'POST', '/__mocks/realtime/disconnect', { body: { downMs: 4000 } })
    await page.reload()
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Pagamento confirmado' })).toBeVisible({
      timeout: 15_000,
    })
    const log = (await apiFetch(page, 'GET', '/__mocks/realtime/log')).json as {
      events: { type: string; recipients: unknown[] }[]
    }
    expect(log.events.filter((e) => e.type === 'order.updated').length).toBeLessThanOrEqual(1)
  })

  test('carteira recusada e desconectada: aviso, nova tentativa e compra concluída', async ({
    page,
  }) => {
    await openCheckout(page)
    await setScenario(page, ['wallet-rejected'])
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(
      page.getByText('Você recusou a conexão na carteira. Tente de novo quando quiser.'),
    ).toBeVisible()
    await expect(reviewDialog(page)).toHaveCount(0)
    await page.getByRole('button', { name: 'Tentar conectar de novo' }).click()
    await expect(page.getByText(/^Carteira conectada: MetaMask/)).toBeVisible()

    await setScenario(page, ['wallet-disconnected'])
    await openReview(page)
    const dialog = reviewDialog(page)
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(
      dialog.getByText(
        'A carteira desconectou durante o pagamento. Conecte de novo para continuar.',
      ),
    ).toBeVisible()
    await dialog.getByRole('button', { name: 'Reconectar carteira' }).click()
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(page).toHaveURL(/\/orders\/ord-/)
  })

  test('sessão expira no meio do pagamento: volta do login com os dados preenchidos', async ({
    page,
  }) => {
    await openCheckout(page)
    await page.getByLabel(/^Nome de exibição/).fill('Ana Compradora')
    await page.getByLabel(/^Observação do colecionador/).fill('Presente de aniversário')
    await setScenario(page, ['session-expired'])
    await page.getByRole('button', { name: 'Confirmar compra' }).click()

    await expect(page).toHaveURL(/\/login\?/)
    await expect(page.getByText(/Sua sessão expirou/)).toBeVisible()
    await submitLogin(page, 'ana@example.com', PASSWORD)
    await expect(page).toHaveURL(/\/checkout$/)
    await expect(page.getByLabel(/^Nome de exibição/)).toHaveValue('Ana Compradora')
    await expect(page.getByLabel(/^Observação do colecionador/)).toHaveValue(
      'Presente de aniversário',
    )
  })

  test('dados do colecionador validados antes de qualquer envio', async ({ page }) => {
    await openCheckout(page)
    const posts = orderPosts(page)
    await page.getByLabel(/^Nome de exibição/).fill('A')
    await page.getByRole('textbox', { name: 'E-mail (obrigatório)' }).fill('nao-e-email')
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByText('Informe o nome de exibição.')).toBeVisible()
    await expect(page.getByLabel(/^Nome de exibição/)).toBeFocused()
    await expect(reviewDialog(page)).toHaveCount(0)
    expect(posts).toHaveLength(0)
  })
})

/** Elementos que passam da borda direita da janela (o diálogo fica fora do `main`). */
const overflowing = (page: Page, selector: string) =>
  page.evaluate(
    (sel) =>
      [...document.querySelectorAll(`${sel} *`)]
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
        .map((el) => (el.textContent ?? '').trim().slice(0, 30)),
    selector,
  )

test.describe('pagamento: ajustes da demonstração', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('a revisão cabe na tela, com preços, totais e botões à vista', async ({ page }) => {
    await openCheckout(page)
    await openReview(page)
    const dialog = reviewDialog(page)
    expect(await overflowing(page, '[role="dialog"]')).toEqual([])
    const box = (await dialog.boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    const totals = dialog.locator('[data-item-total]')
    await expect(totals).toHaveText(['Total do item: 2.38 ETH', 'Total do item: 1.39 ETH'])
    for (const total of await totals.all()) await expect(total).toBeInViewport()
    await expect(dialog.getByText('3.786 ETH', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Confirmar e pagar' })).toBeInViewport()
  })

  test('preço alterado com a revisão aberta: só o aviso da revisão, sem toast', async ({
    page,
  }) => {
    await openCheckout(page)
    await setScenario(page, ['price-changed-on-checkout'])
    await openReview(page)
    const dialog = reviewDialog(page)
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(dialog.getByRole('alert').filter({ hasText: 'Os valores mudaram' })).toBeVisible()
    // O evento em tempo real chega junto: espera o tempo de um toast aparecer e
    // confere uma vez (toHaveCount(0) passaria quando o toast sumisse sozinho).
    await page.waitForTimeout(800)
    expect(await page.locator('[data-sonner-toast]').count()).toBe(0)
  })

  test('preço alterado com a revisão fechada: aviso no fluxo do pagamento, sem toast', async ({
    page,
  }) => {
    await openCheckout(page)
    await apiFetch(page, 'POST', '/__mocks/nfts/nft-042/update', { body: { price: '1.55' } })
    const notice = page.getByRole('status').filter({ hasText: 'o preço mudou' })
    await expect(notice).toHaveText(
      'Emerald Ape #042 (edição aberta): o preço mudou de 1.19 ETH para 1.55 ETH. O total foi atualizado.',
    )
    await expect(page.getByText('4.506 ETH', { exact: true })).toBeVisible()
    await page.waitForTimeout(500)
    expect(await page.locator('[data-sonner-toast]').count()).toBe(0)
  })

  test('itens: no mobile, quantidade e preço na linha de baixo; no desktop, na mesma linha', async ({
    page,
  }) => {
    await openCheckout(page)
    const list = page.getByRole('list', { name: 'Itens da compra' })
    const name = list.locator('[data-item-name]').first()
    const total = list.locator('[data-item-total]').first()
    const [nameBox, totalBox] = [(await name.boundingBox())!, (await total.boundingBox())!]
    if (isMobileViewport(page)) {
      expect(totalBox.y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height)
      // O nome cabe numa linha só (20 px de altura de linha).
      expect(nameBox.height).toBeLessThan(25)
    } else {
      expect(totalBox.x).toBeGreaterThan(nameBox.x + nameBox.width)
      const center = (b: { y: number; height: number }) => b.y + b.height / 2
      expect(Math.abs(center(totalBox) - center(nameBox))).toBeLessThan(20)
    }
    expect(await overflowing(page, 'main')).toEqual([])
  })
})

test.describe('pagamento: envio demorado', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('envio sem resposta: "Ainda enviando…" depois de 5 s, antes da nova tentativa com a mesma chave', async ({
    page,
  }) => {
    await openCheckout(page)
    const before = (await orders(page)).length
    await setScenario(page, ['order-timeout'], { settleMs: 60_000 })
    // Relógio controlado: 5 s e 15 s passam sem esperar de verdade.
    await page.clock.install()
    await page.reload()
    await waitForApp(page)
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
    await openReview(page)
    const dialog = reviewDialog(page)
    const posts = orderPosts(page)
    await dialog.getByRole('button', { name: 'Confirmar e pagar' }).click()
    const status = dialog.getByRole('status')

    await expect(status).toHaveText('Enviando o pedido…')
    await page.clock.runFor(4_000)
    await expect(status).toHaveText('Enviando o pedido…')

    await page.clock.runFor(1_500)
    await expect(status).toHaveText('Ainda enviando…')
    await expect(dialog.getByRole('button', { name: 'Enviando…' })).toBeDisabled()
    expect(posts).toHaveLength(1)

    // Aos 15 s o timeout estoura e a nova tentativa sai, com a mesma chave.
    await page.clock.runFor(10_000)
    await expect(page).toHaveURL(/\/orders\/ord-/)
    expect(posts).toHaveLength(2)
    expect(posts[0]).toBe(posts[1])
    expect((await orders(page)).length).toBe(before + 1)
  })

  test('envio rápido não mostra "Ainda enviando…"', async ({ page }) => {
    await openCheckout(page)
    await openReview(page)
    await page.clock.install()
    await reviewDialog(page).getByRole('button', { name: 'Confirmar e pagar' }).click()
    await expect(page).toHaveURL(/\/orders\/ord-/)
    expect(await page.getByText('Ainda enviando…').count()).toBe(0)
  })
})

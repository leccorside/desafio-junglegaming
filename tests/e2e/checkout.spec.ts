import { expect, test, type Page } from '@playwright/test'

import { PASSWORD, loginViaUi, submitLogin } from '../fixtures/auth'
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

import { expect, test, type Page } from '@playwright/test'

import { formatEth } from '../../src/lib/eth'
import { loginViaUi, logoutViaUi, submitLogin, trackApi } from '../fixtures/auth'
import { apiFetch, resetMocks, setScenario, waitForApp } from '../fixtures/mocks'

/**
 * Tempo real (itens 9 e 10, parte do Passo 8): toda mudança chega pelo
 * `socket.io-client`, vinda do servidor simulado. Os testes mudam o banco dos
 * mocks pelas rotas /__mocks (como faria o backend) e nunca tocam no cache.
 * A prova de que o dado veio pelo socket: a tela muda sem nenhuma busca REST
 * do recurso.
 */

type Json = Record<string, unknown>
type EventReply = { event: { eventId: string; version: number } }

const GUEST_CART = '9e8d7c6b-5a4f-4e3d-8c2b-1a0f9e8d7c6b'

const updateNft = (page: Page, nftId: string, body: Json) =>
  apiFetch(page, 'POST', `/__mocks/nfts/${nftId}/update`, { body })

const peers = async (page: Page) =>
  (
    (await apiFetch(page, 'GET', '/__mocks/realtime/peers')).json as {
      peers: { userId: string | null }[]
    }
  ).peers

/** Requisições REST de um caminho feitas a partir de agora. */
function restCalls(page: Page, method: string, path: RegExp) {
  const seen: string[] = []
  page.on('request', (request) => {
    if (request.method() === method && path.test(new URL(request.url()).pathname))
      seen.push(request.url())
  })
  return seen
}

/** Espera a conexão de tempo real da página estar aberta no servidor simulado. */
async function connected(page: Page, userId: string | null = null) {
  // A reconexão do Socket.IO tem espera crescente com variação aleatória.
  await expect
    .poll(async () => (await peers(page)).map((p) => p.userId), { timeout: 15_000 })
    .toEqual([userId])
}

const detailPrice = (page: Page) =>
  page
    .locator('p')
    .filter({ hasText: /^Preço:/ })
    .filter({ visible: true })
    .first()

test.describe('tempo real', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('o preço muda no detalhe pelo evento, sem buscar o NFT de novo', async ({ page }) => {
    await page.goto('/nft/nft-042')
    await waitForApp(page)
    await expect(detailPrice(page)).toHaveText(/1\.19 ETH/)
    await connected(page)
    const fetches = restCalls(page, 'GET', /^\/api\/nfts\/nft-042$/)

    await updateNft(page, 'nft-042', { price: '1.55' })
    await expect(detailPrice(page)).toHaveText(/1\.55 ETH/)
    expect(fetches).toHaveLength(0)
  })

  test('o preço do card muda no catálogo pelo evento', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    const card = page.locator('[data-nft-id="nft-042"]').filter({ visible: true }).first()
    await expect(card).toContainText('1.19 ETH')
    await connected(page)
    const lists = restCalls(page, 'GET', /^\/api\/nfts$/)

    await updateNft(page, 'nft-042', { price: '1.07' })
    await expect(card).toContainText('1.07 ETH')
    expect(lists).toHaveLength(0)
  })

  test('com o NFT no carrinho: aviso acessível, item marcado e resumo da cotação nova', async ({
    page,
  }) => {
    await page.evaluate((id) => localStorage.setItem('kurio:guest-cart-id', id), GUEST_CART)
    await apiFetch(page, 'POST', '/cart/items', {
      cartId: GUEST_CART,
      body: { nftId: 'nft-314', editionId: 'nft-314-open', quantity: 2 },
    })
    await page.goto('/cart')
    await waitForApp(page)
    await expect(page.getByRole('list', { name: 'Itens do carrinho' })).toBeVisible()
    await connected(page)

    await updateNft(page, 'nft-314', { price: '1.59' })
    // Na página do carrinho o aviso fica no fluxo (role="status"), acima da lista.
    const notice = page.getByRole('status').filter({
      hasText:
        'Violet Nomad #314 (edição aberta): o preço mudou de 1.39 ETH para 1.59 ETH. O resumo do carrinho foi atualizado.',
    })
    await expect(notice).toBeVisible()
    // Conferido uma vez: toHaveCount(0) esperaria o toast sumir sozinho.
    expect(await page.locator('[data-sonner-toast]').count()).toBe(0)
    const list = page.getByRole('list', { name: 'Itens do carrinho' })
    const [noticeBox, listBox] = [await notice.boundingBox(), await list.boundingBox()]
    expect(noticeBox!.y + noticeBox!.height).toBeLessThanOrEqual(listBox!.y)
    // Fechar o aviso devolve o espaço.
    await page.getByRole('button', { name: 'Fechar aviso' }).click()
    await expect(notice).toHaveCount(0)
    await expect(
      page.getByText('O preço mudou de 1.39 ETH para 1.59 ETH.', { exact: true }),
    ).toBeVisible()

    const quote = (
      await apiFetch(page, 'POST', '/quotes', {
        cartId: GUEST_CART,
        body: { network: 'ethereum' },
      })
    ).json as { total: string }
    expect(quote.total).not.toBe('')
    const summary = page.getByRole('region', { name: /Resumo/ }).filter({ visible: true })
    await expect(summary.getByRole('definition').nth(3)).toHaveText(formatEth(quote.total))
  })

  test('evento duplicado e evento antigo são ignorados', async ({ page }) => {
    await page.evaluate((id) => localStorage.setItem('kurio:guest-cart-id', id), GUEST_CART)
    await apiFetch(page, 'POST', '/cart/items', {
      cartId: GUEST_CART,
      body: { nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 },
    })
    await page.goto('/nft/nft-314')
    await waitForApp(page)
    // O aviso compara com o carrinho em cache: o contador só aparece depois dele.
    await expect(page.locator('a[aria-label="Carrinho, 1 unidade"]').first()).toBeAttached()
    await connected(page)
    await updateNft(page, 'nft-314', { price: '1.59' })
    await expect(detailPrice(page)).toHaveText(/1\.59 ETH/)
    await expect(page.getByText(/o preço mudou de 1\.39 ETH para 1\.59 ETH/)).toBeVisible()
    const api = trackApi(page)
    await api.idle()

    // Duplicado: o mesmo eventId de novo não refaz nada (nem invalida o carrinho).
    const cartFetches = restCalls(page, 'GET', /^\/api\/cart$/)
    const replay = (await apiFetch(page, 'POST', '/__mocks/realtime/replay')).json as EventReply
    expect(replay.event.eventId).toMatch(/^nft-nft-314-v2-e\d+$/)
    // Antigo: versão anterior, com um preço que nunca existiu.
    const stale = (
      await apiFetch(page, 'POST', '/__mocks/realtime/stale', {
        body: { nftId: 'nft-314', price: '9.99' },
      })
    ).json as EventReply
    expect(stale.event.version).toBe(1)
    await api.idle()
    api.dispose()

    await expect(detailPrice(page)).toHaveText(/1\.59 ETH/)
    // Nem o duplicado nem o antigo invalidam o carrinho (o aviso só sai com evento aplicado).
    expect(cartFetches).toHaveLength(0)
    await expect(page.getByText(/9\.99 ETH/)).toHaveCount(0)
  })

  test('na reconexão, o que mudou com a conexão fora é buscado pela API', async ({ page }) => {
    await page.goto('/nft/nft-042')
    await waitForApp(page)
    await connected(page)

    // Conexão cai e fica fora por 2 s; a mudança desse intervalo não chega por evento.
    await apiFetch(page, 'POST', '/__mocks/realtime/disconnect', { body: { downMs: 2000 } })
    await expect.poll(async () => (await peers(page)).length).toBe(0)
    await updateNft(page, 'nft-042', { price: '1.66' })
    await expect(detailPrice(page)).toHaveText(/1\.19 ETH/)

    // O Socket.IO reconecta sozinho e a tela é reconciliada pela API.
    const refetch = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/nfts/nft-042')
    await connected(page)
    await refetch
    await expect(detailPrice(page)).toHaveText(/1\.66 ETH/)
  })

  test('a conexão segue a sessão: entra com a conta e volta a visitante no logout', async ({
    page,
  }) => {
    await page.goto('/')
    await waitForApp(page)
    await connected(page, null)

    await page.goto('/login')
    await submitLogin(page, 'ana@example.com')
    await expect(page).not.toHaveURL(/\/login/)
    // Uma conexão só, agora com o usuário (a anterior foi fechada).
    await connected(page, 'user-ana')

    await logoutViaUi(page)
    await connected(page, null)
  })
})

/** Token da sessão salva pela aplicação. */
const sessionToken = (page: Page) =>
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('kurio:session')!) as { token: string }).token,
  )

const sentLog = async (page: Page) =>
  (
    (await apiFetch(page, 'GET', '/__mocks/realtime/log')).json as {
      events: { type: string; eventId: string; recipients: (string | null)[] }[]
    }
  ).events

/** Carrinho de visitante com o Violet Nomad #314 (edição aberta, 2 unidades). */
async function guestCartWithVioletNomad(page: Page) {
  await page.evaluate((id) => localStorage.setItem('kurio:guest-cart-id', id), GUEST_CART)
  await apiFetch(page, 'POST', '/cart/items', {
    cartId: GUEST_CART,
    body: { nftId: 'nft-314', editionId: 'nft-314-open', quantity: 2 },
  })
}

/**
 * Um teste por achado dos dois /code-review do Passo 8 e por ajuste pedido
 * depois da demonstração em produção. Os que só dependem de regra do cliente
 * ou da sessão do servidor estão em src/features/realtime/realtime.test.ts.
 */
test.describe('tempo real: correções do review', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('reset dos mocks sem recarregar: a tela volta ao dado inicial e segue recebendo eventos', async ({
    page,
  }) => {
    await page.goto('/nft/nft-042')
    await waitForApp(page)
    await connected(page)
    await updateNft(page, 'nft-042', { price: '1.55' })
    await expect(detailPrice(page)).toHaveText(/1\.55 ETH/)

    // Reset com a página aberta: as versões voltam para trás (v1).
    await resetMocks(page)
    await expect(detailPrice(page)).toHaveText(/1\.19 ETH/)
    // A v2 seguinte tem outro eventId (época) e passa pelo porteiro.
    await updateNft(page, 'nft-042', { price: '1.77' })
    await expect(detailPrice(page)).toHaveText(/1\.77 ETH/)
  })

  test('o reset limpa o servidor simulado: sem reenvio de evento de antes nem emissão', async ({
    page,
  }) => {
    await page.goto('/nft/nft-042')
    await waitForApp(page)
    await connected(page)
    await updateNft(page, 'nft-042', { price: '1.55' })
    await expect(detailPrice(page)).toHaveText(/1\.55 ETH/)
    expect((await sentLog(page)).map((e) => e.type)).toEqual(['nft.updated'])

    await resetMocks(page)
    const replay = (await apiFetch(page, 'POST', '/__mocks/realtime/replay')).json as {
      event: unknown
    }
    expect(replay.event).toBeNull()
    expect(await sentLog(page)).toEqual([])
  })

  test('evento atrasado numa conexão nova não gera aviso falso nem busca o carrinho', async ({
    page,
  }) => {
    await guestCartWithVioletNomad(page)
    // O preço muda antes de a página abrir: o carrinho já vem da API com a v2.
    await updateNft(page, 'nft-314', { price: '1.59' })
    await page.goto('/cart')
    await waitForApp(page)
    await expect(
      page.getByText('O preço mudou de 1.39 ETH para 1.59 ETH.', { exact: true }),
    ).toBeVisible()
    await connected(page)
    const api = trackApi(page)
    await api.idle()
    const cartFetches = restCalls(page, 'GET', /^\/api\/cart$/)

    const stale = (
      await apiFetch(page, 'POST', '/__mocks/realtime/stale', {
        body: { nftId: 'nft-314', price: '9.99' },
      })
    ).json as EventReply
    expect(stale.event.version).toBe(1)
    await page.waitForTimeout(500)
    await api.idle()
    api.dispose()

    expect(await page.getByText(/9\.99/).count()).toBe(0)
    expect(cartFetches).toHaveLength(0)
  })

  test('na reconexão, a lista de interesse também é buscada de novo', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    const token = await sessionToken(page)
    await apiFetch(page, 'PUT', '/me/favorites/nft-042', { token })
    await page.goto('/favorites')
    await waitForApp(page)
    const card = page.locator('[data-nft-id="nft-042"]').filter({ visible: true }).first()
    await expect(card).toContainText('1.19 ETH')
    await connected(page, 'user-ana')

    await apiFetch(page, 'POST', '/__mocks/realtime/disconnect', { body: { downMs: 1500 } })
    await expect.poll(async () => (await peers(page)).length).toBe(0)
    await updateNft(page, 'nft-042', { price: '1.66' })
    await expect(card).toContainText('1.19 ETH')

    await connected(page, 'user-ana')
    await expect(card).toContainText('1.66 ETH')
  })

  test('o pagamento vencido é decidido e anunciado sem nenhuma requisição REST', async ({
    page,
  }) => {
    await loginViaUi(page, 'ana@example.com')
    const token = await sessionToken(page)
    await connected(page, 'user-ana')
    await setScenario(page, ['payment-confirmed'], { settleMs: 1500 })
    await apiFetch(page, 'POST', '/cart/items', {
      token,
      body: { nftId: 'nft-042', editionId: 'nft-042-open', quantity: 1 },
    })
    const quote = (
      await apiFetch(page, 'POST', '/quotes', { token, body: { network: 'ethereum' } })
    ).json as { id: string; version: number }
    const order = await page.evaluate(
      async ({ token, quote }) => {
        const response = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'Idempotency-Key': crypto.randomUUID(),
          },
          body: JSON.stringify({
            quoteId: quote.id,
            quoteVersion: quote.version,
            walletId: 'wallet-ana-primary',
            network: 'ethereum',
            buyer: { displayName: 'Ana Ribeiro', email: 'ana@example.com' },
          }),
        })
        return (await response.json()) as { id: string; status: string }
      },
      { token, quote },
    )
    expect(order.status).toBe('pending')

    // A criação muda o estoque (nft.updated): espera a tela buscar o que precisa.
    const api = trackApi(page)
    await api.idle()
    api.dispose()
    const calls: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) calls.push(request.url())
    })

    // Lido direto do banco no navegador, sem passar pela API.
    await expect
      .poll(() =>
        page.evaluate((id) => {
          const db = JSON.parse(localStorage.getItem('kurio:mocks:db')!) as {
            orders: { id: string; status: string }[]
          }
          return db.orders.find((o) => o.id === id)?.status
        }, order.id),
      )
      .toBe('confirmed')
    expect(calls).toEqual([])

    const sent = (await sentLog(page)).filter((e) => e.type === 'order.updated')
    expect(sent.at(-1)?.recipients).toEqual(['user-ana'])
  })

  test('troca de sessão com handshake lento: nada é entregue antes da autenticação e o que mudou é buscado', async ({
    page,
  }) => {
    await loginViaUi(page, 'ana@example.com')
    await page.goto('/')
    await waitForApp(page)
    const card = page.locator('[data-nft-id="nft-042"]').filter({ visible: true }).first()
    await expect(card).toContainText('1.19 ETH')
    await connected(page, 'user-ana')

    await apiFetch(page, 'POST', '/__mocks/realtime/auth-delay', { body: { ms: 2000 } })
    await logoutViaUi(page)
    // A conexão de visitante já abriu, mas ainda não se autenticou: fora da lista.
    expect(await peers(page)).toEqual([])
    await updateNft(page, 'nft-042', { price: '1.55' })
    const last = (await sentLog(page)).at(-1)
    expect(last?.type).toBe('nft.updated')
    expect(last?.recipients).toEqual([])

    // Depois do CONNECT: entra na lista, recebe o sync e busca o NFT de novo.
    await connected(page, null)
    await expect(card).toContainText('1.55 ETH')
  })

  test('painel: "Novo preço" altera o preço da edição e o carrinho avisa na hora', async ({
    page,
  }) => {
    await page.addInitScript(() =>
      Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }),
    )
    await guestCartWithVioletNomad(page)
    await page.goto('/cart')
    await waitForApp(page)
    await expect(page.getByRole('list', { name: 'Itens do carrinho' })).toBeVisible()
    await connected(page)

    await page.getByRole('button', { name: /^Cenários de teste/ }).click()
    const panel = page.getByRole('dialog', { name: 'Cenários de teste' })
    await panel.getByLabel('NFT', { exact: true }).selectOption('nft-314')
    await panel.getByLabel('Edição', { exact: true }).selectOption('nft-314-open')
    const price = panel.getByLabel('Novo preço (ETH)')

    await price.fill('abc')
    await panel.getByRole('button', { name: 'Alterar preço' }).click()
    await expect(
      panel.getByText('Informe um preço maior que zero em ETH, como 1.59.'),
    ).toBeVisible()
    await expect(price).toHaveAttribute('aria-invalid', 'true')

    await price.fill('1,59')
    await panel.getByRole('button', { name: 'Alterar preço' }).click()
    await expect(
      panel.getByText('Preço da edição aberta de Violet Nomad #314 alterado para 1.59 ETH.'),
    ).toBeVisible()
    await expect(price).toHaveValue('')
    await page.keyboard.press('Escape')

    await expect(
      page.getByRole('status').filter({ hasText: 'o preço mudou de 1.39 ETH para 1.59 ETH.' }),
    ).toBeVisible()
    const nft = (await apiFetch(page, 'GET', '/nfts/nft-314')).json as {
      editions: { id: string; price: string }[]
    }
    expect(nft.editions.find((e) => e.id === 'nft-314-open')?.price).toBe('1.59')
  })

  test('item esgotado não mostra total na linha, igual ao resumo', async ({ page }) => {
    await guestCartWithVioletNomad(page)
    await page.goto('/cart')
    await waitForApp(page)
    const list = page.getByRole('list', { name: 'Itens do carrinho' })
    await expect(list.locator('[data-line-total]')).toContainText('2.78 ETH')
    await connected(page)

    await updateNft(page, 'nft-314', { editionId: 'nft-314-open', available: 0 })
    await expect(list.getByText('Esgotado: remova do carrinho para finalizar.')).toBeVisible()
    await expect(list.locator('[data-line-total]')).not.toContainText('ETH')
    await expect(list.locator('[data-line-total]')).toHaveText('Esgotado, fora do total.')
    const summary = page.getByRole('region', { name: /Resumo/ }).filter({ visible: true })
    await expect(summary.getByRole('definition').nth(3)).toHaveText('0.00 ETH')
  })
})

/** Marca a página para provar depois que ela não recarregou. */
const markNoReload = (page: Page) =>
  page.evaluate(() => ((window as unknown as { __semReload: boolean }).__semReload = true))
const stillSamePage = (page: Page) =>
  page.evaluate(() => (window as unknown as { __semReload?: boolean }).__semReload === true)

test.describe('tempo real: avisos de queda, reconexão e reset', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('queda: aviso visível enquanto a conexão está fora, anúncio da volta e nada na troca de sessão', async ({
    page,
  }) => {
    await page.goto('/nft/nft-042')
    await waitForApp(page)
    await connected(page)
    const banner = page.getByText('Atualizações em tempo real pausadas. Reconectando…')
    expect(await banner.count()).toBe(0)

    await apiFetch(page, 'POST', '/__mocks/realtime/disconnect', { body: { downMs: 2000 } })
    await expect(banner).toBeVisible()
    // Fica numa região role="status", acima do conteúdo da página.
    const region = page.locator('[data-realtime-status]')
    await expect(region).toHaveAttribute('role', 'status')
    const [bannerBox, mainBox] = [
      await banner.boundingBox(),
      await page.locator('main#conteudo').boundingBox(),
    ]
    expect(bannerBox!.y + bannerBox!.height).toBeLessThanOrEqual(mainBox!.y)

    await connected(page)
    await expect(banner).toBeHidden()
    await expect(region).toHaveText('Atualizações em tempo real retomadas.')

    // Login troca a conexão, mas não é queda.
    await page.goto('/login')
    await submitLogin(page, 'ana@example.com')
    await expect(page).not.toHaveURL(/\/login/)
    await connected(page, 'user-ana')
    await expect(region).toHaveAttribute('data-realtime-status', 'online')
    expect(await banner.count()).toBe(0)
  })

  test('reconexão: o que mudou durante a queda aparece no aviso do carrinho', async ({ page }) => {
    await guestCartWithVioletNomad(page)
    await page.goto('/cart')
    await waitForApp(page)
    await expect(page.getByRole('list', { name: 'Itens do carrinho' })).toBeVisible()
    await connected(page)

    await apiFetch(page, 'POST', '/__mocks/realtime/disconnect', { body: { downMs: 2000 } })
    await expect.poll(async () => (await peers(page)).length).toBe(0)
    await updateNft(page, 'nft-314', { price: '1.79' })
    const notice = page.getByRole('status').filter({ hasText: 'o preço mudou' })
    expect(await notice.count()).toBe(0)

    await connected(page)
    await expect(notice).toHaveText(
      'Violet Nomad #314 (edição aberta): o preço mudou de 1.39 ETH para 1.79 ETH. O resumo do carrinho foi atualizado.',
    )
    const summary = page.getByRole('region', { name: /Resumo/ }).filter({ visible: true })
    await expect(summary.getByRole('definition').nth(3)).toHaveText('3.596 ETH')
    expect(await page.locator('[data-sonner-toast]').count()).toBe(0)
  })

  test('reset sem recarregar: aviso no carrinho, que volta vazio, e toast nas outras telas', async ({
    page,
  }) => {
    await guestCartWithVioletNomad(page)
    await page.goto('/cart')
    await waitForApp(page)
    await expect(page.getByRole('list', { name: 'Itens do carrinho' })).toBeVisible()
    await connected(page)
    await markNoReload(page)

    await resetMocks(page)
    await expect(
      page.getByRole('status').filter({ hasText: 'Os dados de demonstração foram restaurados.' }),
    ).toBeVisible()
    await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
    expect(await stillSamePage(page)).toBe(true)

    // Fora do carrinho, o mesmo aviso vem por toast.
    await page.goto('/nft/nft-042')
    await waitForApp(page)
    await connected(page)
    await resetMocks(page)
    await expect(
      page
        .locator('[data-sonner-toast]')
        .filter({ hasText: 'Os dados de demonstração foram restaurados.' }),
    ).toBeVisible()
  })
})

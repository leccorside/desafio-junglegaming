import { expect, test, type Page } from '@playwright/test'

import { formatEth } from '../../src/lib/eth'
import { logoutViaUi, submitLogin, trackApi } from '../fixtures/auth'
import { apiFetch, resetMocks, waitForApp } from '../fixtures/mocks'

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
    await expect(
      page.getByText(
        'Violet Nomad #314 (edição aberta): o preço mudou de 1.39 ETH para 1.59 ETH. O resumo do carrinho foi atualizado.',
      ),
    ).toBeVisible()
    // O aviso do Sonner fica numa região aria-live.
    await expect(page.getByRole('region', { name: /Notificações/ })).toBeAttached()
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
    expect(replay.event.eventId).toBe('nft-nft-314-v2')
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

import { expect, test, type Request, type Response } from '@playwright/test'

import { loginViaUi } from '../fixtures/auth'
import { apiFetch, resetMocks, waitForApp } from '../fixtures/mocks'

/**
 * Prova de que os testes usam a mesma infraestrutura da aplicação publicada
 * (TESTING.md, "Regras"): todo REST passa pelos handlers do MSW, no service
 * worker; todo tempo real passa pelo `socket.io-client`, ligado ao servidor
 * Socket.IO simulado.
 */

test.describe('infraestrutura dos testes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('REST: toda resposta de /api vem do service worker do MSW', async ({ page }) => {
    const api: Response[] = []
    page.on('response', (response) => {
      if (new URL(response.url()).pathname.startsWith('/api/')) api.push(response)
    })
    // Na troca de documento (`page.goto`), a página que sai já se desligou do
    // MSW e a nova ainda não ligou; o worker deixa passar o que a página antiga
    // pedir nesse intervalo (`activeClientIds.size === 0` em
    // mockServiceWorker.js). A resposta morre com ela, sem chegar ao app.
    // A página nova só faz requisições depois do `worker.start()`.
    const leftBehind = new Set<Request>()
    let leaving = false
    page.on('request', (request) => {
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) leaving = true
      else if (leaving && new URL(request.url()).pathname.startsWith('/api/'))
        leftBehind.add(request)
    })
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) leaving = false
    })

    // Catálogo, detalhe, login, carrinho e pagamento.
    await page.goto('/')
    await waitForApp(page)
    const worker = await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? '')
    expect(worker).toMatch(/\/mockServiceWorker\.js$/)
    await page.goto('/nft/nft-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await loginViaUi(page, 'ana@example.com')
    const token = await page.evaluate(
      () => (JSON.parse(localStorage.getItem('kurio:session')!) as { token: string }).token,
    )
    await apiFetch(page, 'POST', '/cart/items', {
      token,
      body: { nftId: 'nft-042', editionId: 'nft-042-open', quantity: 1 },
    })
    await page.goto('/cart')
    await expect(page.getByRole('list', { name: 'Itens do carrinho' })).toBeVisible()
    await page.goto('/checkout')
    await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()

    expect(api.length).toBeGreaterThan(10)
    const outside = api
      .filter((r) => !r.fromServiceWorker() && !leftBehind.has(r.request()))
      .map((r) => r.url())
    expect(outside).toEqual([])
    // Rotas de dados e utilitárias, não só uma.
    const paths = new Set(api.map((r) => new URL(r.url()).pathname))
    for (const path of [
      '/api/nfts',
      '/api/auth/login',
      '/api/cart',
      '/api/quotes',
      '/api/me/wallets',
    ])
      expect(
        [...paths].some((p) => p.startsWith(path)),
        path,
      ).toBe(true)
  })

  test('tempo real: o socket.io-client conecta no servidor simulado e o evento muda a tela sem REST', async ({
    page,
  }) => {
    const peers = async () =>
      (
        (await apiFetch(page, 'GET', '/__mocks/realtime/peers')).json as {
          peers: { userId: string | null; url: string }[]
        }
      ).peers

    await page.goto('/nft/nft-042')
    await waitForApp(page)
    // O layout aparece antes do NFT (a página suspende até ele chegar). Com o
    // evento chegando durante a primeira busca, o app busca de novo por REST;
    // aqui o NFT já precisa estar na tela.
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    // Handshake do Engine.IO v4 por WebSocket: o do socket.io-client.
    await expect.poll(async () => (await peers()).length, { timeout: 15_000 }).toBe(1)
    const [peer] = await peers()
    expect(peer!.userId).toBeNull()
    expect(new URL(peer!.url).pathname).toBe('/socket/')
    expect(new URL(peer!.url).searchParams.get('EIO')).toBe('4')
    expect(new URL(peer!.url).searchParams.get('transport')).toBe('websocket')

    // O preço muda no banco dos mocks (como faria o backend): o servidor emite
    // `nft.updated` para essa conexão e a tela muda sem buscar o NFT por REST.
    const rest: string[] = []
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/nfts/nft-042')) rest.push(request.url())
    })
    await apiFetch(page, 'POST', '/__mocks/nfts/nft-042/update', {
      body: { editionId: 'nft-042-open', price: '1.55' },
    })
    await expect(
      page
        .locator('p')
        .filter({ hasText: /^Preço:/ })
        .filter({ visible: true })
        .first(),
    ).toContainText('1.55 ETH')
    const log = (
      (await apiFetch(page, 'GET', '/__mocks/realtime/log')).json as {
        events: { type: string; recipients: (string | null)[] }[]
      }
    ).events
    expect(log.at(-1)).toMatchObject({ type: 'nft.updated', recipients: [null] })
    expect(rest).toEqual([])
  })
})

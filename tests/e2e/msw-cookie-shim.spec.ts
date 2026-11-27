import { expect, test, type Page, type Response } from '@playwright/test'

import { formatEth } from '../../src/lib/eth'
import { apiFetch, resetMocks, waitForApp } from '../fixtures/mocks'

/**
 * O `tough-cookie` do MSW é trocado no build do navegador por um stub
 * (src/mocks/shims/tough-cookie.ts, alias no vite.config.ts), que tira ele e
 * o `tldts` do caminho crítico. Estes testes garantem que:
 * - o chunk do MSW não traz mais nenhum dos dois;
 * - o cookie store do MSW continua gravando, lendo e apagando cookies,
 *   inclusive os salvos pelo `tough-cookie` real antes da troca;
 * - REST e tempo real continuam passando pelos mocks.
 */

const STORE_KEY = '__msw-cookie-store__'

type Echo = { cookies: Record<string, string> }
const echo = async (page: Page) =>
  ((await apiFetch(page, 'GET', '/__mocks/cookies')).json as Echo).cookies
const setCookie = (page: Page, header: string) =>
  apiFetch(page, 'POST', '/__mocks/cookies', { body: { header } })
const storedKeys = (page: Page) =>
  page.evaluate(
    (key) => (JSON.parse(localStorage.getItem(key) ?? '[]') as { key: string }[]).map((c) => c.key),
    STORE_KEY,
  )

test.describe('MSW com o stub do tough-cookie', () => {
  test('chunk do MSW sem tough-cookie nem tldts, e bem menor', async ({ request }) => {
    const html = await (await request.get('/')).text()
    const chunk = html.match(/href="(\/assets\/browser-[\w-]+\.js)"/)?.[1]
    expect(chunk, 'modulepreload do chunk do MSW').toBeTruthy()
    const code = await (await request.get(chunk!)).text()
    // Marcas do tough-cookie (mensagem de erro) e do tldts (lista de sufixos públicos).
    expect(code.includes('Cookie has domain set to a public suffix'), 'tough-cookie').toBe(false)
    expect(code.includes('blogspot'), 'tldts').toBe(false)
    // Antes: 457 kB sem compressão. Com o stub: cerca de 157 kB.
    expect(code.length).toBeLessThan(250_000)
  })

  test('cookie store: grava o Set-Cookie, devolve na próxima requisição e apaga com Max-Age=0', async ({
    page,
  }) => {
    await page.goto('/')
    await waitForApp(page)
    expect(await echo(page)).not.toHaveProperty('kurio-teste')

    expect((await setCookie(page, 'kurio-teste=ok; Path=/')).status).toBe(200)
    await expect.poll(() => echo(page)).toMatchObject({ 'kurio-teste': 'ok' })
    expect(await storedKeys(page)).toContain('kurio-teste')

    // Cookie de outro caminho não vai para /api/__mocks/cookies.
    await setCookie(page, 'so-carrinho=1; Path=/api/cart')
    expect(await echo(page)).not.toHaveProperty('so-carrinho')

    // Persiste no recarregamento (localStorage do MSW).
    await page.reload()
    await waitForApp(page)
    expect(await echo(page)).toMatchObject({ 'kurio-teste': 'ok' })

    // Vencido deixa de ir na requisição. (O tough-cookie real ainda guarda o
    // registro vencido no localStorage até a próxima leitura; o stub apaga
    // na hora. Para o MSW, o efeito é o mesmo.)
    await setCookie(page, 'kurio-teste=; Path=/; Max-Age=0')
    await expect.poll(() => echo(page)).not.toHaveProperty('kurio-teste')
    await page.reload()
    await waitForApp(page)
    expect(await echo(page)).not.toHaveProperty('kurio-teste')
  })

  test('lê os cookies que o tough-cookie real deixou salvos antes da troca', async ({ page }) => {
    // Formato gravado pelo tough-cookie 6 (Cookie#toJSON).
    await page.addInitScript((key) => {
      if (localStorage.getItem(key)) return
      localStorage.setItem(
        key,
        JSON.stringify([
          {
            key: 'legado',
            value: 'sim',
            expires: new Date(Date.now() + 3_600_000).toISOString(),
            domain: 'localhost',
            path: '/',
            hostOnly: true,
            creation: new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
          },
          {
            key: 'vencido',
            value: 'nao',
            expires: '2015-01-01T00:00:00.000Z',
            domain: 'localhost',
            path: '/',
            hostOnly: true,
          },
        ]),
      )
    }, STORE_KEY)
    await page.goto('/')
    await waitForApp(page)
    const cookies = await echo(page)
    expect(cookies).toMatchObject({ legado: 'sim' })
    expect(cookies).not.toHaveProperty('vencido')
  })

  test('REST pelo service worker e evento em tempo real continuam chegando à tela', async ({
    page,
  }) => {
    const api: Response[] = []
    page.on('response', (response) => {
      if (new URL(response.url()).pathname.startsWith('/api/')) api.push(response)
    })
    await page.goto('/nft/nft-042')
    await waitForApp(page)
    await resetMocks(page)
    await page.reload()
    await waitForApp(page)
    const heading = page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })
    await expect(heading).toBeVisible()
    expect(api.length).toBeGreaterThan(0)
    expect(api.every((response) => response.fromServiceWorker())).toBe(true)

    // Socket.IO conectado ao servidor simulado.
    await expect
      .poll(async () => {
        const { json } = await apiFetch(page, 'GET', '/__mocks/realtime/peers')
        return (json as { peers: unknown[] }).peers.length
      })
      .toBeGreaterThan(0)

    // Mudança de preço pela rota de teste chega pelo socket, sem recarregar.
    const { status } = await apiFetch(page, 'POST', '/__mocks/nfts/nft-042/update', {
      body: { editionId: 'nft-042-open', price: '1.55' },
    })
    expect(status).toBe(200)
    await expect(page.getByText(formatEth('1.55')).first()).toBeVisible()
  })
})

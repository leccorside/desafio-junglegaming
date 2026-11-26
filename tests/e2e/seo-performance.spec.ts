import { expect, test, type Page } from '@playwright/test'

import { loginViaUi } from '../fixtures/auth'
import { waitForApp } from '../fixtures/mocks'

/**
 * Itens do Passo 15 que o Lighthouse mede e que podem regredir sem ninguém
 * notar: `robots.txt`, dicas de carregamento no `index.html` do build e a
 * descrição da página por rota. A auditoria completa fica em
 * `npm run lighthouse` (docs/PERFORMANCE.md).
 */

// Texto do index.html, usado na tela inicial e nas rotas sem descrição própria.
const DEFAULT_DESCRIPTION =
  'KURIO: marketplace de NFTs para descobrir, colecionar e comprar edições digitais.'

const description = (page: Page) => page.locator('meta[name="description"]').getAttribute('content')

test.describe('SEO e carregamento', () => {
  test('robots.txt é texto, libera o catálogo e bloqueia as telas da conta', async ({
    request,
  }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/plain')
    const body = await response.text()
    expect(body).toMatch(/^User-agent: \*$/m)
    expect(body).toMatch(/^Allow: \/$/m)
    for (const path of ['/cart', '/checkout', '/favorites', '/orders/', '/profile', '/wallets']) {
      expect(body).toContain(`Disallow: ${path}\n`)
    }
    expect(body).not.toContain('<html')
  })

  test('index.html pré-carrega as três fontes e o chunk do MSW', async ({ request }) => {
    const html = await (await request.get('/')).text()
    for (const weight of ['400', '500', '700']) {
      expect(html).toMatch(
        new RegExp(
          `<link rel="preload" href="/assets/roboto-mono-latin-${weight}-normal-[\\w-]+\\.woff2" as="font" type="font/woff2" crossorigin`,
        ),
      )
    }
    const browserChunk = html.match(/href="(\/assets\/browser-[\w-]+\.js)"/)?.[1]
    expect(browserChunk, 'modulepreload do chunk do MSW').toBeTruthy()
    expect(html).toContain(`rel="modulepreload" crossorigin="" href="${browserChunk}"`)
    // Sem repetir o que o Vite já pré-carrega.
    const preloads = [...html.matchAll(/rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1])
    expect(new Set(preloads).size).toBe(preloads.length)
  })

  test('as fontes da página são as pré-carregadas, sem segundo download', async ({ page }) => {
    const fonts: string[] = []
    page.on('request', (request) => {
      if (request.resourceType() === 'font') fonts.push(new URL(request.url()).pathname)
    })
    await page.goto('/nft/nft-042')
    await waitForApp(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.fonts.check('700 16px "Roboto Mono"'))).toBe(true)
    expect(fonts.sort()).toEqual([...new Set(fonts)].sort())
    expect(fonts).toHaveLength(3)
  })

  test('descrição da página acompanha a rota', async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await expect.poll(() => description(page)).toBe(DEFAULT_DESCRIPTION)

    await page.goto('/nft/nft-042')
    await expect(page).toHaveTitle('Emerald Ape #042 | KURIO')
    await expect
      .poll(() => description(page))
      .toBe('Emerald Ape #042 no KURIO: edições disponíveis, preço em ETH e detalhes da coleção.')
    expect(await page.locator('meta[name="description"]').count()).toBe(1)

    await page.goto('/cart')
    await expect.poll(() => description(page)).toMatch(/^Carrinho do KURIO:/)

    await loginViaUi(page, 'ana@example.com')
    await page.goto('/wallets')
    await expect.poll(() => description(page)).toMatch(/^Carteiras no KURIO:/)

    // Navegação pelo app (sem recarregar) também troca a descrição.
    await page.getByRole('link', { name: 'Início' }).first().click()
    await expect.poll(() => description(page)).toBe(DEFAULT_DESCRIPTION)
  })
})

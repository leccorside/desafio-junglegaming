import { expect, test } from '@playwright/test'

import { apiFetch, resetMocks, setScenario, waitForApp } from '../fixtures/mocks'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

test.describe('API simulada no navegador', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('o service worker responde a API com as fixtures', async ({ page }) => {
    const { status, json } = await apiFetch(page, 'GET', '/nfts')
    expect(status).toBe(200)
    expect((json as Json).total).toBe(60)
    expect((json as Json).items[0].name).toBe('Emerald Ape #042')
  })

  test('o estado sobrevive ao refresh e o reset volta às fixtures', async ({ page }) => {
    const login = await apiFetch(page, 'POST', '/auth/login', {
      body: { email: 'ana@example.com', password: 'Senha@123' },
    })
    const token = (login.json as Json).token as string
    await apiFetch(page, 'PUT', '/me/favorites/nft-009', { token })

    await page.reload()
    await waitForApp(page)
    const after = await apiFetch(page, 'GET', '/me/favorites', { token })
    expect((after.json as Json).nftIds).toEqual(['nft-009', 'nft-042', 'nft-118'])

    await resetMocks(page)
    const relogin = await apiFetch(page, 'POST', '/auth/login', {
      body: { email: 'ana@example.com', password: 'Senha@123' },
    })
    const reset = await apiFetch(page, 'GET', '/me/favorites', {
      token: (relogin.json as Json).token as string,
    })
    expect((reset.json as Json).nftIds).toEqual(['nft-042', 'nft-118'])
  })

  test('ativa cenário pela URL e mantém depois do refresh', async ({ page }) => {
    await page.goto('/?scenario=server-error&scenarioRoutes=/nfts')
    await waitForApp(page)
    expect((await apiFetch(page, 'GET', '/nfts')).status).toBe(503)
    expect((await apiFetch(page, 'GET', '/auth/session')).status).toBe(401)

    await page.goto('/')
    await waitForApp(page)
    expect((await apiFetch(page, 'GET', '/nfts')).status).toBe(503)
  })

  test('o ?scenario= sai da URL e o reload não redispara cenário de uso único', async ({
    page,
  }) => {
    await page.goto('/?scenario=session-expired&page=2')
    await waitForApp(page)
    // O parâmetro sai, os outros ficam.
    expect(new URL(page.url()).search).toBe('?page=2')

    const login = await apiFetch(page, 'POST', '/auth/login', {
      body: { email: 'ana@example.com', password: 'Senha@123' },
    })
    const token = (login.json as Json).token as string
    expect((await apiFetch(page, 'GET', '/me/profile', { token })).status).toBe(401)

    // Antes da correção, o reload relia ?scenario= e expirava a sessão de novo.
    await page.reload()
    await waitForApp(page)
    const relogin = await apiFetch(page, 'POST', '/auth/login', {
      body: { email: 'ana@example.com', password: 'Senha@123' },
    })
    const profile = await apiFetch(page, 'GET', '/me/profile', {
      token: (relogin.json as Json).token as string,
    })
    expect(profile.status).toBe(200)
  })

  test('aplica latência variável com respostas fora de ordem', async ({ page }) => {
    await setScenario(page, ['jitter'], { seed: 3 })
    const order = await page.evaluate(async () => {
      const done: number[] = []
      await Promise.all(
        [1, 2, 3, 4, 5, 6].map((n) => fetch(`/api/nfts?page=${n}`).then(() => done.push(n))),
      )
      return done
    })
    expect(order).toHaveLength(6)
    expect(order).not.toEqual([1, 2, 3, 4, 5, 6])
  })

  test('o painel de cenários fica escondido em navegador automatizado', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Cenários de teste/ })).toHaveCount(0)
  })
})

test.describe('painel de cenários visível (como para o avaliador)', () => {
  test.beforeEach(async ({ page }) => {
    // Simula um navegador comum: o painel só some com navigator.webdriver.
    await page.addInitScript(() =>
      Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }),
    )
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('o controle de estoque esgota uma edição sem recarregar a página', async ({ page }) => {
    // Carrinho de visitante com a 1/50 do Emerald Ape, que é removida.
    const cartId = '5a6b7c8d-1e2f-4a3b-8c9d-0e1f2a3b4c5d'
    await page.evaluate((id) => localStorage.setItem('kurio:guest-cart-id', id), cartId)
    await apiFetch(page, 'POST', '/cart/items', {
      cartId,
      body: { nftId: 'nft-042', editionId: 'nft-042-1-50', quantity: 1 },
    })
    await page.goto('/cart')
    await waitForApp(page)
    await page
      .getByRole('button', { name: 'Remover Emerald Ape #042 (edição 1/50) do carrinho' })
      .click()
    await expect(page.getByRole('button', { name: 'Desfazer' })).toBeVisible()
    // Marca a página: um reload apagaria a marca (e o toast com o "Desfazer").
    await page.evaluate(() => ((window as unknown as { stockMark: boolean }).stockMark = true))

    await page.getByRole('button', { name: /^Cenários de teste/ }).click()
    const panel = page.getByRole('dialog', { name: 'Cenários de teste' })
    const stock = panel.getByRole('group', { name: 'Estoque' })
    await stock.getByRole('combobox', { name: 'NFT' }).selectOption({ label: 'Emerald Ape #042' })
    const edition = stock.getByRole('combobox', { name: 'Edição' })
    await edition.selectOption({ label: '1/50 · à venda · 37 disp.' })
    await stock.getByRole('button', { name: 'Marcar como esgotada' }).click()
    await expect(stock.getByRole('status')).toHaveText(
      'Edição 1/50 de Emerald Ape #042 marcada como esgotada.',
    )
    // A lista já mostra o estado novo, e o botão não age de novo na mesma edição.
    await expect(edition.locator('option:checked')).toHaveText('1/50 · esgotada · 0 disp.')
    await expect(stock.getByRole('button', { name: 'Marcar como esgotada' })).toBeDisabled()

    // A API mudou, e a página não recarregou.
    const nft = (await apiFetch(page, 'GET', '/nfts/nft-042')).json as {
      editions: { id: string; available: number; status: string }[]
    }
    expect(nft.editions.find((e) => e.id === 'nft-042-1-50')).toMatchObject({
      available: 0,
      status: 'sold_out',
    })
    expect(
      await page.evaluate(() => (window as unknown as { stockMark?: boolean }).stockMark),
    ).toBe(true)

    // O "Desfazer" continua na tela e agora recebe o erro de estoque.
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
    await page.getByRole('button', { name: 'Desfazer' }).click()
    await expect(
      page.getByText(
        'Não foi possível devolver Emerald Ape #042 (edição 1/50) ao carrinho. Esta edição está esgotada.',
      ),
    ).toBeVisible()
    const cart = (await apiFetch(page, 'GET', '/cart', { cartId })).json as { items: unknown[] }
    expect(cart.items).toHaveLength(0)
  })

  test('no detalhe, o Estoque abre no NFT e na edição da página', async ({ page }) => {
    // Edição escolhida na página (1/10) e, sem escolha, a que a página mostra (aberta).
    for (const [url, label] of [
      ['/nft/nft-042?edition=nft-042-1-10', /^1\/10 · /],
      ['/nft/nft-042', /^Aberta · /],
    ] as const) {
      await page.goto(url)
      await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
      await page.getByRole('button', { name: /^Cenários de teste/ }).click()
      const stock = page
        .getByRole('dialog', { name: 'Cenários de teste' })
        .getByRole('group', { name: 'Estoque' })
      await expect(
        stock.getByRole('combobox', { name: 'NFT' }).locator('option:checked'),
      ).toHaveText('Emerald Ape #042')
      await expect(
        stock.getByRole('combobox', { name: 'Edição' }).locator('option:checked'),
      ).toHaveText(label)
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog', { name: 'Cenários de teste' })).toBeHidden()
    }

    // Detalhe ainda carregando (NFT lento): o NFT vem do endereço e a edição é
    // a que a página vai mostrar.
    await setScenario(page, ['slow'], { routes: ['/nfts/nft-042'], latencyMs: 6000 })
    await page.goto('/nft/nft-042')
    await expect(page.getByText('Carregando NFT…')).toBeAttached()
    await page.getByRole('button', { name: /^Cenários de teste/ }).click()
    const loading = page
      .getByRole('dialog', { name: 'Cenários de teste' })
      .getByRole('group', { name: 'Estoque' })
    await expect(
      loading.getByRole('combobox', { name: 'NFT' }).locator('option:checked'),
    ).toHaveText('Emerald Ape #042')
    await expect(
      loading.getByRole('combobox', { name: 'Edição' }).locator('option:checked'),
    ).toHaveText(/^Aberta · /)
    // A página ainda está carregando.
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await setScenario(page, [])

    // Fora do detalhe, o primeiro NFT da lista, como antes.
    await page.goto('/')
    await waitForApp(page)
    await page.getByRole('button', { name: /^Cenários de teste/ }).click()
    const stock = page
      .getByRole('dialog', { name: 'Cenários de teste' })
      .getByRole('group', { name: 'Estoque' })
    const first = await stock
      .getByRole('combobox', { name: 'NFT' })
      .locator('option')
      .first()
      .textContent()
    await expect(stock.getByRole('combobox', { name: 'NFT' }).locator('option:checked')).toHaveText(
      first!,
    )
  })

  test('preço mudado com a página aberta: a edição na tela não troca, mesmo deixando de ser a mais barata', async ({
    page,
  }) => {
    await page.goto('/nft/nft-042')
    const heading = page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })
    await expect(heading).toBeVisible()
    const open = page.getByRole('radio', { name: /^Edição aberta,/ }).filter({ visible: true })
    await expect(open).toHaveAttribute('aria-checked', 'true')
    await expect(open).toHaveAccessibleName('Edição aberta, 1.19 ETH')

    // Pelo painel: a aberta passa a 1.88, mais cara que a 1/50 (1.79).
    await page.getByRole('button', { name: /^Cenários de teste/ }).click()
    const stock = page
      .getByRole('dialog', { name: 'Cenários de teste' })
      .getByRole('group', { name: 'Estoque' })
    await stock.getByLabel('Novo preço (ETH)').fill('1.88')
    await stock.getByRole('button', { name: 'Alterar preço' }).click()
    await expect(stock.getByRole('status')).toHaveText(
      'Preço da edição aberta de Emerald Ape #042 alterado para 1.88 ETH.',
    )
    await page.keyboard.press('Escape')

    // O preço novo chega pelo tempo real e a seleção continua na aberta.
    await expect(open).toHaveAccessibleName('Edição aberta, 1.88 ETH')
    await expect(open).toHaveAttribute('aria-checked', 'true')
    const price = page
      .locator('p')
      .filter({ hasText: /^Preço:/ })
      .filter({ visible: true })
      .first()
    await expect(price).toHaveText(/1\.88 ETH/)
    await expect(page).toHaveURL(/\/nft\/nft-042$/)
    // Sem aviso de edição esgotada: nada saiu de venda.
    await expect(page.getByText(/está esgotada|está indisponível/)).toHaveCount(0)

    // Recarregando, a página volta à mais barata do momento (a 1/50).
    await page.reload()
    await expect(heading).toBeVisible()
    await expect(
      page.getByRole('radio', { name: /^Edição 1\/50,/ }).filter({ visible: true }),
    ).toHaveAttribute('aria-checked', 'true')
  })

  test('a edição da tela esgota com a página aberta: cai na mais barata e avisa', async ({
    page,
  }) => {
    await page.goto('/nft/nft-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await apiFetch(page, 'POST', '/__mocks/nfts/nft-042/update', {
      body: { editionId: 'nft-042-open', available: 0 },
    })
    await expect(
      page.getByText('A edição Aberta está esgotada. Mostrando a edição 1/50.'),
    ).toBeVisible()
    await expect(
      page.getByRole('radio', { name: /^Edição 1\/50,/ }).filter({ visible: true }),
    ).toHaveAttribute('aria-checked', 'true')
  })

  test('o nome do botão concorda com o número de cenários ativos', async ({ page }) => {
    const button = page.getByRole('button', { name: /^Cenários de teste/ })
    await expect(button).toHaveAccessibleName('Cenários de teste')

    await setScenario(page, ['slow'])
    await page.reload()
    await waitForApp(page)
    await expect(button).toHaveAccessibleName('Cenários de teste (1 ativo)')

    await setScenario(page, ['slow', 'flaky'])
    await page.reload()
    await waitForApp(page)
    await expect(button).toHaveAccessibleName('Cenários de teste (2 ativos)')
  })

  test('o contador e as caixas acompanham o cenário trocado fora do painel, sem recarregar', async ({
    page,
  }) => {
    const button = page.getByRole('button', { name: /^Cenários de teste/ })
    const navigations = await page.evaluate(() => performance.getEntriesByType('navigation').length)

    await setScenario(page, ['slow'], { routes: ['/me/wallets'] })
    await expect(button).toHaveAccessibleName('Cenários de teste (1 ativo)')
    await setScenario(page, ['slow', 'server-error'])
    await expect(button).toHaveAccessibleName('Cenários de teste (2 ativos)')
    await expect(button.locator('span').filter({ hasText: /^2$/ })).toBeVisible()

    // Ao abrir, as caixas mostram o que está em vigor.
    await button.click()
    const panel = page.getByRole('dialog', { name: 'Cenários de teste' })
    await expect(panel.getByRole('checkbox', { name: /^slow/ })).toBeChecked()
    await expect(panel.getByRole('checkbox', { name: /^server-error/ })).toBeChecked()
    await expect(panel.getByRole('checkbox', { name: /^jitter/ })).not.toBeChecked()
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()

    await setScenario(page, [])
    await expect(button).toHaveAccessibleName('Cenários de teste')
    await button.click()
    await expect(panel.getByRole('checkbox', { name: /^slow/ })).not.toBeChecked()
    // Nada foi recarregado no caminho.
    expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(
      navigations,
    )
    expect(await page.evaluate(() => window.location.pathname)).toBe('/')
  })

  test('no mobile, o botão fica na margem da barra inferior sem cobrir nada clicável', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'A barra inferior só existe abaixo de 768 px')
    await setScenario(page, ['server-error'], { routes: ['/nfts'] })
    await page.reload()
    await waitForApp(page)
    const retry = page.getByRole('button', { name: 'Tentar de novo' })
    await expect(retry).toBeVisible({ timeout: 15_000 })

    const button = page.getByRole('button', { name: /^Cenários de teste/ })
    const bar = page.getByRole('navigation', { name: 'Navegação inferior' })
    const home = bar.getByRole('link', { name: 'Início' })
    const box = (await button.boundingBox())!
    const barBox = (await bar.boundingBox())!
    const homeBox = (await home.boundingBox())!
    // Colado à esquerda, dentro da faixa da barra e antes do Início.
    expect(box.x).toBe(0)
    expect(box.y).toBeGreaterThanOrEqual(barBox.y)
    expect(box.x + box.width).toBeLessThanOrEqual(homeBox.x)
    // O contador de cenários também fica dentro da largura do botão.
    const badge = (await button.locator('span').last().boundingBox())!
    expect(badge.x + badge.width).toBeLessThanOrEqual(box.x + box.width)

    // Em qualquer rolagem, nenhum elemento clicável fica embaixo do botão.
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y < height; y += 150) {
      await page.evaluate((top) => window.scrollTo(0, top), y)
      const covered = await page.evaluate(() => {
        const panel = [...document.querySelectorAll('button')].find((b) =>
          b.getAttribute('aria-label')?.startsWith('Cenários de teste'),
        )!
        const p = panel.getBoundingClientRect()
        return [...document.querySelectorAll('main a, main button, main input')]
          .filter((el) => {
            const r = el.getBoundingClientRect()
            return (
              r.width > 0 &&
              r.left < p.right &&
              r.right > p.left &&
              r.top < p.bottom &&
              r.bottom > p.top
            )
          })
          .map((el) => el.getAttribute('aria-label') ?? el.textContent?.trim())
      })
      expect(covered, `rolagem ${y}px`).toEqual([])
    }

    // O "Tentar de novo" recebe o toque, e o botão do painel continua funcionando.
    await retry.scrollIntoViewIfNeeded()
    await retry.click()
    await button.click()
    await expect(page.getByRole('dialog', { name: 'Cenários de teste' })).toBeVisible()
  })
})

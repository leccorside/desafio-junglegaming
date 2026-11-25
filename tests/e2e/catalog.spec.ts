import { expect, test, type Page } from '@playwright/test'

import { apiFetch, resetMocks, setScenario, waitForApp } from '../fixtures/mocks'

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/** Total que a API devolve para a mesma consulta (o catálogo precisa mostrar este número). */
async function apiTotal(page: Page, query = ''): Promise<number> {
  const { json } = await apiFetch(page, 'GET', `/nfts${query ? `?${query}` : ''}`)
  return (json as Json).total as number
}

const resultCount = (page: Page) => page.getByRole('status').filter({ hasText: /encontrado/ })
const cards = (page: Page) => page.locator('#catalogo ul[aria-busy] > li a')

/** Contagem estável: sem "Atualizando…" e com o total esperado. */
async function expectTotal(page: Page, total: number) {
  await expect(resultCount(page)).toHaveText(new RegExp(`^${total} NFTs? encontrados?$`), {
    timeout: 10_000,
  })
}

/** Filtros: sidebar no desktop, menu lateral (Sheet) no mobile. */
async function filters(page: Page, isMobile: boolean) {
  if (!isMobile) return page.getByRole('complementary', { name: 'Filtros' })
  const dialog = page.getByRole('dialog', { name: 'Filtros' })
  if (!(await dialog.isVisible())) {
    await page.getByRole('button', { name: 'Filtros e ordenação' }).click()
  }
  await expect(dialog).toBeVisible()
  return dialog
}

async function closeFilters(page: Page, isMobile: boolean) {
  if (isMobile) {
    const dialog = page.getByRole('dialog', { name: 'Filtros' })
    await dialog.getByRole('button', { name: 'Fechar' }).click()
    await expect(dialog).toBeHidden()
    // O foco volta ao botão que abriu o menu.
    await expect(page.getByRole('button', { name: 'Filtros e ordenação' })).toBeFocused()
  }
}

async function search(page: Page, isMobile: boolean, text: string) {
  if (isMobile) {
    await page.getByRole('searchbox', { name: 'Buscar NFTs' }).fill(text)
  } else {
    await page.getByRole('button', { name: 'Buscar NFTs' }).click()
    const dialog = page.getByRole('dialog', { name: 'Buscar NFTs' })
    await dialog.getByRole('searchbox', { name: 'Buscar NFTs' }).fill(text)
    await dialog.getByRole('button', { name: 'Buscar' }).click()
    await expect(dialog).toBeHidden()
  }
}

test.describe('catálogo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
    await page.reload()
    await waitForApp(page)
  })

  test('mostra destaques e a primeira página com 9 NFTs', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: /dono d/i })).toBeVisible()
    await expectTotal(page, await apiTotal(page))
    await expect(cards(page)).toHaveCount(9)
    await expect(page.getByRole('link', { name: 'Página 1' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('busca volta para a página 1 e limpa pelo botão', async ({ page, isMobile }) => {
    await page.goto('/?page=2')
    await waitForApp(page)
    await search(page, isMobile, 'ape')

    await expect(page).toHaveURL(/[?&]q=ape/)
    expect(new URL(page.url()).searchParams.get('page')).toBeNull()
    await expectTotal(page, await apiTotal(page, 'q=ape'))
    await expect(page.getByText('Resultados para')).toBeVisible()

    await page.getByRole('button', { name: 'Limpar a busca por ape' }).click()
    await expect(page).not.toHaveURL(/q=/)
    await expectTotal(page, await apiTotal(page))
    if (isMobile) await expect(page.getByRole('searchbox', { name: 'Buscar NFTs' })).toHaveValue('')
  })

  test('filtros combinados e ordenação ficam na URL e sobrevivem ao refresh', async ({
    page,
    isMobile,
  }) => {
    let panel = await filters(page, isMobile)
    await panel.getByRole('button', { name: /^Música/ }).click()
    await panel.getByRole('button', { name: /^Arte digital/ }).click()
    await panel.getByRole('button', { name: /^Ethereum/ }).click()
    await expect(panel.getByRole('button', { name: /^Música/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    const sortScope = isMobile ? panel : page
    await sortScope.getByRole('combobox', { name: 'Ordenar por:' }).click()
    await page.getByRole('option', { name: 'Menor preço' }).click()
    await closeFilters(page, isMobile)

    const url = new URL(page.url())
    expect(JSON.parse(url.searchParams.get('category') ?? '[]')).toEqual(['music', 'digital-art'])
    expect(JSON.parse(url.searchParams.get('network') ?? '[]')).toEqual(['ethereum'])
    expect(url.searchParams.get('sort')).toBe('price_asc')

    const total = await apiTotal(page, 'category=music,digital-art&network=ethereum&sort=price_asc')
    await expectTotal(page, total)

    // Preços em ordem crescente.
    const prices = await cards(page).evaluateAll((links) =>
      // O preço é o último texto do card ("1.19 ETH"); o nome vem antes.
      links.map((a) =>
        Number(/([\d.]+) ETH/.exec(a.lastElementChild?.lastElementChild?.textContent ?? '')?.[1]),
      ),
    )
    expect(prices).toEqual([...prices].sort((a, b) => a - b))

    await page.reload()
    await waitForApp(page)
    await expectTotal(page, total)
    panel = await filters(page, isMobile)
    await expect(panel.getByRole('button', { name: /^Ethereum/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(
      (isMobile ? panel : page).getByRole('combobox', { name: 'Ordenar por:' }),
    ).toHaveText(/Menor preço/)
  })

  test('paginação acompanha o voltar e o avançar do navegador', async ({ page }) => {
    await expect(cards(page)).toHaveCount(9)
    const firstOnPage1 = await cards(page).first().textContent()

    await page.getByRole('link', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/[?&]page=2/)
    await expect(page.getByRole('link', { name: 'Página 2' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    // Só a página atual e a aba atual são "página atual" para o leitor de tela.
    const current = page.locator('#catalogo [aria-current="page"]')
    await expect(current).toHaveCount(2)
    await expect(
      page.getByRole('navigation', { name: 'Paginação do catálogo' }).locator('[aria-current]'),
    ).toHaveText('2')
    await expect(
      page.getByRole('navigation', { name: 'Vitrines do catálogo' }).locator('[aria-current]'),
    ).toHaveText('Todos os NFTs')
    await expect(cards(page).first()).not.toHaveText(firstOnPage1 ?? '')
    const firstOnPage2 = await cards(page).first().textContent()

    await page.goBack()
    await expect(page).not.toHaveURL(/page=/)
    await expect(cards(page).first()).toHaveText(firstOnPage1 ?? '')

    await page.goForward()
    await expect(page).toHaveURL(/[?&]page=2/)
    await expect(cards(page).first()).toHaveText(firstOnPage2 ?? '')

    await page.getByRole('link', { name: 'Próxima página' }).click()
    await expect(page).toHaveURL(/[?&]page=3/)
  })

  test('abas trocam a vitrine e o card leva ao detalhe', async ({ page }) => {
    await page.getByRole('link', { name: 'Em alta' }).click()
    await expect(page).toHaveURL(/[?&]feed=trending/)
    await expect(page.getByRole('link', { name: 'Em alta' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expectTotal(page, await apiTotal(page, 'feed=trending'))

    const first = cards(page).first()
    const href = await first.getAttribute('href')
    await first.click()
    await expect(page).toHaveURL(new RegExp(`${href}$`))
  })

  test('valores inválidos na URL voltam ao padrão', async ({ page }) => {
    await page.goto('/?page=abc&sort=xyz&feed=nada&category=%5B%22inexistente%22%5D')
    await waitForApp(page)
    await expectTotal(page, await apiTotal(page))
    await expect(cards(page)).toHaveCount(9)
  })

  test('busca sem resultado oferece limpar os filtros', async ({ page }) => {
    await page.goto('/?q=zzzzzz')
    await waitForApp(page)
    await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()
    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(page).not.toHaveURL(/q=/)
    await expect(cards(page)).toHaveCount(9)
  })

  test('catálogo vazio da API mostra o estado vazio', async ({ page }) => {
    await setScenario(page, ['empty-catalog'])
    await page.reload()
    await waitForApp(page)
    await expect(page.getByText('Nenhum NFT encontrado.')).toBeVisible()
    await expect(resultCount(page)).toHaveText('0 NFTs encontrados')
  })

  test('mostra skeleton enquanto a API demora', async ({ page }) => {
    await setScenario(page, ['slow'], { routes: ['/nfts'] })
    await page.reload()
    await waitForApp(page)
    await expect(page.getByRole('status').filter({ hasText: 'Carregando NFTs…' })).toBeVisible()
    await expect(page.locator('#catalogo ul[aria-hidden="true"] > li')).toHaveCount(9)
    await expect(cards(page)).toHaveCount(9, { timeout: 15_000 })
  })

  test('erro da API mostra nova tentativa que recupera o catálogo', async ({ page }) => {
    await setScenario(page, ['server-error'], { routes: ['/nfts'] })
    await page.reload()
    await waitForApp(page)
    const alert = page
      .getByRole('alert')
      .filter({ hasText: 'Não foi possível carregar o catálogo.' })
    await expect(alert).toBeVisible({ timeout: 15_000 })

    await setScenario(page, [])
    await alert.getByRole('button', { name: 'Tentar de novo' }).click()
    await expect(cards(page)).toHaveCount(9, { timeout: 10_000 })
    await expect(alert).toBeHidden()
  })

  test('respostas fora de ordem não trocam o resultado do último filtro', async ({
    page,
    isMobile,
  }) => {
    await setScenario(page, ['jitter'], { routes: ['/nfts'], seed: 7 })
    await page.reload()
    await waitForApp(page)
    await expect(cards(page)).toHaveCount(9, { timeout: 10_000 })

    const panel = await filters(page, isMobile)
    // Cliques seguidos: cada um dispara uma consulta com latência diferente.
    await panel.getByRole('button', { name: /^Fotografia/ }).click()
    await panel.getByRole('button', { name: /^Música/ }).click()
    await panel.getByRole('button', { name: /^Fotografia/ }).click()
    await panel.getByRole('button', { name: /^Jogos/ }).click()
    await closeFilters(page, isMobile)

    await expect(page).toHaveURL(/category=/)
    const category = JSON.parse(new URL(page.url()).searchParams.get('category') ?? '[]')
    expect(category).toEqual(['music', 'gaming'])

    const expected = await apiFetch(page, 'GET', '/nfts?category=music,gaming')
    const names = ((expected.json as Json).items as Json[]).map((nft) => nft.name as string)
    await expectTotal(page, (expected.json as Json).total as number)
    await expect(cards(page)).toHaveCount(names.length)
    // Espera todas as respostas atrasadas chegarem e confere que nada antigo sobrescreveu.
    await page.waitForLoadState('networkidle')
    for (const [index, name] of names.entries()) {
      await expect(cards(page).nth(index)).toContainText(name)
    }
  })

  test('links de coleções do footer abrem o catálogo filtrado', async ({ page }) => {
    await page
      .getByRole('navigation', { name: 'Coleções' })
      .getByRole('link', { name: 'Fotografia' })
      .click()
    await expect(page).toHaveURL(/category=/)
    expect(JSON.parse(new URL(page.url()).searchParams.get('category') ?? '[]')).toEqual([
      'photography',
    ])
    await expectTotal(page, await apiTotal(page, 'category=photography'))
  })

  test('o botão de filtros do mobile anuncia quando há filtro aplicado', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'O botão de filtros só existe abaixo de 1024 px')
    const plain = page.getByRole('button', { name: 'Filtros e ordenação', exact: true })
    const applied = page.getByRole('button', {
      name: 'Filtros e ordenação (filtros aplicados)',
      exact: true,
    })
    await expect(plain).toBeVisible()

    // Ordenar não é filtrar: o nome não muda.
    await plain.click()
    const dialog = page.getByRole('dialog', { name: 'Filtros' })
    await dialog.getByRole('combobox', { name: 'Ordenar por:' }).click()
    await page.getByRole('option', { name: 'Menor preço' }).click()
    await expect(page).toHaveURL(/sort=price_asc/)
    await dialog.getByRole('button', { name: 'Fechar' }).click()
    await expect(plain).toBeFocused()

    // Busca conta como filtro.
    await page.getByRole('searchbox', { name: 'Buscar NFTs' }).fill('ape')
    await expect(applied).toBeVisible()

    // Filtro do menu, mantido no refresh.
    await applied.click()
    await dialog.getByRole('button', { name: /^Ethereum/ }).click()
    await dialog.getByRole('button', { name: 'Fechar' }).click()
    await expect(applied).toBeFocused()
    await page.reload()
    await waitForApp(page)
    await expect(applied).toBeVisible()

    // "Limpar filtros" volta ao nome simples.
    await applied.click()
    await dialog.getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(page).not.toHaveURL(/[?&](q|network)=/)
    await dialog.getByRole('button', { name: 'Fechar' }).click()
    await expect(plain).toBeFocused()
    await expect(applied).toHaveCount(0)
  })

  test('não há rolagem horizontal na tela inicial', async ({ page }) => {
    await expect(cards(page)).toHaveCount(9)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

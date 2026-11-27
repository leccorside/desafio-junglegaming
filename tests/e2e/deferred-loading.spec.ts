import { expect, test, type Page } from '@playwright/test'

import { isMobileViewport, loginViaUi } from '../fixtures/auth'
import { waitForApp } from '../fixtures/mocks'

/**
 * O que saiu do carregamento inicial para a Performance mobile do Lighthouse
 * (docs/PERFORMANCE.md):
 * - menu da conta e menu lateral carregados sob demanda, sem mudar o uso pelo
 *   mouse ou pelo teclado na primeira abertura;
 * - detalhe em duas renderizações: o topo primeiro, abas e "Mais desta
 *   coleção" depois da primeira pintura, sem deslocar o rodapé na tela.
 */

const USER_MENU_CHUNK = /\/assets\/user-menu-dropdown-[\w-]+\.js$/
const MOBILE_MENU_CHUNK = /\/assets\/mobile-menu-panel-[\w-]+\.js$/

/** Scripts pedidos pela página a partir de agora. */
function trackScripts(page: Page) {
  const urls: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'script') urls.push(new URL(request.url()).pathname)
  })
  return { has: (pattern: RegExp) => urls.some((url) => pattern.test(url)) }
}

/**
 * Gatilho do menu da conta pelo atributo: com o menu aberto (modal), o Radix
 * esconde o resto da página com `aria-hidden` e a busca por papel não o acha.
 */
const accountTrigger = (page: Page) => page.locator('header button[aria-haspopup="menu"]')

const settled = async (page: Page) => {
  await waitForApp(page)
  await page.waitForLoadState('networkidle')
}

test.describe('carregamento sob demanda', () => {
  test('bundle inicial sem o menu da conta e o painel do menu lateral', async ({ request }) => {
    const html = await (await request.get('/')).text()
    const initial = [
      ...html.matchAll(/<script type="module"[^>]*src="([^"]+)"/g),
      ...html.matchAll(/rel="modulepreload"[^>]*href="([^"]+)"/g),
    ].map((m) => m[1]!)
    expect(initial.length).toBeGreaterThan(3)
    const code = (
      await Promise.all(initial.map(async (url) => (await request.get(url)).text()))
    ).join('\n')
    // Marcas de cada parte: Radix Menu, painel do menu lateral e texto do detalhe.
    // Comparação booleana: numa falha, a mensagem não despeja o bundle inteiro.
    expect(code.includes('MenuContent'), 'Radix Menu no bundle inicial').toBe(false)
    expect(
      code.includes('Navegação principal do marketplace'),
      'painel do menu lateral no bundle inicial',
    ).toBe(false)
    expect(initial.some((url) => USER_MENU_CHUNK.test(url) || MOBILE_MENU_CHUNK.test(url))).toBe(
      false,
    )
  })

  test('menu da conta: baixa ao passar o ponteiro e abre pelo mouse como antes', async ({
    page,
  }) => {
    test.skip(isMobileViewport(page), 'O menu da conta é do header do desktop')
    await loginViaUi(page, 'ana@example.com')
    const scripts = trackScripts(page)
    await page.goto('/')
    await settled(page)
    expect(scripts.has(USER_MENU_CHUNK)).toBe(false)

    const trigger = page.getByRole('button', { name: /^Conta de/ })
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await trigger.hover()
    await expect.poll(() => scripts.has(USER_MENU_CHUNK)).toBe(true)
    await expect(page.getByRole('menu')).toHaveCount(0)

    await trigger.click()
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect(accountTrigger(page)).toHaveAttribute('aria-expanded', 'true')
    await expect(menu.getByRole('menuitem', { name: 'Sair' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(page.getByRole('button', { name: /^Conta de/ })).toBeFocused()
    await expect(accountTrigger(page)).toHaveAttribute('aria-expanded', 'false')
  })

  // O botão leve só dá lugar ao menu do Radix na ativação, então a primeira
  // abertura sempre passa pelo caminho sob demanda, com o módulo já baixado
  // (pré-carga no foco) ou ainda chegando.
  for (const key of ['Enter', 'ArrowDown']) {
    test(`menu da conta pelo teclado (${key}), primeira abertura: foco no primeiro item`, async ({
      page,
    }) => {
      test.skip(isMobileViewport(page), 'O menu da conta é do header do desktop')
      await loginViaUi(page, 'ana@example.com')
      const scripts = trackScripts(page)
      await page.goto('/')
      await settled(page)
      expect(scripts.has(USER_MENU_CHUNK)).toBe(false)

      const trigger = page.getByRole('button', { name: /^Conta de/ })
      await trigger.focus()
      await expect.poll(() => scripts.has(USER_MENU_CHUNK)).toBe(true)
      await expect(page.getByRole('menu')).toHaveCount(0)
      await page.keyboard.press(key)

      const menu = page.getByRole('menu')
      await expect(menu).toBeVisible()
      await expect(menu.getByRole('menuitem').first()).toBeFocused()
      await page.keyboard.press('ArrowDown')
      await expect(menu.getByRole('menuitem').nth(1)).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(menu).toBeHidden()
      await expect(page.getByRole('button', { name: /^Conta de/ })).toBeFocused()

      // Segunda abertura pelo mouse: o Radix foca o painel, não o 1º item.
      await page.getByRole('button', { name: /^Conta de/ }).click()
      await expect(menu).toBeVisible()
      await expect(menu.getByRole('menuitem').first()).not.toBeFocused()
      await page.keyboard.press('Escape')
    })
  }

  test('menu lateral, primeira abertura pelo teclado: foco em "Início" e o Esc devolve ao botão', async ({
    page,
  }) => {
    test.skip(!isMobileViewport(page), 'Menu lateral do mobile')
    const scripts = trackScripts(page)
    await page.goto('/')
    await settled(page)
    expect(scripts.has(MOBILE_MENU_CHUNK)).toBe(false)

    const open = page
      .getByRole('navigation', { name: 'Navegação inferior' })
      .getByRole('button', { name: 'Abrir menu' })
    await expect(open).toHaveAttribute('aria-haspopup', 'dialog')
    await expect(open).toHaveAttribute('aria-expanded', 'false')
    await open.focus()
    await expect.poll(() => scripts.has(MOBILE_MENU_CHUNK)).toBe(true)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.keyboard.press('Enter')

    const menu = page.getByRole('dialog')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('link', { name: 'Início' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(open).toBeFocused()
    await expect(open).toHaveAttribute('aria-expanded', 'false')

    // Já carregado: abre de novo pelo toque.
    await open.click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('detalhe: topo na primeira renderização, abas e "Mais desta coleção" depois', async ({
    page,
  }) => {
    // Cada lote do MutationObserver junta as mudanças de uma renderização do React.
    await page.addInitScript(() => {
      const seen: Record<string, number> = {}
      let batch = 0
      new MutationObserver(() => {
        batch += 1
        const mark = (key: string, selector: string) => {
          if (seen[key] === undefined && document.querySelector(selector)) seen[key] = batch
        }
        mark('title', 'main h1')
        mark('buy', 'main [data-nft-id] img[fetchpriority="high"]')
        mark('tabs', 'main [role="tablist"]')
        mark('related', 'main section[aria-labelledby="related-title"]')
      }).observe(document, { childList: true, subtree: true })
      ;(window as unknown as { __batches: typeof seen }).__batches = seen
    })
    await page.goto('/nft/nft-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByRole('tablist', { name: 'Informações do NFT' })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: /^Mais desta coleção/ })).toBeVisible()

    const batches = await page.evaluate(
      () => (window as unknown as { __batches: Record<string, number> }).__batches,
    )
    expect(batches.title).toBeGreaterThan(0)
    expect(batches.buy).toBe(batches.title)
    expect(batches.tabs).toBeGreaterThan(batches.title!)
    expect(batches.related).toBeGreaterThan(batches.title!)

    // As abas continuam funcionando depois da entrada tardia.
    await page.getByRole('tab', { name: /^Avaliações de colecionadores/ }).click()
    await expect(page.getByRole('tab', { name: /^Avaliações de colecionadores/ })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('detalhe: a entrada tardia da parte de baixo não desloca nada na tela', async ({ page }) => {
    // Tela do perfil desktop do Lighthouse: sem a reserva, o rodapé começa
    // dentro dela (y ≈ 889) e desce quando a parte de baixo entra.
    if (!isMobileViewport(page)) await page.setViewportSize({ width: 1350, height: 940 })
    await page.addInitScript(() => {
      const shifts: { value: number; nodes: string[] }[] = []
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as {
          value: number
          hadRecentInput: boolean
          sources: { node?: Node }[]
        }[]) {
          if (entry.hadRecentInput) continue
          shifts.push({
            value: entry.value,
            nodes: entry.sources.map((s) => (s.node as Element | undefined)?.tagName ?? '?'),
          })
        }
      }).observe({ type: 'layout-shift', buffered: true })
      ;(window as unknown as { __shifts: typeof shifts }).__shifts = shifts
    })
    await page.goto('/nft/nft-042')
    await expect(page.getByRole('heading', { level: 2, name: /^Mais desta coleção/ })).toBeVisible()
    await expect(page.locator('[data-below-fold-placeholder]')).toHaveCount(0)
    // Espera as imagens de "Mais desta coleção" e um quadro a mais.
    await page.waitForLoadState('networkidle')
    await page.evaluate(
      () => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve))),
    )
    const shifts = await page.evaluate(
      () => (window as unknown as { __shifts: { value: number; nodes: string[] }[] }).__shifts,
    )
    const total = shifts.reduce((sum, shift) => sum + shift.value, 0)
    expect(total, JSON.stringify(shifts)).toBeLessThan(0.01)
  })
})

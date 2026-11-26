import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { isMobileViewport, loginViaUi } from '../fixtures/auth'
import { apiFetch, resetMocks, setScenario, waitForApp } from '../fixtures/mocks'

/**
 * Acessibilidade (item 11 do enunciado e Passo 12): auditoria com axe em todas
 * as telas, navegação por teclado, foco em diálogos e drawers, validação de
 * formulários e ausência de overflow (390, 768, 1440 px e zoom de 200%).
 */

const GUEST_CART = '7b6f3c2e-9d1a-4c8b-a5e2-3f4d6b8c0a1e'

const token = (page: Page) =>
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('kurio:session')!) as { token: string }).token,
  )

/** Violações sérias ou críticas do axe (WCAG 2.0, 2.1 e 2.2, A e AA). */
async function seriousViolations(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa',
  ])
  if (include) builder = builder.include(include)
  const { violations } = await builder.analyze()
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
    }))
}

/** Espera skeletons e indicadores de carregamento sumirem. */
async function settled(page: Page) {
  await waitForApp(page)
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 })
  await page.waitForTimeout(300)
}

async function guestCart(page: Page) {
  await page.evaluate((id) => localStorage.setItem('kurio:guest-cart-id', id), GUEST_CART)
  for (const body of [
    { nftId: 'nft-042', editionId: 'nft-042-open', quantity: 2 },
    { nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 },
  ]) {
    await apiFetch(page, 'POST', '/cart/items', { body, cartId: GUEST_CART })
  }
}

async function anaCart(page: Page) {
  const auth = await token(page)
  for (const body of [
    { nftId: 'nft-042', editionId: 'nft-042-open', quantity: 2 },
    { nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 },
  ]) {
    await apiFetch(page, 'POST', '/cart/items', { token: auth, body })
  }
}

test.describe('acessibilidade: auditoria com axe', () => {
  // Cada teste percorre várias telas (e o axe leva 1 a 2 s por tela).
  test.describe.configure({ timeout: 90_000 })
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('telas públicas sem violações sérias ou críticas', async ({ page }) => {
    await guestCart(page)
    const found: Record<string, unknown> = {}
    for (const path of [
      '/',
      '/?page=2',
      '/nft/nft-042',
      '/nft/nft-552',
      '/cart',
      '/login',
      '/register',
      '/rota-que-nao-existe',
      '/nft/nft-000',
    ]) {
      await page.goto(path)
      await settled(page)
      const violations = await seriousViolations(page)
      if (violations.length) found[path] = violations
    }
    expect(found).toEqual({})
  })

  test('telas da conta, pagamento e pedido sem violações sérias ou críticas', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    await anaCart(page)
    const found: Record<string, unknown> = {}
    for (const path of [
      '/cart',
      '/checkout',
      '/profile',
      '/wallets',
      '/favorites',
      '/orders/ord-0001',
      '/orders/ord-0002',
    ]) {
      await page.goto(path)
      await settled(page)
      const violations = await seriousViolations(page)
      if (violations.length) found[path] = violations
    }
    expect(found).toEqual({})
  })

  test('diálogos e drawers abertos sem violações sérias ou críticas', async ({ page }) => {
    const found: Record<string, unknown> = {}
    await page.goto('/')
    await settled(page)

    let v: Awaited<ReturnType<typeof seriousViolations>>
    if (isMobileViewport(page)) {
      // Mobile: menu lateral pelo botão central da barra inferior.
      await page
        .getByRole('navigation', { name: 'Navegação inferior' })
        .getByRole('button', { name: 'Abrir menu' })
        .click()
      await expect(page.getByRole('dialog')).toBeVisible()
      v = await seriousViolations(page)
      if (v.length) found.menu = v
      await page.keyboard.press('Escape')
    } else {
      // Desktop: busca do header.
      await page.getByRole('button', { name: 'Buscar NFTs' }).click()
      await expect(page.getByRole('dialog', { name: 'Buscar NFTs' })).toBeVisible()
      v = await seriousViolations(page)
      if (v.length) found.busca = v
      await page.keyboard.press('Escape')
    }

    // Revisão da compra
    await loginViaUi(page, 'ana@example.com')
    await anaCart(page)
    await page.goto('/checkout')
    await settled(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(page.getByRole('dialog', { name: 'Revise sua compra' })).toBeVisible()
    await page.waitForTimeout(300)
    v = await seriousViolations(page)
    if (v.length) found.revisao = v

    expect(found).toEqual({})
  })

  test('recibo e pedido pendente sem violações sérias ou críticas', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    await anaCart(page)
    await setScenario(page, ['payment-confirmed'], { settleMs: 60_000 })
    await page.goto('/checkout')
    await settled(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await page
      .getByRole('dialog', { name: 'Revise sua compra' })
      .getByRole('button', { name: 'Confirmar e pagar' })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Aguardando a confirmação do pagamento' }),
    ).toBeVisible()
    const pending = await seriousViolations(page)
    expect(pending).toEqual([])
  })

  test('contraste: texto dos botões com gradiente cobre passa de 4,5:1 (mobile)', async ({
    page,
  }) => {
    test.skip(!isMobileViewport(page), 'O gradiente só existe no mobile')
    await guestCart(page)
    await page.goto('/cart')
    await settled(page)
    const summary = page.getByRole('region', { name: /Resumo/ }).filter({ visible: true })
    for (const name of ['Aplicar', 'Conectar e finalizar']) {
      const ratios = await summary.getByRole('button', { name }).evaluate((button) => {
        const rgb = (value: string) =>
          value
            .match(/\d+(\.\d+)?/g)!
            .slice(0, 3)
            .map(Number)
        const lum = ([r, g, b]: number[]) => {
          const f = (c: number) => {
            const s = c / 255
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
          }
          return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!)
        }
        const ratio = (a: number[], b: number[]) => {
          const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
          return (x! + 0.05) / (y! + 0.05)
        }
        // As duas pontas do gradiente vêm dos tokens --primary-hover e --primary.
        const probe = document.createElement('span')
        document.body.append(probe)
        const stops = ['--primary-hover', '--primary'].map((token) => {
          probe.style.color = `var(${token})`
          return rgb(getComputedStyle(probe).color)
        })
        probe.remove()
        const text = rgb(getComputedStyle(button).color)
        return stops.map((stop) => ratio(text, stop))
      })
      for (const value of ratios) expect(value, name).toBeGreaterThanOrEqual(4.5)
    }
  })
})

/** Aperta Tab até o elemento receber o foco (prova que o teclado chega nele). */
async function tabTo(page: Page, target: ReturnType<Page['locator']>, max = 200) {
  for (let i = 0; i < max; i += 1) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return
    await page.keyboard.press('Tab')
  }
  throw new Error(`O Tab não chegou ao elemento em ${max} passos`)
}

const focusedInside = (page: Page, selector: string) =>
  page.evaluate((sel) => Boolean(document.activeElement?.closest(sel)), selector)

/** O elemento focado tem indicador visível (contorno ou sombra). */
const focusIndicator = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null
    if (!el || el === document.body) return null
    // O anel pode estar no próprio elemento ou na caixa em volta (campo sem
    // borda dentro de um contorno, que acende com `:has(:focus-visible)`).
    const ringed = (node: Element) => {
      const cs = getComputedStyle(node)
      return (
        (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || cs.boxShadow !== 'none'
      )
    }
    let visible = false
    for (let node: Element | null = el, depth = 0; node && depth < 3; node = node.parentElement) {
      if (ringed(node)) visible = true
      depth += 1
    }
    return {
      name: (el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim().slice(0, 40),
      visible,
    }
  })

test.describe('acessibilidade: teclado e foco', () => {
  // Cada teste percorre várias telas (e o axe leva 1 a 2 s por tela).
  test.describe.configure({ timeout: 90_000 })
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('"Pular para o conteúdo" é o primeiro Tab e leva o foco ao conteúdo', async ({ page }) => {
    await page.goto('/nft/nft-042')
    await settled(page)
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeInViewport()
    await page.keyboard.press('Enter')
    await expect(page.locator('main#conteudo')).toBeFocused()
    await page.keyboard.press('Tab')
    expect(await focusedInside(page, 'main#conteudo')).toBe(true)
  })

  /** Percorre a tela com Tab até o fim do conteúdo (ou `max` passos) e lista quem ficou sem anel. */
  async function missingRings(page: Page, max: number) {
    const missing: string[] = []
    for (let i = 0; i < max; i += 1) {
      await page.keyboard.press('Tab')
      const focus = await focusIndicator(page)
      if (focus && !focus.visible) missing.push(focus.name)
      // Chegou ao rodapé: o conteúdo da tela já foi todo percorrido.
      if (await focusedInside(page, 'footer')) break
    }
    return missing
  }

  test('todo elemento alcançado pelo Tab mostra o foco', async ({ page }) => {
    for (const path of ['/', '/nft/nft-042', '/login']) {
      await page.goto(path)
      await settled(page)
      expect(await missingRings(page, 40), path).toEqual([])
    }
  })

  test('todo elemento alcançado pelo Tab mostra o foco: carrinho, pagamento, perfil e carteiras', async ({
    page,
  }) => {
    await loginViaUi(page, 'ana@example.com')
    await anaCart(page)
    for (const path of ['/cart', '/checkout', '/profile', '/wallets']) {
      await page.goto(path)
      await settled(page)
      expect(await missingRings(page, 80), path).toEqual([])
    }
  })

  test('menu da conta aberto: cada item focado pelas setas tem anel próprio e fundo de destaque', async ({
    page,
  }) => {
    test.skip(isMobileViewport(page), 'O menu da conta é do header do desktop')
    await loginViaUi(page, 'ana@example.com')
    await page.goto('/')
    await settled(page)
    await page.getByRole('button', { name: /^Conta de/ }).focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    const items = await menu.getByRole('menuitem').count()
    expect(items).toBeGreaterThan(2)
    // Espera o primeiro item receber o foco (o Radix foca o item depois de abrir).
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    const focusedName = () => page.evaluate(() => document.activeElement?.textContent?.trim() ?? '')
    const seen = new Set<string>()
    for (let i = 0; i < items; i += 1) {
      const state = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement
        const cs = getComputedStyle(el)
        const menuBg = getComputedStyle(el.closest('[role="menu"]')!).backgroundColor
        return {
          role: el.getAttribute('role'),
          name: el.textContent?.trim() ?? '',
          // O anel tem de estar no próprio item (o contorno do menu não conta).
          ring: cs.outlineStyle === 'solid' && parseFloat(cs.outlineWidth) >= 2,
          highlighted: cs.backgroundColor !== menuBg && cs.backgroundColor !== 'rgba(0, 0, 0, 0)',
        }
      })
      expect(state.role, state.name).toBe('menuitem')
      expect(state.ring, state.name).toBe(true)
      expect(state.highlighted, state.name).toBe(true)
      seen.add(state.name)
      if (i === items - 1) break
      await page.keyboard.press('ArrowDown')
      // Só lê o próximo depois de o foco andar (sob carga, a leitura podia vir antes).
      await expect.poll(focusedName).not.toBe(state.name)
    }
    expect([...seen]).toHaveLength(items)
    expect(seen.has('Sair')).toBe(true)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: /^Conta de/ })).toBeFocused()
  })

  test('menu lateral do mobile abre com o foco em "Início", não em "Sair"', async ({ page }) => {
    test.skip(!isMobileViewport(page), 'Menu lateral do mobile')
    for (const logged of [false, true]) {
      if (logged) await loginViaUi(page, 'ana@example.com')
      await page.goto('/')
      await settled(page)
      const open = page
        .getByRole('navigation', { name: 'Navegação inferior' })
        .getByRole('button', { name: 'Abrir menu' })
      await open.focus()
      await page.keyboard.press('Enter')
      const menu = page.getByRole('dialog')
      await expect(menu).toBeVisible()
      await expect(menu.getByRole('link', { name: 'Início' })).toBeFocused()
      if (logged) {
        // Enter de novo não sai da conta: leva ao início e fecha o menu.
        await expect(menu.getByRole('button', { name: 'Sair' })).not.toBeFocused()
        await page.keyboard.press('Enter')
        await expect(menu).toBeHidden()
        await expect(page.getByText('Você saiu da sua conta.')).toHaveCount(0)
        await expect(page.getByRole('link', { name: 'Perfil' }).last()).toBeVisible()
        expect(await page.evaluate(() => localStorage.getItem('kurio:session'))).not.toBeNull()
      } else {
        await page.keyboard.press('Escape')
        await expect(menu).toBeHidden()
        await expect(open).toBeFocused()
      }
    }
  })

  test('sair da conta: foco no "Entrar" do header (desktop) ou no título da tela (mobile)', async ({
    page,
  }) => {
    const signOut = async () => {
      if (isMobileViewport(page)) {
        await page
          .getByRole('navigation', { name: 'Navegação inferior' })
          .getByRole('button', { name: 'Abrir menu' })
          .focus()
        await page.keyboard.press('Enter')
        await tabTo(page, page.getByRole('dialog').getByRole('button', { name: 'Sair' }), 30)
        await page.keyboard.press('Enter')
      } else {
        await page.getByRole('button', { name: /^Conta de/ }).focus()
        await page.keyboard.press('Enter')
        const out = page.getByRole('menuitem', { name: 'Sair' })
        for (let i = 0; i < 10; i += 1) {
          if (await out.evaluate((el) => el === document.activeElement)) break
          await page.keyboard.press('ArrowDown')
        }
        await page.keyboard.press('Enter')
      }
      await expect(page.getByText('Você saiu da sua conta.')).toBeVisible()
    }
    const expected = () =>
      isMobileViewport(page)
        ? page.locator('main#conteudo h1').filter({ visible: true })
        : page.locator('[data-login-link]')

    // Tela pública: a página fica e o foco vai ao "Entrar" (ou ao título).
    // (A tela inicial: no detalhe, o mobile troca a barra de navegação pela de compra.)
    await loginViaUi(page, 'ana@example.com')
    await page.goto('/')
    await settled(page)
    await signOut()
    await expect(expected()).toBeFocused()
    // O foco continua lá depois de o menu e o toast se acomodarem.
    await page.waitForTimeout(1200)
    await expect(expected()).toBeFocused()

    // Tela privada: volta ao início com o mesmo destino do foco.
    await loginViaUi(page, 'ana@example.com')
    await page.goto('/profile')
    await settled(page)
    await signOut()
    await expect(page).toHaveURL(/\/$/)
    await expect(expected()).toBeFocused()
    await page.waitForTimeout(1200)
    await expect(expected()).toBeFocused()
  })

  test('cupom: anel na caixa, foco no "Remover cupom" ao aplicar e de volta no campo ao remover', async ({
    page,
  }) => {
    await loginViaUi(page, 'ana@example.com')
    await anaCart(page)
    await page.goto('/cart')
    await settled(page)
    const summary = page.getByRole('region', { name: /Resumo/ }).filter({ visible: true })
    const field = summary.getByRole('textbox', { name: 'Código promocional' })
    await tabTo(page, field)
    // O anel fica na caixa em volta do campo (o campo não tem contorno próprio).
    const box = await field.evaluate((el) => {
      const cs = getComputedStyle(el.parentElement!)
      return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth) }
    })
    expect(box).toEqual({ style: 'solid', width: 2 })

    // Código inválido: o foco fica no campo, com o erro ligado.
    await page.keyboard.type('nada')
    await page.keyboard.press('Enter')
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toBeFocused()

    await field.fill('')
    await page.keyboard.type('bemvindo10')
    await page.keyboard.press('Enter')
    const remove = summary.getByRole('button', { name: 'Remover cupom' })
    await expect(remove).toBeFocused()
    await expect(page.getByText('Cupom BEMVINDO10 aplicado.')).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(field).toBeFocused()
    await expect(field).toHaveValue('')
    await expect(page.getByText('Cupom BEMVINDO10 removido.')).toBeVisible()

    // Carregar o carrinho já com cupom não mexe no foco.
    await page.keyboard.type('bemvindo10')
    await page.keyboard.press('Enter')
    await expect(remove).toBeFocused()
    await page.reload()
    await settled(page)
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)
  })

  test('carteiras: foco no "Salvar" durante o envio, no "Editar" ao salvar ou cancelar a secundária, e o aviso de sucesso sai com um erro', async ({
    page,
  }) => {
    await loginViaUi(page, 'ana@example.com')
    await page.goto('/wallets')
    await settled(page)
    const primary = page.getByRole('form', { name: 'Carteira principal' })
    const save = primary.getByRole('button', { name: /^(Salvar carteira|Salvando…)$/ })

    // Latência de 2,5 s: o botão fica em envio, com o foco nele.
    await setScenario(page, ['slow'])
    await tabTo(page, save)
    await page.keyboard.press('Enter')
    await expect(save).toHaveAttribute('aria-disabled', 'true')
    await expect(save).toBeFocused()
    const saved = page
      .locator('[data-sonner-toast]')
      .filter({ hasText: 'Carteira principal salva.' })
    await expect(saved).toBeVisible({ timeout: 15_000 })
    await expect(save).toBeFocused()
    await expect(save).not.toHaveAttribute('aria-disabled', 'true')
    await setScenario(page, [])

    // Secundária com erro: o aviso de sucesso da principal sai da tela.
    const edit = page.getByRole('button', { name: 'Editar carteira secundária' })
    await tabTo(page, edit)
    await page.keyboard.press('Enter')
    const secondary = page.getByRole('form', { name: 'Carteira secundária' })
    const nick = secondary.getByRole('textbox', { name: /^Apelido da carteira/ })
    await expect(nick).toBeFocused()
    await page.keyboard.press('Control+A')
    await page.keyboard.press('Backspace')
    await tabTo(page, secondary.getByRole('button', { name: 'Salvar carteira' }), 15)
    await page.keyboard.press('Enter')
    await expect(nick).toBeFocused()
    await expect(nick).toHaveAccessibleDescription('Informe um apelido.')
    await expect(saved).toHaveCount(0)

    // Salvar: o formulário fecha e o foco vai ao "Editar", na tela.
    await page.keyboard.type('Reserva da Ana')
    await tabTo(page, secondary.getByRole('button', { name: 'Salvar carteira' }), 15)
    await page.keyboard.press('Enter')
    await expect(secondary).toHaveCount(0)
    await expect(edit).toBeFocused()
    await expect(edit).toBeInViewport()
    await expect(page.getByText('Apelido:').last()).toBeVisible()

    // Cancelar também devolve o foco ao "Editar".
    await page.keyboard.press('Enter')
    await expect(nick).toBeFocused()
    await tabTo(page, secondary.getByRole('button', { name: 'Cancelar' }), 15)
    await page.keyboard.press('Enter')
    await expect(secondary).toHaveCount(0)
    await expect(edit).toBeFocused()
  })

  test('carrinho: token e edição em linhas próprias, sem corte', async ({ page }) => {
    test.skip(isMobileViewport(page), 'No mobile a linha do item tem outro layout')
    await loginViaUi(page, 'ana@example.com')
    await anaCart(page)
    await page.goto('/cart')
    await settled(page)
    const metas = page.getByRole('list', { name: 'Itens do carrinho' }).locator('[data-item-meta]')
    await expect(metas).toHaveCount(2)
    for (const meta of await metas.all()) {
      const token = (await meta.locator('[data-item-token]').boundingBox())!
      const edition = (await meta.locator('[data-item-edition]').boundingBox())!
      expect(edition.y).toBeGreaterThanOrEqual(token.y + token.height)
      expect(Math.abs(edition.x - token.x)).toBeLessThan(1)
      expect(token.height).toBeLessThan(20)
      expect(edition.height).toBeLessThan(20)
      await expect(meta).toHaveText(/^ID do token: #\d+, Edição aberta$/)
    }
  })

  test('troca de página: foco no título e título da aba atualizado; no carregamento, o foco não muda', async ({
    page,
  }) => {
    await page.goto('/nft/nft-042')
    await settled(page)
    await expect(page).toHaveTitle('Emerald Ape #042 | KURIO')
    // Carregamento direto: o primeiro Tab continua sendo o "Pular para o conteúdo".
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true)

    await page.goto('/')
    await settled(page)
    await expect(page).toHaveTitle('KURIO | Marketplace de NFTs')
    const card = page
      .locator('#catalogo')
      .getByRole('link', { name: /Emerald Ape #042/ })
      .first()
    await card.focus()
    await page.keyboard.press('Enter')
    const heading = page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })
    await expect(heading).toBeFocused()
    await expect(page).toHaveTitle('Emerald Ape #042 | KURIO')
    // O próximo Tab sai do título para o conteúdo da página, não do topo.
    await page.keyboard.press('Tab')
    expect(await focusedInside(page, 'main#conteudo')).toBe(true)
  })

  test('diálogo e drawer: foco preso dentro, Esc fecha e devolve o foco ao botão', async ({
    page,
  }) => {
    await page.goto('/')
    await settled(page)
    const trigger = isMobileViewport(page)
      ? page
          .getByRole('navigation', { name: 'Navegação inferior' })
          .getByRole('button', { name: 'Abrir menu' })
      : page.getByRole('button', { name: 'Buscar NFTs' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    expect(await focusedInside(page, '[role="dialog"]')).toBe(true)
    for (let i = 0; i < 25; i += 1) {
      await page.keyboard.press('Tab')
      expect(await focusedInside(page, '[role="dialog"]')).toBe(true)
    }
    for (let i = 0; i < 5; i += 1) {
      await page.keyboard.press('Shift+Tab')
      expect(await focusedInside(page, '[role="dialog"]')).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('compra inteira só pelo teclado, do detalhe ao recibo', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    await setScenario(page, ['payment-confirmed'], { settleMs: 800 })
    await page.goto('/nft/nft-042')
    await settled(page)

    // Edição pelas setas e quantidade pelos botões.
    // Edições: 1/1, 1/10, 1/50 e aberta (a marcada, mais barata).
    await tabTo(page, page.getByRole('radio', { name: /^Edição aberta/ }))
    await page.keyboard.press('ArrowLeft')
    await expect(page.getByRole('radio', { name: /^Edição 1\/50/ })).toBeFocused()
    await expect(page.getByRole('radio', { name: /^Edição 1\/50/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('radio', { name: /^Edição aberta/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await tabTo(
      page,
      page.getByRole('button', { name: 'Aumentar quantidade' }).filter({ visible: true }),
    )
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('spinbutton', { name: /^(Quantidade|Qtd\.)$/ }).filter({ visible: true }),
    ).toHaveValue('2')

    if (isMobileViewport(page)) {
      await tabTo(page, page.getByRole('button', { name: 'Adicionar ao carrinho' }))
      await page.keyboard.press('Enter')
      await expect(page.getByText(/adicionado ao carrinho/)).toBeVisible()
      await page.goto('/cart')
      await settled(page)
    } else {
      await tabTo(page, page.getByRole('button', { name: 'COMPRAR', exact: true }))
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/\/cart$/)
      await settled(page)
    }

    const finish = page
      .getByRole('region', { name: /Resumo/ })
      .filter({ visible: true })
      .getByRole('button', { name: 'Conectar e finalizar' })
    await tabTo(page, finish)
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/checkout$/)
    await settled(page)

    const confirm = page.getByRole('button', { name: 'Confirmar compra' })
    await tabTo(page, confirm)
    await page.keyboard.press('Enter')
    const review = page.getByRole('dialog', { name: 'Revise sua compra' })
    await expect(review).toBeVisible()
    expect(await focusedInside(page, '[role="dialog"]')).toBe(true)
    // Esc fecha a revisão e devolve o foco ao "Confirmar compra".
    await page.keyboard.press('Escape')
    await expect(review).toBeHidden()
    await expect(confirm).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(review).toBeVisible()
    await tabTo(page, review.getByRole('button', { name: 'Confirmar e pagar' }), 30)
    await page.keyboard.press('Enter')

    await expect(page).toHaveURL(/\/orders\/ord-/)
    const receiptTitle = page.getByRole('heading', { level: 1, name: 'Pagamento confirmado' })
    await expect(receiptTitle).toBeVisible({ timeout: 15_000 })
    // O título do recibo substitui o de "aguardando" e fica com o foco.
    await expect(receiptTitle).toBeFocused()
    // O endereço é o mesmo, mas a aba acompanha a situação do pedido.
    await expect(page).toHaveTitle('Pagamento confirmado | KURIO')
    await tabTo(page, page.getByRole('link', { name: 'Ver no Etherscan (abre em nova aba)' }), 15)
  })

  test('adicionar ao carrinho: o foco fica no botão enquanto a API responde', async ({ page }) => {
    await page.goto('/nft/nft-042')
    await settled(page)
    // Latência de 2,5 s: dá para ver o botão em envio.
    await setScenario(page, ['slow'])
    // No desktop o texto vira "Adicionando…" durante o envio.
    const button = isMobileViewport(page)
      ? page.getByRole('button', { name: 'Adicionar ao carrinho' })
      : page.getByRole('button', { name: /^(COMPRAR|Adicionando…)$/ })
    await tabTo(page, button)
    await page.keyboard.press('Enter')
    await expect(button).toHaveAttribute('aria-disabled', 'true')
    await expect(button).toHaveAttribute('aria-busy', 'true')
    await expect(button).toBeFocused()
    // Enter repetido durante o envio não adiciona de novo.
    await page.keyboard.press('Enter')
    await expect(page.getByText(/adicionado ao carrinho/).first()).toBeVisible({
      timeout: 15_000,
    })
    if (isMobileViewport(page)) {
      await expect(button).toBeFocused()
      await expect(button).not.toHaveAttribute('aria-disabled', 'true')
    } else {
      await expect(page).toHaveURL(/\/cart$/)
    }
    const cartId = await page.evaluate(() => localStorage.getItem('kurio:guest-cart-id') ?? '')
    const cart = (await apiFetch(page, 'GET', '/cart', { cartId })).json as {
      items: { quantity: number }[]
    }
    expect(cart.items.map((i) => i.quantity)).toEqual([1])
  })

  test('toast: "Ver carrinho" com anel de foco e, no carrinho, o foco fica no título', async ({
    page,
  }) => {
    test.skip(
      !isMobileViewport(page),
      'O toast com "Ver carrinho" é do botão do carrinho no mobile',
    )
    await page.goto('/nft/nft-042')
    await settled(page)
    await tabTo(page, page.getByRole('button', { name: 'Adicionar ao carrinho' }))
    await page.keyboard.press('Enter')
    const action = page.getByRole('button', { name: 'Ver carrinho' })
    await expect(action).toBeVisible()
    await tabTo(page, action, 60)
    const ring = await action.evaluate((el) => {
      const cs = getComputedStyle(el)
      const probe = document.createElement('span')
      probe.style.color = 'var(--ring)'
      document.body.append(probe)
      const ringColor = getComputedStyle(probe).color
      probe.remove()
      return { style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor, ringColor }
    })
    expect(ring.style).toBe('solid')
    expect(parseFloat(ring.width)).toBeGreaterThanOrEqual(2)
    expect(ring.color).toBe(ring.ringColor)

    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/cart$/)
    const heading = page.getByRole('heading', { level: 1, name: 'Carrinho de NFTs' })
    await expect(heading).toBeFocused()
    // O toast fecha depois e tentaria devolver o foco ao rodapé: o título segura.
    await page.waitForTimeout(1200)
    await expect(heading).toBeFocused()
    expect(await focusedInside(page, 'footer')).toBe(false)
  })

  test('pagamento e revisão: token e edição em linhas próprias, sem corte', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    await anaCart(page)
    await page.goto('/checkout')
    await settled(page)

    const checkLines = async (scope: ReturnType<Page['locator']>) => {
      const items = scope.locator('[data-item-meta]')
      await expect(items).toHaveCount(2)
      for (const meta of await items.all()) {
        await expect(meta.locator('[data-item-edition]')).toHaveText('Edição aberta')
        const [token, edition] = [
          (await meta.locator('[data-item-token]').boundingBox())!,
          (await meta.locator('[data-item-edition]').boundingBox())!,
        ]
        expect(edition.y).toBeGreaterThanOrEqual(token.y + token.height)
        expect(token.height).toBeLessThan(20)
        expect(edition.height).toBeLessThan(20)
        expect(await meta.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
        await expect(meta).toHaveText(/^ID do token: #\d+, Edição aberta$/)
      }
    }
    await checkLines(page.getByRole('list', { name: 'Itens da compra' }).first())

    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    const review = page.getByRole('dialog', { name: 'Revise sua compra' })
    await expect(review).toBeVisible()
    await checkLines(review)
  })
})

test.describe('acessibilidade: validação de formulários', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  /** Campo focado, inválido e com a mensagem ligada por aria-describedby. */
  async function expectFieldError(page: Page, name: string | RegExp, message: string) {
    const field = page.getByRole('textbox', { name })
    await expect(field).toBeFocused()
    await expect(field).toHaveAttribute('aria-invalid', 'true')
    await expect(field).toHaveAccessibleDescription(new RegExp(message.replace(/\./g, '\\.')))
    await expect(field).toBeInViewport()
  }

  test('login e cadastro: o primeiro campo com erro recebe o foco e anuncia a mensagem', async ({
    page,
  }) => {
    await page.goto('/login')
    await settled(page)
    await page.getByRole('textbox', { name: 'E-mail', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expectFieldError(page, 'E-mail', 'Informe um e-mail válido.')

    await page.getByRole('textbox', { name: 'E-mail', exact: true }).fill('ana@example.com')
    await page.keyboard.press('Enter')
    const password = page.getByLabel('Senha', { exact: true })
    await expect(password).toBeFocused()
    await expect(password).toHaveAttribute('aria-invalid', 'true')
    await expect(password).toHaveAccessibleDescription(/Informe a senha\./)

    // Erro da API: aviso geral em role="alert", sem dizer qual campo.
    await password.fill('errada123')
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('alert').filter({ hasText: 'E-mail ou senha incorretos.' }),
    ).toBeVisible()
  })

  test('pagamento e perfil: erro no campo certo, com foco e descrição', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    await anaCart(page)
    await page.goto('/checkout')
    await settled(page)
    const name = page.getByRole('textbox', { name: /^Nome de exibição/ })
    await name.fill('')
    await tabTo(page, page.getByRole('button', { name: 'Confirmar compra' }))
    await page.keyboard.press('Enter')
    await expectFieldError(page, /^Nome de exibição/, 'Informe o nome de exibição.')
    await expect(page.getByRole('dialog')).toHaveCount(0)

    await page.goto('/profile')
    await settled(page)
    const profileName = page.getByRole('textbox', { name: /^Nome de exibição/ })
    await profileName.fill('')
    await tabTo(page, page.getByRole('button', { name: 'Salvar' }))
    await page.keyboard.press('Enter')
    await expectFieldError(page, /^Nome de exibição/, 'Informe o nome de exibição.')
  })
})

test.describe('acessibilidade: largura e zoom', () => {
  // Cada teste percorre várias telas (e o axe leva 1 a 2 s por tela).
  test.describe.configure({ timeout: 90_000 })
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  /** Elementos que passam da borda direita, fora de áreas com rolagem horizontal própria. */
  const overflowing = (page: Page) =>
    page.evaluate(() => {
      const scrolls = (el: Element | null): boolean => {
        for (let node = el?.parentElement; node; node = node.parentElement) {
          const x = getComputedStyle(node).overflowX
          if (x === 'auto' || x === 'scroll' || x === 'hidden' || x === 'clip') {
            if (node !== document.body && node !== document.documentElement) return true
          }
        }
        return false
      }
      const doc = document.documentElement
      const pageScroll = doc.scrollWidth > doc.clientWidth + 1
      const items = [...document.querySelectorAll('body *')]
        .filter((el) => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.right > window.innerWidth + 1 && !scrolls(el)
        })
        .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 24)}"`)
      return { pageScroll, items: items.slice(0, 8) }
    })

  async function checkPages(page: Page, label: string) {
    const found: Record<string, unknown> = {}
    const pages = [
      '/',
      '/nft/nft-042',
      '/cart',
      '/checkout',
      '/profile',
      '/wallets',
      '/favorites',
      '/orders/ord-0001',
    ]
    for (const path of pages) {
      await page.goto(path)
      await settled(page)
      // Cada tela tem um título visível (a inicial tem um por layout).
      await expect(page.locator('main#conteudo h1').filter({ visible: true })).toHaveCount(1)
      const result = await overflowing(page)
      if (result.pageScroll || result.items.length) found[`${label} ${path}`] = result
    }
    return found
  }

  test('sem rolagem horizontal em 390, 768 e 1440 px', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    await anaCart(page)
    if (isMobileViewport(page)) {
      expect(await checkPages(page, '390')).toEqual({})
    } else {
      await page.setViewportSize({ width: 1440, height: 900 })
      const wide = await checkPages(page, '1440')
      await page.setViewportSize({ width: 768, height: 1024 })
      const tablet = await checkPages(page, '768')
      expect({ ...wide, ...tablet }).toEqual({})
    }
  })

  test('zoom de 200%: sem rolagem horizontal e com o conteúdo alcançável', async ({ page }) => {
    test.skip(isMobileViewport(page), 'Zoom do navegador no desktop')
    await loginViaUi(page, 'ana@example.com')
    await anaCart(page)
    // 1280 × 800 com zoom de 200% equivale a uma janela de 640 × 400 px CSS.
    await page.setViewportSize({ width: 640, height: 400 })
    expect(await checkPages(page, 'zoom 200%')).toEqual({})

    // As ações principais continuam ao alcance (rolando, sem cortar).
    await page.goto('/cart')
    await settled(page)
    const finish = page
      .getByRole('region', { name: /Resumo/ })
      .filter({ visible: true })
      .getByRole('button', { name: 'Conectar e finalizar' })
    await finish.scrollIntoViewIfNeeded()
    await expect(finish).toBeInViewport()
    await finish.click()
    await expect(page).toHaveURL(/\/checkout$/)
  })
})

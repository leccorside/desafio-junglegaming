import { expect, test, type Locator, type Page } from '@playwright/test'

import { isMobileViewport, loginViaUi } from '../fixtures/auth'
import { resetMocks, waitForApp } from '../fixtures/mocks'

/**
 * Links e ações fora do escopo (Passo 13, RF-39): páginas editoriais, suporte,
 * atividade, ofertas, downloads, redes sociais, newsletter, recuperação de
 * senha e login social. Ficam visíveis (Figma), mas não parecem funcionar:
 * nada de link morto, de página genérica nem de mensagem de sucesso.
 */

const toasts = (page: Page) => page.locator('[data-sonner-toast]')

/** Aciona o item e confere: aviso `info` de indisponível, sem sucesso e sem navegar. */
async function expectUnavailable(page: Page, item: Locator, message: string, how: 'click' | 'key') {
  const before = page.url()
  await expect(item).toHaveAttribute('aria-disabled', 'true')
  expect(await item.getAttribute('href')).toBeNull()
  if (how === 'key') {
    await item.focus()
    await page.keyboard.press('Enter')
  } else {
    // Clique forçado: o Playwright trata aria-disabled como desabilitado; o
    // navegador não. No centro da tela, para a barra fixa do mobile não cobrir.
    await item.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await item.click({ force: true })
  }
  const toast = toasts(page).filter({ hasText: message })
  await expect(toast).toBeVisible()
  await expect(toast).toHaveAttribute('data-type', 'info')
  expect(await toasts(page).and(page.locator('[data-type="success"]')).count()).toBe(0)
  expect(page.url()).toBe(before)
}

test.describe('links e ações fora do escopo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('navegação principal e rodapé: áreas fora do escopo avisam, pelo clique e pelo teclado', async ({
    page,
  }) => {
    await page.goto('/')
    await waitForApp(page)
    if (isMobileViewport(page)) {
      await page
        .getByRole('navigation', { name: 'Navegação inferior' })
        .getByRole('button', { name: 'Abrir menu' })
        .click()
      const menu = page.getByRole('dialog')
      await expectUnavailable(
        page,
        menu.getByRole('button', { name: /^Criadores/ }),
        'Criadores: indisponível nesta demonstração.',
        'key',
      )
      await page.keyboard.press('Escape')
    } else {
      const header = page.getByRole('navigation', { name: 'Principal' })
      await expectUnavailable(
        page,
        header.getByRole('button', { name: /^Criadores/ }),
        'Criadores: indisponível nesta demonstração.',
        'click',
      )
      await expectUnavailable(
        page,
        header.getByRole('button', { name: /^Aprenda/ }),
        'Aprenda: indisponível nesta demonstração.',
        'key',
      )
    }

    const footer = page.getByRole('contentinfo')
    for (const [name, how] of [
      ['Minha coleção', 'click'],
      ['Central de ajuda', 'key'],
      ['Denunciar item', 'click'],
    ] as const) {
      await expectUnavailable(
        page,
        footer.getByRole('button', { name: new RegExp(`^${name}`) }),
        `${name}: indisponível nesta demonstração.`,
        how,
      )
    }
    // Redes sociais: a Kurio não tem perfis; nada de abrir a página genérica da rede.
    await expectUnavailable(
      page,
      footer.getByRole('button', { name: 'Instagram (indisponível nesta demonstração)' }),
      'Perfil da Kurio no Instagram: indisponível nesta demonstração.',
      'key',
    )
    // Contatos de exemplo: texto, sem mailto/tel.
    await expect(footer.locator('a[href^="mailto:"], a[href^="tel:"]')).toHaveCount(0)
    await expect(footer.getByText('contato@email.com')).toBeVisible()

    // Newsletter: aviso informativo, sem "inscrito com sucesso".
    await footer.getByRole('textbox', { name: 'E-mail para a newsletter' }).fill('eu@example.com')
    await footer.getByRole('button', { name: 'Enviar' }).click()
    const news = toasts(page).filter({ hasText: 'A newsletter não está disponível' })
    await expect(news).toHaveAttribute('data-type', 'info')

    // "Ler mais" do blog da tela inicial.
    await expectUnavailable(
      page,
      page.getByRole('button', { name: /^Ler mais/ }).first(),
      'O artigo completo: indisponível nesta demonstração.',
      'click',
    )
  })

  test('menu da conta e entrada: Atividade, Ofertas, Suporte, recuperação de senha e login social', async ({
    page,
  }) => {
    await page.goto('/login')
    await waitForApp(page)
    const auth = isMobileViewport(page) ? page : page.getByRole('dialog')
    await auth.getByRole('button', { name: 'Esqueceu a senha?' }).click({ force: true })
    await expect(
      toasts(page).filter({ hasText: 'A recuperação de senha não está disponível' }),
    ).toHaveAttribute('data-type', 'info')
    await auth.getByRole('button', { name: /^Continuar com Google/ }).click({ force: true })
    await expect(
      toasts(page).filter({ hasText: 'Entrar com Google não está disponível' }),
    ).toHaveAttribute('data-type', 'info')
    await expect(page).toHaveURL(/\/login/)
    expect(await page.evaluate(() => localStorage.getItem('kurio:session'))).toBeNull()

    test.skip(isMobileViewport(page), 'O menu "Meu perfil" com essas áreas é do desktop')
    await loginViaUi(page, 'ana@example.com')
    await page.goto('/profile')
    await waitForApp(page)
    const account = page.getByRole('navigation', { name: 'Minha conta' })
    for (const name of ['Atividade', 'Ofertas', 'Arquivos baixados', 'Suporte']) {
      await expectUnavailable(
        page,
        account.getByRole('button', { name: new RegExp(`^${name}`) }),
        `${name}: indisponível nesta demonstração.`,
        name === 'Suporte' ? 'key' : 'click',
      )
    }
  })

  test('nenhum item desabilitado de nenhuma tela mostra sucesso nem troca de página', async ({
    page,
  }) => {
    test.setTimeout(120_000)
    const sweep = async (path: string) => {
      await page.goto(path)
      await waitForApp(page)
      // Com um diálogo aberto (login no desktop), só o que está nele recebe cliques.
      const dialog = page.getByRole('dialog').filter({ visible: true })
      const scope = (await dialog.count()) ? dialog : page.locator('body')
      const items = scope.locator('[aria-disabled="true"]').filter({ visible: true })
      const count = await items.count()
      for (let i = 0; i < count; i += 1) {
        const before = new URL(page.url()).pathname
        await items
          .nth(i)
          .click({ force: true, timeout: 2000 })
          .catch(() => {})
        await page.waitForTimeout(150)
        expect(new URL(page.url()).pathname, `${path} item ${i}`).toBe(before)
        expect(
          await toasts(page).and(page.locator('[data-type="success"]')).count(),
          `${path} item ${i}`,
        ).toBe(0)
        // Fecha diálogos que algum item tenha aberto por engano (não deveria).
        if (await page.getByRole('dialog').filter({ visible: true }).count()) {
          if (!path.startsWith('/login')) await page.keyboard.press('Escape')
        }
      }
      return count
    }
    let total = 0
    for (const path of ['/', '/nft/nft-042', '/cart', '/login', '/register'])
      total += await sweep(path)
    await loginViaUi(page, 'ana@example.com')
    for (const path of ['/profile', '/wallets', '/checkout', '/favorites'])
      total += await sweep(path)
    expect(total).toBeGreaterThan(10)
  })

  test('todo link interno visível abre uma página que existe', async ({ page }) => {
    test.setTimeout(120_000)
    const hrefs = new Set<string>()
    const collect = async (path: string) => {
      await page.goto(path)
      await waitForApp(page)
      const found = await page
        .locator('a[href^="/"]')
        .filter({ visible: true })
        .evaluateAll((links) => links.map((a) => a.getAttribute('href')!))
      for (const href of found) if (!href.startsWith('/#')) hrefs.add(href.split('#')[0]!)
    }
    await loginViaUi(page, 'ana@example.com')
    for (const path of ['/', '/nft/nft-042', '/cart', '/profile', '/wallets', '/orders/ord-0001'])
      await collect(path)
    // Os cards de NFT são todos a mesma rota: basta um.
    const targets = [...hrefs].filter(
      (h, i, all) => !/^\/nft\//.test(h) || all.findIndex((x) => /^\/nft\//.test(x)) === i,
    )
    expect(targets.length).toBeGreaterThan(5)
    for (const href of targets) {
      await page.goto(href)
      await waitForApp(page)
      await expect(page.getByRole('heading', { name: 'Página não encontrada' }), href).toHaveCount(
        0,
      )
      await expect(page.getByRole('heading', { name: /não encontrado/ }), href).toHaveCount(0)
    }
  })
})

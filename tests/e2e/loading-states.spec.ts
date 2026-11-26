import { expect, test, type Page } from '@playwright/test'

import { loginViaUi } from '../fixtures/auth'
import { apiFetch, resetMocks, setScenario, waitForApp } from '../fixtures/mocks'

/**
 * Item 12 do enunciado nas telas além do catálogo (o catálogo fica em
 * `catalog.spec.ts`): skeleton com carregamento lento, aviso de falha e
 * recuperação por "Tentar de novo". Os cenários valem só para a rota da tela
 * (`routes`), para o resto da página carregar normalmente.
 */

const GUEST_CART = '7b6f3c2e-9d1a-4c8b-a5e2-3f4d6b8c0a1e'

const token = (page: Page) =>
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('kurio:session')!) as { token: string }).token,
  )

interface Screen {
  name: string
  path: string
  /** Prefixo da rota da API que a tela carrega. */
  route: string
  /** Skeleton (marcado com `aria-busy` ou atributo próprio). */
  skeleton: string
  /** Mensagem de erro da tela. */
  error: string | RegExp
  /** O que aparece quando os dados chegam. */
  ready: (page: Page) => ReturnType<Page['locator']>
  logged?: boolean
  setup?: (page: Page) => Promise<void>
}

const SCREENS: Screen[] = [
  {
    name: 'detalhe do NFT',
    path: '/nft/nft-042',
    route: '/nfts/nft-042',
    skeleton: '[aria-busy="true"]',
    error: /Não foi possível carregar/,
    ready: (page) => page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' }),
  },
  {
    name: 'carrinho',
    path: '/cart',
    route: '/cart',
    skeleton: '[data-cart-skeleton]',
    error: 'Não foi possível carregar o carrinho.',
    ready: (page) => page.getByRole('list', { name: 'Itens do carrinho' }),
    setup: async (page) => {
      await page.evaluate((id) => localStorage.setItem('kurio:guest-cart-id', id), GUEST_CART)
      await apiFetch(page, 'POST', '/cart/items', {
        cartId: GUEST_CART,
        body: { nftId: 'nft-042', editionId: 'nft-042-open', quantity: 1 },
      })
    },
  },
  {
    name: 'pagamento',
    path: '/checkout',
    route: '/me/wallets',
    skeleton: '[data-checkout-skeleton]',
    error: 'Não foi possível carregar o pagamento.',
    ready: (page) => page.getByRole('button', { name: 'Confirmar compra' }),
    logged: true,
    setup: async (page) => {
      await apiFetch(page, 'POST', '/cart/items', {
        token: await token(page),
        body: { nftId: 'nft-042', editionId: 'nft-042-open', quantity: 1 },
      })
    },
  },
  {
    name: 'perfil',
    path: '/profile',
    route: '/me/profile',
    skeleton: '[data-profile-skeleton]',
    error: 'Não foi possível carregar o perfil.',
    ready: (page) => page.getByRole('textbox', { name: /^Nome de exibição/ }),
    logged: true,
  },
  {
    name: 'carteiras',
    path: '/wallets',
    route: '/me/wallets',
    skeleton: '[data-wallets-skeleton]',
    error: 'Não foi possível carregar as carteiras.',
    ready: (page) => page.getByRole('form', { name: 'Carteira principal' }),
    logged: true,
  },
  {
    name: 'lista de interesse',
    path: '/favorites',
    route: '/me/favorites',
    skeleton: '[data-favorites-skeleton]',
    error: 'Não foi possível carregar a lista de interesse.',
    ready: (page) => page.locator('main#conteudo').getByRole('link', { name: /#\d+/ }).first(),
    logged: true,
  },
  {
    name: 'pedido',
    path: '/orders/ord-0001',
    route: '/orders/ord-0001',
    skeleton: '[data-order-skeleton]',
    error: 'Não foi possível carregar o pedido.',
    ready: (page) => page.getByRole('heading', { level: 1, name: 'Pagamento confirmado' }),
    logged: true,
  },
]

async function prepare(page: Page, screen: Screen) {
  if (screen.logged) await loginViaUi(page, 'ana@example.com')
  await screen.setup?.(page)
}

test.describe('carregamento lento, falha e recuperação nas telas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  for (const screen of SCREENS) {
    test(`${screen.name}: skeleton com a API lenta e conteúdo quando chega`, async ({ page }) => {
      await prepare(page, screen)
      await setScenario(page, ['slow'], { routes: [screen.route], latencyMs: 2500 })
      await page.goto(screen.path)
      await waitForApp(page)
      const skeleton = page.locator('main#conteudo').locator(screen.skeleton).first()
      await expect(skeleton).toBeVisible()
      await expect(screen.ready(page)).toBeHidden()
      // Depois da latência, os dados substituem o skeleton.
      await expect(screen.ready(page)).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('main#conteudo').locator(screen.skeleton)).toHaveCount(0)
    })

    test(`${screen.name}: falha com aviso e "Tentar de novo" que recupera`, async ({ page }) => {
      await prepare(page, screen)
      await setScenario(page, ['server-error'], { routes: [screen.route] })
      await page.goto(screen.path)
      await waitForApp(page)
      // As repetições automáticas (503) acontecem antes do aviso.
      const error = page.getByText(screen.error).first()
      await expect(error).toBeVisible({ timeout: 20_000 })
      await expect(screen.ready(page)).toBeHidden()

      // A API volta: "Tentar de novo" busca de novo, sem recarregar a página.
      await setScenario(page, [])
      await page.getByRole('button', { name: 'Tentar de novo' }).first().click()
      await expect(screen.ready(page)).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(screen.error)).toHaveCount(0)
    })
  }
})

import { expect, test, type Page } from '@playwright/test'

import { formatEth } from '../../src/lib/eth'
import { formatReceiptDate, shortHash } from '../../src/features/orders/receipt-format'
import { loginViaUi } from '../fixtures/auth'
import { apiFetch, resetMocks, setScenario, waitForApp } from '../fixtures/mocks'

/**
 * Compra completa e recibo (item 6 do enunciado): do catálogo ao recibo
 * confirmado, recibo fiel ao snapshot mesmo com o catálogo mudando depois, e
 * acesso bloqueado ao recibo de pedido não confirmado ou de outra conta.
 */

type OrderJson = {
  id: string
  status: string
  updatedAt: string
  transaction: { hash: string; explorerUrl: string } | null
  snapshot: {
    total: string
    networkFee: string
    wallet: { type: string }
    items: { nftId: string; name: string; unitPrice: string; quantity: number; lineTotal: string }[]
  }
}

const WALLET_LABELS: Record<string, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

const token = (page: Page) =>
  page.evaluate(
    () => (JSON.parse(localStorage.getItem('kurio:session')!) as { token: string }).token,
  )

async function orderById(page: Page, id: string): Promise<OrderJson> {
  return (await apiFetch(page, 'GET', `/orders/${id}`, { token: await token(page) }))
    .json as OrderJson
}

const receipt = (page: Page) => page.locator('[data-order-receipt]')

/** Valor de um campo da faixa "Resumo da transação" (ID, data, total, carteira). */
const meta = (page: Page, label: string) =>
  receipt(page)
    .locator('dl[aria-label="Resumo da transação"] > div')
    .filter({ has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) })
    .locator('dd')

/** Ana compra 2 unidades da edição aberta do Emerald Ape #042 pela interface. */
async function buyEmeraldApe(page: Page, isMobile: boolean) {
  await loginViaUi(page, 'ana@example.com')
  await setScenario(page, ['payment-confirmed'], { settleMs: 1000 })

  // Catálogo → detalhe.
  await page.goto('/')
  await waitForApp(page)
  await page
    .locator('#catalogo')
    .getByRole('link', { name: /Emerald Ape #042/ })
    .first()
    .click()
  await expect(page).toHaveURL(/\/nft\/nft-042/)
  await expect(page.getByRole('radio', { name: /^Edição aberta, 1.19 ETH$/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.getByRole('button', { name: 'Aumentar quantidade' }).filter({ visible: true }).click()

  // Detalhe → carrinho.
  if (isMobile) {
    await page.getByRole('button', { name: 'Adicionar ao carrinho' }).click()
    await page.getByRole('button', { name: 'Ver carrinho' }).click()
  } else {
    await page.getByRole('button', { name: 'COMPRAR' }).click()
  }
  await expect(page).toHaveURL(/\/cart$/)
  await page
    .getByRole('region', { name: /Resumo/ })
    .filter({ visible: true })
    .getByRole('button', { name: 'Conectar e finalizar' })
    .click()

  // Pagamento → revisão → pedido.
  await expect(page).toHaveURL(/\/checkout$/)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  const review = page.getByRole('dialog', { name: 'Revise sua compra' })
  await review.getByRole('button', { name: 'Confirmar e pagar' }).click()
  await expect(page).toHaveURL(/\/orders\/ord-/)
  await expect(
    page.getByRole('heading', { name: 'Aguardando a confirmação do pagamento' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pagamento confirmado' })).toBeVisible()
  return page.url().split('/').pop()!
}

/** O recibo mostra exatamente o snapshot do pedido. */
async function expectReceiptMatches(page: Page, order: OrderJson) {
  const box = receipt(page)
  await expect(box).toBeVisible()
  await expect(box.getByRole('status')).toHaveText('Seus NFTs agora estão na sua carteira')
  await expect(meta(page, 'ID da transação')).toHaveText(shortHash(order.transaction!.hash))
  await expect(meta(page, 'Data')).toHaveText(formatReceiptDate(order.updatedAt))
  await expect(meta(page, 'Total')).toHaveText(formatEth(order.snapshot.total))
  await expect(meta(page, 'Carteira')).toHaveText(WALLET_LABELS[order.snapshot.wallet.type]!)

  const items = box.getByRole('list', { name: 'Itens do pedido' }).getByRole('listitem')
  await expect(items).toHaveCount(order.snapshot.items.length)
  for (const [index, item] of order.snapshot.items.entries()) {
    await expect(items.nth(index)).toContainText(item.name)
    await expect(items.nth(index)).toContainText(`(x ${item.quantity})`)
    // A linha do token e da edição aparece inteira, sem reticências.
    const itemMeta = items.nth(index).locator('[data-item-meta]')
    await expect(itemMeta).toContainText('Edição aberta')
    expect(await itemMeta.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true)
    await expect(items.nth(index).locator('[data-item-total]')).toHaveText(
      `Subtotal do item: ${formatEth(item.lineTotal)}`,
    )
  }
  // Sem desconto: só taxa de rede e total, como no Figma.
  await expect(box.locator('dl[aria-label="Totais do pedido"] dd')).toHaveText([
    formatEth(order.snapshot.networkFee),
    formatEth(order.snapshot.total),
  ])

  const explorer = box.getByRole('link', { name: 'Ver no Etherscan (abre em nova aba)' })
  await expect(explorer).toHaveAttribute('href', order.transaction!.explorerUrl)
  await expect(explorer).toHaveAttribute('target', '_blank')
}

test.describe('compra completa e recibo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForApp(page)
    await resetMocks(page)
  })

  test('do catálogo ao recibo confirmado, com o carrinho sem os itens comprados', async ({
    page,
    isMobile,
  }) => {
    const orderId = await buyEmeraldApe(page, isMobile)
    const order = await orderById(page, orderId)
    expect(order.status).toBe('confirmed')
    expect(order.snapshot.items).toEqual([
      expect.objectContaining({ nftId: 'nft-042', unitPrice: '1.19', quantity: 2 }),
    ])
    await expectReceiptMatches(page, order)
    await expect(page.getByText(/Transação confirmada na Ethereum \(simulada\)/)).toBeVisible()

    const cart = (await apiFetch(page, 'GET', '/cart', { token: await token(page) })).json as {
      items: unknown[]
    }
    expect(cart.items).toHaveLength(0)
    await expect(
      page
        .getByRole('link', { name: /^Carrinho, vazio/ })
        .filter({ visible: true })
        .first(),
    ).toBeVisible()
  })

  test('o recibo não muda quando o catálogo muda depois (tempo real e refresh)', async ({
    page,
    isMobile,
  }) => {
    const orderId = await buyEmeraldApe(page, isMobile)
    const order = await orderById(page, orderId)
    await expectReceiptMatches(page, order)

    // Preço e nome mudam no catálogo: o evento chega pelo Socket.IO.
    await apiFetch(page, 'POST', '/__mocks/nfts/nft-042/update', {
      body: { editionId: 'nft-042-open', price: '2.50' },
    })
    const nft = (await apiFetch(page, 'GET', '/nfts/nft-042')).json as {
      editions: { id: string; price: string }[]
    }
    expect(nft.editions.find((e) => e.id === 'nft-042-open')?.price).toBe('2.50')
    await page.waitForTimeout(800)
    await expectReceiptMatches(page, order)
    await expect(receipt(page)).not.toContainText('2.50 ETH')
    await expect(receipt(page)).not.toContainText('5.00 ETH')

    await page.reload()
    await waitForApp(page)
    await expectReceiptMatches(page, order)
    expect((await orderById(page, orderId)).snapshot).toEqual(order.snapshot)
  })

  test('pedido de outra conta não mostra recibo; o da própria conta mostra', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    const own = (
      (await apiFetch(page, 'GET', '/orders', { token: await token(page) })).json as {
        items: OrderJson[]
      }
    ).items
    const ownConfirmed = own.find((o) => o.status === 'confirmed')!
    expect(own.map((o) => o.id)).not.toContain('ord-0002')

    // ord-0002 é do Bruno: a API responde 404 e a tela não revela nada dele.
    await page.goto('/orders/ord-0002')
    await waitForApp(page)
    await expect(page.getByRole('heading', { name: 'Pedido não encontrado.' })).toBeVisible()
    expect(await receipt(page).count()).toBe(0)
    expect(await page.getByText('ID da transação').count()).toBe(0)

    await page.goto(`/orders/${ownConfirmed.id}`)
    await waitForApp(page)
    await expectReceiptMatches(page, await orderById(page, ownConfirmed.id))
  })

  test('pedido pendente não mostra recibo nem transação', async ({ page }) => {
    await loginViaUi(page, 'ana@example.com')
    const auth = await token(page)
    await apiFetch(page, 'POST', '/cart/items', {
      token: auth,
      body: { nftId: 'nft-314', editionId: 'nft-314-open', quantity: 1 },
    })
    await setScenario(page, ['payment-confirmed'], { settleMs: 60_000 })
    await page.goto('/checkout')
    await waitForApp(page)
    await page.getByRole('button', { name: 'Confirmar compra' }).click()
    await page
      .getByRole('dialog', { name: 'Revise sua compra' })
      .getByRole('button', { name: 'Confirmar e pagar' })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Aguardando a confirmação do pagamento' }),
    ).toBeVisible()
    await page.reload()
    await waitForApp(page)
    await expect(
      page.getByRole('heading', { name: 'Aguardando a confirmação do pagamento' }),
    ).toBeVisible()
    expect(await receipt(page).count()).toBe(0)
    expect(await page.getByText(/ID da transação|Ver no Etherscan|Pago com/).count()).toBe(0)
  })

  test('visitante que abre o recibo vai para o login', async ({ page }) => {
    await page.goto('/orders/ord-0001')
    await expect(page).toHaveURL(/\/login\?redirect=%2Forders%2Ford-0001/)
  })

  test('layout: faixa da transação em linha no desktop e em duas colunas no mobile, sem sobra lateral', async ({
    page,
    isMobile,
  }) => {
    const orderId = await buyEmeraldApe(page, isMobile)
    await expectReceiptMatches(page, await orderById(page, orderId))

    const tops = await receipt(page)
      .locator('dl[aria-label="Resumo da transação"] dt')
      .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))
    expect(tops).toHaveLength(4)
    if (isMobile) {
      // 2 × 2: ID e data numa linha, total e carteira na seguinte.
      expect(tops[0]).toBe(tops[1])
      expect(tops[2]).toBe(tops[3])
      expect(tops[2]).toBeGreaterThan(tops[0]!)
    } else {
      expect(new Set(tops).size).toBe(1)
    }

    const item = receipt(page).locator('[data-receipt-item]').first()
    const name = item.locator('p').first()
    const total = item.locator('[data-item-total]')
    const [nameBox, totalBox] = [(await name.boundingBox())!, (await total.boundingBox())!]
    if (isMobile) {
      expect(totalBox.y).toBeGreaterThanOrEqual(nameBox.y + nameBox.height)
    } else {
      expect(totalBox.x).toBeGreaterThan(nameBox.x + nameBox.width)
    }

    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('main *')]
        .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
        .map((el) => (el.textContent ?? '').trim().slice(0, 30)),
    )
    expect(overflow).toEqual([])
    const box = (await receipt(page).boundingBox())!
    expect(box.width).toBeLessThanOrEqual(578)
    await expect(receipt(page).getByRole('link', { name: /^Ver no Etherscan/ })).toBeVisible()
  })
})

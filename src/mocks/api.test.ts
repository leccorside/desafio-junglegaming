import { describe, expect, it } from 'vitest'

import {
  apiErrorBodySchema,
  cartSchema,
  favoritesResponseSchema,
  mergeCartResponseSchema,
  nftListResponseSchema,
  nftSchema,
  orderSchema,
  profileSchema,
  quoteOutdatedDetailsSchema,
  quoteSchema,
  sessionSchema,
  walletConnectionSchema,
  walletSchema,
} from '@/api/contracts'
import { ethCompare } from '@/lib/eth'

import { getDb } from './db/store'
import { SPECIAL_NFTS } from './fixtures'
import { setScenario } from './scenarios'
import { call, GUEST_CART, loginAs, setupMockServer } from './test-utils'

setupMockServer()

const uuid = () => crypto.randomUUID()
const errorOf = (json: unknown) => apiErrorBodySchema.parse(json).error

describe('sessão e conta', () => {
  it('entra, consulta a sessão e sai', async () => {
    const session = await loginAs('ana')
    expect(session.user.email).toBe('ana@example.com')

    const current = await call('GET', '/auth/session', { token: session.token })
    expect(sessionSchema.parse(current.json).user.id).toBe('user-ana')

    expect((await call('POST', '/auth/logout', { token: session.token })).status).toBe(204)
    const after = await call('GET', '/auth/session', { token: session.token })
    expect(after.status).toBe(401)
    expect(errorOf(after.json).code).toBe('UNAUTHENTICATED')
  })

  it('recusa credenciais erradas sem dizer qual campo', async () => {
    const res = await call('POST', '/auth/login', {
      body: { email: 'ana@example.com', password: 'Errada@1' },
    })
    expect(res.status).toBe(401)
    expect(errorOf(res.json)).toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(errorOf(res.json).fields).toBeUndefined()
  })

  it('cadastra e trata conflito de e-mail e nome de usuário', async () => {
    const body = { username: 'carla.arte', email: 'carla@example.com', password: 'Senha@123' }
    const created = await call('POST', '/auth/register', { body })
    expect(created.status).toBe(201)
    expect(sessionSchema.parse(created.json).user.displayName).toBe('carla.arte')

    const sameEmail = await call('POST', '/auth/register', { body: { ...body, username: 'outra' } })
    expect(sameEmail.status).toBe(409)
    expect(errorOf(sameEmail.json).fields).toHaveProperty('email')

    const sameUser = await call('POST', '/auth/register', {
      body: { ...body, email: 'x@example.com' },
    })
    expect(errorOf(sameUser.json)).toMatchObject({ code: 'USERNAME_TAKEN' })
  })

  it('valida o corpo com o schema do contrato', async () => {
    const res = await call('POST', '/auth/register', {
      body: { username: 'a', email: 'x', password: '1' },
    })
    expect(res.status).toBe(422)
    expect(Object.keys(errorOf(res.json).fields ?? {})).toEqual(
      expect.arrayContaining(['username', 'email', 'password']),
    )
  })

  it('expira a sessão no cenário session-expired', async () => {
    const { token } = await loginAs('ana')
    setScenario(['session-expired'])
    const res = await call('GET', '/me/profile', { token })
    expect(res.status).toBe(401)
    expect(errorOf(res.json).code).toBe('SESSION_EXPIRED')
  })
})

describe('catálogo', () => {
  it('lista com paginação e facetas coerentes', async () => {
    const res = await call('GET', '/nfts')
    const page = nftListResponseSchema.parse(res.json)
    expect(page).toMatchObject({ page: 1, pageSize: 12, total: 60, totalPages: 5 })
    expect(page.items).toHaveLength(12)
    const totalByCategory = Object.values(page.facets.categories).reduce((a, b) => a + b, 0)
    expect(totalByCategory).toBe(60)
    const prices = getDb()
      .nfts.map((n) => n.priceFrom)
      .sort(ethCompare)
    expect(page.facets.priceRange).toEqual({ min: prices[0], max: prices.at(-1) })
  })

  it('combina filtros e cada faceta ignora o próprio filtro', async () => {
    const res = await call('GET', '/nfts?category=music&network=ethereum')
    const page = nftListResponseSchema.parse(res.json)
    expect(page.items.every((n) => n.category === 'music' && n.network === 'ethereum')).toBe(true)
    // A contagem de categorias continua mostrando as outras categorias da rede escolhida.
    expect(Object.values(page.facets.categories).filter((c) => c > 0).length).toBeGreaterThan(1)
  })

  it('busca sem diferenciar maiúsculas e acentos', async () => {
    const page = nftListResponseSchema.parse((await call('GET', '/nfts?q=ÉMERALD')).json)
    expect(page.items.map((n) => n.id)).toContain('nft-042')
  })

  it('filtra por faixa de preço e ordena por preço', async () => {
    const page = nftListResponseSchema.parse(
      (await call('GET', '/nfts?minPrice=1&maxPrice=2&sort=price_asc&pageSize=48')).json,
    )
    const prices = page.items.map((n) => n.priceFrom)
    expect(prices.every((p) => ethCompare(p, '1') >= 0 && ethCompare(p, '2') <= 0)).toBe(true)
    expect([...prices].sort(ethCompare)).toEqual(prices)
  })

  it('separa as abas novos lançamentos e em alta', async () => {
    const recent = nftListResponseSchema.parse(
      (await call('GET', '/nfts?feed=new&pageSize=48')).json,
    )
    const trending = nftListResponseSchema.parse(
      (await call('GET', '/nfts?feed=trending&pageSize=48')).json,
    )
    expect(recent.total).toBeGreaterThan(0)
    expect(recent.total).toBeLessThan(60)
    expect(trending.total).toBeGreaterThan(0)
    expect(trending.total).toBeLessThan(60)
  })

  it('devolve página vazia, resultado vazio e erro de parâmetro', async () => {
    const beyond = nftListResponseSchema.parse((await call('GET', '/nfts?page=99')).json)
    expect(beyond.items).toEqual([])

    setScenario(['empty-catalog'])
    expect(nftListResponseSchema.parse((await call('GET', '/nfts')).json).total).toBe(0)

    setScenario([])
    const bad = await call('GET', '/nfts?category=pintura')
    expect(bad.status).toBe(400)
  })

  it('mostra o detalhe e 404 para NFT inexistente', async () => {
    expect(nftSchema.parse((await call('GET', '/nfts/nft-042')).json).name).toBe('Emerald Ape #042')
    const missing = await call('GET', '/nfts/nft-000')
    expect(missing.status).toBe(404)
    expect(errorOf(missing.json).code).toBe('NOT_FOUND')
  })
})

describe('favoritos', () => {
  it('exige login', async () => {
    expect((await call('GET', '/me/favorites')).status).toBe(401)
  })

  it('inclui e remove de forma idempotente, isolado por usuário', async () => {
    const ana = await loginAs('ana')
    await call('PUT', '/me/favorites/nft-207', { token: ana.token })
    const twice = await call('PUT', '/me/favorites/nft-207', { token: ana.token })
    expect(twice.json.nftIds.filter((id: string) => id === 'nft-207')).toHaveLength(1)

    await call('DELETE', '/me/favorites/nft-042', { token: ana.token })
    const list = favoritesResponseSchema.parse(
      (await call('GET', '/me/favorites', { token: ana.token })).json,
    )
    expect(list.nftIds).toEqual(['nft-207', 'nft-118'])

    const bruno = await loginAs('bruno')
    const other = favoritesResponseSchema.parse(
      (await call('GET', '/me/favorites', { token: bruno.token })).json,
    )
    expect(other.nftIds).toEqual(['nft-207'])
  })

  it('falha com erro transitório no cenário favorite-fails', async () => {
    const { token } = await loginAs('ana')
    setScenario(['favorite-fails'])
    const res = await call('PUT', '/me/favorites/nft-009', { token })
    expect(res.status).toBe(503)
    expect(errorOf(res.json).retryable).toBe(true)
  })
})

describe('carrinho e cotação', () => {
  const add = (quantity: number, editionId = 'nft-042-open', extra: { token?: string } = {}) =>
    call('POST', '/cart/items', {
      cartId: GUEST_CART,
      ...extra,
      body: { nftId: 'nft-042', editionId, quantity },
    })

  it('exige identificação do visitante', async () => {
    expect((await call('GET', '/cart')).status).toBe(400)
  })

  it('soma itens iguais e respeita o estoque da edição', async () => {
    await add(1, 'nft-042-1-10')
    const cart = cartSchema.parse((await add(2, 'nft-042-1-10')).json)
    expect(cart.items).toHaveLength(1)
    expect(cart.items[0]?.quantity).toBe(3)

    const over = await add(10, 'nft-042-1-10')
    expect(over.status).toBe(409)
    expect(errorOf(over.json)).toMatchObject({
      code: 'AVAILABILITY_CONFLICT',
      details: { maxQuantity: 8 },
    })

    const soldOut = await call('POST', '/cart/items', {
      cartId: GUEST_CART,
      body: { nftId: SPECIAL_NFTS.soldOut, editionId: `${SPECIAL_NFTS.soldOut}-open`, quantity: 1 },
    })
    expect(errorOf(soldOut.json).details).toEqual({ maxQuantity: 0 })
  })

  it('altera e remove itens', async () => {
    const itemId = cartSchema.parse((await add(2)).json).items[0]!.id
    const updated = cartSchema.parse(
      (await call('PATCH', `/cart/items/${itemId}`, { cartId: GUEST_CART, body: { quantity: 5 } }))
        .json,
    )
    expect(updated.items[0]?.quantity).toBe(5)
    const removed = cartSchema.parse(
      (await call('DELETE', `/cart/items/${itemId}`, { cartId: GUEST_CART })).json,
    )
    expect(removed.items).toEqual([])
  })

  it('aplica cupom válido e recusa inválido e expirado', async () => {
    await add(2)
    const invalid = await call('PUT', '/cart/coupon', {
      cartId: GUEST_CART,
      body: { code: 'nada' },
    })
    expect(errorOf(invalid.json).code).toBe('COUPON_INVALID')
    const expired = await call('PUT', '/cart/coupon', {
      cartId: GUEST_CART,
      body: { code: 'expirado' },
    })
    expect(errorOf(expired.json).code).toBe('COUPON_EXPIRED')

    const ok = cartSchema.parse(
      (await call('PUT', '/cart/coupon', { cartId: GUEST_CART, body: { code: 'bemvindo10' } }))
        .json,
    )
    expect(ok.couponCode).toBe('BEMVINDO10')

    const quote = quoteSchema.parse(
      (await call('POST', '/quotes', { cartId: GUEST_CART, body: { network: 'ethereum' } })).json,
    )
    expect(quote).toMatchObject({
      subtotal: '2.38',
      discount: '0.238',
      networkFee: '0.016',
      total: '2.158',
    })
  })

  it('marca preço alterado e esgotado com o catálogo atual', async () => {
    await add(2)
    await call('POST', '/__mocks/nfts/nft-042/update', {
      body: { editionId: 'nft-042-open', price: '1.31' },
    })
    const changed = cartSchema.parse((await call('GET', '/cart', { cartId: GUEST_CART })).json)
    expect(changed.items[0]).toMatchObject({
      status: 'price_changed',
      unitPrice: '1.31',
      previousUnitPrice: '1.19',
    })

    await call('POST', '/__mocks/nfts/nft-042/update', {
      body: { editionId: 'nft-042-open', available: 0 },
    })
    const soldOut = cartSchema.parse((await call('GET', '/cart', { cartId: GUEST_CART })).json)
    expect(soldOut.items[0]?.status).toBe('sold_out')
    const quote = quoteSchema.parse(
      (await call('POST', '/quotes', { cartId: GUEST_CART, body: { network: 'ethereum' } })).json,
    )
    expect(quote.blockedItemIds).toEqual([soldOut.items[0]?.id])
    expect(quote.total).toBe('0')
  })

  it('junta o carrinho do visitante ao do usuário no login', async () => {
    await add(2)
    await add(1, 'nft-042-1-1')
    const { token } = await loginAs('ana')
    await call('POST', '/cart/items', {
      token,
      body: { nftId: 'nft-042', editionId: 'nft-042-1-1', quantity: 1 },
    })

    const merged = mergeCartResponseSchema.parse(
      (await call('POST', '/cart/merge', { token, body: { guestCartId: GUEST_CART } })).json,
    )
    expect(merged.cart.items.map((i) => [i.editionId, i.quantity])).toEqual([
      ['nft-042-1-1', 1],
      ['nft-042-open', 2],
    ])
    // A edição 1/1 só tem uma unidade: a do visitante não coube.
    expect(merged.adjustments).toEqual([
      expect.objectContaining({ editionId: 'nft-042-1-1', requested: 1, added: 0 }),
    ])
    expect(getDb().carts[`guest:${GUEST_CART}`]).toBeUndefined()
  })
})

describe('pedidos', () => {
  async function prepare(user: 'ana' | 'bruno' = 'ana') {
    const session = await loginAs(user)
    const token = session.token
    await call('POST', '/cart/items', {
      token,
      body: { nftId: 'nft-042', editionId: 'nft-042-open', quantity: 2 },
    })
    await call('POST', '/cart/items', {
      token,
      body: { nftId: 'nft-088', editionId: 'nft-088-open', quantity: 1 },
    })
    const quote = quoteSchema.parse(
      (await call('POST', '/quotes', { token, body: { network: 'ethereum' } })).json,
    )
    const body = {
      quoteId: quote.id,
      quoteVersion: quote.version,
      walletId: 'wallet-ana-primary',
      network: 'ethereum',
      buyer: { displayName: 'Ana Ribeiro', email: 'ana@example.com' },
    }
    return { token, quote, body }
  }

  const openStock = () =>
    getDb()
      .nfts.find((n) => n.id === 'nft-042')!
      .editions.find((e) => e.name === 'Aberta')!.available

  it('cria pendente, recupera pela mesma chave e recusa chave com outro corpo', async () => {
    const { token, body } = await prepare()
    const key = uuid()
    const first = await call('POST', '/orders', { token, body, idempotencyKey: key })
    expect(first.status).toBe(201)
    const order = orderSchema.parse(first.json)
    expect(order.status).toBe('pending')
    // 2 × 1.19 (Emerald Ape) + 1.79 (Ivory Baron) + 0.016 de taxa
    expect(order.snapshot.total).toBe('4.186')

    const again = await call('POST', '/orders', { token, body, idempotencyKey: key })
    expect(again.status).toBe(200)
    expect(again.json.id).toBe(order.id)

    const other = await call('POST', '/orders', {
      token,
      body: { ...body, buyer: { ...body.buyer, note: 'x' } },
      idempotencyKey: key,
    })
    expect(errorOf(other.json).code).toBe('IDEMPOTENCY_CONFLICT')

    expect((await call('POST', '/orders', { token, body })).status).toBe(400)
  })

  it('confirma o pagamento, gera a transação e tira do carrinho só o que foi comprado', async () => {
    const { token, body } = await prepare()
    setScenario(['payment-confirmed'], { settleMs: 0 })
    const stockBefore = openStock()
    const created = orderSchema.parse(
      (await call('POST', '/orders', { token, body, idempotencyKey: uuid() })).json,
    )
    expect(openStock()).toBe(stockBefore - 2)

    // Item colocado depois da cotação não pode sair do carrinho.
    await call('POST', '/cart/items', {
      token,
      body: { nftId: 'nft-207', editionId: 'nft-207-open', quantity: 1 },
    })

    const order = orderSchema.parse((await call('GET', `/orders/${created.id}`, { token })).json)
    expect(order.status).toBe('confirmed')
    expect(order.transaction?.explorerUrl).toMatch(/^https:\/\/etherscan\.io\/tx\/0x[0-9a-f]{64}$/)

    const cart = cartSchema.parse((await call('GET', '/cart', { token })).json)
    expect(cart.items.map((i) => i.nftId)).toEqual(['nft-207'])
  })

  it('recusa o pagamento, devolve o estoque e preserva o carrinho', async () => {
    const { token, body } = await prepare()
    setScenario(['payment-rejected'], { settleMs: 0 })
    const stockBefore = openStock()
    const created = orderSchema.parse(
      (await call('POST', '/orders', { token, body, idempotencyKey: uuid() })).json,
    )

    const order = orderSchema.parse((await call('GET', `/orders/${created.id}`, { token })).json)
    expect(order).toMatchObject({ status: 'rejected', transaction: null })
    expect(order.rejectionReason).toBeTruthy()
    expect(openStock()).toBe(stockBefore)
    expect(cartSchema.parse((await call('GET', '/cart', { token })).json).items).toHaveLength(2)
  })

  it('exige nova confirmação quando o preço muda no checkout', async () => {
    const { token, body } = await prepare()
    setScenario(['price-changed-on-checkout'])
    const res = await call('POST', '/orders', { token, body, idempotencyKey: uuid() })
    expect(res.status).toBe(409)
    const details = quoteOutdatedDetailsSchema.parse(errorOf(res.json).details)
    expect(details.changes[0]).toMatchObject({ kind: 'price' })
    expect(details.changes[0]?.message).toContain('Emerald Ape #042')

    const retry = await call('POST', '/orders', {
      token,
      body: { ...body, quoteId: details.quote.id, quoteVersion: details.quote.version },
      idempotencyKey: uuid(),
    })
    expect(retry.status).toBe(201)
    expect(retry.json.snapshot.items[0].unitPrice).toBe('1.31')
  })

  it('bloqueia a compra quando a edição esgota no checkout', async () => {
    const { token, body } = await prepare()
    setScenario(['sold-out-on-checkout'])
    const res = await call('POST', '/orders', { token, body, idempotencyKey: uuid() })
    const details = quoteOutdatedDetailsSchema.parse(errorOf(res.json).details)
    expect(details.changes[0]?.kind).toBe('availability')
    expect(details.quote.blockedItemIds).toHaveLength(1)
  })

  it('recupera o mesmo pedido depois de timeout', async () => {
    const { token, body } = await prepare()
    setScenario(['order-timeout'])
    const key = uuid()
    await expect(
      call('POST', '/orders', {
        token,
        body,
        idempotencyKey: key,
        signal: AbortSignal.timeout(200),
      }),
    ).rejects.toThrow()

    const retry = await call('POST', '/orders', { token, body, idempotencyKey: key })
    expect(retry.status).toBe(200)
    expect(
      getDb().orders.filter((o) => o.userId === 'user-ana' && o.status === 'pending'),
    ).toHaveLength(1)
  })

  it('lista pendentes e isola pedidos por usuário', async () => {
    const { token, body } = await prepare()
    const order = orderSchema.parse(
      (await call('POST', '/orders', { token, body, idempotencyKey: uuid() })).json,
    )
    const pending = await call('GET', '/orders?status=pending', { token })
    expect(pending.json.items.map((o: { id: string }) => o.id)).toEqual([order.id])

    const bruno = await loginAs('bruno')
    const denied = await call('GET', `/orders/${order.id}`, { token: bruno.token })
    expect(denied.status).toBe(403)
  })

  it('valida carteira e rede do pedido', async () => {
    const { token, body } = await prepare()
    const wrongWallet = await call('POST', '/orders', {
      token,
      body: { ...body, walletId: 'wallet-bruno-primary' },
      idempotencyKey: uuid(),
    })
    expect(errorOf(wrongWallet.json).fields).toHaveProperty('walletId')
    const wrongNetwork = await call('POST', '/orders', {
      token,
      body: { ...body, network: 'polygon' },
      idempotencyKey: uuid(),
    })
    expect(errorOf(wrongNetwork.json).fields).toHaveProperty('network')
  })
})

describe('perfil e carteiras', () => {
  it('atualiza o perfil e trata nome de usuário em uso', async () => {
    const { token } = await loginAs('ana')
    const body = { displayName: 'Ana R.', username: 'ana.r', ensName: 'ana' }
    const updated = profileSchema.parse((await call('PATCH', '/me/profile', { token, body })).json)
    expect(updated.displayName).toBe('Ana R.')

    const taken = await call('PATCH', '/me/profile', {
      token,
      body: { ...body, username: 'bruno.nft' },
    })
    expect(errorOf(taken.json).fields).toHaveProperty('username')
  })

  it('envia e remove o avatar, validando tipo e tamanho', async () => {
    const { token } = await loginAs('ana')
    const form = new FormData()
    form.set(
      'avatar',
      new File([new Uint8Array([137, 80, 78, 71])], 'a.png', { type: 'image/png' }),
    )
    const withAvatar = profileSchema.parse((await call('PUT', '/me/avatar', { token, form })).json)
    expect(withAvatar.avatarUrl).toMatch(/^data:image\/png;base64,/)

    const big = new FormData()
    big.set('avatar', new File([new Uint8Array(3 * 1024 * 1024)], 'b.png', { type: 'image/png' }))
    expect((await call('PUT', '/me/avatar', { token, form: big })).status).toBe(422)

    expect(
      profileSchema.parse((await call('DELETE', '/me/avatar', { token })).json).avatarUrl,
    ).toBeNull()
  })

  it('troca a senha só com a senha atual correta', async () => {
    const { token } = await loginAs('ana')
    const wrong = await call('POST', '/me/password', {
      token,
      body: { currentPassword: 'X@1aaaaa', newPassword: 'Nova@1234' },
    })
    expect(errorOf(wrong.json).code).toBe('INVALID_PASSWORD')
    expect(
      (
        await call('POST', '/me/password', {
          token,
          body: { currentPassword: 'Senha@123', newPassword: 'Nova@1234' },
        })
      ).status,
    ).toBe(204)
    const login = await call('POST', '/auth/login', {
      body: { email: 'ana@example.com', password: 'Nova@1234' },
    })
    expect(login.status).toBe(200)
  })

  it('cadastra a carteira secundária, valida endereço e papel', async () => {
    const { token } = await loginAs('bruno')
    const body = {
      role: 'secondary',
      label: 'Reserva',
      network: 'ethereum',
      type: 'metamask',
      address: '0x' + 'a'.repeat(40),
    }
    const created = await call('POST', '/me/wallets', { token, body })
    expect(created.status).toBe(201)
    expect(walletSchema.parse(created.json).role).toBe('secondary')

    expect(
      errorOf((await call('POST', '/me/wallets', { token, body })).json).fields,
    ).toHaveProperty('role')
    const badAddress = await call('POST', '/me/wallets', {
      token,
      body: { ...body, role: 'primary', network: 'solana' },
    })
    expect(errorOf(badAddress.json).fields).toHaveProperty('address')
  })

  it('simula a recusa da conexão uma vez e depois conecta', async () => {
    const { token } = await loginAs('ana')
    setScenario(['wallet-rejected'])
    const refused = await call('POST', '/me/wallets/wallet-ana-primary/connect', { token })
    expect(errorOf(refused.json).code).toBe('WALLET_REJECTED')
    const ok = await call('POST', '/me/wallets/wallet-ana-primary/connect', { token })
    expect(walletConnectionSchema.parse(ok.json).network).toBe('ethereum')

    const bruno = await loginAs('bruno')
    expect(
      (await call('POST', '/me/wallets/wallet-ana-primary/connect', { token: bruno.token })).status,
    ).toBe(403)
  })
})

describe('cenários de rede e reset', () => {
  it('simula offline, erro 503 e falha na primeira tentativa', async () => {
    setScenario(['offline'])
    await expect(call('GET', '/nfts')).rejects.toThrow()

    setScenario(['server-error'])
    expect((await call('GET', '/nfts')).status).toBe(503)

    setScenario(['flaky'])
    expect((await call('GET', '/nfts/nft-042')).status).toBe(503)
    expect((await call('GET', '/nfts/nft-042')).status).toBe(200)
  })

  it('limita o cenário às rotas escolhidas', async () => {
    setScenario(['server-error'], { routes: ['/nfts'] })
    expect((await call('GET', '/nfts')).status).toBe(503)
    expect((await call('GET', '/auth/session')).status).toBe(401)
  })

  it('aplica a latência do cenário slow', async () => {
    setScenario(['slow'], { latencyMs: 150 })
    const start = performance.now()
    await call('GET', '/nfts/nft-042')
    expect(performance.now() - start).toBeGreaterThanOrEqual(140)
  })

  it('reset restaura as fixtures e o cenário padrão', async () => {
    const { token } = await loginAs('ana')
    await call('DELETE', '/me/favorites/nft-042', { token })
    setScenario(['empty-catalog'])

    expect((await call('POST', '/__mocks/reset')).status).toBe(200)
    expect(getDb().favorites['user-ana']).toEqual(['nft-042', 'nft-118'])
    expect(getDb().sessions).toEqual([])
    expect(nftListResponseSchema.parse((await call('GET', '/nfts')).json).total).toBe(60)
  })
})

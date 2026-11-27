import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  Cart,
  EditionStatus,
  FavoritesResponse,
  Nft,
  NftListResponse,
  OrderUpdatedEvent,
} from '@/api/contracts'
import { cartKeys, quoteKeys } from '@/features/cart/cart-cache'
import { nftKeys } from '@/features/catalog/queries'
import { mutate, resetDb } from '@/mocks/db/store'
import { createNftFixtures } from '@/mocks/fixtures/nfts'
import { nftEvent, sessionUserId } from '@/mocks/socket/server'

import { applyNftUpdated, describeCartDiff } from './apply-nft-updated'
import { createEventGate } from './event-gate'
import { reconcileWithServer } from './reconcile'
import { createEventHandler, onOrderUpdated } from './socket'

const nfts = createNftFixtures()
const emerald = nfts.find((n) => n.id === 'nft-042') as Nft
const OWNER = 'guest:x'

/** O mesmo evento que o servidor simulado emite, com o NFT alterado. */
function updated(
  nft: Nft,
  patch: { version: number; price?: string; available?: number; status?: EditionStatus },
) {
  const editions = nft.editions.map((e) =>
    e.id === `${nft.id}-open`
      ? {
          ...e,
          price: patch.price ?? e.price,
          available: patch.available ?? e.available,
          status: patch.status ?? (patch.available === 0 ? ('sold_out' as const) : e.status),
        }
      : e,
  )
  return nftEvent({
    ...nft,
    version: patch.version,
    editions,
    priceFrom: patch.price ?? nft.priceFrom,
    updatedAt: new Date(1000 * patch.version).toISOString(),
  })
}

const orderEvent = (userId: string, version = 2): OrderUpdatedEvent => ({
  eventId: `order-ord-1-v${version}`,
  type: 'order.updated',
  resource: { type: 'order', id: 'ord-1' },
  version,
  occurredAt: new Date(0).toISOString(),
  userId,
  data: { orderId: 'ord-1', status: 'confirmed', rejectionReason: null, transaction: null },
})

/** Carrinho com o Emerald Ape (edição aberta) numa versão do NFT. */
function cartWith(nftVersion: number, id = 'cart-1'): Cart {
  return {
    id,
    owner: 'guest',
    couponCode: null,
    version: 3,
    updatedAt: new Date(0).toISOString(),
    items: [
      {
        id: 'nft-042-open',
        nftId: 'nft-042',
        editionId: 'nft-042-open',
        name: 'Emerald Ape #042',
        editionName: 'Aberta',
        tokenId: '0042',
        imageUrl: '/images/nfts/nft-01-960.webp',
        unitPrice: '1.19',
        previousUnitPrice: null,
        quantity: 2,
        available: 999,
        status: 'ok',
        nftVersion,
      },
    ],
  }
}

const isInvalidated = (client: QueryClient, key: readonly unknown[]) =>
  client.getQueryState(key)?.isInvalidated ?? false

afterEach(() => {
  vi.restoreAllMocks()
})

describe('porteiro dos eventos', () => {
  it('descarta duplicado (eventId) e antigo (version)', () => {
    const gate = createEventGate(null)
    const v2 = updated(emerald, { version: 2, price: '1.50' })
    expect(gate.check(v2)).toBe('apply')
    gate.record(v2)
    expect(gate.check(v2)).toBe('duplicate')
    // Mesmo recurso, versão menor ou igual: antigo, mesmo com outro eventId.
    expect(gate.check({ ...updated(emerald, { version: 2 }), eventId: 'outro' })).toBe('stale')
    expect(gate.check({ ...updated(emerald, { version: 1 }), eventId: 'outro-2' })).toBe('stale')
    expect(gate.check(updated(emerald, { version: 3 }))).toBe('apply')
  })

  it('descarta evento de outro usuário; cada sessão começa sem registro', () => {
    const ana = createEventGate('user-ana')
    expect(ana.check(orderEvent('user-bruno'))).toBe('other-user')
    expect(ana.check(orderEvent('user-ana'))).toBe('apply')
    ana.record(orderEvent('user-ana'))
    expect(createEventGate('user-ana').check(orderEvent('user-ana'))).toBe('apply')
    // Visitante não recebe evento de pedido.
    expect(createEventGate(null).check(orderEvent('user-ana'))).toBe('other-user')
  })

  it('as versões do sync viram referência, inclusive quando voltam para trás (reset)', () => {
    const gate = createEventGate('user-ana')
    // Conexão nova: nunca viu evento do NFT, mas o servidor está na v3.
    gate.sync({ reason: 'connect', nfts: { 'nft-042': 3 }, orders: { 'ord-1': 2 } })
    expect(gate.check(updated(emerald, { version: 3 }))).toBe('stale')
    expect(gate.check(orderEvent('user-ana', 2))).toBe('stale')
    expect(gate.check(updated(emerald, { version: 4 }))).toBe('apply')
    gate.record(updated(emerald, { version: 4 }))

    // Reset dos mocks: v1 no servidor; a v2 seguinte precisa passar.
    gate.sync({ reason: 'connect', nfts: { 'nft-042': 1 }, orders: {} })
    expect(gate.check(updated(emerald, { version: 2 }))).toBe('apply')
  })

  it('o eventId muda depois do reset dos mocks (época), sem repetir o de antes', () => {
    const before = updated(emerald, { version: 2 }).eventId
    resetDb()
    expect(updated(emerald, { version: 2 }).eventId).not.toBe(before)
  })
})

describe('aplicação do nft.updated no cache', () => {
  it('atualiza detalhe e listagem só com evento mais novo que a cópia', () => {
    const client = new QueryClient()
    client.setQueryData(nftKeys.detail(emerald.id), emerald)
    const page = { items: [emerald], page: 1, pageSize: 9, total: 1, totalPages: 1 }
    client.setQueryData(nftKeys.list({ feed: 'all', sort: 'recent', page: 1, pageSize: 9 }), page)

    applyNftUpdated(
      client,
      updated(emerald, { version: emerald.version + 1, price: '1.55' }),
      OWNER,
    )
    const detail = client.getQueryData<Nft>(nftKeys.detail(emerald.id))!
    expect(detail.priceFrom).toBe('1.55')
    expect(detail.editions.find((e) => e.id === 'nft-042-open')?.price).toBe('1.55')
    const list = client.getQueriesData<NftListResponse>({ queryKey: [...nftKeys.all, 'list'] })
    expect(list[0]?.[1]?.items[0]?.priceFrom).toBe('1.55')

    // Evento com versão igual à da cópia não volta o preço.
    applyNftUpdated(
      client,
      updated(emerald, { version: emerald.version + 1, price: '9.99' }),
      OWNER,
    )
    expect(client.getQueryData<Nft>(nftKeys.detail(emerald.id))?.priceFrom).toBe('1.55')
  })

  it('NFT no carrinho: devolve o aviso e invalida carrinho e cotação', async () => {
    const client = new QueryClient()
    client.setQueryData(cartKeys.current(OWNER), cartWith(1))

    const price = applyNftUpdated(client, updated(emerald, { version: 2, price: '1.55' }), OWNER)
    expect(price).toEqual([
      'Emerald Ape #042 (edição aberta): o preço mudou de 1.19 ETH para 1.55 ETH.',
    ])
    await vi.waitFor(() => expect(isInvalidated(client, cartKeys.current(OWNER))).toBe(true))

    const soldOut = applyNftUpdated(client, updated(emerald, { version: 3, available: 0 }), OWNER)
    expect(soldOut).toEqual(['Emerald Ape #042 (edição aberta) esgotou.'])

    // NFT fora do carrinho: nenhum aviso.
    const other = nfts.find((n) => n.id === 'nft-314') as Nft
    expect(applyNftUpdated(client, updated(other, { version: 2, price: '2' }), OWNER)).toEqual([])
  })

  it('edição indisponível não é anunciada como esgotada', () => {
    const client = new QueryClient()
    client.setQueryData(cartKeys.current(OWNER), cartWith(1))
    const changes = applyNftUpdated(
      client,
      updated(emerald, { version: 2, status: 'unavailable', available: 50 }),
      OWNER,
    )
    expect(changes).toEqual(['Emerald Ape #042 (edição aberta) ficou indisponível.'])
  })

  it('evento atrasado em relação ao carrinho (nftVersion igual ou maior) não avisa nem invalida', () => {
    const client = new QueryClient()
    // O carrinho veio da API já com o NFT na v3 (preço 1.19 nessa versão).
    client.setQueryData(cartKeys.current(OWNER), cartWith(3))
    client.setQueryData(quoteKeys.current(OWNER, 'ethereum', 3), { total: '2.396' })

    const late = applyNftUpdated(client, updated(emerald, { version: 2, price: '9.99' }), OWNER)
    expect(late).toEqual([])
    expect(isInvalidated(client, cartKeys.current(OWNER))).toBe(false)
    expect(isInvalidated(client, quoteKeys.current(OWNER, 'ethereum', 3))).toBe(false)
  })

  it('o aviso usa só o carrinho do dono atual, mas invalida todos os que têm o NFT', async () => {
    const client = new QueryClient()
    // Durante o merge do login, o carrinho do visitante e o da conta estão em cache.
    client.setQueryData(cartKeys.current('guest:x'), cartWith(1, 'cart-guest'))
    client.setQueryData(cartKeys.current('user:user-ana'), cartWith(1, 'cart-ana'))

    const changes = applyNftUpdated(
      client,
      updated(emerald, { version: 2, available: 0 }),
      'user:user-ana',
    )
    expect(changes).toEqual(['Emerald Ape #042 (edição aberta) esgotou.'])
    await vi.waitFor(() => {
      expect(isInvalidated(client, cartKeys.current('guest:x'))).toBe(true)
      expect(isInvalidated(client, cartKeys.current('user:user-ana'))).toBe(true)
    })
  })

  it('cotação ainda na primeira busca é refeita, não reaproveitada com o valor antigo', async () => {
    const client = new QueryClient()
    client.setQueryData(cartKeys.current(OWNER), cartWith(1))
    const key = quoteKeys.current(OWNER, 'ethereum', 3)
    let calls = 0
    let resolveFirst: (value: { total: string }) => void = () => {}
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn: () => {
        calls += 1
        // A primeira resposta foi calculada antes da mudança de preço.
        return calls === 1
          ? new Promise<{ total: string }>((resolve) => (resolveFirst = resolve))
          : Promise.resolve({ total: '3.116' })
      },
    })
    const stop = observer.subscribe(() => {})
    try {
      await vi.waitFor(() => expect(calls).toBe(1))
      applyNftUpdated(client, updated(emerald, { version: 2, price: '1.55' }), OWNER)
      resolveFirst({ total: '2.396' })
      await vi.waitFor(() => expect(client.getQueryData(key)).toEqual({ total: '3.116' }))
      expect(calls).toBe(2)
    } finally {
      stop()
    }
  })

  it('detalhe ainda na primeira busca: termina e busca de novo, ficando com o preço do evento', async () => {
    const client = new QueryClient()
    const key = nftKeys.detail(emerald.id)
    const changed = { ...emerald, version: 2, priceFrom: '1.55' }
    let calls = 0
    let resolveFirst: (value: Nft) => void = () => {}
    const observer = new QueryObserver(client, {
      queryKey: key,
      queryFn: () => {
        calls += 1
        // A primeira resposta foi calculada antes da mudança de preço.
        return calls === 1
          ? new Promise<Nft>((resolve) => (resolveFirst = resolve))
          : Promise.resolve(changed)
      },
    })
    const stop = observer.subscribe(() => {})
    try {
      await vi.waitFor(() => expect(calls).toBe(1))
      // Sem dado em cache, o evento não tem onde ser aplicado.
      applyNftUpdated(client, updated(emerald, { version: 2, price: '1.55' }), OWNER)
      resolveFirst(emerald)
      await vi.waitFor(() => expect(client.getQueryData<Nft>(key)?.priceFrom).toBe('1.55'))
      // A primeira busca não foi cancelada (a tela suspensa espera por ela).
      expect(calls).toBe(2)
    } finally {
      stop()
    }
  })
})

describe('tratamento do evento recebido', () => {
  it('registra só depois de aplicar: falha na aplicação deixa a reentrega passar', () => {
    const gate = createEventGate(null)
    const client = new QueryClient()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const boom = vi.spyOn(client, 'setQueryData').mockImplementationOnce(() => {
      throw new Error('falhou')
    })
    const handle = createEventHandler(gate, client)
    const event = updated(emerald, { version: 2, price: '1.55' })

    expect(handle(event)).toBe('failed')
    expect(gate.check(event)).toBe('apply')
    boom.mockRestore()
    expect(handle(event)).toBe('apply')
    expect(gate.check(event)).toBe('duplicate')
  })

  it('a falha de um listener de pedido não impede os seguintes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const handle = createEventHandler(createEventGate('user-ana'), new QueryClient())
    const received: string[] = []
    const stopA = onOrderUpdated(() => {
      throw new Error('status inesperado')
    })
    const stopB = onOrderUpdated((event) => received.push(event.data.status))
    try {
      expect(handle(orderEvent('user-ana'))).toBe('apply')
      expect(received).toEqual(['confirmed'])
      // E o evento foi registrado: a reentrega é duplicada.
      expect(handle(orderEvent('user-ana'))).toBe('duplicate')
    } finally {
      stopA()
      stopB()
    }
  })
})

describe('reconciliação pelo sync', () => {
  const favorites = (version: number): FavoritesResponse =>
    ({ items: [{ ...emerald, version }] }) as unknown as FavoritesResponse

  it('busca de novo só o que tem versão diferente da do servidor', () => {
    const client = new QueryClient()
    client.setQueryData(nftKeys.detail(emerald.id), emerald)
    client.setQueryData(['favorites', 'user-ana'], favorites(emerald.version))
    client.setQueryData(cartKeys.current(OWNER), cartWith(emerald.version))

    // Nada mudou: nada é buscado (abrir a página não duplica requisições).
    expect(
      reconcileWithServer(client, {
        reason: 'connect',
        nfts: { 'nft-042': emerald.version },
        orders: {},
      }),
    ).toEqual([])
    expect(isInvalidated(client, nftKeys.detail(emerald.id))).toBe(false)

    // Mudou com a conexão fora: detalhe, lista de interesse e carrinho.
    expect(
      reconcileWithServer(client, {
        reason: 'connect',
        nfts: { 'nft-042': emerald.version + 1 },
        orders: {},
      }),
    ).toEqual(['nfts', 'favorites', 'cart'])
    expect(isInvalidated(client, ['favorites', 'user-ana'])).toBe(true)
  })

  it('reset dos mocks (versão menor no servidor) também conta como diferente', () => {
    const client = new QueryClient()
    client.setQueryData(nftKeys.detail(emerald.id), { ...emerald, version: 5 })
    expect(
      reconcileWithServer(client, { reason: 'connect', nfts: { 'nft-042': 1 }, orders: {} }),
    ).toEqual(['nfts'])
  })
})

describe('aviso das mudanças perdidas durante a queda', () => {
  const item = (patch: Partial<Cart['items'][number]>) => ({
    ...cartWith(1).items[0]!,
    ...patch,
  })
  const cart = (items: Cart['items']): Cart => ({ ...cartWith(1), items })

  it('compara o carrinho antes e depois da busca: preço, esgotado e estoque menor', () => {
    expect(
      describeCartDiff(cart([item({ unitPrice: '1.59' })]), cart([item({ unitPrice: '1.79' })])),
    ).toEqual(['Emerald Ape #042 (edição aberta): o preço mudou de 1.59 ETH para 1.79 ETH.'])
    expect(
      describeCartDiff(cart([item({})]), cart([item({ status: 'sold_out', available: 0 })])),
    ).toEqual(['Emerald Ape #042 (edição aberta) esgotou.'])
    expect(
      describeCartDiff(cart([item({})]), cart([item({ status: 'insufficient', available: 1 })])),
    ).toEqual(['Emerald Ape #042 (edição aberta): só 1 disponível.'])
    // Nada mudou, ou o item saiu: sem aviso.
    expect(describeCartDiff(cart([item({})]), cart([item({})]))).toEqual([])
    expect(describeCartDiff(cart([item({})]), cart([]))).toEqual([])
  })

  async function reconcileCart(reason: 'connect' | 'reset') {
    const client = new QueryClient()
    client.setQueryData(cartKeys.current(OWNER), cartWith(1))
    const fresh = cart([item({ unitPrice: '1.79', nftVersion: 2 })])
    const observer = new QueryObserver(client, {
      queryKey: cartKeys.current(OWNER),
      queryFn: () => Promise.resolve(fresh),
      staleTime: Infinity,
    })
    const stop = observer.subscribe(() => {})
    const onCartChanges = vi.fn()
    try {
      reconcileWithServer(
        client,
        { reason, nfts: { 'nft-042': 2 }, orders: {} },
        { cartOwner: OWNER, onCartChanges },
      )
      await vi.waitFor(() => expect(client.getQueryData(cartKeys.current(OWNER))).toEqual(fresh))
      await new Promise((resolve) => setTimeout(resolve, 0))
    } finally {
      stop()
    }
    return onCartChanges
  }

  it('na reconexão, avisa o que mudou depois de buscar o carrinho', async () => {
    const onCartChanges = await reconcileCart('connect')
    expect(onCartChanges).toHaveBeenCalledWith([
      'Emerald Ape #042 (edição aberta): o preço mudou de 1.19 ETH para 1.79 ETH.',
    ])
  })

  it('no reset dos dados de demonstração, não compara o carrinho', async () => {
    const onCartChanges = await reconcileCart('reset')
    expect(onCartChanges).not.toHaveBeenCalled()
  })
})

describe('sessão do socket simulado', () => {
  it('token vencido ou revogado vale como visitante, como na API REST', () => {
    resetDb()
    const now = Date.parse('2026-11-25T12:00:00.000Z')
    mutate((state) => {
      state.sessions.push(
        {
          token: 'tok-valid',
          userId: 'user-ana',
          expiresAt: new Date(now + 60_000).toISOString(),
          revoked: false,
        },
        {
          token: 'tok-expired',
          userId: 'user-ana',
          expiresAt: new Date(now - 1).toISOString(),
          revoked: false,
        },
        {
          token: 'tok-revoked',
          userId: 'user-ana',
          expiresAt: new Date(now + 60_000).toISOString(),
          revoked: true,
        },
      )
    })
    expect(sessionUserId('tok-valid', now)).toBe('user-ana')
    expect(sessionUserId('tok-expired', now)).toBeNull()
    expect(sessionUserId('tok-revoked', now)).toBeNull()
    expect(sessionUserId(undefined, now)).toBeNull()
  })
})

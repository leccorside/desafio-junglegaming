import {
  idempotencyKeySchema,
  type CreateOrderRequest,
  type Order,
  type OrderStatus,
} from '@/api/contracts'
import { ethPercent, ethRound } from '@/lib/eth'

import { PAYMENT_SETTLE_MS } from '../config'
import { getDb, mutate, nextId } from '../db/store'
import type { DbOrder, DbState } from '../db/state'
import { computePriceFrom } from '../fixtures/nfts'
import { fail } from '../errors'
import { consumeOnce, getScenario, isActive } from '../scenarios'
import { simulatedTransaction } from '../transaction'
import { ensureCart, findEdition, removePurchased } from './cart'
import { computeQuote, describeChanges, fingerprint, storeQuote, toQuote } from './quotes'

export function toOrder(order: DbOrder): Order {
  const {
    userId: _u,
    cartOwnerKey: _c,
    settleAt: _s,
    outcome: _o,
    soldOutByReservation: _r,
    ...rest
  } = order
  return rest
}

/** JSON com chaves ordenadas: o mesmo corpo sempre gera o mesmo hash de idempotência. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function bumpNft(state: DbState, nftId: string) {
  const nft = state.nfts.find((n) => n.id === nftId)
  if (!nft) return
  nft.priceFrom = computePriceFrom(nft.editions)
  nft.version += 1
  nft.updatedAt = new Date().toISOString()
}

/** Cenários de checkout: o catálogo muda entre a revisão e a confirmação. */
function applyCheckoutScenarios(state: DbState, itemIds: { nftId: string; editionId: string }[]) {
  const target = itemIds[0]
  if (!target) return
  const found = findEdition(state, target.nftId, target.editionId)
  if (!found) return

  if (consumeOnce('price-changed-on-checkout')) {
    found.edition.price = ethRound(ethPercent(found.edition.price, 110), 2)
    bumpNft(state, target.nftId)
  }
  if (consumeOnce('sold-out-on-checkout')) {
    found.edition.available = 0
    found.edition.status = 'sold_out'
    bumpNft(state, target.nftId)
  }
}

export interface CreateOrderResult {
  order: Order
  created: boolean
}

export function createOrder(
  userId: string,
  idempotencyKey: string | null,
  body: CreateOrderRequest,
): CreateOrderResult {
  if (!idempotencyKey || !idempotencyKeySchema.safeParse(idempotencyKey).success) {
    fail('BAD_REQUEST', { message: 'Informe o cabeçalho Idempotency-Key com um UUID.' })
  }

  const requestHash = stableStringify(body)
  const previous = getDb().idempotency[idempotencyKey]
  if (previous) {
    if (previous.userId !== userId || previous.requestHash !== requestHash)
      fail('IDEMPOTENCY_CONFLICT')
    const order = getDb().orders.find((o) => o.id === previous.orderId)
    if (order) return { order: toOrder(order), created: false }
  }

  return mutate((state) => {
    const wallet = state.wallets.find((w) => w.id === body.walletId && w.userId === userId)
    if (!wallet)
      fail('VALIDATION_ERROR', { fields: { walletId: 'Escolha uma das suas carteiras.' } })
    if (wallet.network !== body.network) {
      fail('VALIDATION_ERROR', { fields: { network: 'A rede precisa ser a mesma da carteira.' } })
    }
    if (consumeOnce('wallet-disconnected')) fail('WALLET_DISCONNECTED')

    const ownerKey = `user:${userId}`
    const cart = ensureCart(state, { key: ownerKey, owner: 'user' })
    const accepted = state.quotes.find((q) => q.id === body.quoteId && q.ownerKey === ownerKey)

    applyCheckoutScenarios(state, accepted?.lines ?? cart.items)

    const current = computeQuote(state, cart, body.network)
    const outdated =
      !accepted ||
      accepted.version !== body.quoteVersion ||
      Date.parse(accepted.expiresAt) <= Date.now() ||
      accepted.fingerprint !== fingerprint(current)

    if (outdated) {
      const fresh = storeQuote(state, ownerKey, current)
      fail('QUOTE_OUTDATED', {
        details: {
          quote: toQuote(fresh),
          changes: accepted
            ? describeChanges(accepted, current)
            : [
                {
                  kind: 'price',
                  message: 'A cotação não vale mais. Confira os valores atualizados.',
                },
              ],
        },
      })
    }
    if (!current.lines.length) {
      fail('VALIDATION_ERROR', { message: 'Não há itens disponíveis para comprar.' })
    }

    // Reserva o estoque. Se o pagamento for recusado, ele volta.
    const soldOutByReservation: string[] = []
    for (const line of current.lines) {
      const found = findEdition(state, line.nftId, line.editionId)!
      found.edition.available -= line.quantity
      if (found.edition.available <= 0) {
        found.edition.available = 0
        found.edition.status = 'sold_out'
        soldOutByReservation.push(found.edition.id)
      }
      bumpNft(state, line.nftId)
    }

    const createdAt = new Date()
    const settleMs = getScenario().options.settleMs ?? PAYMENT_SETTLE_MS
    const order: DbOrder = {
      id: nextId(state, 'order', 'ord'),
      userId,
      cartOwnerKey: ownerKey,
      status: 'pending',
      outcome: isActive('payment-rejected') ? 'rejected' : 'confirmed',
      settleAt: new Date(createdAt.getTime() + settleMs).toISOString(),
      soldOutByReservation,
      rejectionReason: null,
      transaction: null,
      snapshot: {
        items: current.lines.map((line) => {
          const { nft, edition } = findEdition(state, line.nftId, line.editionId)!
          return {
            nftId: nft.id,
            editionId: edition.id,
            name: nft.name,
            editionName: edition.name,
            tokenId: nft.tokenId,
            imageUrl: nft.images[0]?.url ?? '',
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            lineTotal: line.lineTotal,
          }
        }),
        subtotal: current.subtotal,
        discount: current.discount,
        networkFee: current.networkFee,
        total: current.total,
        couponCode: current.coupon?.code ?? null,
        network: body.network,
        wallet: { address: wallet.address, type: wallet.type, label: wallet.label },
        buyer: body.buyer,
      },
      version: 1,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
    }

    state.orders.push(order)
    state.idempotency[idempotencyKey] = { userId, requestHash, orderId: order.id }
    return { order: toOrder(order), created: true }
  })
}

function settle(state: DbState, order: DbOrder) {
  order.status = order.outcome
  order.version += 1
  order.updatedAt = new Date().toISOString()

  if (order.outcome === 'confirmed') {
    order.transaction = simulatedTransaction(order)
    removePurchased(state, order.cartOwnerKey, order.snapshot.items)
  } else {
    order.rejectionReason = 'O pagamento foi recusado pela carteira. Nenhum valor foi cobrado.'
    for (const item of order.snapshot.items) {
      const found = findEdition(state, item.nftId, item.editionId)
      if (!found) continue
      found.edition.available += item.quantity
      // Só reabre a venda se foi esta reserva que esgotou a edição. Esgotada por
      // outro motivo depois (cenário, ajuste de teste), continua esgotada.
      const reopened =
        order.soldOutByReservation.includes(found.edition.id) && found.edition.status === 'sold_out'
      if (reopened) found.edition.status = 'available'
      bumpNft(state, item.nftId)
    }
  }
}

/**
 * Decide os pagamentos com prazo vencido. Roda antes de cada requisição, então
 * o resultado aparece mesmo depois de um refresh. Devolve os pedidos decididos
 * (o socket simulado emite `order.updated` com eles no Passo 8).
 */
export function settleDueOrders(now = Date.now()): DbOrder[] {
  const due = getDb().orders.filter((o) => o.status === 'pending' && Date.parse(o.settleAt) <= now)
  if (!due.length) return []
  return mutate((state) => {
    const settled = state.orders.filter((o) => due.some((d) => d.id === o.id))
    for (const order of settled) settle(state, order)
    return settled
  })
}

export function getOrder(userId: string, orderId: string): Order {
  if (isActive('forbidden')) fail('FORBIDDEN')
  const order = getDb().orders.find((o) => o.id === orderId)
  if (!order) fail('NOT_FOUND', { message: 'Pedido não encontrado.' })
  if (order.userId !== userId) fail('FORBIDDEN')
  return toOrder(order)
}

export function listOrders(userId: string, status?: OrderStatus): { items: Order[] } {
  if (isActive('forbidden')) fail('FORBIDDEN')
  const items = getDb()
    .orders.filter((o) => o.userId === userId && (!status || o.status === status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(toOrder)
  return { items }
}

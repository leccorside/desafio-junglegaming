import type { EthAmount, Network, Quote, QuoteOutdatedDetails } from '@/api/contracts'
import { ethAdd, ethMul, ethSub, formatEth, isEthZero } from '@/lib/eth'

import { NETWORK_FEES, QUOTE_TTL_MS } from '../config'
import { getDb, mutate, nextId } from '../db/store'
import type { DbCart, DbQuote, DbState } from '../db/state'
import { MockApiError } from '../errors'
import { ensureCart, toCart, type CartOwner } from './cart'
import { discountOf, subtotalOf, validateCoupon } from './coupons'

/** Valores da cotação calculados com o catálogo e o carrinho atuais. */
export function computeQuote(state: DbState, cart: DbCart, network: Network) {
  const items = toCart(state, cart).items
  const sellable = items.filter((i) => i.status === 'ok' || i.status === 'price_changed')
  const lines = sellable.map((i) => ({
    itemId: i.id,
    nftId: i.nftId,
    editionId: i.editionId,
    unitPrice: i.unitPrice,
    quantity: i.quantity,
    lineTotal: ethMul(i.unitPrice, i.quantity),
  }))
  const subtotal = subtotalOf(lines.map((l) => ({ price: l.unitPrice, quantity: l.quantity })))

  // Cupom que deixou de valer (expirou, subtotal caiu) simplesmente sai da cotação.
  let coupon: Quote['coupon'] = null
  let discount: EthAmount = '0'
  if (cart.couponCode) {
    try {
      const valid = validateCoupon(
        state,
        cart.couponCode,
        lines.map((l) => ({ price: l.unitPrice, quantity: l.quantity })),
      )
      coupon = { code: valid.code, description: valid.description }
      discount = discountOf(valid, subtotal)
    } catch (error) {
      if (!(error instanceof MockApiError)) throw error
    }
  }

  const networkFee = lines.length ? NETWORK_FEES[network] : '0'
  return {
    network,
    lines,
    subtotal,
    discount,
    networkFee,
    total: ethAdd(ethSub(subtotal, discount), networkFee),
    coupon,
    blockedItemIds: items.filter((i) => !sellable.includes(i)).map((i) => i.id),
  }
}

type QuoteValues = ReturnType<typeof computeQuote>

/** Assinatura do que foi cotado: mudou preço, quantidade, cupom ou taxa, mudou a assinatura. */
export function fingerprint(values: QuoteValues): string {
  return JSON.stringify([
    values.network,
    values.lines.map((l) => [l.itemId, l.unitPrice, l.quantity]),
    values.coupon?.code ?? null,
    values.discount,
    values.networkFee,
    values.blockedItemIds,
  ])
}

export function storeQuote(state: DbState, ownerKey: string, values: QuoteValues): DbQuote {
  const id = nextId(state, 'quote', 'quote')
  const quote: DbQuote = {
    ...values,
    id,
    version: state.counters.quote ?? 1,
    expiresAt: new Date(Date.now() + QUOTE_TTL_MS).toISOString(),
    ownerKey,
    fingerprint: fingerprint(values),
  }
  // Guarda só as últimas cotações de cada dono.
  const others = state.quotes.filter((q) => q.ownerKey !== ownerKey)
  const mine = state.quotes.filter((q) => q.ownerKey === ownerKey).slice(-9)
  state.quotes = [...others, ...mine, quote]
  return quote
}

export function toQuote(quote: DbQuote): Quote {
  const { ownerKey: _owner, fingerprint: _fingerprint, ...rest } = quote
  return rest
}

export function createQuote(owner: CartOwner, network: Network): Quote {
  return mutate((state) => {
    const cart = ensureCart(state, owner)
    return toQuote(storeQuote(state, owner.key, computeQuote(state, cart, network)))
  })
}

/** O que mudou entre a cotação aceita e a atual, em mensagens para o colecionador. */
export function describeChanges(
  previous: DbQuote,
  current: QuoteValues,
): QuoteOutdatedDetails['changes'] {
  const state = getDb()
  const name = (nftId: string) => state.nfts.find((n) => n.id === nftId)?.name ?? 'Item'
  const changes: QuoteOutdatedDetails['changes'] = []

  for (const line of previous.lines) {
    const now = current.lines.find((l) => l.itemId === line.itemId)
    if (!now) {
      changes.push({ kind: 'availability', message: `${name(line.nftId)} ficou indisponível.` })
    } else if (now.unitPrice !== line.unitPrice) {
      changes.push({
        kind: 'price',
        message: `${name(line.nftId)}: o preço passou de ${formatEth(line.unitPrice)} para ${formatEth(now.unitPrice)}.`,
      })
    } else if (now.quantity !== line.quantity) {
      changes.push({
        kind: 'availability',
        message: `${name(line.nftId)}: a quantidade mudou de ${line.quantity} para ${now.quantity}.`,
      })
    }
  }
  for (const line of current.lines) {
    if (!previous.lines.some((l) => l.itemId === line.itemId)) {
      changes.push({ kind: 'availability', message: `${name(line.nftId)} entrou na compra.` })
    }
  }
  if (
    (previous.coupon?.code ?? null) !== (current.coupon?.code ?? null) ||
    previous.discount !== current.discount
  ) {
    changes.push({
      kind: 'coupon',
      message: current.coupon
        ? `O desconto agora é ${formatEth(current.discount)}.`
        : 'O código promocional deixou de valer para esta compra.',
    })
  }
  if (previous.networkFee !== current.networkFee) {
    changes.push({
      kind: 'fee',
      message: `A taxa de rede agora é ${formatEth(current.networkFee)}.`,
    })
  }
  if (!changes.length && !isEthZero(current.total)) {
    changes.push({ kind: 'price', message: 'A cotação expirou. Confira os valores atualizados.' })
  }
  return changes
}

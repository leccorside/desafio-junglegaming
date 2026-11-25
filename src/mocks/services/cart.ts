import {
  HEADERS,
  uuidSchema,
  type AddCartItemRequest,
  type Cart,
  type CartItem,
  type MergeCartResponse,
  type Nft,
  type NftEdition,
} from '@/api/contracts'
import { ethCompare } from '@/lib/eth'

import { getDb, mutate } from '../db/store'
import type { DbCart, DbCartItem, DbState } from '../db/state'
import { fail } from '../errors'
import { authenticate } from './auth'
import { validateCoupon } from './coupons'

export interface CartOwner {
  key: string
  owner: 'user' | 'guest'
}

/** Dono do carrinho: o usuário autenticado ou o visitante do `X-Cart-Id`. */
export function resolveCartOwner(request: Request): CartOwner {
  const auth = authenticate(request)
  if (auth) return { key: `user:${auth.user.id}`, owner: 'user' }

  const guestId = request.headers.get(HEADERS.cartId)
  if (!guestId || !uuidSchema.safeParse(guestId).success) {
    fail('BAD_REQUEST', { message: `Informe o cabeçalho ${HEADERS.cartId} com um UUID.` })
  }
  return { key: `guest:${guestId}`, owner: 'guest' }
}

function now() {
  return new Date().toISOString()
}

export function ensureCart(state: DbState, { key, owner }: CartOwner): DbCart {
  state.carts[key] ??= {
    id: key.replace(':', '-'),
    owner,
    items: [],
    couponCode: null,
    version: 0,
    updatedAt: now(),
  }
  return state.carts[key]
}

export function findEdition(state: DbState, nftId: string, editionId: string) {
  const nft = state.nfts.find((n) => n.id === nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  return nft && edition ? { nft, edition } : null
}

function isSellable(edition: NftEdition) {
  return edition.status === 'available' && edition.available > 0
}

/** Item do carrinho com a situação calculada contra o catálogo atual. */
function toCartItem(state: DbState, item: DbCartItem): CartItem {
  const found = findEdition(state, item.nftId, item.editionId)
  if (!found) {
    return {
      id: item.id,
      nftId: item.nftId,
      editionId: item.editionId,
      name: 'NFT indisponível',
      editionName: '',
      tokenId: '',
      imageUrl: '',
      unitPrice: item.acknowledgedPrice,
      previousUnitPrice: null,
      quantity: item.quantity,
      available: 0,
      status: 'sold_out',
      nftVersion: 0,
    }
  }

  const { nft, edition } = found
  const priceChanged = ethCompare(edition.price, item.acknowledgedPrice) !== 0
  const status: CartItem['status'] = !isSellable(edition)
    ? 'sold_out'
    : item.quantity > edition.available
      ? 'insufficient'
      : priceChanged
        ? 'price_changed'
        : 'ok'

  return {
    id: item.id,
    nftId: nft.id,
    editionId: edition.id,
    name: nft.name,
    editionName: edition.name,
    tokenId: nft.tokenId,
    imageUrl: nft.images[0]?.url ?? '',
    unitPrice: edition.price,
    previousUnitPrice: priceChanged ? item.acknowledgedPrice : null,
    quantity: item.quantity,
    available: isSellable(edition) ? edition.available : 0,
    status,
    nftVersion: nft.version,
  }
}

export function toCart(state: DbState, cart: DbCart): Cart {
  return {
    id: cart.id,
    owner: cart.owner,
    items: cart.items.map((item) => toCartItem(state, item)),
    couponCode: cart.couponCode,
    version: cart.version,
    updatedAt: cart.updatedAt,
  }
}

function touch(cart: DbCart) {
  cart.version += 1
  cart.updatedAt = now()
}

function assertQuantity(edition: NftEdition, quantity: number) {
  if (!isSellable(edition)) {
    fail('AVAILABILITY_CONFLICT', {
      message: 'Esta edição está esgotada.',
      details: { maxQuantity: 0 },
    })
  }
  if (quantity > edition.available) {
    fail('AVAILABILITY_CONFLICT', {
      message: `Só há ${edition.available} ${edition.available === 1 ? 'edição disponível' : 'edições disponíveis'}.`,
      details: { maxQuantity: edition.available },
    })
  }
}

export function getCart(owner: CartOwner): Cart {
  const state = getDb()
  const cart = state.carts[owner.key]
  if (cart) return toCart(state, cart)
  return toCart(state, {
    id: owner.key.replace(':', '-'),
    owner: owner.owner,
    items: [],
    couponCode: null,
    version: 0,
    updatedAt: now(),
  })
}

export function addCartItem(owner: CartOwner, body: AddCartItemRequest): Cart {
  return mutate((state) => {
    const found = findEdition(state, body.nftId, body.editionId)
    if (!found) fail('NOT_FOUND', { message: 'NFT ou edição não encontrados.' })

    const cart = ensureCart(state, owner)
    const existing = cart.items.find(
      (i) => i.nftId === body.nftId && i.editionId === body.editionId,
    )
    const quantity = (existing?.quantity ?? 0) + body.quantity
    assertQuantity(found.edition, quantity)

    if (existing) {
      existing.quantity = quantity
      existing.acknowledgedPrice = found.edition.price
    } else {
      cart.items.push({
        id: `${found.edition.id}`,
        nftId: body.nftId,
        editionId: body.editionId,
        quantity,
        acknowledgedPrice: found.edition.price,
      })
    }
    touch(cart)
    return toCart(state, cart)
  })
}

function findItem(state: DbState, owner: CartOwner, itemId: string) {
  const cart = state.carts[owner.key]
  const item = cart?.items.find((i) => i.id === itemId)
  if (!cart || !item) fail('NOT_FOUND', { message: 'Item não está no carrinho.' })
  return { cart, item }
}

export function updateCartItem(owner: CartOwner, itemId: string, quantity: number): Cart {
  return mutate((state) => {
    const { cart, item } = findItem(state, owner, itemId)
    const found = findEdition(state, item.nftId, item.editionId)
    if (!found) fail('NOT_FOUND', { message: 'NFT ou edição não encontrados.' })
    assertQuantity(found.edition, quantity)
    item.quantity = quantity
    // Alterar a quantidade conta como ciência do preço atual.
    item.acknowledgedPrice = found.edition.price
    touch(cart)
    return toCart(state, cart)
  })
}

export function removeCartItem(owner: CartOwner, itemId: string): Cart {
  return mutate((state) => {
    const { cart } = findItem(state, owner, itemId)
    cart.items = cart.items.filter((i) => i.id !== itemId)
    touch(cart)
    return toCart(state, cart)
  })
}

export function applyCoupon(owner: CartOwner, code: string): Cart {
  return mutate((state) => {
    const cart = ensureCart(state, owner)
    validateCoupon(state, code, cartSubtotal(state, cart))
    cart.couponCode = code
    touch(cart)
    return toCart(state, cart)
  })
}

export function removeCoupon(owner: CartOwner): Cart {
  return mutate((state) => {
    const cart = ensureCart(state, owner)
    cart.couponCode = null
    touch(cart)
    return toCart(state, cart)
  })
}

/** Subtotal dos itens vendáveis, com os preços atuais. */
export function cartSubtotal(state: DbState, cart: DbCart) {
  return toCart(state, cart)
    .items.filter((i) => i.status === 'ok' || i.status === 'price_changed')
    .map((i) => ({ price: i.unitPrice, quantity: i.quantity }))
}

/**
 * Junta o carrinho do visitante ao do usuário. Itens iguais somam a
 * quantidade, limitada ao estoque; o que não couber volta em `adjustments`.
 */
export function mergeGuestCart(userId: string, guestId: string): MergeCartResponse {
  return mutate((state) => {
    const userOwner: CartOwner = { key: `user:${userId}`, owner: 'user' }
    const cart = ensureCart(state, userOwner)
    const guest = state.carts[`guest:${guestId}`]
    const adjustments: MergeCartResponse['adjustments'] = []
    let changed = false

    for (const guestItem of guest?.items ?? []) {
      const found = findEdition(state, guestItem.nftId, guestItem.editionId)
      if (!found) {
        // O NFT saiu do catálogo: o item não entra, mas o colecionador fica sabendo.
        adjustments.push({
          nftId: guestItem.nftId,
          editionId: guestItem.editionId,
          name: 'Item que não está mais no catálogo',
          requested: guestItem.quantity,
          added: 0,
        })
        continue
      }
      const existing = cart.items.find(
        (i) => i.nftId === guestItem.nftId && i.editionId === guestItem.editionId,
      )
      const current = existing?.quantity ?? 0
      const limit = isSellable(found.edition) ? found.edition.available : 0
      const added = Math.max(0, Math.min(guestItem.quantity, limit - current))

      if (added < guestItem.quantity) {
        adjustments.push({
          nftId: found.nft.id,
          editionId: found.edition.id,
          name: found.nft.name,
          requested: guestItem.quantity,
          added,
        })
      }
      if (added === 0) continue
      if (existing) existing.quantity = current + added
      else cart.items.push({ ...guestItem, quantity: added })
      changed = true
    }

    if (!cart.couponCode && guest?.couponCode) {
      cart.couponCode = guest.couponCode
      changed = true
    }
    delete state.carts[`guest:${guestId}`]
    // A versão só muda quando o carrinho do usuário mudou de fato.
    if (changed) touch(cart)
    return { cart: toCart(state, cart), adjustments }
  })
}

/** Depois do pagamento confirmado: tira do carrinho só o que foi comprado. */
export function removePurchased(
  state: DbState,
  ownerKey: string,
  purchased: { nftId: string; editionId: string; quantity: number }[],
) {
  const cart = state.carts[ownerKey]
  if (!cart) return
  for (const bought of purchased) {
    const item = cart.items.find(
      (i) => i.nftId === bought.nftId && i.editionId === bought.editionId,
    )
    if (!item) continue
    item.quantity -= bought.quantity
  }
  cart.items = cart.items.filter((i) => i.quantity > 0)
  touch(cart)
}

export type { Nft }

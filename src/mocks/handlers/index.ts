import { delay, http, HttpResponse, type RequestHandler } from 'msw'
import { z } from 'zod'

import {
  addCartItemRequestSchema,
  applyCouponRequestSchema,
  changePasswordRequestSchema,
  createOrderRequestSchema,
  createQuoteRequestSchema,
  createWalletRequestSchema,
  editionStatusSchema,
  ethAmountSchema,
  HEADERS,
  loginRequestSchema,
  mergeCartRequestSchema,
  orderStatusSchema,
  parseNftListQuery,
  registerRequestSchema,
  updateCartItemRequestSchema,
  updateProfileRequestSchema,
  updateWalletRequestSchema,
} from '@/api/contracts'

import { apiPath, MOCKS_PREFIX } from '../config'
import { getDb, mutate, resetDb } from '../db/store'
import { fail } from '../errors'
import { computePriceFrom } from '../fixtures/nfts'
import { readBody, route, zodFields } from '../http'
import {
  consumeOnce,
  getScenario,
  resetScenario,
  scenarioNameSchema,
  scenarioOptionsSchema,
  setScenario,
} from '../scenarios'
import {
  changePassword,
  connectWallet,
  createWallet,
  getProfile,
  listWallets,
  removeAvatar,
  updateAvatar,
  updateProfile,
  updateWallet,
} from '../services/account'
import { currentSession, login, logout, register, requireUser } from '../services/auth'
import {
  addCartItem,
  applyCoupon,
  getCart,
  mergeGuestCart,
  removeCartItem,
  removeCoupon,
  resolveCartOwner,
  updateCartItem,
} from '../services/cart'
import { featuredNfts, getNft, listNfts } from '../services/catalog'
import { addFavorite, listFavorites, removeFavorite } from '../services/favorites'
import { createOrder, getOrder, listOrders } from '../services/orders'
import { createQuote } from '../services/quotes'
import {
  connectedPeers,
  dropConnections,
  replayLastNftEvent,
  sendStaleNftEvent,
} from '../socket/server'

type IdParams = { id: string }
type NftParams = { nftId: string }
type ItemParams = { itemId: string }

const authHandlers = [
  http.post(
    apiPath('/auth/register'),
    route(async ({ request }) => register(await readBody(request, registerRequestSchema)), {
      status: 201,
    }),
  ),
  http.post(
    apiPath('/auth/login'),
    route(async ({ request }) => login(await readBody(request, loginRequestSchema))),
  ),
  http.get(
    apiPath('/auth/session'),
    route(({ request }) => currentSession(request)),
  ),
  http.post(
    apiPath('/auth/logout'),
    route(({ request }) => logout(request)),
  ),
]

const nftHandlers = [
  http.get(
    apiPath('/nfts'),
    route(({ request }) => {
      const parsed = parseNftListQuery(new URL(request.url).searchParams)
      if (!parsed.success) fail('BAD_REQUEST', { fields: zodFields(parsed.error) })
      return listNfts(parsed.data)
    }),
  ),
  http.get(
    apiPath('/nfts/featured'),
    route(() => featuredNfts()),
  ),
  http.get<IdParams>(
    apiPath('/nfts/:id'),
    route<IdParams>(({ params }) => getNft(params.id)),
  ),
]

const favoriteHandlers = [
  http.get(
    apiPath('/me/favorites'),
    route(({ request }) => listFavorites(requireUser(request).user.id)),
  ),
  http.put<NftParams>(
    apiPath('/me/favorites/:nftId'),
    route<NftParams>(({ request, params }) =>
      addFavorite(requireUser(request).user.id, params.nftId),
    ),
  ),
  http.delete<NftParams>(
    apiPath('/me/favorites/:nftId'),
    route<NftParams>(({ request, params }) =>
      removeFavorite(requireUser(request).user.id, params.nftId),
    ),
  ),
]

const cartHandlers = [
  http.get(
    apiPath('/cart'),
    route(({ request }) => getCart(resolveCartOwner(request))),
  ),
  http.post(
    apiPath('/cart/items'),
    route(async ({ request }) =>
      addCartItem(resolveCartOwner(request), await readBody(request, addCartItemRequestSchema)),
    ),
  ),
  http.patch<ItemParams>(
    apiPath('/cart/items/:itemId'),
    route<ItemParams>(async ({ request, params }) => {
      const { quantity } = await readBody(request, updateCartItemRequestSchema)
      return updateCartItem(resolveCartOwner(request), params.itemId, quantity)
    }),
  ),
  http.delete<ItemParams>(
    apiPath('/cart/items/:itemId'),
    route<ItemParams>(({ request, params }) =>
      removeCartItem(resolveCartOwner(request), params.itemId),
    ),
  ),
  http.post(
    apiPath('/cart/merge'),
    route(async ({ request }) => {
      const { user } = requireUser(request)
      const { guestCartId } = await readBody(request, mergeCartRequestSchema)
      return mergeGuestCart(user.id, guestCartId)
    }),
  ),
  http.put(
    apiPath('/cart/coupon'),
    route(async ({ request }) => {
      const { code } = await readBody(request, applyCouponRequestSchema)
      return applyCoupon(resolveCartOwner(request), code)
    }),
  ),
  http.delete(
    apiPath('/cart/coupon'),
    route(({ request }) => removeCoupon(resolveCartOwner(request))),
  ),
]

const quoteHandlers = [
  http.post(
    apiPath('/quotes'),
    route(async ({ request }) => {
      const { network } = await readBody(request, createQuoteRequestSchema)
      return createQuote(resolveCartOwner(request), network)
    }),
  ),
]

const orderHandlers = [
  http.post(
    apiPath('/orders'),
    route(async ({ request }) => {
      const { user } = requireUser(request)
      const body = await readBody(request, createOrderRequestSchema)
      const result = createOrder(user.id, request.headers.get(HEADERS.idempotencyKey), body)
      // Cenário order-timeout: o pedido foi criado, mas a primeira resposta nunca chega.
      if (result.created && consumeOnce('order-timeout')) await delay('infinite')
      return HttpResponse.json(result.order, { status: result.created ? 201 : 200 })
    }),
  ),
  http.get(
    apiPath('/orders'),
    route(({ request }) => {
      const { user } = requireUser(request)
      const status = new URL(request.url).searchParams.get('status')
      const parsed = status === null ? undefined : orderStatusSchema.safeParse(status)
      if (parsed && !parsed.success) fail('BAD_REQUEST', { message: 'Status inválido.' })
      return listOrders(user.id, parsed?.data)
    }),
  ),
  http.get<IdParams>(
    apiPath('/orders/:id'),
    route<IdParams>(({ request, params }) => getOrder(requireUser(request).user.id, params.id)),
  ),
]

const accountHandlers = [
  http.get(
    apiPath('/me/profile'),
    route(({ request }) => getProfile(requireUser(request).user.id)),
  ),
  http.patch(
    apiPath('/me/profile'),
    route(async ({ request }) => {
      const { user } = requireUser(request)
      return updateProfile(user.id, await readBody(request, updateProfileRequestSchema))
    }),
  ),
  http.put(
    apiPath('/me/avatar'),
    route(async ({ request }) => {
      const { user } = requireUser(request)
      const form = await request
        .formData()
        .catch(() => fail('BAD_REQUEST', { message: 'Envie multipart/form-data.' }))
      const file = form.get('avatar')
      return updateAvatar(user.id, file instanceof File ? file : null)
    }),
  ),
  http.delete(
    apiPath('/me/avatar'),
    route(({ request }) => removeAvatar(requireUser(request).user.id)),
  ),
  http.post(
    apiPath('/me/password'),
    route(async ({ request }) => {
      const { user } = requireUser(request)
      return changePassword(user.id, await readBody(request, changePasswordRequestSchema))
    }),
  ),
  http.get(
    apiPath('/me/wallets'),
    route(({ request }) => listWallets(requireUser(request).user.id)),
  ),
  http.post(
    apiPath('/me/wallets'),
    route(
      async ({ request }) => {
        const { user } = requireUser(request)
        return createWallet(user.id, await readBody(request, createWalletRequestSchema))
      },
      { status: 201 },
    ),
  ),
  http.patch<IdParams>(
    apiPath('/me/wallets/:id'),
    route<IdParams>(async ({ request, params }) => {
      const { user } = requireUser(request)
      return updateWallet(user.id, params.id, await readBody(request, updateWalletRequestSchema))
    }),
  ),
  http.post<IdParams>(
    apiPath('/me/wallets/:id/connect'),
    route<IdParams>(({ request, params }) =>
      connectWallet(requireUser(request).user.id, params.id),
    ),
  ),
]

const nftUpdateSchema = z.object({
  editionId: z.string().optional(),
  price: ethAmountSchema.optional(),
  available: z.number().int().nonnegative().optional(),
  status: editionStatusSchema.optional(),
})

/** Rotas utilitárias, sem cenários de rede: o painel e os testes precisam delas sempre. */
const mocksHandlers = [
  http.post(
    apiPath(`${MOCKS_PREFIX}/reset`),
    route(
      () => {
        resetDb()
        resetScenario()
        return { ok: true }
      },
      { network: false },
    ),
  ),
  http.get(
    apiPath(`${MOCKS_PREFIX}/scenario`),
    route(() => getScenario(), { network: false }),
  ),
  http.put(
    apiPath(`${MOCKS_PREFIX}/scenario`),
    route(
      async ({ request }) => {
        const body = await readBody(
          request,
          z.object({
            names: z.array(scenarioNameSchema),
            options: scenarioOptionsSchema.default({}),
          }),
        )
        return setScenario(body.names, body.options)
      },
      { network: false },
    ),
  ),
  http.post<IdParams>(
    apiPath(`${MOCKS_PREFIX}/nfts/:id/update`),
    route<IdParams>(
      async ({ request, params }) => {
        const body = await readBody(request, nftUpdateSchema)
        getNft(params.id)
        return mutate((state) => {
          const nft = state.nfts.find((n) => n.id === params.id)!
          const edition = body.editionId
            ? nft.editions.find((e) => e.id === body.editionId)
            : (nft.editions.find((e) => e.name === 'Aberta') ?? nft.editions[0])
          if (!edition) fail('NOT_FOUND', { message: 'Edição não encontrada.' })
          if (body.price) edition.price = body.price
          if (body.available !== undefined) edition.available = body.available
          if (body.status) {
            edition.status = body.status
          } else if (body.available !== undefined && edition.status !== 'unavailable') {
            // Só o estoque informado decide entre disponível e esgotado. Um ajuste só
            // de preço mantém o status, e uma edição indisponível continua indisponível.
            edition.status = edition.available > 0 ? 'available' : 'sold_out'
          }
          nft.priceFrom = computePriceFrom(nft.editions)
          nft.version += 1
          nft.updatedAt = new Date().toISOString()
          return nft
        })
      },
      { network: false },
    ),
  ),
  // Tempo real: as ações de teste passam pelo servidor Socket.IO simulado.
  http.post(
    apiPath(`${MOCKS_PREFIX}/realtime/replay`),
    route(() => ({ event: replayLastNftEvent() }), { network: false }),
  ),
  http.post(
    apiPath(`${MOCKS_PREFIX}/realtime/stale`),
    route(
      async ({ request }) => {
        const body = await readBody(
          request,
          z.object({ nftId: z.string(), price: ethAmountSchema }),
        )
        return { event: sendStaleNftEvent(body.nftId, body.price) }
      },
      { network: false },
    ),
  ),
  http.post(
    apiPath(`${MOCKS_PREFIX}/realtime/disconnect`),
    route(
      async ({ request }) => {
        const body = await readBody(
          request,
          z.object({ downMs: z.number().int().nonnegative().max(60_000).default(0) }),
        )
        return dropConnections(body.downMs)
      },
      { network: false },
    ),
  ),
  http.get(
    apiPath(`${MOCKS_PREFIX}/realtime/peers`),
    route(() => ({ peers: connectedPeers() }), { network: false }),
  ),
]

export const handlers: RequestHandler[] = [
  ...mocksHandlers,
  ...authHandlers,
  // /nfts/featured precisa vir antes de /nfts/:id (os dois estão em nftHandlers, nessa ordem).
  ...nftHandlers,
  ...favoriteHandlers,
  ...cartHandlers,
  ...quoteHandlers,
  ...orderHandlers,
  ...accountHandlers,
]

/** Estado atual do banco, para inspeção nos testes. */
export const inspectDb = getDb

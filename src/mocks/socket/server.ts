import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'

import {
  REALTIME_EVENTS,
  type Nft,
  type NftUpdatedEvent,
  type OrderUpdatedEvent,
  type RealtimeEvent,
  type RealtimeSync,
} from '@/api/contracts'
import { env } from '@/lib/env'

import { getDb, onDbChange, onDbReset } from '../db/store'
import type { DbOrder, DbState } from '../db/state'
import { settleDueOrders } from '../services/orders'

/**
 * Servidor Socket.IO simulado (MSW + `@mswjs/socket.io-binding`). Lê o mesmo
 * banco da API REST: quando a `version` de um NFT ou de um pedido sobe, emite
 * `nft.updated` (para todos) ou `order.updated` (só para o dono). REST e
 * evento mostram o mesmo dado porque saem do mesmo estado.
 *
 * Cada conexão só entra na lista de envio depois do pacote CONNECT do
 * cliente (com o token) e recebe na hora um `realtime.sync` com as versões
 * atuais, para o cliente buscar o que mudou antes de a conexão abrir.
 *
 * Ver docs/REALTIME.md (limitações do transporte).
 */

/** Intervalo dos pings do Engine.IO (o binding não manda; sem eles o cliente cai). */
const PING_INTERVAL_MS = 20_000
/** De quanto em quanto tempo o servidor decide os pagamentos vencidos (sem esperar REST). */
const SETTLE_INTERVAL_MS = 500
/** Quantos envios o log guarda (rota de teste `/__mocks/realtime/log`). */
const LOG_SIZE = 50

interface Peer {
  io: ReturnType<typeof toSocketIo>
  close: () => void
  /** Token do handshake (`auth.token`), conferido de novo a cada envio com dono. */
  token: string | null
  /** Usuário do token; `null` para visitante. */
  userId: string | null
  timer: ReturnType<typeof setInterval>
}

export interface SentEvent {
  type: string
  eventId: string
  /** `userId` de cada conexão que recebeu (`null` = visitante). */
  recipients: (string | null)[]
}

const peers = new Set<Peer>()
/** Até quando o servidor recusa conexões (queda simulada). */
let downUntil = 0
/** Atraso para ler o CONNECT do cliente (handshake lento, rota de teste). */
let authDelayMs = 0
/** Últimas versões vistas, para emitir só o que mudou. */
let nftVersions = new Map<string, number>()
let orderVersions = new Map<string, number>()
/** Último `nft.updated` emitido (para reenviar como duplicado nos testes). */
let lastNftEvent: NftUpdatedEvent | null = null
/** Sobe a cada reset: as versões voltam para trás, e o `eventId` não pode se repetir. */
let epoch = 0
let sentLog: SentEvent[] = []
let settleTimer: ReturnType<typeof setInterval> | null = null

const socketUrl = new URL(env.socketUrl)
/** `ws://localhost/socket` → o Socket.IO conecta em `ws://localhost/socket/?EIO=4...`. */
export const SOCKET_ORIGIN = `${socketUrl.protocol}//${socketUrl.host}`
export const SOCKET_PATH = `${socketUrl.pathname.replace(/\/$/, '')}/`

// Caminho exato: a query do Engine.IO (`?EIO=4&transport=websocket`) não entra na comparação.
const realtime = ws.link(`${SOCKET_ORIGIN}${SOCKET_PATH}`)

/**
 * Usuário de um token, com as mesmas regras da API REST: sessão existente,
 * não revogada e dentro da validade. Token vencido vale como visitante.
 */
export function sessionUserId(token: unknown, now = Date.now()): string | null {
  if (typeof token !== 'string') return null
  const session = getDb().sessions.find((s) => s.token === token)
  if (!session || session.revoked || Date.parse(session.expiresAt) <= now) return null
  return session.userId
}

export function nftEvent(nft: Nft): NftUpdatedEvent {
  return {
    eventId: `nft-${nft.id}-v${nft.version}-e${epoch}`,
    type: REALTIME_EVENTS.nftUpdated,
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: nft.updatedAt,
    userId: null,
    data: {
      nftId: nft.id,
      priceFrom: nft.priceFrom,
      editions: nft.editions.map(({ id, price, available, status }) => ({
        id,
        price,
        available,
        status,
      })),
    },
  }
}

function orderEvent(order: DbOrder): OrderUpdatedEvent {
  return {
    eventId: `order-${order.id}-v${order.version}-e${epoch}`,
    type: REALTIME_EVENTS.orderUpdated,
    resource: { type: 'order', id: order.id },
    version: order.version,
    occurredAt: order.updatedAt,
    userId: order.userId,
    data: {
      orderId: order.id,
      status: order.status,
      rejectionReason: order.rejectionReason,
      transaction: order.transaction,
    },
  }
}

/**
 * Envia para quem pode receber: eventos públicos para todos, de pedido só
 * para o dono, com a sessão conferida agora (vencida ou revogada depois da
 * conexão deixa de receber).
 */
export function broadcast(event: RealtimeEvent) {
  const recipients: (string | null)[] = []
  for (const peer of peers) {
    if (event.userId !== null) {
      peer.userId = sessionUserId(peer.token)
      if (peer.userId !== event.userId) continue
    }
    peer.io.client.emit(event.type, event)
    recipients.push(peer.userId)
  }
  sentLog = [...sentLog, { type: event.type, eventId: event.eventId, recipients }].slice(-LOG_SIZE)
}

function syncPayload(userId: string | null): RealtimeSync {
  const state = getDb()
  return {
    nfts: Object.fromEntries(state.nfts.map((n) => [n.id, n.version])),
    orders: Object.fromEntries(
      state.orders.filter((o) => userId && o.userId === userId).map((o) => [o.id, o.version]),
    ),
  }
}

function sendSync(peer: Peer) {
  peer.io.client.emit(REALTIME_EVENTS.sync, syncPayload(peer.userId))
}

function snapshot(state: DbState) {
  nftVersions = new Map(state.nfts.map((n) => [n.id, n.version]))
  orderVersions = new Map(state.orders.map((o) => [o.id, o.version]))
}

/**
 * Reset dos mocks: as versões voltam às das fixtures. Nada é emitido (não é
 * uma mudança de dado); cada conexão recebe um `realtime.sync` novo e o
 * cliente busca de novo o que ficou diferente.
 */
onDbReset((state) => {
  epoch += 1
  lastNftEvent = null
  sentLog = []
  authDelayMs = 0
  snapshot(state)
  for (const peer of peers) sendSync(peer)
})

/** A cada mudança no banco: emite o que subiu de versão. */
onDbChange((state) => {
  for (const nft of state.nfts) {
    const before = nftVersions.get(nft.id)
    if (before !== undefined && nft.version > before) {
      lastNftEvent = nftEvent(nft)
      broadcast(lastNftEvent)
    }
  }
  for (const order of state.orders) {
    const before = orderVersions.get(order.id) ?? 0
    if (order.version > before) broadcast(orderEvent(order))
  }
  snapshot(state)
})

/**
 * O pedido é decidido no `settleAt`. Antes só a próxima requisição REST
 * decidia; com o timer, o `order.updated` sai na hora mesmo sem tráfego.
 */
function startSettleTimer() {
  settleTimer ??= setInterval(() => settleDueOrders(), SETTLE_INTERVAL_MS)
}

export const socketHandlers = [
  realtime.addEventListener('connection', (connection) => {
    // Queda simulada: recusa e o cliente tenta de novo (reconexão do Socket.IO).
    // Enquanto abre, o Engine.IO só reage a `error` (um `close` sozinho o deixa
    // esperando o tempo limite de 20 s), então a recusa imita a falha de rede
    // de um servidor fora do ar: `error` e depois `close`.
    if (Date.now() < downUntil) {
      setTimeout(() => {
        // socket (o WebSocket simulado da página) existe, mas não está no tipo público.
        ;(connection.client as unknown as { socket: WebSocket }).socket.dispatchEvent(
          new Event('error'),
        )
        connection.client.close(1011, 'indisponível')
      }, 0)
      return
    }
    if (nftVersions.size === 0) snapshot(getDb())
    startSettleTimer()
    const io = toSocketIo(connection)
    const peer: Peer = {
      io,
      close: () => connection.client.close(),
      token: null,
      userId: null,
      timer: setInterval(() => connection.client.send('2'), PING_INTERVAL_MS),
    }
    let closed = false

    // O binding confirma o CONNECT sozinho, mas o usuário só se sabe pelo
    // pacote do cliente ("40{...}", com o `auth`). Antes dele a conexão não
    // recebe nada; depois, entra na lista e recebe as versões atuais.
    const join = (token: string | null) => {
      if (closed) return
      peer.token = token
      peer.userId = sessionUserId(token)
      peers.add(peer)
      sendSync(peer)
    }
    connection.client.addEventListener('message', (event) => {
      const data = event.data
      if (typeof data !== 'string' || !data.startsWith('40')) return
      let token: string | null = null
      try {
        const auth = JSON.parse(data.slice(2) || '{}') as { token?: unknown }
        token = typeof auth.token === 'string' ? auth.token : null
      } catch {
        token = null
      }
      if (authDelayMs > 0) setTimeout(() => join(token), authDelayMs)
      else join(token)
    })
    connection.client.addEventListener('close', () => {
      closed = true
      clearInterval(peer.timer)
      peers.delete(peer)
    })
  }),
]

/* Ações de teste (rotas /__mocks/realtime/*): sempre pelo socket, nunca pelo cache. */

/** Reenvia o último `nft.updated` (mesmo `eventId`): o cliente precisa ignorar. */
export function replayLastNftEvent(): NftUpdatedEvent | null {
  if (lastNftEvent) broadcast(lastNftEvent)
  return lastNftEvent
}

/**
 * Envia um `nft.updated` antigo: versão anterior à atual, com um preço que
 * nunca existiu. O cliente precisa ignorar pela `version`.
 */
export function sendStaleNftEvent(nftId: string, price: string): NftUpdatedEvent | null {
  const nft = getDb().nfts.find((n) => n.id === nftId)
  if (!nft || nft.version < 1) return null
  const stale = nftEvent({
    ...nft,
    version: nft.version - 1,
    priceFrom: price,
    editions: nft.editions.map((e) => ({ ...e, price })),
  })
  stale.eventId = `${stale.eventId}-stale-${Date.now()}`
  broadcast(stale)
  return stale
}

/** Derruba as conexões e recusa novas por `downMs` (eventos desse intervalo se perdem). */
export function dropConnections(downMs: number) {
  downUntil = Date.now() + downMs
  for (const peer of [...peers]) peer.close()
  return { dropped: true, downMs }
}

/** Atrasa a leitura do CONNECT das próximas conexões (handshake lento). `0` desliga. */
export function setAuthDelay(ms: number) {
  authDelayMs = ms
  return { authDelayMs }
}

/** Conexões que já passaram do CONNECT (as que recebem eventos). */
export function connectedPeers() {
  return [...peers].map((peer) => ({ userId: peer.userId }))
}

/** Últimos envios, do mais antigo ao mais novo. Zerado no reset. */
export function sentEvents(): SentEvent[] {
  return sentLog
}

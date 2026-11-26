import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws } from 'msw'

import {
  REALTIME_EVENTS,
  type Nft,
  type NftUpdatedEvent,
  type OrderUpdatedEvent,
  type RealtimeEvent,
} from '@/api/contracts'
import { env } from '@/lib/env'

import { getDb, onDbChange } from '../db/store'
import type { DbOrder, DbState } from '../db/state'

/**
 * Servidor Socket.IO simulado (MSW + `@mswjs/socket.io-binding`). Lê o mesmo
 * banco da API REST: quando a `version` de um NFT ou de um pedido sobe, emite
 * `nft.updated` (para todos) ou `order.updated` (só para o dono). REST e
 * evento mostram o mesmo dado porque saem do mesmo estado.
 *
 * Ver docs/REALTIME.md (limitações do transporte).
 */

/** Intervalo dos pings do Engine.IO (o binding não manda; sem eles o cliente cai). */
const PING_INTERVAL_MS = 20_000

interface Peer {
  io: ReturnType<typeof toSocketIo>
  close: () => void
  /** Usuário do token enviado no handshake (`auth.token`); `null` para visitante. */
  userId: string | null
  timer: ReturnType<typeof setInterval>
}

const peers = new Set<Peer>()
/** Até quando o servidor recusa conexões (queda simulada). */
let downUntil = 0
/** Últimas versões vistas, para emitir só o que mudou. */
let nftVersions = new Map<string, number>()
let orderVersions = new Map<string, number>()
/** Último `nft.updated` emitido (para reenviar como duplicado nos testes). */
let lastNftEvent: NftUpdatedEvent | null = null

const socketUrl = new URL(env.socketUrl)
/** `ws://localhost/socket` → o Socket.IO conecta em `ws://localhost/socket/?EIO=4...`. */
export const SOCKET_ORIGIN = `${socketUrl.protocol}//${socketUrl.host}`
export const SOCKET_PATH = `${socketUrl.pathname.replace(/\/$/, '')}/`

// Caminho exato: a query do Engine.IO (`?EIO=4&transport=websocket`) não entra na comparação.
const realtime = ws.link(`${SOCKET_ORIGIN}${SOCKET_PATH}`)

function userFromToken(token: unknown): string | null {
  if (typeof token !== 'string') return null
  const session = getDb().sessions.find((s) => s.token === token && !s.revoked)
  return session ? session.userId : null
}

export function nftEvent(nft: Nft): NftUpdatedEvent {
  return {
    eventId: `nft-${nft.id}-v${nft.version}`,
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
    eventId: `order-${order.id}-v${order.version}`,
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

/** Envia para quem pode receber: eventos públicos para todos, de pedido só para o dono. */
export function broadcast(event: RealtimeEvent) {
  for (const peer of peers) {
    if (event.userId !== null && event.userId !== peer.userId) continue
    peer.io.client.emit(event.type, event)
  }
}

function snapshot(state: DbState) {
  nftVersions = new Map(state.nfts.map((n) => [n.id, n.version]))
  orderVersions = new Map(state.orders.map((o) => [o.id, o.version]))
}

/** A cada mudança no banco: emite o que subiu de versão. Reset (versões menores) só ressincroniza. */
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
    const io = toSocketIo(connection)
    const peer: Peer = {
      io,
      close: () => connection.client.close(),
      userId: null,
      timer: setInterval(() => connection.client.send('2'), PING_INTERVAL_MS),
    }
    peers.add(peer)

    // O pacote CONNECT do cliente ("40{...}") traz o `auth` do Socket.IO.
    connection.client.addEventListener('message', (event) => {
      const data = event.data
      if (typeof data !== 'string' || !data.startsWith('40')) return
      try {
        const auth = JSON.parse(data.slice(2) || '{}') as { token?: unknown }
        peer.userId = userFromToken(auth.token)
      } catch {
        peer.userId = null
      }
    })
    connection.client.addEventListener('close', () => {
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

export function connectedPeers() {
  return [...peers].map((peer) => ({ userId: peer.userId }))
}

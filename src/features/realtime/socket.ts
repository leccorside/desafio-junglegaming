import type { QueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'

import { REALTIME_EVENTS, realtimeEventSchema, type RealtimeEvent } from '@/api/contracts'
import { cartKeys, quoteKeys } from '@/features/cart/cart-cache'
import { nftKeys } from '@/features/catalog/queries'
import { env } from '@/lib/env'

import { applyNftUpdated } from './apply-nft-updated'
import { createEventGate, type EventGate } from './event-gate'

/** `ws://localhost/socket` → origem `ws://localhost` e caminho `/socket/`. */
const socketUrl = new URL(env.socketUrl)
const SOCKET_ORIGIN = `${socketUrl.protocol}//${socketUrl.host}`
const SOCKET_PATH = `${socketUrl.pathname.replace(/\/$/, '')}/`

/** Quem quer saber de `order.updated` (pedido e recibo, Passo 10). */
type OrderListener = (event: Extract<RealtimeEvent, { type: 'order.updated' }>) => void
const orderListeners = new Set<OrderListener>()

export function onOrderUpdated(listener: OrderListener): () => void {
  orderListeners.add(listener)
  return () => orderListeners.delete(listener)
}

interface Connection {
  close: () => void
}

/**
 * Abre a conexão de tempo real de uma sessão (ou do visitante). Cada sessão
 * tem a própria conexão e o próprio registro de eventos: trocar de conta
 * fecha esta (listeners removidos antes de tudo) e abre outra, então nenhum
 * evento da sessão anterior chega à seguinte.
 */
export function connectRealtime({
  queryClient,
  token,
  userId,
}: {
  queryClient: QueryClient
  token: string | null
  userId: string | null
}): Connection {
  let closed = false
  let socket: Socket | null = null

  // O `engine.io-client` guarda o `WebSocket` global quando o módulo carrega.
  // Carregado sob demanda (depois de o MSW iniciar e interceptar o
  // WebSocket), o socket passa pelo servidor simulado.
  void import('socket.io-client').then(({ io }) => {
    if (closed) return
    socket = io(SOCKET_ORIGIN, {
      path: SOCKET_PATH,
      // O MSW intercepta só WebSocket (sem long-polling).
      transports: ['websocket'],
      auth: token ? { token } : {},
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    })
    listen(socket, createEventGate(userId), queryClient)
  })

  return {
    // Idempotente: chamado pelo `onSessionEnd` e de novo na limpeza do efeito.
    close: () => {
      if (closed) return
      closed = true
      if (!socket) return
      socket.off()
      socket.io.off()
      socket.disconnect()
    },
  }
}

function listen(socket: Socket, gate: EventGate, queryClient: QueryClient) {
  const handle = (raw: unknown) => {
    const parsed = realtimeEventSchema.safeParse(raw)
    if (!parsed.success) return // Fora do contrato: descartado.
    const event = parsed.data
    if (gate.check(event) !== 'apply') return
    gate.record(event)

    if (event.type === REALTIME_EVENTS.nftUpdated) {
      const changes = applyNftUpdated(queryClient, event)
      // Aviso acessível (o Sonner anuncia em região aria-live), uma vez por evento.
      if (changes.length) {
        toast.warning(`${changes.join(' ')} O resumo do carrinho foi atualizado.`, {
          id: `cart-change-${event.eventId}`,
        })
      }
    } else {
      for (const listener of orderListeners) listener(event)
    }
  }

  socket.on(REALTIME_EVENTS.nftUpdated, handle)
  socket.on(REALTIME_EVENTS.orderUpdated, handle)

  // Reconexão: eventos perdidos enquanto a conexão estava fora são
  // recuperados pela API (que passa a ser a referência de versão).
  socket.io.on('reconnect', () => {
    void queryClient.invalidateQueries({ queryKey: nftKeys.all })
    void queryClient.invalidateQueries({ queryKey: cartKeys.all })
    void queryClient.invalidateQueries({ queryKey: quoteKeys.all })
    void queryClient.invalidateQueries({ queryKey: ['orders'] })
  })
}

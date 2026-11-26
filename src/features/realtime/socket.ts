import type { QueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'

import {
  REALTIME_EVENTS,
  realtimeEventSchema,
  realtimeSyncSchema,
  type RealtimeEvent,
} from '@/api/contracts'
import { publishCartChange } from '@/features/cart/cart-notices'
import { currentCartOwner } from '@/features/cart/queries'
import { env } from '@/lib/env'

import { applyNftUpdated } from './apply-nft-updated'
import { createEventGate, type EventGate } from './event-gate'
import { reconcileWithServer } from './reconcile'

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

/** Mostra o aviso de mudança no carrinho: na página do carrinho, se aberta; senão, toast. */
function notifyCartChange(message: string, eventId: string) {
  if (publishCartChange(message)) return
  // O Sonner anuncia em região aria-live; o id evita dois avisos do mesmo evento.
  toast.warning(message, { id: `cart-change-${eventId}` })
}

/**
 * Trata um evento recebido: contrato, porteiro, aplicação e só então o
 * registro. Se a aplicação falhar, o evento não fica marcado como aplicado
 * (uma reentrega tenta de novo). Cada listener de pedido roda isolado: a
 * falha de um não impede os seguintes.
 */
export function createEventHandler(gate: EventGate, queryClient: QueryClient) {
  return (raw: unknown) => {
    const parsed = realtimeEventSchema.safeParse(raw)
    if (!parsed.success) return 'invalid' as const // Fora do contrato: descartado.
    const event = parsed.data
    const decision = gate.check(event)
    if (decision !== 'apply') return decision

    if (event.type === REALTIME_EVENTS.nftUpdated) {
      let changes: string[]
      try {
        changes = applyNftUpdated(queryClient, event, currentCartOwner())
      } catch (error) {
        console.error('Falha ao aplicar nft.updated', error)
        return 'failed' as const
      }
      gate.record(event)
      if (changes.length) {
        notifyCartChange(`${changes.join(' ')} O resumo do carrinho foi atualizado.`, event.eventId)
      }
    } else {
      gate.record(event)
      for (const listener of [...orderListeners]) {
        try {
          listener(event)
        } catch (error) {
          console.error('Falha num listener de order.updated', error)
        }
      }
    }
    return decision
  }
}

function listen(socket: Socket, gate: EventGate, queryClient: QueryClient) {
  const handle = createEventHandler(gate, queryClient)
  socket.on(REALTIME_EVENTS.nftUpdated, handle)
  socket.on(REALTIME_EVENTS.orderUpdated, handle)

  // A cada conexão (a primeira, a de uma sessão nova, cada reconexão) e no
  // reset dos mocks, o servidor manda as versões atuais: elas viram a
  // referência do porteiro, e o que está diferente no cache é buscado de
  // novo pela API (inclui o que mudou enquanto não havia conexão).
  socket.on(REALTIME_EVENTS.sync, (raw: unknown) => {
    const parsed = realtimeSyncSchema.safeParse(raw)
    if (!parsed.success) return
    gate.sync(parsed.data)
    reconcileWithServer(queryClient, parsed.data)
  })
}

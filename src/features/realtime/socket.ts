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
import { setRealtimeStatus, type RealtimeStatus } from './connection-status'
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
  // Só a conexão mais recente mexe no aviso de queda (trocar de sessão não é queda).
  const generation = ++connectionGeneration
  const setStatus = (next: RealtimeStatus) => {
    if (!closed && generation === connectionGeneration) setRealtimeStatus(next)
  }
  setStatus('idle')

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
    listen(socket, createEventGate(userId), queryClient, setStatus)
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

let connectionGeneration = 0

export const DEMO_RESET_MESSAGE = 'Os dados de demonstração foram restaurados.'

/** Mostra o aviso de mudança no carrinho: na página do carrinho, se aberta; senão, toast. */
function notifyCartChange(message: string, id: string, kind: 'warning' | 'info' = 'warning') {
  if (publishCartChange(message)) return
  // O Sonner anuncia em região aria-live; o id evita dois avisos da mesma mudança.
  toast[kind](message, { id: `cart-change-${id}` })
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

function listen(
  socket: Socket,
  gate: EventGate,
  queryClient: QueryClient,
  setStatus: (status: RealtimeStatus) => void,
) {
  const handle = createEventHandler(gate, queryClient)
  socket.on(REALTIME_EVENTS.nftUpdated, handle)
  socket.on(REALTIME_EVENTS.orderUpdated, handle)

  // Queda: preço e estoque na tela podem ficar velhos até a volta. Fechar a
  // conexão de propósito (logout, troca de sessão) não é queda.
  socket.on('disconnect', (reason) => {
    if (reason !== 'io client disconnect') setStatus('offline')
  })
  socket.on('connect_error', () => setStatus('offline'))

  // A cada conexão (a primeira, a de uma sessão nova, cada reconexão) e no
  // reset dos mocks, o servidor manda as versões atuais: elas viram a
  // referência do porteiro, e o que está diferente no cache é buscado de
  // novo pela API (inclui o que mudou enquanto não havia conexão).
  socket.on(REALTIME_EVENTS.sync, (raw: unknown) => {
    const parsed = realtimeSyncSchema.safeParse(raw)
    if (!parsed.success) return
    const sync = parsed.data
    setStatus('online')
    gate.sync(sync)
    reconcileWithServer(queryClient, sync, {
      cartOwner: currentCartOwner(),
      onCartChanges: (messages) =>
        notifyCartChange(
          `${messages.join(' ')} O resumo do carrinho foi atualizado.`,
          `sync-${Date.now()}`,
        ),
    })
    if (sync.reason === 'reset') notifyCartChange(DEMO_RESET_MESSAGE, 'reset', 'info')
  })
}

import { useRef, useState } from 'react'

import type { CreateOrderRequest, Order } from '@/api/contracts'
import { normalizeError } from '@/api/errors'
import { useSession } from '@/features/auth/session-store'

import { ordersApi } from './api'
import { readCheckoutDraft, sameOrderBody, updateCheckoutDraft } from './storage'

/** Novas tentativas automáticas, com a mesma chave, depois de timeout ou queda de rede. */
export const ORDER_AUTO_RETRIES = 2
const RETRY_DELAY_MS = 500

const RETRYABLE = new Set(['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE'])

/** Depois disto sem resposta, a revisão avisa "Ainda enviando…" (o timeout é de 15 s). */
export const ORDER_SLOW_MS = 5000

export type PlaceOrderPhase = 'idle' | 'sending' | 'slow' | 'retrying' | 'done'

/** Gera a chave da tentativa (UUID v4; o contrato exige UUID). */
function newKey(): string {
  return crypto.randomUUID()
}

/**
 * Envio do pedido com `Idempotency-Key`:
 * - uma chave por tentativa: o mesmo corpo reaproveita a chave guardada no
 *   rascunho (refresh, timeout, "Tentar de novo"); corpo diferente (cotação
 *   nova, outra carteira) é outra tentativa, com chave nova;
 * - a chave é gravada antes do envio, então um refresh no meio ainda a tem;
 * - timeout ou queda de rede reenviam sozinhos com a mesma chave: se o pedido
 *   foi criado, a API devolve o mesmo (200), sem duplicar;
 * - clique repetido enquanto envia devolve a mesma promessa.
 */
export function usePlaceOrder() {
  const userId = useSession()?.user.id ?? 'anonymous'
  const inFlight = useRef<Promise<Order> | null>(null)
  const [phase, setPhase] = useState<PlaceOrderPhase>('idle')

  const place = (body: CreateOrderRequest): Promise<Order> => {
    if (inFlight.current) return inFlight.current
    const stored = readCheckoutDraft(userId)?.attempt
    const key = stored && sameOrderBody(stored.body, body) ? stored.key : newKey()
    updateCheckoutDraft(userId, { attempt: { key, body } })

    const run = async (): Promise<Order> => {
      setPhase('sending')
      // Sem resposta em 5 s, a tela avisa que ainda está enviando (antes, ficava
      // 15 s só com "Enviando o pedido…" até a nova tentativa).
      const slowTimer = setTimeout(() => {
        setPhase((current) => (current === 'sending' ? 'slow' : current))
      }, ORDER_SLOW_MS)
      try {
        return await send()
      } finally {
        clearTimeout(slowTimer)
      }
    }

    const send = async (): Promise<Order> => {
      for (let attempt = 0; ; attempt += 1) {
        try {
          const order = await ordersApi.create(body, key)
          // Pedido registrado: a tentativa terminou.
          updateCheckoutDraft(userId, { attempt: null })
          return order
        } catch (error) {
          const apiError = normalizeError(error)
          if (!RETRYABLE.has(apiError.code) || attempt >= ORDER_AUTO_RETRIES) throw apiError
          setPhase('retrying')
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
        }
      }
    }

    // Sucesso: a tentativa fica travada no pedido criado. Um clique que chega
    // entre a resposta e a troca de tela devolve o mesmo pedido, em vez de
    // abrir outra tentativa (a chave já foi apagada do rascunho). Só uma
    // falha libera nova tentativa.
    const promise = run().then(
      (order) => {
        setPhase('done')
        return order
      },
      (error: unknown) => {
        inFlight.current = null
        setPhase('idle')
        throw error
      },
    )
    inFlight.current = promise
    return promise
  }

  return { place, phase, pending: phase !== 'idle' }
}

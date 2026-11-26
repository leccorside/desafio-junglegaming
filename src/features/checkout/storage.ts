import type { CreateOrderRequest } from '@/api/contracts'

/**
 * Rascunho do checkout por usuário, no `sessionStorage` (ver SECURITY.md):
 * sobrevive ao refresh e à expiração da sessão no meio do pagamento (volta do
 * login com o que foi preenchido), e some ao fechar a aba.
 *
 * `attempt` é a tentativa de compra em andamento: a `Idempotency-Key` e o
 * corpo enviado com ela. Enquanto existir, um reenvio usa a mesma chave e
 * recupera o mesmo pedido em vez de criar outro.
 */
export interface CheckoutDraft {
  buyer: { displayName: string; email: string; note: string }
  walletId: string | null
  attempt: { key: string; body: CreateOrderRequest } | null
}

const PREFIX = 'kurio:checkout:'

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

export function readCheckoutDraft(userId: string): CheckoutDraft | null {
  try {
    const raw = storage()?.getItem(PREFIX + userId)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CheckoutDraft>
    if (!parsed.buyer || typeof parsed.buyer !== 'object') return null
    return {
      buyer: {
        displayName: String(parsed.buyer.displayName ?? ''),
        email: String(parsed.buyer.email ?? ''),
        note: String(parsed.buyer.note ?? ''),
      },
      walletId: typeof parsed.walletId === 'string' ? parsed.walletId : null,
      attempt:
        parsed.attempt && typeof parsed.attempt.key === 'string' && parsed.attempt.body
          ? parsed.attempt
          : null,
    }
  } catch {
    return null
  }
}

export function writeCheckoutDraft(userId: string, draft: CheckoutDraft) {
  try {
    storage()?.setItem(PREFIX + userId, JSON.stringify(draft))
  } catch {
    // Sem storage: o rascunho vale só enquanto a tela estiver aberta.
  }
}

export function updateCheckoutDraft(userId: string, patch: Partial<CheckoutDraft>) {
  const current = readCheckoutDraft(userId) ?? {
    buyer: { displayName: '', email: '', note: '' },
    walletId: null,
    attempt: null,
  }
  writeCheckoutDraft(userId, { ...current, ...patch })
}

export function clearCheckoutDraft(userId?: string) {
  const store = storage()
  if (!store) return
  try {
    if (userId) {
      store.removeItem(PREFIX + userId)
      return
    }
    for (const key of Object.keys(store)) if (key.startsWith(PREFIX)) store.removeItem(key)
  } catch {
    // Nada a limpar.
  }
}

/** Mesmo corpo = mesma tentativa (a chave só pode ser reusada com o mesmo corpo). */
export function sameOrderBody(a: CreateOrderRequest, b: CreateOrderRequest): boolean {
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b))
}

function normalize(body: CreateOrderRequest) {
  return {
    quoteId: body.quoteId,
    quoteVersion: body.quoteVersion,
    walletId: body.walletId,
    network: body.network,
    buyer: {
      displayName: body.buyer.displayName,
      email: body.buyer.email,
      note: body.buyer.note ?? null,
    },
  }
}

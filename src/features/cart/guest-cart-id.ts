import { randomId } from '@/lib/random-id'

/**
 * Identificador do carrinho do visitante, enviado em `X-Cart-Id` enquanto não
 * há sessão. Gerado uma vez e guardado no localStorage, para o carrinho
 * sobreviver ao refresh. No login ele é juntado ao da conta e trocado por um
 * novo (`resetGuestCartId`), para o próximo visitante começar vazio.
 */

export const GUEST_CART_STORAGE_KEY = 'kurio:guest-cart-id'

let memory: string | null = null

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

export function getGuestCartId(): string {
  const store = storage()
  try {
    const stored = store?.getItem(GUEST_CART_STORAGE_KEY)
    if (stored) return stored
  } catch {
    // Storage bloqueado: segue com o identificador em memória.
  }

  memory ??= randomId()
  try {
    store?.setItem(GUEST_CART_STORAGE_KEY, memory)
  } catch {
    // Sem storage, o carrinho do visitante vale só nesta aba.
  }
  return memory
}

/** O identificador atual, sem criar um (o merge só roda se o visitante já teve carrinho). */
export function peekGuestCartId(): string | null {
  try {
    return storage()?.getItem(GUEST_CART_STORAGE_KEY) ?? memory
  } catch {
    return memory
  }
}

/** Depois do merge: o carrinho antigo foi absorvido pela conta; o próximo é novo. */
export function resetGuestCartId() {
  memory = null
  try {
    storage()?.removeItem(GUEST_CART_STORAGE_KEY)
  } catch {
    // Sem storage, basta a memória.
  }
}

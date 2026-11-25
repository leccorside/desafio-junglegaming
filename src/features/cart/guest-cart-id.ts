import { randomId } from '@/lib/random-id'

/**
 * Identificador do carrinho do visitante, enviado em `X-Cart-Id` enquanto não
 * há sessão. Gerado uma vez e guardado no localStorage, para o carrinho
 * sobreviver ao refresh. O merge com o carrinho da conta entra no Passo 7.
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

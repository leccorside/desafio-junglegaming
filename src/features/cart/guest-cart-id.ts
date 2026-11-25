/**
 * Identificador do carrinho do visitante, enviado em `X-Cart-Id` enquanto não
 * há sessão. Gerado uma vez e guardado no localStorage, para o carrinho
 * sobreviver ao refresh. O merge com o carrinho da conta entra no Passo 7.
 */

export const GUEST_CART_STORAGE_KEY = 'kurio:guest-cart-id'

let memory: string | null = null

export function getGuestCartId(): string {
  try {
    const stored = localStorage.getItem(GUEST_CART_STORAGE_KEY)
    if (stored) return stored
    const created = crypto.randomUUID()
    localStorage.setItem(GUEST_CART_STORAGE_KEY, created)
    return created
  } catch {
    memory ??= crypto.randomUUID()
    return memory
  }
}

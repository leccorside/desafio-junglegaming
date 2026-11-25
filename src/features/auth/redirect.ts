/**
 * Aceita como destino pós-login só caminhos internos da aplicação. Evita open
 * redirect (`?redirect=https://site-malicioso` ou `//site`) e laços de volta
 * para as telas de entrada.
 */
export function safeRedirect(target: unknown, fallback = '/'): string {
  if (typeof target !== 'string') return fallback
  const value = target.trim()
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  try {
    const url = new URL(value, 'http://interno')
    if (url.origin !== 'http://interno') return fallback
    if (url.pathname === '/login' || url.pathname === '/register') return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

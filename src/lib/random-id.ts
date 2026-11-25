/**
 * UUID v4 que funciona também fora de contexto seguro. `crypto.randomUUID` só
 * existe em HTTPS e localhost: acessando o app por `http://192.168.x.x` (ex.:
 * `vite preview --host` no celular) ele não existe. Nesse caso monta o UUID com
 * `crypto.getRandomValues`, que existe em qualquer contexto, e em último caso
 * com `Math.random` (só para identificadores, nunca para segredo).
 */
export function randomId(): string {
  const c = typeof crypto === 'undefined' ? undefined : crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()

  const bytes = new Uint8Array(16)
  if (typeof c?.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)

  bytes[6] = (bytes[6]! & 0x0f) | 0x40 // versão 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80 // variante RFC 4122
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

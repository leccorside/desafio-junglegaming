import { useEffect, useState } from 'react'

/** Limite para esperar o ocioso: numa página que nunca para, o conteúdo entra mesmo assim. */
const IDLE_TIMEOUT_MS = 2000

/**
 * `true` depois do evento `load` e do primeiro momento ocioso do navegador
 * (`requestIdleCallback`, com limite de 2 s). Para o que não pode disputar
 * rede e CPU com a primeira tela.
 */
export function useIdle(): boolean {
  const [idle, setIdle] = useState(false)

  useEffect(() => {
    let handle = 0
    let cancelled = false
    const schedule = () => {
      if (cancelled) return
      // Safari ainda não tem requestIdleCallback.
      handle =
        typeof window.requestIdleCallback === 'function'
          ? window.requestIdleCallback(() => setIdle(true), { timeout: IDLE_TIMEOUT_MS })
          : globalThis.setTimeout(() => setIdle(true), 200)
    }
    if (document.readyState === 'complete') schedule()
    else window.addEventListener('load', schedule, { once: true })
    return () => {
      cancelled = true
      window.removeEventListener('load', schedule)
      if (typeof window.cancelIdleCallback === 'function') window.cancelIdleCallback(handle)
      globalThis.clearTimeout(handle)
    }
  }, [])

  return idle
}

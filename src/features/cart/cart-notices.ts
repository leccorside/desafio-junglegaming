import { useEffect, useRef, useState } from 'react'

type NoticeListener = (message: string) => void
const listeners = new Set<NoticeListener>()

/**
 * Entrega um aviso de mudança no carrinho (tempo real) à tela que mostra o
 * carrinho, se houver uma aberta (carrinho ou pagamento). Devolve `false`
 * quando nenhuma está ouvindo, e quem chamou usa um toast. Na tela, o aviso
 * fica no fluxo, em vez de um toast por cima do conteúdo.
 */
export function publishCartChange(message: string): boolean {
  if (!listeners.size) return false
  for (const listener of listeners) listener(message)
  return true
}

/**
 * Ouve os avisos enquanto a tela estiver aberta. O `listener` decide o que
 * fazer com cada um (inclusive ignorar): mesmo assim o aviso conta como
 * entregue e não vira toast.
 */
export function useCartChangeListener(listener: NoticeListener) {
  const latest = useRef(listener)
  useEffect(() => {
    latest.current = listener
  })
  useEffect(() => {
    const forward: NoticeListener = (message) => latest.current(message)
    listeners.add(forward)
    return () => {
      listeners.delete(forward)
    }
  }, [])
}

/** Último aviso de mudança recebido enquanto a tela está aberta. */
export function useCartChangeNotice(): [string | null, () => void] {
  const [message, setMessage] = useState<string | null>(null)
  useCartChangeListener(setMessage)
  return [message, () => setMessage(null)]
}

import { useEffect, useState } from 'react'

type NoticeListener = (message: string) => void
const listeners = new Set<NoticeListener>()

/**
 * Entrega um aviso de mudança no carrinho (tempo real) à página do carrinho,
 * se ela estiver aberta. Devolve `false` quando não há página para mostrar, e
 * quem chamou usa um toast. Na página, o aviso fica no fluxo, acima da lista,
 * em vez de um toast por cima do primeiro item.
 */
export function publishCartChange(message: string): boolean {
  if (!listeners.size) return false
  for (const listener of listeners) listener(message)
  return true
}

/** Último aviso de mudança recebido enquanto a página do carrinho está aberta. */
export function useCartChangeNotice(): [string | null, () => void] {
  const [message, setMessage] = useState<string | null>(null)
  useEffect(() => {
    const listener: NoticeListener = (next) => setMessage(next)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])
  return [message, () => setMessage(null)]
}

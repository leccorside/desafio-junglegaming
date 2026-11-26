import { WifiOffIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useRealtimeStatus } from '../connection-status'

const RESUMED_MS = 4000

/**
 * Aviso de queda do tempo real, no fluxo, acima do conteúdo: enquanto a
 * conexão está fora, preço e estoque na tela podem estar velhos. Quando volta,
 * o leitor de tela ouve "retomadas" (o texto some da tela). A região
 * `role="status"` existe sempre, para o anúncio funcionar.
 */
export function RealtimeStatusBanner() {
  const status = useRealtimeStatus()
  const [previous, setPrevious] = useState(status)
  const [resumed, setResumed] = useState(false)

  // Ajuste durante a renderização (sem efeito): saiu de offline para online.
  if (status !== previous) {
    setPrevious(status)
    setResumed(previous === 'offline' && status === 'online')
  }

  useEffect(() => {
    if (!resumed) return
    const timer = setTimeout(() => setResumed(false), RESUMED_MS)
    return () => clearTimeout(timer)
  }, [resumed])

  const offline = status === 'offline'
  return (
    <div
      role="status"
      data-realtime-status={status}
      className={offline ? 'mx-auto w-full max-w-content px-4 pt-3 md:px-6 xl:px-0' : 'sr-only'}
    >
      {offline ? (
        <p className="flex items-center gap-2 rounded-md border border-warning/50 bg-card px-3 py-2 text-body-sm text-foreground">
          <WifiOffIcon aria-hidden="true" className="size-4 shrink-0 text-warning" />
          Atualizações em tempo real pausadas. Reconectando…
        </p>
      ) : resumed ? (
        'Atualizações em tempo real retomadas.'
      ) : null}
    </div>
  )
}

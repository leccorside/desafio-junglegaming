import { WifiOffIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useRealtimeStatus } from '../connection-status'

const RESUMED_MS = 4000

const OFFLINE_MESSAGE_SHORT = 'Reconectando… Os preços podem ter mudado.'
const OFFLINE_MESSAGE =
  'Atualizações em tempo real pausadas. Reconectando… Os preços podem ter mudado.'

/**
 * Aviso de queda do tempo real, por cima do topo da página (sem pulo de
 * layout): enquanto a conexão está fora, preço e estoque na tela podem estar
 * velhos. Quando volta,
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
  // Contêiner de altura zero e fixo no topo: o aviso fica por cima do começo
  // da página (a trilha, no desktop) sem empurrar o conteúdo, e continua à
  // vista com a página rolada. Não recebe cliques, para não travar o que está
  // embaixo.
  return (
    <div className="pointer-events-none sticky top-0 z-40 h-0">
      <div
        role="status"
        data-realtime-status={status}
        className={
          offline
            ? 'absolute inset-x-0 top-3 mx-auto w-full max-w-content px-4 md:px-6 xl:px-0'
            : 'sr-only'
        }
      >
        {offline ? (
          // Mobile: uma linha, com o texto curto (sem header, o aviso cobria o
          // título da página). Desktop: o texto inteiro.
          <p
            data-offline-banner=""
            className="flex items-center gap-2 rounded-md border border-warning/50 bg-card px-3 py-1.5 text-caption-sm whitespace-nowrap text-foreground shadow-lg md:py-2 md:text-body-sm md:whitespace-normal"
          >
            <WifiOffIcon aria-hidden="true" className="size-4 shrink-0 text-warning" />
            <span className="truncate md:hidden">{OFFLINE_MESSAGE_SHORT}</span>
            <span className="hidden md:inline">{OFFLINE_MESSAGE}</span>
          </p>
        ) : resumed ? (
          'Atualizações em tempo real retomadas.'
        ) : null}
      </div>
    </div>
  )
}

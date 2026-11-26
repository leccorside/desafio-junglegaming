import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { onSessionEnd } from '@/features/auth/session'
import { useSession } from '@/features/auth/session-store'

import { connectRealtime } from './socket'

/**
 * Liga o tempo real à sessão: conecta ao montar (depois de o MSW iniciar) e
 * refaz a conexão a cada troca de token (login, logout, troca de conta). A
 * conexão anterior é fechada antes, com todos os listeners removidos.
 */
export function useRealtime() {
  const queryClient = useQueryClient()
  const session = useSession()
  const token = session?.token ?? null
  const userId = session?.user.id ?? null

  useEffect(() => {
    const connection = connectRealtime({ queryClient, token, userId })
    // Logout, expiração ou troca de conta: fecha já no início do `endSession`,
    // antes de apagar a sessão e reiniciar o cache. Esperar o efeito do React
    // deixaria uma janela em que um evento da conta anterior chegaria ao
    // cache já reiniciado.
    const stopOnEnd = token ? onSessionEnd(() => connection.close()) : () => {}
    return () => {
      stopOnEnd()
      connection.close()
    }
  }, [queryClient, token, userId])
}

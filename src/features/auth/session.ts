import type { QueryClient } from '@tanstack/react-query'

import { configureApiClient } from '@/api/client'
import type { Session } from '@/api/contracts'
import { isApiError } from '@/api/errors'
import { getGuestCartId } from '@/features/cart/guest-cart-id'

import { authApi } from './api'
import { sessionKeys } from './keys'
import { clearSession, getSession, getToken, isSessionExpired, setSession } from './session-store'

/**
 * Ciclo de vida da sessão: validação no carregamento, revalidação nas rotas
 * privadas, expiração, login e logout. Ver docs/SECURITY.md.
 */

export type SessionEndReason = 'logout' | 'expired' | 'switch'

type EndListener = (reason: SessionEndReason) => void
const endListeners = new Set<EndListener>()

/**
 * Registra quem precisa saber que a sessão terminou (ex.: o socket do Passo 8
 * desconecta e remove listeners). Devolve a função para cancelar.
 */
export function onSessionEnd(listener: EndListener): () => void {
  endListeners.add(listener)
  return () => endListeners.delete(listener)
}

interface SessionRuntime {
  queryClient: QueryClient
  /** Chamado uma vez por expiração, para a interface avisar e levar ao login. */
  onExpired: () => void
}

let runtime: SessionRuntime | null = null
let expiring = false
let lastEndReason: SessionEndReason | null = null

/** Por que a última sessão terminou: a tela de login avisa quando foi expiração. */
export function lastSessionEndReason(): SessionEndReason | null {
  return lastEndReason
}

/**
 * Termina a sessão: avisa os interessados (socket), cancela requisições em
 * andamento e apaga todo o cache, para nenhum dado do usuário anterior
 * aparecer para o próximo. Os dados públicos são buscados de novo.
 */
export async function endSession(reason: SessionEndReason) {
  lastEndReason = reason
  for (const listener of endListeners) listener(reason)
  clearSession()
  if (runtime) {
    await runtime.queryClient.cancelQueries()
    runtime.queryClient.clear()
  }
}

/** Expiração detectada (API ou validade local). Roda uma vez por sessão. */
export function expireSession() {
  if (expiring || !getSession()) return
  expiring = true
  void endSession('expired').then(() => runtime?.onExpired())
}

/** Nova sessão (login ou cadastro). Limpa o cache de quem estava antes. */
export async function startSession(session: Session) {
  const previous = getSession()
  if (previous && previous.user.id !== session.user.id) await endSession('switch')
  else runtime?.queryClient.clear()
  expiring = false
  lastEndReason = null
  setSession(session)
  runtime?.queryClient.setQueryData(sessionKeys.current(session.token), session)
}

export async function logout() {
  try {
    await authApi.logout()
  } catch {
    // Mesmo sem resposta da API, a sessão local termina.
  }
  await endSession('logout')
}

/**
 * Confere a sessão salva. Valida pela API na primeira vez do carregamento e,
 * com `revalidate`, a cada entrada em rota privada. Token vencido localmente
 * expira sem requisição.
 */
export async function ensureSession({ revalidate = false } = {}): Promise<Session | null> {
  const session = getSession()
  if (!session || !runtime) return session
  if (isSessionExpired(session)) {
    expireSession()
    return null
  }

  try {
    const fresh = await runtime.queryClient.fetchQuery({
      queryKey: sessionKeys.current(session.token),
      queryFn: ({ signal }) => authApi.session(signal),
      staleTime: revalidate ? 0 : Infinity,
      retry: false,
    })
    // O token pode ter mudado enquanto a requisição estava em andamento.
    if (getToken() === fresh.token) setSession(fresh)
    return getSession()
  } catch (error) {
    if (
      isApiError(error) &&
      (error.code === 'SESSION_EXPIRED' || error.code === 'UNAUTHENTICATED')
    ) {
      return null
    }
    // Falha de rede: mantém a sessão salva, as telas tratam o erro ao buscar dados.
    return session
  }
}

/** Liga a sessão ao cliente HTTP e ao cache. Chamado uma vez, no início da aplicação. */
export function setupSession(next: SessionRuntime) {
  runtime = next
  configureApiClient({
    getToken,
    getGuestCartId,
    onSessionInvalid: (error) => {
      if (error.code === 'SESSION_EXPIRED' || error.code === 'UNAUTHENTICATED') expireSession()
    },
  })
}

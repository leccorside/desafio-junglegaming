import { CancelledError, type QueryClient } from '@tanstack/react-query'

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
  /**
   * Chamado em todo login ou cadastro, já com a sessão nova e antes de o cache
   * ser reiniciado (ex.: juntar o carrinho do visitante ao da conta).
   */
  onStart?: (session: Session) => Promise<void>
}

let runtime: SessionRuntime | null = null
let expiring = false
let loggingOut = false
let lastEndReason: SessionEndReason | null = null

/** Por que a última sessão terminou: a proteção das rotas avisa quando foi expiração. */
export function lastSessionEndReason(): SessionEndReason | null {
  return lastEndReason
}

/**
 * Esquece o motivo do fim da sessão. A tela de login chama ao sair dela: quem
 * fechou o aviso de expiração e seguiu como visitante não o vê de novo depois.
 */
export function clearSessionEndReason() {
  lastEndReason = null
}

/**
 * Troca o dono do cache sem deixar rastro do anterior: cancela as buscas em
 * andamento (uma resposta atrasada não grava no cache novo), apaga o que não
 * está na tela e reinicia o que está, que busca de novo já com a sessão atual.
 * Só `clear()` não basta: as telas montadas continuariam mostrando os dados
 * antigos, porque ficam presas às queries removidas.
 */
async function resetCache() {
  if (!runtime) return
  const { queryClient } = runtime
  await queryClient.cancelQueries()
  queryClient.removeQueries({ type: 'inactive' })
  void queryClient.resetQueries({ type: 'active' })
}

/**
 * Termina a sessão: avisa os interessados (socket), apaga a sessão e reinicia
 * o cache, para nenhum dado do usuário anterior aparecer para o próximo.
 */
export async function endSession(reason: SessionEndReason) {
  lastEndReason = reason
  for (const listener of endListeners) listener(reason)
  clearSession()
  await resetCache()
}

/** Expiração detectada (API ou validade local). Roda uma vez por sessão e nunca durante o logout. */
export function expireSession() {
  if (expiring || loggingOut || !getSession()) return
  expiring = true
  void endSession('expired').then(() => runtime?.onExpired())
}

/** Nova sessão (login ou cadastro). Reinicia o cache de quem estava antes, visitante ou outra conta. */
export async function startSession(session: Session) {
  const previous = getSession()
  if (previous && previous.user.id !== session.user.id) {
    for (const listener of endListeners) listener('switch')
  }
  expiring = false
  lastEndReason = null
  setSession(session)
  // Antes do reinício: as buscas refeitas já veem o resultado (carrinho juntado).
  await runtime?.onStart?.(session)
  await resetCache()
  // Depois do reinício: a sessão recém-recebida já vale como validada, sem
  // outra ida à API na próxima navegação.
  runtime?.queryClient.setQueryData(sessionKeys.current(session.token), session)
}

/**
 * Sai da conta. Enquanto o logout roda, um 401 (token já vencido no servidor,
 * requisição antiga voltando) não vira "sessão expirou".
 */
export async function logout() {
  loggingOut = true
  try {
    await authApi.logout()
  } catch {
    // Mesmo sem resposta da API, a sessão local termina.
  } finally {
    await endSession('logout')
    loggingOut = false
  }
}

/** Sessão salva e ainda válida pela data, sem requisição (usada no preload ao passar o mouse). */
export function getLocalSession(): Session | null {
  const session = getSession()
  return session && !isSessionExpired(session) ? session : null
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
      error instanceof CancelledError ||
      (isApiError(error) && (error.code === 'SESSION_EXPIRED' || error.code === 'UNAUTHENTICATED'))
    ) {
      // Cancelada pelo fim da sessão (logout, expiração) ou recusada pela API.
      return null
    }
    // Falha de rede: vale a sessão que existe agora, não a lida antes da espera.
    return getSession()
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

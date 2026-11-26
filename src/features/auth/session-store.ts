import { useSyncExternalStore } from 'react'

import { sessionSchema, type Session } from '@/api/contracts'

/**
 * Sessão atual, fora do React para o Axios ler o token. Persistida no
 * localStorage para sobreviver ao refresh (ver docs/SECURITY.md: num backend
 * real seria um cookie HttpOnly). Só guarda token, validade e dados públicos
 * do usuário: nunca a senha.
 */

export const SESSION_STORAGE_KEY = 'kurio:session'

type Listener = () => void
const listeners = new Set<Listener>()

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function read(): Session | null {
  const raw = storage()?.getItem(SESSION_STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = sessionSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

let current: Session | null = read()

function emit() {
  for (const listener of listeners) listener()
}

export function getSession(): Session | null {
  return current
}

export function getToken(): string | null {
  return current?.token ?? null
}

/** A validade informada pela API já passou (checagem local, sem requisição). */
export function isSessionExpired(session: Session, now = Date.now()): boolean {
  return Date.parse(session.expiresAt) <= now
}

export function setSession(session: Session) {
  current = session
  try {
    storage()?.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Sem storage: a sessão vale só nesta aba.
  }
  emit()
}

/**
 * Atualiza os dados públicos do usuário na sessão atual (nome, usuário,
 * avatar), depois de salvar o perfil, para o header mudar na hora. Não mexe
 * no token. Ignora se a sessão já é de outra pessoa.
 */
export function updateSessionUser(userId: string, patch: Partial<Omit<Session['user'], 'id'>>) {
  if (!current || current.user.id !== userId) return
  setSession({ ...current, user: { ...current.user, ...patch } })
}

export function clearSession() {
  current = null
  try {
    storage()?.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // Nada a limpar.
  }
  emit()
}

export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Sessão atual no React. Re-renderiza no login, logout e expiração. */
export function useSession(): Session | null {
  return useSyncExternalStore(subscribeSession, getSession, getSession)
}

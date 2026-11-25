import {
  HEADERS,
  type LoginRequest,
  type RegisterRequest,
  type Session,
  type User,
} from '@/api/contracts'

import { SESSION_TTL_MS } from '../config'
import { getDb, mutate, nextId } from '../db/store'
import type { DbSession, DbState, DbUser } from '../db/state'
import { fail } from '../errors'
import { consumeOnce, isActive } from '../scenarios'

/** SHA-256 de `salt:senha` em hexadecimal (Web Crypto, igual no navegador e no Node). */
export async function hashPassword(salt: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
}

export function toUser(user: DbUser): User {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
  }
}

function toSession(state: DbState, session: DbSession): Session {
  const user = state.users.find((u) => u.id === session.userId)
  if (!user) fail('UNAUTHENTICATED')
  return { token: session.token, expiresAt: session.expiresAt, user: toUser(user) }
}

function createSession(state: DbState, userId: string): Session {
  const session: DbSession = {
    token: `tok_${randomHex(24)}`,
    userId,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    revoked: false,
  }
  // Uma sessão ativa por usuário: entrar de novo invalida a anterior.
  state.sessions = state.sessions.filter((s) => s.userId !== userId).concat(session)
  return toSession(state, session)
}

function readToken(request: Request): string | null {
  const header = request.headers.get(HEADERS.authorization)
  const match = header?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

export interface AuthContext {
  user: DbUser
  session: DbSession
}

/**
 * Usuário da requisição. Sem token devolve `null`. Token inválido ou vencido
 * gera erro, para o cliente tratar a expiração mesmo em rotas públicas.
 */
export function authenticate(request: Request): AuthContext | null {
  const token = readToken(request)
  if (!token) return null

  const state = getDb()
  const session = state.sessions.find((s) => s.token === token)
  if (!session) fail('UNAUTHENTICATED')

  if (consumeOnce('session-expired')) {
    mutate(() => {
      session.revoked = true
    })
  }
  if (session.revoked || Date.parse(session.expiresAt) <= Date.now()) fail('SESSION_EXPIRED')

  const user = state.users.find((u) => u.id === session.userId)
  if (!user) fail('UNAUTHENTICATED')
  return { user, session }
}

export function requireUser(request: Request): AuthContext {
  return authenticate(request) ?? fail('UNAUTHENTICATED')
}

export async function register(body: RegisterRequest): Promise<Session> {
  if (isActive('register-conflict')) {
    fail('EMAIL_TAKEN', { fields: { email: 'Já existe uma conta com este e-mail.' } })
  }
  if (isActive('validation-error')) {
    fail('VALIDATION_ERROR', { fields: { username: 'Este nome de usuário não é permitido.' } })
  }

  const state = getDb()
  if (state.users.some((u) => u.email === body.email)) {
    fail('EMAIL_TAKEN', { fields: { email: 'Já existe uma conta com este e-mail.' } })
  }
  if (state.users.some((u) => u.username.toLowerCase() === body.username.toLowerCase())) {
    fail('USERNAME_TAKEN', { fields: { username: 'Este nome de usuário já está em uso.' } })
  }

  const salt = randomHex(8)
  const passwordHash = await hashPassword(salt, body.password)

  return mutate((db) => {
    const user: DbUser = {
      id: nextId(db, 'user', 'user'),
      username: body.username,
      displayName: body.username,
      email: body.email,
      ensName: null,
      avatarUrl: null,
      passwordSalt: salt,
      passwordHash,
      updatedAt: new Date().toISOString(),
    }
    db.users.push(user)
    db.favorites[user.id] = []
    return createSession(db, user.id)
  })
}

export async function login(body: LoginRequest): Promise<Session> {
  const user = getDb().users.find((u) => u.email === body.email)
  const hash = user ? await hashPassword(user.passwordSalt, body.password) : null
  if (!user || hash !== user.passwordHash) fail('INVALID_CREDENTIALS')
  return mutate((db) => createSession(db, user.id))
}

export function currentSession(request: Request): Session {
  const { session } = requireUser(request)
  return toSession(getDb(), session)
}

export function logout(request: Request): null {
  const token = readToken(request)
  if (token) {
    mutate((db) => {
      db.sessions = db.sessions.filter((s) => s.token !== token)
    })
  }
  return null
}

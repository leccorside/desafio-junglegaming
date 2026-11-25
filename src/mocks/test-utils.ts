import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach } from 'vitest'

import { sessionSchema, type Session } from '@/api/contracts'

import { resetDb } from './db/store'
import { FIXTURE_PASSWORD } from './fixtures'
import { handlers } from './handlers'
import { resetScenario } from './scenarios'

export const BASE = 'http://localhost/api'

/** Sobe o MSW em Node e reinicia banco e cenário antes de cada teste. */
export function setupMockServer() {
  const server = setupServer(...handlers)
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
  beforeEach(() => {
    resetDb()
    resetScenario()
  })
  afterAll(() => server.close())
  return server
}

interface CallOptions {
  body?: unknown
  form?: FormData
  token?: string
  cartId?: string
  idempotencyKey?: string
  signal?: AbortSignal
}

export async function call(method: string, path: string, options: CallOptions = {}) {
  const headers: Record<string, string> = {}
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  if (options.token) headers.Authorization = `Bearer ${options.token}`
  if (options.cartId) headers['X-Cart-Id'] = options.cartId
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey

  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: options.form ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
    signal: options.signal,
  })
  const text = await response.text()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- corpo validado pelos schemas nos testes
  const json: any = text ? JSON.parse(text) : null
  return { status: response.status, json }
}

export async function loginAs(user: 'ana' | 'bruno'): Promise<Session> {
  const { json } = await call('POST', '/auth/login', {
    body: { email: `${user}@example.com`, password: FIXTURE_PASSWORD },
  })
  return sessionSchema.parse(json)
}

export const GUEST_CART = '7b6f3c2e-9d1a-4c8b-a5e2-3f4d6b8c0a1e'

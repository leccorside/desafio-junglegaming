import { MutationObserver, QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { apiClient, apiRequest } from '@/api/client'
import { sessionSchema, type Session } from '@/api/contracts'
import { setScenario } from '@/mocks/scenarios'
import { setupMockServer } from '@/mocks/test-utils'

import { SENSITIVE_MUTATION } from './hooks'
import {
  clearSessionEndReason,
  endSession,
  ensureSession,
  lastSessionEndReason,
  logout,
  setupSession,
  startSession,
} from './session'
import { clearSession, getSession } from './session-store'

setupMockServer()

const onExpired = vi.fn()
let queryClient: QueryClient

beforeAll(() => {
  apiClient.defaults.baseURL = 'http://localhost/api'
})

beforeEach(() => {
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  onExpired.mockReset()
  setupSession({ queryClient, onExpired })
  clearSession()
  clearSessionEndReason()
})

afterEach(() => queryClient.clear())

async function login(email = 'ana@example.com'): Promise<Session> {
  const session = await apiRequest(sessionSchema, {
    method: 'POST',
    url: '/auth/login',
    data: { email, password: 'Senha@123' },
  })
  await startSession(session)
  return session
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 20))

/** Query montada numa tela (observer ativo), com contador de buscas. */
function mountQuery(queryFn: () => Promise<string>) {
  const observer = new QueryObserver(queryClient, { queryKey: ['tela'], queryFn })
  const unsubscribe = observer.subscribe(() => {})
  return { observer, unsubscribe }
}

describe('fim da sessão', () => {
  it('as telas montadas buscam de novo, sem dados do usuário anterior', async () => {
    await login()
    let calls = 0
    const { observer, unsubscribe } = mountQuery(async () => `resposta ${++calls}`)
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toBe('resposta 1'))

    await endSession('logout')
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toBe('resposta 2'))
    expect(calls).toBe(2)
    unsubscribe()
  })

  it('mutations com senha saem do cache: ao desmontar o formulário e no fim da sessão', async () => {
    const variables = { email: 'ana@example.com', password: 'Senha@123' }
    // Formulário desmontado: com gcTime 0, a mutation sai logo do cache.
    const form = new MutationObserver(queryClient, {
      ...SENSITIVE_MUTATION,
      mutationFn: async (body: typeof variables) => body.email,
    })
    const stop = form.subscribe(() => {})
    await form.mutate(variables)
    expect(
      JSON.stringify(
        queryClient
          .getMutationCache()
          .getAll()
          .map((m) => m.state.variables),
      ),
    ).toContain('Senha@123')
    stop()
    form.reset()
    await vi.waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0))

    // Sem o gcTime 0 (ex.: outra mutation da conta), o fim da sessão limpa o cache.
    await queryClient
      .getMutationCache()
      .build(queryClient, { mutationFn: async () => 'ok' })
      .execute(variables)
    expect(queryClient.getMutationCache().getAll()).toHaveLength(1)
    await endSession('logout')
    expect(queryClient.getMutationCache().getAll()).toHaveLength(0)
  })

  it('o login cancela buscas de visitante em andamento e busca de novo com a sessão', async () => {
    let calls = 0
    const { observer, unsubscribe } = mountQuery(async () => {
      const call = ++calls
      await new Promise((resolve) => setTimeout(resolve, call === 1 ? 80 : 0))
      return call === 1 ? 'dados de visitante' : 'dados da conta'
    })
    await flush()
    await login()
    await vi.waitFor(() => expect(observer.getCurrentResult().data).toBe('dados da conta'))
    await new Promise((resolve) => setTimeout(resolve, 120))
    // A resposta lenta de visitante não sobrescreve a da conta.
    expect(observer.getCurrentResult().data).toBe('dados da conta')
    unsubscribe()
  })

  it('revalidação cancelada pelo fim da sessão não devolve a sessão apagada', async () => {
    await login()
    setScenario(['slow'], { latencyMs: 150 })
    const pending = ensureSession({ revalidate: true })
    await flush()
    // A sessão termina (expiração vinda de outra requisição, por exemplo)
    // enquanto a revalidação ainda espera a rede: o cancelQueries a interrompe.
    await endSession('expired')
    await expect(pending).resolves.toBeNull()
    expect(getSession()).toBeNull()
  })
})

describe('expiração', () => {
  it('401 com o token atual expira a sessão uma vez', async () => {
    await login()
    setScenario(['session-expired'])
    await expect(apiRequest(sessionSchema, { url: '/auth/session' })).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    })
    await vi.waitFor(() => expect(onExpired).toHaveBeenCalledTimes(1))
    expect(getSession()).toBeNull()
    expect(lastSessionEndReason()).toBe('expired')
  })

  it('401 atrasado com o token antigo não derruba a sessão nova', async () => {
    const old = await login()
    setScenario(['session-expired', 'slow'], { latencyMs: 120 })
    const late = apiRequest(sessionSchema, { url: '/auth/session' }).catch((e: unknown) => e)
    await flush()
    // Entra de novo (outro token) antes de a resposta antiga chegar.
    setScenario([])
    const fresh = await login()
    expect(fresh.token).not.toBe(old.token)

    await expect(late).resolves.toMatchObject({
      code: expect.stringMatching(/SESSION_EXPIRED|UNAUTHENTICATED/),
    })
    await flush()
    expect(onExpired).not.toHaveBeenCalled()
    expect(getSession()?.token).toBe(fresh.token)
  })

  it('401 durante o logout não vira "sessão expirou"', async () => {
    await login()
    setScenario(['session-expired', 'slow'], { latencyMs: 80 })
    const inFlight = apiRequest(sessionSchema, { url: '/auth/session' }).catch(() => null)
    await Promise.all([logout(), inFlight])
    await flush()
    expect(onExpired).not.toHaveBeenCalled()
    expect(lastSessionEndReason()).toBe('logout')
  })

  it('o motivo da expiração some depois de lido pela tela de login', async () => {
    await login()
    await endSession('expired')
    expect(lastSessionEndReason()).toBe('expired')
    clearSessionEndReason()
    expect(lastSessionEndReason()).toBeNull()
  })
})

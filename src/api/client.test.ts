import { AxiosError, AxiosHeaders, CanceledError } from 'axios'
import { http, HttpResponse } from 'msw'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { setScenario } from '@/mocks/scenarios'
import { setupMockServer } from '@/mocks/test-utils'
import { shouldRetry } from '@/lib/query-client'

import { apiClient, apiRequest, configureApiClient } from './client'
import { nftSchema, sessionSchema } from './contracts'
import { ApiError, normalizeError } from './errors'

const server = setupMockServer()

beforeAll(() => {
  // Em Node não há origem: a base relativa (/api) vira absoluta.
  apiClient.defaults.baseURL = 'http://localhost/api'
})
afterEach(() =>
  configureApiClient({
    getToken: () => null,
    getGuestCartId: () => '',
    onSessionInvalid: () => {},
  }),
)

describe('normalizeError', () => {
  const config = { headers: new AxiosHeaders() }

  it('lê o corpo de erro do contrato', () => {
    const error = new AxiosError('x', 'ERR_BAD_REQUEST', config, null, {
      status: 422,
      statusText: '',
      headers: {},
      config,
      data: {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Inválido.',
          fields: { email: 'E-mail inválido.' },
          retryable: false,
        },
      },
    })
    expect(normalizeError(error)).toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 422,
      fields: { email: 'E-mail inválido.' },
      retryable: false,
    })
  })

  it('diferencia timeout, rede, cancelamento e resposta fora do contrato', () => {
    expect(normalizeError(new AxiosError('t', AxiosError.ECONNABORTED, config))).toMatchObject({
      code: 'TIMEOUT',
      retryable: true,
    })
    expect(normalizeError(new AxiosError('n', AxiosError.ERR_NETWORK, config))).toMatchObject({
      code: 'NETWORK_ERROR',
      retryable: true,
    })
    expect(normalizeError(new CanceledError()).code).toBe('CANCELED')
    const html = new AxiosError('h', 'ERR_BAD_RESPONSE', config, null, {
      status: 502,
      statusText: '',
      headers: {},
      config,
      data: '<html>Bad Gateway</html>',
    })
    expect(normalizeError(html)).toMatchObject({ code: 'INTERNAL_ERROR', retryable: true })
  })
})

describe('apiRequest', () => {
  it('valida a resposta com o schema do contrato', async () => {
    const nft = await apiRequest(nftSchema, { url: '/nfts/nft-042' })
    expect(nft.name).toBe('Emerald Ape #042')
  })

  it('rejeita resposta fora do contrato em vez de guardar dado errado', async () => {
    server.use(http.get('*/api/nfts/:id', () => HttpResponse.json({ id: 1 })))
    await expect(apiRequest(nftSchema, { url: '/nfts/nft-042' })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    })
  })

  it('converte erros da API em ApiError', async () => {
    const error = await apiRequest(nftSchema, { url: '/nfts/nft-000' }).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ code: 'NOT_FOUND', status: 404 })
  })

  it('envia o token e avisa a sessão quando ele expira', async () => {
    const session = await apiRequest(sessionSchema, {
      method: 'POST',
      url: '/auth/login',
      data: { email: 'ana@example.com', password: 'Senha@123' },
    })
    const onSessionInvalid = vi.fn()
    configureApiClient({ getToken: () => session.token, onSessionInvalid })

    await expect(apiRequest(sessionSchema, { url: '/auth/session' })).resolves.toMatchObject({
      user: { id: 'user-ana' },
    })
    expect(onSessionInvalid).not.toHaveBeenCalled()

    setScenario(['session-expired'])
    await expect(apiRequest(sessionSchema, { url: '/auth/session' })).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    })
    expect(onSessionInvalid).toHaveBeenCalledTimes(1)
  })

  it('não confunde login errado (sem token) com sessão expirada', async () => {
    const onSessionInvalid = vi.fn()
    configureApiClient({ onSessionInvalid })
    await expect(
      apiRequest(sessionSchema, {
        method: 'POST',
        url: '/auth/login',
        data: { email: 'ana@example.com', password: 'Errada@1' },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(onSessionInvalid).not.toHaveBeenCalled()
  })

  it('envia o X-Cart-Id do visitante quando não há sessão', async () => {
    configureApiClient({ getGuestCartId: () => '7b6f3c2e-9d1a-4c8b-a5e2-3f4d6b8c0a1e' })
    const cart = await apiRequest(z.object({ id: z.string() }), { url: '/cart' })
    expect(cart.id).toBe('guest-7b6f3c2e-9d1a-4c8b-a5e2-3f4d6b8c0a1e')
  })
})

describe('política de retry', () => {
  const retryable = new ApiError({ code: 'SERVICE_UNAVAILABLE', message: '', retryable: true })
  const final = new ApiError({ code: 'NOT_FOUND', message: '' })

  it('repete só falhas transitórias, no máximo 2 vezes', () => {
    expect(shouldRetry(0, retryable)).toBe(true)
    expect(shouldRetry(1, retryable)).toBe(true)
    expect(shouldRetry(2, retryable)).toBe(false)
    expect(shouldRetry(0, final)).toBe(false)
    expect(shouldRetry(0, new Error('qualquer'))).toBe(false)
  })
})

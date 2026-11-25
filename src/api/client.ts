import axios, { type AxiosRequestConfig } from 'axios'
import type { z } from 'zod'

import { env } from '@/lib/env'

import { HEADERS } from './contracts'
import { ApiError, normalizeError } from './errors'

/**
 * Instância única do Axios. Toda chamada REST passa por aqui (AGENTS.md).
 *
 * - envia o token da sessão e, para o visitante, o `X-Cart-Id`;
 * - converte qualquer falha em `ApiError`;
 * - avisa a sessão quando a API diz que o token venceu.
 *
 * Quem fornece token, carrinho e reação à expiração é a camada de sessão
 * (src/features/auth), registrada em `configureApiClient` para não haver
 * dependência circular.
 */

export const REQUEST_TIMEOUT_MS = 15_000

export const apiClient = axios.create({
  baseURL: env.apiUrl,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
})

interface ClientHooks {
  getToken: () => string | null
  getGuestCartId: () => string
  onSessionInvalid: (error: ApiError) => void
}

let hooks: ClientHooks = {
  getToken: () => null,
  getGuestCartId: () => '',
  onSessionInvalid: () => {},
}

export function configureApiClient(next: Partial<ClientHooks>) {
  hooks = { ...hooks, ...next }
}

apiClient.interceptors.request.use((config) => {
  const token = hooks.getToken()
  if (token) {
    config.headers.set(HEADERS.authorization, `Bearer ${token}`)
  } else {
    config.headers.set(HEADERS.cartId, hooks.getGuestCartId())
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (rawError) => {
    const error = normalizeError(rawError)
    // Só a sessão atual pode ser derrubada: um 401 de requisição feita com um
    // token antigo (antes de um novo login, por exemplo) não conta.
    const sent: unknown = rawError?.config?.headers?.[HEADERS.authorization]
    const current = hooks.getToken()
    const sentCurrentToken = Boolean(current) && sent === `Bearer ${current}`
    if (
      sentCurrentToken &&
      (error.code === 'SESSION_EXPIRED' || error.code === 'UNAUTHENTICATED')
    ) {
      hooks.onSessionInvalid(error)
    }
    return Promise.reject(error)
  },
)

/**
 * Faz a requisição e valida a resposta com o schema do contrato. Resposta que
 * não passa no schema vira `INVALID_RESPONSE`, em vez de dado errado no cache.
 */
export async function apiRequest<T extends z.ZodType>(
  schema: T,
  config: AxiosRequestConfig,
): Promise<z.infer<T>> {
  const response = await apiClient.request(config)
  const parsed = schema.safeParse(response.status === 204 ? null : response.data)
  if (!parsed.success) {
    if (import.meta.env.DEV)
      console.error('[api] resposta fora do contrato', config.url, parsed.error)
    throw new ApiError({
      code: 'INVALID_RESPONSE',
      message: 'Recebemos uma resposta inesperada do servidor.',
      status: response.status,
    })
  }
  return parsed.data
}

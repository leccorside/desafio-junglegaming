import { AxiosError, isAxiosError, isCancel } from 'axios'

import { apiErrorBodySchema, type ErrorCode } from './contracts'

/**
 * Erro único da aplicação: todo erro de requisição (resposta da API, falha de
 * rede, timeout, cancelamento, resposta fora do contrato) vira um `ApiError`
 * com código do contrato. A interface decide só pelo `code`.
 */
export class ApiError extends Error {
  readonly code: ErrorCode
  /** Status HTTP, quando houve resposta. */
  readonly status: number | null
  /** Erros por campo vindos da API (nome do campo → mensagem). */
  readonly fields: Record<string, string>
  readonly details: Record<string, unknown>
  /** Se repetir a mesma requisição pode dar certo. */
  readonly retryable: boolean

  constructor(options: {
    code: ErrorCode
    message: string
    status?: number | null
    fields?: Record<string, string>
    details?: Record<string, unknown>
    retryable?: boolean
  }) {
    super(options.message)
    this.name = 'ApiError'
    this.code = options.code
    this.status = options.status ?? null
    this.fields = options.fields ?? {}
    this.details = options.details ?? {}
    this.retryable = options.retryable ?? false
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

const MESSAGES = {
  NETWORK_ERROR: 'Sem conexão com o servidor. Confira sua internet e tente de novo.',
  TIMEOUT: 'O servidor demorou demais para responder. Tente de novo.',
  CANCELED: 'A requisição foi cancelada.',
  INVALID_RESPONSE: 'Recebemos uma resposta inesperada do servidor.',
} as const

/** Converte qualquer erro de requisição em `ApiError`. */
export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (isCancel(error) || (error instanceof Error && error.name === 'CanceledError')) {
    return new ApiError({ code: 'CANCELED', message: MESSAGES.CANCELED })
  }

  if (isAxiosError(error)) {
    if (error.response) {
      const body = apiErrorBodySchema.safeParse(error.response.data)
      if (body.success) {
        const { code, message, fields, details, retryable } = body.data.error
        return new ApiError({
          code,
          message,
          fields,
          details,
          retryable,
          status: error.response.status,
        })
      }
      // Resposta de erro fora do contrato (proxy, HTML): trata como falha do servidor.
      return new ApiError({
        code: error.response.status >= 500 ? 'INTERNAL_ERROR' : 'INVALID_RESPONSE',
        message: MESSAGES.INVALID_RESPONSE,
        status: error.response.status,
        retryable: error.response.status >= 500,
      })
    }
    if (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT) {
      return new ApiError({ code: 'TIMEOUT', message: MESSAGES.TIMEOUT, retryable: true })
    }
    return new ApiError({ code: 'NETWORK_ERROR', message: MESSAGES.NETWORK_ERROR, retryable: true })
  }

  return new ApiError({
    code: 'INVALID_RESPONSE',
    message: error instanceof Error ? error.message : MESSAGES.INVALID_RESPONSE,
  })
}

/** Mensagem para exibir ao colecionador. */
export function errorMessage(error: unknown): string {
  return normalizeError(error).message
}

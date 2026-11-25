import { z } from 'zod'

/**
 * Tipos base compartilhados por todos os contratos (REST e eventos).
 * Os schemas validam as respostas no limite da rede e geram os tipos usados
 * pelo cache e pela interface. Ver docs/API.md.
 */

/** Valor em ETH como string decimal, nunca `number` (até 18 casas, sem sinal). */
export const ethAmountSchema = z
  .string()
  .regex(/^(0|[1-9]\d*)(\.\d{1,18})?$/, 'Valor em ETH inválido')
export type EthAmount = z.infer<typeof ethAmountSchema>

export const idSchema = z.string().min(1)
export const isoDateTimeSchema = z.iso.datetime({ offset: true })
export const quantitySchema = z.number().int().positive()
export const nonNegativeIntSchema = z.number().int().nonnegative()

/** Versão de um recurso, incrementada a cada mudança. Base da ordenação de eventos. */
export const versionSchema = z.number().int().nonnegative()

export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: nonNegativeIntSchema,
    totalPages: nonNegativeIntSchema,
  })
}
export type Page<T> = {
  items: T[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

/** Cabeçalhos HTTP com significado no contrato. */
export const HEADERS = {
  authorization: 'Authorization',
  cartId: 'X-Cart-Id',
  idempotencyKey: 'Idempotency-Key',
} as const

export const uuidSchema = z.uuid()

/* -------------------------------------------------------------------------- */
/* Erros                                                                      */
/* -------------------------------------------------------------------------- */

/** Códigos que a API devolve no corpo de erro. */
export const apiErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'EMAIL_TAKEN',
  'USERNAME_TAKEN',
  'AVAILABILITY_CONFLICT',
  'QUOTE_OUTDATED',
  'IDEMPOTENCY_CONFLICT',
  'VALIDATION_ERROR',
  'INVALID_CREDENTIALS',
  'INVALID_PASSWORD',
  'COUPON_INVALID',
  'COUPON_EXPIRED',
  'SERVICE_UNAVAILABLE',
  'INTERNAL_ERROR',
])
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>

/** Status HTTP de cada código. Os handlers do MSW usam esta tabela. */
export const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  SESSION_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  USERNAME_TAKEN: 409,
  AVAILABILITY_CONFLICT: 409,
  QUOTE_OUTDATED: 409,
  IDEMPOTENCY_CONFLICT: 409,
  VALIDATION_ERROR: 422,
  INVALID_PASSWORD: 422,
  COUPON_INVALID: 422,
  COUPON_EXPIRED: 422,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
}

/** Corpo de erro de toda resposta 4xx/5xx. */
export const apiErrorBodySchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string(),
    /** Erros por campo (nome do campo → mensagem), em validação e conflito de cadastro. */
    fields: z.record(z.string(), z.string()).optional(),
    /** Se a mesma requisição pode ser repetida com chance de sucesso. */
    retryable: z.boolean(),
    /** Dados extras do código (por exemplo `maxQuantity` ou a nova cotação). */
    details: z.record(z.string(), z.unknown()).optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>

/**
 * Códigos que só existem no cliente, quando não há resposta da API
 * (normalizados pelo Axios no Passo 4).
 */
export const clientErrorCodeSchema = z.enum([
  'NETWORK_ERROR',
  'TIMEOUT',
  'CANCELED',
  'INVALID_RESPONSE',
])
export type ClientErrorCode = z.infer<typeof clientErrorCodeSchema>

export type ErrorCode = ApiErrorCode | ClientErrorCode

import type { ApiErrorCode } from '@/api/contracts'

const DEFAULT_MESSAGES: Record<ApiErrorCode, string> = {
  BAD_REQUEST: 'Requisição inválida.',
  UNAUTHENTICATED: 'Entre na sua conta para continuar.',
  SESSION_EXPIRED: 'Sua sessão expirou. Entre de novo para continuar.',
  INVALID_CREDENTIALS: 'E-mail ou senha incorretos.',
  FORBIDDEN: 'Você não tem acesso a este recurso.',
  NOT_FOUND: 'Recurso não encontrado.',
  EMAIL_TAKEN: 'Já existe uma conta com este e-mail.',
  USERNAME_TAKEN: 'Este nome de usuário já está em uso.',
  AVAILABILITY_CONFLICT: 'Não há edições suficientes disponíveis.',
  QUOTE_OUTDATED: 'Os valores mudaram. Revise a cotação antes de confirmar.',
  IDEMPOTENCY_CONFLICT: 'Esta tentativa de compra já foi usada com outros dados.',
  WALLET_REJECTED: 'A conexão foi recusada na carteira.',
  WALLET_DISCONNECTED: 'A carteira foi desconectada. Conecte de novo para continuar.',
  VALIDATION_ERROR: 'Alguns campos estão inválidos.',
  INVALID_PASSWORD: 'A senha atual está incorreta.',
  COUPON_INVALID: 'Código promocional inválido.',
  COUPON_EXPIRED: 'Este código promocional expirou.',
  INTERNAL_ERROR: 'Erro inesperado no servidor.',
  SERVICE_UNAVAILABLE: 'Serviço temporariamente indisponível. Tente de novo.',
}

const RETRYABLE: ReadonlySet<ApiErrorCode> = new Set(['SERVICE_UNAVAILABLE', 'INTERNAL_ERROR'])

/** Erro de regra lançado pelos serviços dos mocks e convertido em resposta HTTP pelos handlers. */
export class MockApiError extends Error {
  readonly code: ApiErrorCode
  readonly fields?: Record<string, string>
  readonly details?: Record<string, unknown>
  readonly retryable: boolean

  constructor(
    code: ApiErrorCode,
    options: {
      message?: string
      fields?: Record<string, string>
      details?: Record<string, unknown>
    } = {},
  ) {
    super(options.message ?? DEFAULT_MESSAGES[code])
    this.name = 'MockApiError'
    this.code = code
    this.fields = options.fields
    this.details = options.details
    this.retryable = RETRYABLE.has(code)
  }
}

export function fail(
  code: ApiErrorCode,
  options?: ConstructorParameters<typeof MockApiError>[1],
): never {
  throw new MockApiError(code, options)
}

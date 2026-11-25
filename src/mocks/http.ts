import { HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import { ZodError, type z } from 'zod'

import { API_ERROR_STATUS, type ApiErrorBody } from '@/api/contracts'
import { env } from '@/lib/env'

import { MockApiError } from './errors'
import { applyNetworkScenario } from './scenarios'
import { settleDueOrders } from './services/orders'

/** Converte um erro de regra no corpo padrão da API. */
export function errorResponse(error: MockApiError) {
  const body: ApiErrorBody = {
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      ...(error.fields ? { fields: error.fields } : {}),
      ...(error.details ? { details: error.details } : {}),
    },
  }
  return HttpResponse.json(body, { status: API_ERROR_STATUS[error.code] })
}

/** Erros de schema viram `VALIDATION_ERROR` com uma mensagem por campo. */
export function zodFields(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    fields[key] ??= issue.message
  }
  return fields
}

/** Lê e valida o corpo JSON com o schema do contrato. */
export async function readBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw new MockApiError('BAD_REQUEST', { message: 'Corpo JSON inválido.' })
  }
  const result = schema.safeParse(raw)
  if (!result.success)
    throw new MockApiError('VALIDATION_ERROR', { fields: zodFields(result.error) })
  return result.data
}

/** Caminho da rota sem a base da API (`/api/nfts?x` → `/nfts`). */
function routePath(request: Request): string {
  const { pathname } = new URL(request.url)
  const base = new URL(env.apiUrl, 'http://base').pathname.replace(/\/$/, '')
  return pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname
}

interface HandlerContext<P extends PathParams> {
  request: Request
  params: P
  path: string
}

type Resolver<P extends PathParams> = (ctx: HandlerContext<P>) => unknown

/**
 * Envolve a regra de uma rota: cenários de rede, liquidação de pagamentos
 * vencidos, serialização da resposta e conversão de erros.
 * O resultado vira JSON com `status` (padrão 200); `null` vira 204; uma
 * `Response` pronta é devolvida como está.
 */
export function route<P extends PathParams = PathParams>(
  resolver: Resolver<P>,
  options: { status?: number; network?: boolean } = {},
): HttpResponseResolver<P, DefaultBodyType, DefaultBodyType> {
  return async ({ request, params }) => {
    const path = routePath(request)
    if (options.network !== false) {
      const replaced = await applyNetworkScenario(request.method, path)
      if (replaced) return replaced
    }

    try {
      settleDueOrders()
      const result = await resolver({ request, params, path })
      if (result instanceof Response) return result
      if (result === null) return new HttpResponse(null, { status: 204 })
      return HttpResponse.json(result as DefaultBodyType, { status: options.status ?? 200 })
    } catch (error) {
      if (error instanceof MockApiError) return errorResponse(error)
      if (error instanceof ZodError) {
        return errorResponse(new MockApiError('VALIDATION_ERROR', { fields: zodFields(error) }))
      }
      console.error('[mocks] erro inesperado', error)
      return errorResponse(new MockApiError('INTERNAL_ERROR'))
    }
  }
}

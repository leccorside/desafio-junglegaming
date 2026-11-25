/**
 * Query keys da sessão. Toda chave de dado privado inclui o ID do usuário
 * (docs/STATE_MANAGEMENT.md), para dois usuários nunca dividirem cache.
 */
export const sessionKeys = {
  all: ['session'] as const,
  current: (token: string) => ['session', token] as const,
}

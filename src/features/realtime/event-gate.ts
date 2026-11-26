import type { RealtimeEvent } from '@/api/contracts'

/** Quantos `eventId` lembrar (janela limitada, os mais antigos saem). */
const MAX_REMEMBERED = 500

export type GateDecision = 'apply' | 'duplicate' | 'stale' | 'other-user'

/**
 * Porteiro dos eventos de uma conexão (uma sessão). Decide se o evento é
 * aplicado: descarta repetidos (`eventId`), antigos (`version` menor ou igual
 * à última aplicada para o recurso) e de outro usuário (`userId`). Cada
 * sessão tem o seu: na troca de sessão o registro começa vazio.
 */
export function createEventGate(sessionUserId: string | null) {
  const seen = new Set<string>()
  const versions = new Map<string, number>()

  return {
    check(event: RealtimeEvent): GateDecision {
      if (event.userId !== null && event.userId !== sessionUserId) return 'other-user'
      if (seen.has(event.eventId)) return 'duplicate'
      const key = `${event.resource.type}:${event.resource.id}`
      const last = versions.get(key)
      if (last !== undefined && event.version <= last) return 'stale'
      return 'apply'
    },
    /** Registra o evento aplicado (ou a versão vinda da API, como referência). */
    record(event: Pick<RealtimeEvent, 'eventId' | 'resource' | 'version'>) {
      seen.add(event.eventId)
      if (seen.size > MAX_REMEMBERED) {
        const oldest = seen.values().next().value
        if (oldest !== undefined) seen.delete(oldest)
      }
      const key = `${event.resource.type}:${event.resource.id}`
      versions.set(key, Math.max(versions.get(key) ?? 0, event.version))
    },
  }
}

export type EventGate = ReturnType<typeof createEventGate>

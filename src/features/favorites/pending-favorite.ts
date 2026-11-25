import { z } from 'zod'

/**
 * Intenção de favoritar de quem ainda não entrou: o visitante toca no coração,
 * vai ao login e, ao voltar, o favorito é concluído e a tela rola até o NFT.
 * Fica no sessionStorage (só esta aba) e vale por 10 minutos.
 */
export const PENDING_FAVORITE_KEY = 'kurio:pending-favorite'
export const PENDING_FAVORITE_TTL_MS = 10 * 60_000

const pendingFavoriteSchema = z.object({
  nftId: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  createdAt: z.number(),
})
export type PendingFavorite = z.infer<typeof pendingFavoriteSchema>

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

export function savePendingFavorite(nft: { id: string; name: string }, now = Date.now()) {
  try {
    storage()?.setItem(
      PENDING_FAVORITE_KEY,
      JSON.stringify({ nftId: nft.id, name: nft.name, createdAt: now }),
    )
  } catch {
    // Sem storage: o visitante favorita de novo depois de entrar.
  }
}

/** Lê sem apagar. Valor corrompido ou vencido conta como nenhum (e é apagado). */
export function peekPendingFavorite(now = Date.now()): PendingFavorite | null {
  const store = storage()
  try {
    const raw = store?.getItem(PENDING_FAVORITE_KEY)
    if (!raw) return null
    const parsed = pendingFavoriteSchema.safeParse(JSON.parse(raw))
    if (parsed.success && now - parsed.data.createdAt <= PENDING_FAVORITE_TTL_MS) {
      return parsed.data
    }
  } catch {
    // JSON inválido: cai no descarte abaixo.
  }
  clearPendingFavorite()
  return null
}

/** Lê e apaga: a intenção é concluída uma vez só. */
export function takePendingFavorite(now = Date.now()): PendingFavorite | null {
  const pending = peekPendingFavorite(now)
  clearPendingFavorite()
  return pending
}

export function clearPendingFavorite() {
  try {
    storage()?.removeItem(PENDING_FAVORITE_KEY)
  } catch {
    // Nada a fazer.
  }
}

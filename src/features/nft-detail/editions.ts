import type { Nft, NftEdition } from '@/api/contracts'
import { ethCompare } from '@/lib/eth'

/** A edição pode ser escolhida (está à venda e tem estoque)? */
export function isEditionSelectable(edition: NftEdition): boolean {
  return edition.status === 'available' && edition.available > 0
}

/** Rótulo do estado de uma edição que não pode ser escolhida. */
export function editionStatusLabel(edition: NftEdition): string | null {
  if (isEditionSelectable(edition)) return null
  return edition.status === 'unavailable' ? 'indisponível' : 'esgotada'
}

/** Edição padrão: a mais barata entre as disponíveis (o preço do card). */
export function defaultEdition(nft: Nft): NftEdition | null {
  const selectable = nft.editions.filter(isEditionSelectable)
  if (!selectable.length) return null
  return selectable.reduce((best, edition) =>
    ethCompare(edition.price, best.price) < 0 ? edition : best,
  )
}

export interface EditionChoice {
  edition: NftEdition | null
  /** A edição pedida na URL existe mas não pode ser escolhida. */
  requestedUnavailable: NftEdition | null
}

/**
 * Edição em uso a partir da URL (`?edition=`). Uma edição esgotada ou
 * indisponível não é escolhida: cai na padrão e o motivo é devolvido para a
 * tela avisar. ID desconhecido também cai na padrão, sem aviso.
 */
export function resolveEdition(nft: Nft, requestedId: string | undefined): EditionChoice {
  const requested = requestedId ? nft.editions.find((e) => e.id === requestedId) : undefined
  if (requested && isEditionSelectable(requested)) {
    return { edition: requested, requestedUnavailable: null }
  }
  return {
    edition: defaultEdition(nft),
    requestedUnavailable: requested && !isEditionSelectable(requested) ? requested : null,
  }
}

/** Limite do seletor de quantidade: a disponibilidade da edição (a mesma regra da API). */
export function maxQuantity(edition: NftEdition | null): number {
  if (!edition || !isEditionSelectable(edition)) return 0
  return edition.available
}

/** Mantém a quantidade entre 1 e o limite (0 quando não há o que comprar). */
export function clampQuantity(quantity: number, max: number): number {
  if (max <= 0) return 0
  if (!Number.isFinite(quantity)) return 1
  return Math.min(Math.max(Math.trunc(quantity), 1), max)
}

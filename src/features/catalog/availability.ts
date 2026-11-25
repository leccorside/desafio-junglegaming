import type { Nft } from '@/api/contracts'

/** Alguma edição ainda à venda? */
export function isNftAvailable(nft: Nft): boolean {
  return nft.editions.some((e) => e.status === 'available' && e.available > 0)
}

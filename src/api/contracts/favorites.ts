import { z } from 'zod'

import { idSchema } from './common'
import { nftSchema } from './nft'

/** GET /me/favorites: IDs para marcar os corações e os NFTs para listar. */
export const favoritesResponseSchema = z.object({
  nftIds: z.array(idSchema),
  items: z.array(nftSchema),
})
export type FavoritesResponse = z.infer<typeof favoritesResponseSchema>

/** PUT e DELETE /me/favorites/:nftId devolvem a lista de IDs atualizada. */
export const favoriteMutationResponseSchema = z.object({
  nftIds: z.array(idSchema),
})
export type FavoriteMutationResponse = z.infer<typeof favoriteMutationResponseSchema>

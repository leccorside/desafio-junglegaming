import { z } from 'zod'

import {
  ethAmountSchema,
  idSchema,
  isoDateTimeSchema,
  nonNegativeIntSchema,
  quantitySchema,
  uuidSchema,
  versionSchema,
} from './common'

/**
 * Situação de um item frente ao catálogo atual:
 * - `price_changed`: o preço mudou desde que o item entrou no carrinho;
 * - `insufficient`: há estoque, mas menos que a quantidade escolhida;
 * - `sold_out`: a edição esgotou ou ficou indisponível.
 */
export const cartItemStatusSchema = z.enum(['ok', 'price_changed', 'insufficient', 'sold_out'])
export type CartItemStatus = z.infer<typeof cartItemStatusSchema>

export const cartItemSchema = z.object({
  id: idSchema,
  nftId: idSchema,
  editionId: idSchema,
  name: z.string(),
  editionName: z.string(),
  tokenId: z.string(),
  imageUrl: z.string(),
  unitPrice: ethAmountSchema,
  /** Preço quando o item foi adicionado, para mostrar a diferença quando muda. */
  previousUnitPrice: ethAmountSchema.nullable(),
  quantity: quantitySchema,
  available: nonNegativeIntSchema,
  status: cartItemStatusSchema,
  /** Versão do NFT refletida neste item. */
  nftVersion: versionSchema,
})
export type CartItem = z.infer<typeof cartItemSchema>

export const cartSchema = z.object({
  id: idSchema,
  /** Dono: `user` para conta autenticada, `guest` para o carrinho do visitante. */
  owner: z.enum(['user', 'guest']),
  items: z.array(cartItemSchema),
  couponCode: z.string().nullable(),
  version: versionSchema,
  updatedAt: isoDateTimeSchema,
})
export type Cart = z.infer<typeof cartSchema>

export const addCartItemRequestSchema = z.object({
  nftId: idSchema,
  editionId: idSchema,
  quantity: quantitySchema,
})
export type AddCartItemRequest = z.infer<typeof addCartItemRequestSchema>

export const updateCartItemRequestSchema = z.object({
  quantity: quantitySchema,
})
export type UpdateCartItemRequest = z.infer<typeof updateCartItemRequestSchema>

export const mergeCartRequestSchema = z.object({
  guestCartId: uuidSchema,
})
export type MergeCartRequest = z.infer<typeof mergeCartRequestSchema>

/** Resposta do merge: o carrinho final e o que não coube pelo estoque. */
export const mergeCartResponseSchema = z.object({
  cart: cartSchema,
  adjustments: z.array(
    z.object({
      nftId: idSchema,
      editionId: idSchema,
      name: z.string(),
      requested: quantitySchema,
      added: nonNegativeIntSchema,
    }),
  ),
})
export type MergeCartResponse = z.infer<typeof mergeCartResponseSchema>

export const couponCodeSchema = z
  .string()
  .trim()
  .min(1, 'Informe o código promocional.')
  .max(32, 'Código muito longo.')
  .transform((code) => code.toUpperCase())

export const applyCouponRequestSchema = z.object({ code: couponCodeSchema })
export type ApplyCouponRequest = z.infer<typeof applyCouponRequestSchema>

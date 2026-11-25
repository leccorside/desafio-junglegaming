import { z } from 'zod'

import { emailSchema } from './auth'
import {
  ethAmountSchema,
  idSchema,
  isoDateTimeSchema,
  quantitySchema,
  uuidSchema,
  versionSchema,
} from './common'
import { networkSchema } from './network'
import { walletTypeSchema } from './wallet'

export const orderStatusSchema = z.enum(['pending', 'confirmed', 'rejected'])
export type OrderStatus = z.infer<typeof orderStatusSchema>

/** `confirmed` e `rejected` são terminais: nenhum evento pode tirar o pedido deles. */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['confirmed', 'rejected']

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return TERMINAL_ORDER_STATUSES.includes(status)
}

/** Chave enviada em `Idempotency-Key`: uma por tentativa de compra. */
export const idempotencyKeySchema = uuidSchema

/** Dados do colecionador no pagamento ("Perfil do colecionador"). */
export const buyerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Informe o nome de exibição.')
    .max(50, 'Use no máximo 50 caracteres.'),
  email: emailSchema,
  note: z.string().trim().max(280, 'Use no máximo 280 caracteres.').optional(),
})
export type Buyer = z.infer<typeof buyerSchema>

export const createOrderRequestSchema = z.object({
  quoteId: idSchema,
  quoteVersion: versionSchema,
  walletId: idSchema,
  network: networkSchema,
  buyer: buyerSchema,
})
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>

export const orderSnapshotItemSchema = z.object({
  nftId: idSchema,
  editionId: idSchema,
  name: z.string(),
  editionName: z.string(),
  tokenId: z.string(),
  imageUrl: z.string(),
  unitPrice: ethAmountSchema,
  quantity: quantitySchema,
  lineTotal: ethAmountSchema,
})
export type OrderSnapshotItem = z.infer<typeof orderSnapshotItemSchema>

/** Cópia do pedido no momento da criação. O recibo usa só este snapshot. */
export const orderSnapshotSchema = z.object({
  items: z.array(orderSnapshotItemSchema).min(1),
  subtotal: ethAmountSchema,
  discount: ethAmountSchema,
  networkFee: ethAmountSchema,
  total: ethAmountSchema,
  couponCode: z.string().nullable(),
  network: networkSchema,
  wallet: z.object({ address: z.string(), type: walletTypeSchema, label: z.string() }),
  buyer: buyerSchema,
})
export type OrderSnapshot = z.infer<typeof orderSnapshotSchema>

export const orderSchema = z.object({
  id: idSchema,
  status: orderStatusSchema,
  rejectionReason: z.string().nullable(),
  /** Transação simulada. Só existe em pedido confirmado. */
  transaction: z.object({ hash: z.string(), explorerUrl: z.string() }).nullable(),
  snapshot: orderSnapshotSchema,
  version: versionSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})
export type Order = z.infer<typeof orderSchema>

export const ordersResponseSchema = z.object({ items: z.array(orderSchema) })
export type OrdersResponse = z.infer<typeof ordersResponseSchema>

export const orderListParamsSchema = z.object({
  status: orderStatusSchema.optional(),
})
export type OrderListParams = z.infer<typeof orderListParamsSchema>

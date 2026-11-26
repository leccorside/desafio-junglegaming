import { z } from 'zod'

import { idSchema, isoDateTimeSchema, versionSchema } from './common'
import { editionStatusSchema, nftEditionSchema } from './nft'
import { orderStatusSchema } from './order'

/** Nomes dos eventos Socket.IO. Ver docs/REALTIME.md. */
export const REALTIME_EVENTS = {
  nftUpdated: 'nft.updated',
  orderUpdated: 'order.updated',
  sync: 'realtime.sync',
} as const

/**
 * Mensagem de controle enviada logo depois de cada conexão (e no reset dos
 * mocks): as versões atuais dos NFTs e dos pedidos do usuário. O cliente
 * compara com o que tem em cache, busca de novo o que está diferente e passa
 * a usar essas versões como referência para descartar eventos antigos.
 */
export const realtimeSyncSchema = z.object({
  /**
   * `connect`: conexão nova ou reconexão. `reset`: os dados de demonstração
   * voltaram às fixtures (só nos mocks); o cliente avisa e não compara o
   * carrinho, que pode ter sumido.
   */
  reason: z.enum(['connect', 'reset']),
  nfts: z.record(idSchema, versionSchema),
  orders: z.record(idSchema, versionSchema),
})
export type RealtimeSync = z.infer<typeof realtimeSyncSchema>

/**
 * Envelope comum: identidade estável (`eventId`) para descartar duplicados,
 * recurso afetado e `version` para descartar eventos antigos.
 */
function envelope<TType extends string, TResource extends string, TData extends z.ZodType>(
  type: TType,
  resource: TResource,
  data: TData,
) {
  return z.object({
    eventId: idSchema,
    type: z.literal(type),
    resource: z.object({ type: z.literal(resource), id: idSchema }),
    version: versionSchema,
    occurredAt: isoDateTimeSchema,
    /** Dono do recurso. `null` em eventos públicos (catálogo). */
    userId: idSchema.nullable(),
    data,
  })
}

export const nftUpdatedDataSchema = z.object({
  nftId: idSchema,
  priceFrom: nftEditionSchema.shape.price,
  editions: z.array(
    z.object({
      id: idSchema,
      price: nftEditionSchema.shape.price,
      available: nftEditionSchema.shape.available,
      status: editionStatusSchema,
    }),
  ),
})

export const nftUpdatedEventSchema = envelope(
  REALTIME_EVENTS.nftUpdated,
  'nft',
  nftUpdatedDataSchema,
).extend({ userId: z.null() })
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEventSchema>

export const orderUpdatedDataSchema = z.object({
  orderId: idSchema,
  status: orderStatusSchema,
  rejectionReason: z.string().nullable(),
  transaction: z.object({ hash: z.string(), explorerUrl: z.string() }).nullable(),
})

export const orderUpdatedEventSchema = envelope(
  REALTIME_EVENTS.orderUpdated,
  'order',
  orderUpdatedDataSchema,
).extend({ userId: idSchema })
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEventSchema>

export const realtimeEventSchema = z.discriminatedUnion('type', [
  nftUpdatedEventSchema,
  orderUpdatedEventSchema,
])
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>

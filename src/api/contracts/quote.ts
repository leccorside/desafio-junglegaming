import { z } from 'zod'

import {
  ethAmountSchema,
  idSchema,
  isoDateTimeSchema,
  quantitySchema,
  versionSchema,
} from './common'
import { networkSchema } from './network'

export const createQuoteRequestSchema = z.object({
  network: networkSchema,
})
export type CreateQuoteRequest = z.infer<typeof createQuoteRequestSchema>

export const quoteLineSchema = z.object({
  itemId: idSchema,
  nftId: idSchema,
  editionId: idSchema,
  unitPrice: ethAmountSchema,
  quantity: quantitySchema,
  lineTotal: ethAmountSchema,
})
export type QuoteLine = z.infer<typeof quoteLineSchema>

/**
 * Cotação calculada pela API a partir do carrinho, do cupom e da rede.
 * É a referência para fechar o pedido: a interface só exibe estes valores.
 */
export const quoteSchema = z.object({
  id: idSchema,
  version: versionSchema,
  network: networkSchema,
  lines: z.array(quoteLineSchema),
  subtotal: ethAmountSchema,
  discount: ethAmountSchema,
  networkFee: ethAmountSchema,
  total: ethAmountSchema,
  coupon: z.object({ code: z.string(), description: z.string() }).nullable(),
  /** Itens fora da cotação por estarem esgotados ou com quantidade acima do estoque. */
  blockedItemIds: z.array(idSchema),
  expiresAt: isoDateTimeSchema,
})
export type Quote = z.infer<typeof quoteSchema>

/** `details` do erro `QUOTE_OUTDATED`: a cotação nova e o que mudou. */
export const quoteOutdatedDetailsSchema = z.object({
  quote: quoteSchema,
  changes: z.array(
    z.object({
      kind: z.enum(['price', 'availability', 'coupon', 'fee']),
      message: z.string(),
    }),
  ),
})
export type QuoteOutdatedDetails = z.infer<typeof quoteOutdatedDetailsSchema>

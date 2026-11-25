import { z } from 'zod'

import { idSchema, isoDateTimeSchema } from './common'
import { ADDRESS_HINTS, isValidAddress, networkSchema } from './network'

/** Tipos de carteira do Figma ("METAMASK • WALLETCONNECT • COINBASE"). */
export const walletTypeSchema = z.enum(['metamask', 'walletconnect', 'coinbase'])
export type WalletType = z.infer<typeof walletTypeSchema>

export const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase Wallet',
}

export const walletRoleSchema = z.enum(['primary', 'secondary'])
export type WalletRole = z.infer<typeof walletRoleSchema>

/** Nome ENS opcional, digitado sem o ".eth" (o campo do Figma já mostra o sufixo). */
export const ensNameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9-]{3,63}$/, 'Use de 3 a 63 letras, números ou hífen.')

export const walletSchema = z.object({
  id: idSchema,
  role: walletRoleSchema,
  /** "Apelido da carteira". */
  label: z.string(),
  network: networkSchema,
  type: walletTypeSchema,
  address: z.string(),
  ensName: z.string().nullable(),
  updatedAt: isoDateTimeSchema,
})
export type Wallet = z.infer<typeof walletSchema>

const walletFieldsSchema = z.object({
  label: z.string().trim().min(1, 'Informe um apelido.').max(40, 'Use no máximo 40 caracteres.'),
  network: networkSchema,
  type: walletTypeSchema,
  address: z.string().trim(),
  ensName: ensNameSchema.nullable().optional(),
})

/** Endereço validado conforme a rede escolhida. */
function withAddressCheck<
  T extends z.ZodType<{ network: z.infer<typeof networkSchema>; address: string }>,
>(schema: T) {
  return schema.superRefine((data, ctx) => {
    if (!isValidAddress(data.network, data.address)) {
      ctx.addIssue({ code: 'custom', path: ['address'], message: ADDRESS_HINTS[data.network] })
    }
  })
}

export const createWalletRequestSchema = withAddressCheck(
  walletFieldsSchema.extend({ role: walletRoleSchema }),
)
export type CreateWalletRequest = z.infer<typeof createWalletRequestSchema>

export const updateWalletRequestSchema = withAddressCheck(walletFieldsSchema)
export type UpdateWalletRequest = z.infer<typeof updateWalletRequestSchema>

export const walletsResponseSchema = z.object({ items: z.array(walletSchema) })
export type WalletsResponse = z.infer<typeof walletsResponseSchema>

import type { EthAmount, Network, Nft, Order, Quote, Wallet, WalletType } from '@/api/contracts'

/**
 * Estado completo da API simulada. Tudo o que REST e Socket.IO devolvem sai
 * daqui, então as duas pontas nunca divergem.
 */
export interface DbState {
  /** Versão do formato. Mudou, o banco volta às fixtures. */
  schemaVersion: number
  users: DbUser[]
  sessions: DbSession[]
  nfts: Nft[]
  /** userId → IDs de NFTs favoritos. */
  favorites: Record<string, string[]>
  /** Dono (`user:<id>` ou `guest:<uuid>`) → carrinho. */
  carts: Record<string, DbCart>
  coupons: DbCoupon[]
  quotes: DbQuote[]
  orders: DbOrder[]
  /** `Idempotency-Key` → tentativa registrada. */
  idempotency: Record<string, DbIdempotencyEntry>
  wallets: DbWallet[]
  /** Contadores para IDs sequenciais e determinísticos. */
  counters: Record<string, number>
}

export interface DbUser {
  id: string
  username: string
  displayName: string
  email: string
  ensName: string | null
  avatarUrl: string | null
  passwordSalt: string
  passwordHash: string
  updatedAt: string
}

export interface DbSession {
  token: string
  userId: string
  expiresAt: string
  /** Marcada pelo cenário `session-expired` ou pelo logout. */
  revoked: boolean
}

export interface DbCartItem {
  id: string
  nftId: string
  editionId: string
  quantity: number
  /** Preço reconhecido pelo colecionador (quando entrou ou na última alteração). */
  acknowledgedPrice: EthAmount
}

export interface DbCart {
  id: string
  owner: 'user' | 'guest'
  items: DbCartItem[]
  couponCode: string | null
  version: number
  updatedAt: string
}

export interface DbCoupon {
  code: string
  description: string
  kind: 'percent' | 'fixed'
  /** Porcentagem (kind percent) ou valor em ETH (kind fixed). */
  value: string
  minSubtotal: EthAmount | null
  expiresAt: string | null
}

export interface DbQuote extends Quote {
  ownerKey: string
  /** Assinatura do que foi cotado, para detectar mudança na hora do pedido. */
  fingerprint: string
}

export interface DbOrder extends Order {
  userId: string
  cartOwnerKey: string
  /** Quando a simulação decide o pagamento. */
  settleAt: string
  /** Resultado previsto na criação (pelo cenário ativo). */
  outcome: 'confirmed' | 'rejected'
  /** Edições que a reserva deste pedido esgotou (voltam à venda se ele for recusado). */
  soldOutByReservation: string[]
}

export interface DbIdempotencyEntry {
  userId: string
  requestHash: string
  orderId: string
}

export interface DbWallet extends Wallet {
  userId: string
}

export type { Network, WalletType }

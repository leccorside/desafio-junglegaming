import type { Nft } from '@/api/contracts'
import { ethAdd, ethMul } from '@/lib/eth'

import { EXPLORERS, FIXTURE_NOW, NETWORK_FEES } from '../config'
import type { DbOrder, DbState, DbWallet } from '../db/state'
import { createNftFixtures } from './nfts'

export { SPECIAL_NFTS } from './nfts'

/** Versão do formato do banco. Incrementar quando `DbState` ou as fixtures mudarem. */
// 2: DbOrder ganhou `soldOutByReservation`.
export const SCHEMA_VERSION = 2

/**
 * Credenciais fictícias. A senha dos dois é `Senha@123`; só o hash
 * (SHA-256 de `salt:senha`) fica nas fixtures.
 */
export const FIXTURE_USERS = {
  ana: {
    id: 'user-ana',
    username: 'ana.colecionadora',
    displayName: 'Ana Ribeiro',
    email: 'ana@example.com',
    passwordSalt: 'b7e1c2d4a9f03e58',
    passwordHash: 'c4cb77c5fb60715c846cc32d29c9fc807814723ab87ca96b7839be1232cb92af',
  },
  bruno: {
    id: 'user-bruno',
    username: 'bruno.nft',
    displayName: 'Bruno Lima',
    email: 'bruno@example.com',
    passwordSalt: '4c9a1f0e7d2b6a35',
    passwordHash: '4be0510f4a873854c1166f089a425264327fe42d0fea5b5233546c6c96ab8183',
  },
} as const

export const FIXTURE_PASSWORD = 'Senha@123'

const iso = (offsetMs = 0) => new Date(FIXTURE_NOW + offsetMs).toISOString()
const DAY = 24 * 60 * 60 * 1000

function createWallets(): DbWallet[] {
  return [
    {
      id: 'wallet-ana-primary',
      userId: FIXTURE_USERS.ana.id,
      role: 'primary',
      label: 'Carteira principal',
      network: 'ethereum',
      type: 'metamask',
      address: '0x7A42c1F0b9E35d6A8e2B4c7D90a1F3e5B8d219E8',
      ensName: 'ana-coleciona',
      updatedAt: iso(-30 * DAY),
    },
    {
      id: 'wallet-ana-secondary',
      userId: FIXTURE_USERS.ana.id,
      role: 'secondary',
      label: 'Polygon do dia a dia',
      network: 'polygon',
      type: 'coinbase',
      address: '0x3F9e21A4c6B8d0E2f4A6c8E0b2D4f6A8c0E2b4D6',
      ensName: null,
      updatedAt: iso(-12 * DAY),
    },
    {
      id: 'wallet-bruno-primary',
      userId: FIXTURE_USERS.bruno.id,
      role: 'primary',
      label: 'Phantom via WalletConnect',
      network: 'solana',
      type: 'walletconnect',
      address: '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
      ensName: null,
      updatedAt: iso(-20 * DAY),
    },
  ]
}

/** Um pedido confirmado anterior por usuário, para o histórico e para testar isolamento. */
function createPastOrder(
  id: string,
  userId: string,
  wallet: DbWallet,
  nft: Nft,
  quantity: number,
  daysAgo: number,
): DbOrder {
  const edition = nft.editions.find((e) => e.name === 'Aberta') ?? nft.editions[0]!
  const lineTotal = ethMul(edition.price, quantity)
  const networkFee = NETWORK_FEES[wallet.network]
  const createdAt = iso(-daysAgo * DAY)
  const hash = `0x${id.replace(/\W/g, '').padEnd(64, 'a').slice(0, 64)}`
  const user = Object.values(FIXTURE_USERS).find((u) => u.id === userId)!

  return {
    id,
    userId,
    cartOwnerKey: `user:${userId}`,
    status: 'confirmed',
    outcome: 'confirmed',
    settleAt: createdAt,
    soldOutByReservation: [],
    rejectionReason: null,
    transaction: { hash, explorerUrl: `${EXPLORERS[wallet.network]}${hash}` },
    snapshot: {
      items: [
        {
          nftId: nft.id,
          editionId: edition.id,
          name: nft.name,
          editionName: edition.name,
          tokenId: nft.tokenId,
          imageUrl: nft.images[0]!.url,
          unitPrice: edition.price,
          quantity,
          lineTotal,
        },
      ],
      subtotal: lineTotal,
      discount: '0',
      networkFee,
      total: ethAdd(lineTotal, networkFee),
      couponCode: null,
      network: wallet.network,
      wallet: { address: wallet.address, type: wallet.type, label: wallet.label },
      buyer: { displayName: user.displayName, email: user.email },
    },
    version: 2,
    createdAt,
    updatedAt: createdAt,
  }
}

/** Estado inicial completo da API simulada. Sempre o mesmo: base do reset. */
export function createSeed(): DbState {
  const nfts = createNftFixtures()
  const wallets = createWallets()
  const byId = (id: string) => nfts.find((n) => n.id === id)!

  return {
    schemaVersion: SCHEMA_VERSION,
    users: Object.values(FIXTURE_USERS).map((u) => ({
      ...u,
      ensName: u.id === FIXTURE_USERS.ana.id ? 'ana-coleciona' : null,
      avatarUrl: null,
      updatedAt: iso(-30 * DAY),
    })),
    sessions: [],
    nfts,
    favorites: {
      [FIXTURE_USERS.ana.id]: ['nft-042', 'nft-118'],
      [FIXTURE_USERS.bruno.id]: ['nft-207'],
    },
    carts: {},
    coupons: [
      {
        code: 'BEMVINDO10',
        description: 'Desconto do lançamento: 10% no subtotal',
        kind: 'percent',
        value: '10',
        minSubtotal: null,
        expiresAt: null,
      },
      {
        code: 'FIXO005',
        description: '0.05 ETH de desconto em compras a partir de 0.5 ETH',
        kind: 'fixed',
        value: '0.05',
        minSubtotal: '0.5',
        expiresAt: null,
      },
      {
        code: 'EXPIRADO',
        description: 'Cupom de uma campanha encerrada',
        kind: 'percent',
        value: '20',
        minSubtotal: null,
        expiresAt: '2026-01-31T23:59:59.000Z',
      },
    ],
    quotes: [],
    orders: [
      createPastOrder('ord-0001', FIXTURE_USERS.ana.id, wallets[0]!, byId('nft-207'), 2, 9),
      createPastOrder('ord-0002', FIXTURE_USERS.bruno.id, wallets[2]!, byId('nft-160'), 1, 4),
    ],
    idempotency: {},
    wallets,
    counters: { order: 2 },
  }
}

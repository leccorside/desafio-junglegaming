import { EXPLORERS } from './config'
import type { DbOrder } from './db/state'
import { createRandom } from './random'

/**
 * Semente do hash simulado: número do pedido, itens (NFT, edição, quantidade,
 * preço) e total. O hash continua previsível (mesmo pedido, mesmo hash), mas
 * compras diferentes com o mesmo número depois de um reset ganham IDs
 * diferentes. Hash de 32 bits (FNV-1a) para não perder precisão.
 */
export function transactionSeed(order: Pick<DbOrder, 'id' | 'snapshot'>): number {
  const items = order.snapshot.items
    .map((item) => `${item.nftId}/${item.editionId}/${item.quantity}/${item.unitPrice}`)
    .join(',')
  const source = `${order.id}|${items}|${order.snapshot.total}`
  let hash = 0x811c9dc5
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * Transação simulada de um pedido confirmado: 64 dígitos hexadecimais, com
 * `0x` nas redes EVM e sem prefixo na Solana, e o link do explorador da rede.
 * Vale para as compras feitas na demo e para os pedidos de exemplo das fixtures.
 */
export function simulatedTransaction(
  order: Pick<DbOrder, 'id' | 'snapshot'>,
): NonNullable<DbOrder['transaction']> {
  const digits = createRandom(transactionSeed(order)).hex(64)
  const hash = order.snapshot.network === 'solana' ? digits : `0x${digits}`
  return { hash, explorerUrl: `${EXPLORERS[order.snapshot.network]}${hash}` }
}

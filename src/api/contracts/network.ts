import { z } from 'zod'

/** Redes do layout (filtro do catálogo, carteiras e pagamento). */
export const networkSchema = z.enum(['ethereum', 'polygon', 'solana'])
export type Network = z.infer<typeof networkSchema>

export const NETWORK_LABELS: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

/** Formato de endereço de cada rede: EVM (0x + 40 hex) ou Solana (base58, 32 a 44). */
const ADDRESS_PATTERNS: Record<Network, RegExp> = {
  ethereum: /^0x[a-fA-F0-9]{40}$/,
  polygon: /^0x[a-fA-F0-9]{40}$/,
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
}

export function isValidAddress(network: Network, address: string): boolean {
  return ADDRESS_PATTERNS[network].test(address)
}

export const ADDRESS_HINTS: Record<Network, string> = {
  ethereum: 'Use um endereço 0x com 40 caracteres hexadecimais.',
  polygon: 'Use um endereço 0x com 40 caracteres hexadecimais.',
  solana: 'Use um endereço Solana em base58, com 32 a 44 caracteres.',
}

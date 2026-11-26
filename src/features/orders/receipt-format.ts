import type { Network } from '@/api/contracts'

/** Nome do explorador de blocos de cada rede (o link vem pronto da API). */
export const EXPLORER_NAMES: Record<Network, string> = {
  ethereum: 'Etherscan',
  polygon: 'Polygonscan',
  solana: 'Solscan',
}

/**
 * Hash abreviado como no Figma ("0xA91F…E82C"): prefixo, 4 caracteres de cada
 * ponta em maiúsculas. Hash curto (até 12 caracteres) aparece inteiro.
 */
export function shortHash(hash: string): string {
  const body = hash.startsWith('0x') ? hash.slice(2) : hash
  const prefix = hash.startsWith('0x') ? '0x' : ''
  if (body.length <= 10) return `${prefix}${body.toUpperCase()}`
  return `${prefix}${body.slice(0, 4).toUpperCase()}…${body.slice(-4).toUpperCase()}`
}

/**
 * Data do recibo no formato do Figma ("29 Jul, 2026"), com o mês abreviado em
 * português e no fuso de São Paulo.
 */
export function formatReceiptDate(iso: string): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).formatToParts(new Date(iso))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  const month = get('month').replace('.', '')
  return `${get('day')} ${month.charAt(0).toUpperCase()}${month.slice(1)}, ${get('year')}`
}

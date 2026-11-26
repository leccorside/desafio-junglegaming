import { describe, expect, it } from 'vitest'

import { EXPLORER_NAMES, formatReceiptDate, shortHash } from './receipt-format'

describe('recibo', () => {
  it('abrevia o hash como no Figma', () => {
    expect(shortHash(`0xa91f${'0'.repeat(56)}e82c`)).toBe('0xA91F…E82C')
    expect(shortHash('0xabc')).toBe('0xABC')
    expect(shortHash('5KtP9wXq2mRs7Lz')).toBe('5KTP…S7LZ')
  })

  it('formata a data no fuso de São Paulo, com o mês abreviado', () => {
    expect(formatReceiptDate('2026-07-29T15:00:00.000Z')).toBe('29 Jul, 2026')
    // 01:30 UTC ainda é o dia anterior em São Paulo.
    expect(formatReceiptDate('2026-11-27T01:30:00.000Z')).toBe('26 Nov, 2026')
  })

  it('tem um explorador para cada rede', () => {
    expect(EXPLORER_NAMES).toEqual({
      ethereum: 'Etherscan',
      polygon: 'Polygonscan',
      solana: 'Solscan',
    })
  })
})

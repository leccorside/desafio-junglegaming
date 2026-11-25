import { describe, expect, it } from 'vitest'

import {
  ethAdd,
  ethCompare,
  ethMax,
  ethMin,
  ethMul,
  ethPercent,
  ethSub,
  formatEth,
  isEthZero,
  toEthString,
} from './eth'

describe('aritmética em ETH', () => {
  it('soma sem erro de ponto flutuante', () => {
    // Em number: 0.1 + 0.2 = 0.30000000000000004
    expect(ethAdd('0.1', '0.2')).toBe('0.3')
    expect(ethAdd('2.38', '8.34', '16.11')).toBe('26.83')
    expect(ethAdd()).toBe('0')
  })

  it('reproduz o resumo do carrinho do Figma', () => {
    const subtotal = ethAdd(ethMul('1.19', 2), ethMul('1.39', 6), ethMul('1.79', 9))
    expect(subtotal).toBe('26.83')
    expect(ethAdd(subtotal, '0.016')).toBe('26.846')
  })

  it('multiplica preço por quantidade inteira', () => {
    expect(ethMul('1.19', 2)).toBe('2.38')
    expect(ethMul('0.000000000000000001', 3)).toBe('0.000000000000000003')
    expect(ethMul('1.5', 0)).toBe('0')
  })

  it('rejeita quantidade fracionária ou negativa', () => {
    expect(() => ethMul('1', 1.5)).toThrow('Quantidade inválida')
    expect(() => ethMul('1', -1)).toThrow('Quantidade inválida')
  })

  it('mantém as 18 casas (1 wei) e não usa notação exponencial', () => {
    expect(ethAdd('0.000000000000000001', '0.000000000000000001')).toBe('0.000000000000000002')
    expect(toEthString('0.0000001')).toBe('0.0000001')
    expect(toEthString('123456789012345678901234.5')).toBe('123456789012345678901234.5')
  })

  it('normaliza zeros à direita', () => {
    expect(toEthString('1.500')).toBe('1.5')
    expect(toEthString('2.000')).toBe('2')
  })

  it('subtrai e recusa resultado negativo', () => {
    expect(ethSub('26.846', '0.016')).toBe('26.83')
    expect(ethSub('1', '1')).toBe('0')
    expect(() => ethSub('1', '1.01')).toThrow('Resultado negativo')
  })

  it('calcula porcentagem arredondando em 18 casas', () => {
    expect(ethPercent('26.83', 10)).toBe('2.683')
    expect(ethPercent('1', 33.333)).toBe('0.33333')
    expect(ethPercent('0.000000000000000001', 50)).toBe('0.000000000000000001')
  })

  it('compara valores', () => {
    expect(ethCompare('1.19', '1.190')).toBe(0)
    expect(ethCompare('0.99', '1')).toBe(-1)
    expect(ethCompare('12.3', '2.29')).toBe(1)
    expect(ethMin('0.39', '2.29')).toBe('0.39')
    expect(ethMax('0.39', '2.29')).toBe('2.29')
    expect(isEthZero('0.000')).toBe(true)
    expect(isEthZero('0.000000000000000001')).toBe(false)
  })

  it('lança erro com valor inválido', () => {
    expect(() => ethAdd('abc')).toThrow('Valor em ETH inválido')
  })
})

describe('formatEth', () => {
  it('formata como no Figma', () => {
    expect(formatEth('1.19')).toBe('1.19 ETH')
    expect(formatEth('0.016')).toBe('0.016 ETH')
    expect(formatEth('26.846')).toBe('26.846 ETH')
    expect(formatEth('2')).toBe('2.00 ETH')
    expect(formatEth('0')).toBe('0.00 ETH')
  })

  it('arredonda só na exibição, até 4 casas', () => {
    expect(formatEth('1.234567')).toBe('1.2346 ETH')
    expect(formatEth('1.23444')).toBe('1.2344 ETH')
    expect(formatEth('0.99995')).toBe('1.00 ETH')
  })

  it('mostra valor muito pequeno sem virar zero', () => {
    expect(formatEth('0.000001')).toBe('< 0.0001 ETH')
  })

  it('aceita opções de casas e unidade', () => {
    expect(formatEth('1.5', { unit: false })).toBe('1.50')
    expect(formatEth('1.23456', { maxDecimals: 2 })).toBe('1.23 ETH')
    expect(formatEth('3', { minDecimals: 0 })).toBe('3 ETH')
  })
})

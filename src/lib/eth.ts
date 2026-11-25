import Big from 'big.js'

import type { EthAmount } from '@/api/contracts/common'

/**
 * Aritmética de valores em ETH sem ponto flutuante.
 *
 * Os valores trafegam como string decimal (`"1.19"`) e são calculados com
 * big.js. A precisão é de 18 casas (1 wei); a exibição arredonda para no máximo
 * 4 casas sem alterar o valor guardado. Quantidades são inteiras.
 */

/** Construtor isolado: a configuração não vaza para outros usos do big.js. */
const EthBig = Big()
EthBig.DP = 18
EthBig.RM = Big.roundHalfUp
// Nunca usar notação exponencial ao converter para string.
EthBig.NE = -21
EthBig.PE = 40

export const ETH_DECIMALS = 18

type EthInput = EthAmount | string | Big

function toBig(value: EthInput): Big {
  try {
    return value instanceof Big ? value : new EthBig(value)
  } catch {
    throw new Error(`Valor em ETH inválido: "${String(value)}"`)
  }
}

/** Converte para a string decimal canônica do contrato (sem zeros à direita). */
export function toEthString(value: EthInput): EthAmount {
  return toBig(value).round(ETH_DECIMALS, Big.roundHalfUp).toString()
}

export function ethAdd(...values: EthInput[]): EthAmount {
  return toEthString(values.reduce<Big>((acc, value) => acc.plus(toBig(value)), new EthBig(0)))
}

/** Subtração. Não devolve negativo: lança erro, porque valor negativo indica bug de regra. */
export function ethSub(a: EthInput, b: EthInput): EthAmount {
  const result = toBig(a).minus(toBig(b))
  if (result.lt(0)) throw new Error(`Resultado negativo: ${toEthString(a)} - ${toEthString(b)}`)
  return toEthString(result)
}

/** Preço unitário × quantidade inteira. */
export function ethMul(price: EthInput, quantity: number): EthAmount {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`Quantidade inválida: ${quantity}`)
  }
  return toEthString(toBig(price).times(quantity))
}

/** Porcentagem de um valor (desconto percentual), arredondada em 18 casas. */
export function ethPercent(amount: EthInput, percent: number): EthAmount {
  return toEthString(toBig(amount).times(percent).div(100))
}

/** Arredonda (meio para cima) para `decimals` casas. */
export function ethRound(value: EthInput, decimals: number): EthAmount {
  return toEthString(toBig(value).round(decimals, Big.roundHalfUp))
}

export function ethCompare(a: EthInput, b: EthInput): -1 | 0 | 1 {
  return toBig(a).cmp(toBig(b)) as -1 | 0 | 1
}

export function ethMin(a: EthInput, b: EthInput): EthAmount {
  return ethCompare(a, b) <= 0 ? toEthString(a) : toEthString(b)
}

export function ethMax(a: EthInput, b: EthInput): EthAmount {
  return ethCompare(a, b) >= 0 ? toEthString(a) : toEthString(b)
}

export function isEthZero(value: EthInput): boolean {
  return toBig(value).eq(0)
}

export interface FormatEthOptions {
  /** Casas mínimas (padrão 2, como "1.19 ETH" e "0.99 ETH" no Figma). */
  minDecimals?: number
  /** Casas máximas (padrão 4). */
  maxDecimals?: number
  /** Acrescenta " ETH" (padrão true). */
  unit?: boolean
}

/**
 * Formata para exibição: "1.19 ETH", "0.016 ETH", "26.846 ETH".
 * Arredonda para `maxDecimals` só na apresentação. Um valor positivo que
 * arredondaria para zero aparece como "< 0.0001 ETH".
 */
export function formatEth(value: EthInput, options: FormatEthOptions = {}): string {
  const { minDecimals = 2, maxDecimals = 4, unit = true } = options
  const amount = toBig(value)
  const suffix = unit ? ' ETH' : ''

  const rounded = amount.round(maxDecimals, Big.roundHalfUp)
  if (rounded.eq(0) && amount.gt(0)) {
    return `< ${new EthBig(1).div(10 ** maxDecimals).toFixed(maxDecimals)}${suffix}`
  }

  let text = rounded.toFixed(maxDecimals)
  // Remove zeros à direita além do mínimo de casas.
  const [integer, decimals = ''] = text.split('.')
  let trimmed = decimals.replace(/0+$/, '')
  if (trimmed.length < minDecimals) trimmed = trimmed.padEnd(minDecimals, '0')
  text = trimmed ? `${integer}.${trimmed}` : (integer ?? '0')
  return `${text}${suffix}`
}

import type { EthAmount } from '@/api/contracts'
import { ethAdd, ethCompare, ethMin, ethMul, ethPercent, formatEth } from '@/lib/eth'

import type { DbCoupon, DbState } from '../db/state'
import { fail } from '../errors'

export function subtotalOf(lines: { price: EthAmount; quantity: number }[]): EthAmount {
  return ethAdd(...lines.map((l) => ethMul(l.price, l.quantity)))
}

/** Valida o cupom para o subtotal informado. Lança `COUPON_INVALID` ou `COUPON_EXPIRED`. */
export function validateCoupon(
  state: DbState,
  code: string,
  lines: { price: EthAmount; quantity: number }[],
): DbCoupon {
  const coupon = state.coupons.find((c) => c.code === code)
  if (!coupon) fail('COUPON_INVALID', { fields: { code: 'Código promocional inválido.' } })
  if (coupon.expiresAt && Date.parse(coupon.expiresAt) < Date.now()) {
    fail('COUPON_EXPIRED', { fields: { code: 'Este código promocional expirou.' } })
  }
  if (coupon.minSubtotal && ethCompare(subtotalOf(lines), coupon.minSubtotal) < 0) {
    fail('COUPON_INVALID', {
      message: `Este código vale para compras a partir de ${formatEth(coupon.minSubtotal)}.`,
      fields: { code: `Válido a partir de ${formatEth(coupon.minSubtotal)}.` },
    })
  }
  return coupon
}

/** Desconto do cupom, nunca maior que o subtotal. */
export function discountOf(coupon: DbCoupon, subtotal: EthAmount): EthAmount {
  const raw = coupon.kind === 'percent' ? ethPercent(subtotal, Number(coupon.value)) : coupon.value
  return ethMin(raw, subtotal)
}

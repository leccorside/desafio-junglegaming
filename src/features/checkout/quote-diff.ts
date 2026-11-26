import type { Quote } from '@/api/contracts'
import { formatEth } from '@/lib/eth'

type Names = Record<string, string>

/**
 * O que mudou entre a cotação que a pessoa via e a nova, em frases para a
 * revisão. Vazio = nada que pese no que ela vai pagar. Compara preço e
 * quantidade de cada linha, linhas que saíram (esgotadas), cupom, desconto,
 * taxa e total.
 */
export function describeQuoteDiff(before: Quote, after: Quote, names: Names = {}): string[] {
  const label = (nftId: string) => names[nftId] ?? 'Um item'
  const changes: string[] = []
  for (const line of before.lines) {
    const now = after.lines.find((l) => l.itemId === line.itemId)
    if (!now) {
      changes.push(`${label(line.nftId)} ficou indisponível e saiu da compra.`)
    } else if (now.unitPrice !== line.unitPrice) {
      changes.push(
        `${label(line.nftId)}: o preço mudou de ${formatEth(line.unitPrice)} para ${formatEth(now.unitPrice)}.`,
      )
    } else if (now.quantity !== line.quantity) {
      changes.push(
        `${label(line.nftId)}: a quantidade mudou de ${line.quantity} para ${now.quantity}.`,
      )
    }
  }
  for (const line of after.lines) {
    if (!before.lines.some((l) => l.itemId === line.itemId)) {
      changes.push(`${label(line.nftId)} entrou na compra.`)
    }
  }
  if ((before.coupon?.code ?? null) !== (after.coupon?.code ?? null)) {
    changes.push(
      after.coupon
        ? `O cupom ${after.coupon.code} foi aplicado.`
        : 'O código promocional deixou de valer para esta compra.',
    )
  } else if (before.discount !== after.discount) {
    changes.push(
      `O desconto mudou de ${formatEth(before.discount)} para ${formatEth(after.discount)}.`,
    )
  }
  if (before.networkFee !== after.networkFee) {
    changes.push(
      `A taxa de rede mudou de ${formatEth(before.networkFee)} para ${formatEth(after.networkFee)}.`,
    )
  }
  if (before.total !== after.total) {
    changes.push(`Total: de ${formatEth(before.total)} para ${formatEth(after.total)}.`)
  }
  return changes
}

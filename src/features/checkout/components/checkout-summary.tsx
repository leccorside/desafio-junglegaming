import type { Cart, Quote } from '@/api/contracts'
import { NETWORK_LABELS } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { formatEth } from '@/lib/eth'
import { nftImageSources } from '@/lib/images'
import { cn } from '@/lib/utils'

/** Linha do resumo (rótulo à esquerda, valor que nunca quebra à direita). */
export function SummaryRow({
  label,
  value,
  hint,
  strong = false,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  strong?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3">
        <dt className={cn('min-w-0 text-body text-foreground', strong && 'font-bold')}>{label}</dt>
        <dd
          className={cn(
            'shrink-0 text-right whitespace-nowrap',
            strong ? 'text-lead font-bold text-accent-foreground' : 'text-lead text-foreground',
          )}
        >
          {value}
        </dd>
      </div>
      {hint ? <p className="text-caption-sm text-accent-foreground">{hint}</p> : null}
    </div>
  )
}

/** Itens da cotação com nome e imagem do carrinho (frame "Seus NFTs"). */
export function QuoteItems({ cart, quote }: { cart: Cart; quote: Quote }) {
  const byId = new Map(cart.items.map((item) => [item.id, item]))
  return (
    <ul aria-label="Itens da compra" className="flex flex-col gap-3">
      {quote.lines.map((line) => {
        const item = byId.get(line.itemId)
        return (
          <li key={line.itemId} className="flex items-center gap-2 bg-card py-0 pr-4 pl-1 md:gap-2">
            <img
              {...nftImageSources(item?.imageUrl ?? '', '70px')}
              alt=""
              width={70}
              height={70}
              loading="lazy"
              className="size-[70px] shrink-0 rounded-lg object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="line-clamp-2 text-body leading-5 font-bold break-words text-foreground">
                {item?.name ?? 'NFT'}
              </p>
              <p className="truncate text-body-sm leading-4 text-secondary">
                ID do token: #{item?.tokenId ?? ''}
                {item
                  ? ` · Edição ${item.editionName === 'Aberta' ? 'aberta' : item.editionName}`
                  : ''}
              </p>
            </div>
            <p className="flex shrink-0 items-center gap-3 md:gap-5">
              <span className="text-body-sm text-muted-foreground">
                <span className="sr-only">Quantidade: </span>(x {line.quantity})
              </span>
              <span className="text-lead leading-4 font-bold text-accent-foreground">
                <span className="sr-only">Total do item: </span>
                {formatEth(line.lineTotal)}
              </span>
            </p>
          </li>
        )
      })}
    </ul>
  )
}

/** Subtotal, desconto, taxa da rede da carteira e total. */
export function QuoteTotals({ quote, updating }: { quote: Quote | undefined; updating?: boolean }) {
  const value = (amount: string | undefined, prefix = '') =>
    amount === undefined ? (
      <Skeleton className="ml-auto h-5 w-24" />
    ) : (
      `${prefix}${formatEth(amount)}`
    )
  return (
    <dl
      aria-busy={updating || undefined}
      className={cn('flex flex-col gap-3 transition-opacity', updating && 'opacity-60')}
    >
      <SummaryRow label="Subtotal" value={value(quote?.subtotal)} />
      <SummaryRow
        label={quote?.coupon ? `Desconto (${quote.coupon.code})` : 'Desconto do lançamento'}
        value={value(quote?.discount, '(-) ')}
      />
      <SummaryRow
        label="Taxa de rede"
        value={value(quote?.networkFee)}
        hint={quote ? `Taxa estimada · ${NETWORK_LABELS[quote.network]}` : 'Taxa estimada'}
      />
      <div className="border-t border-primary/30 pt-3">
        <SummaryRow label="Total" value={value(quote?.total)} strong />
      </div>
    </dl>
  )
}

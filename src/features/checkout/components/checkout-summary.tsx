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
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  strong?: boolean
  className?: string
}) {
  // Um `div` por par, com `dt` e `dd` como filhos diretos (o único agrupamento
  // que o HTML aceita dentro de `dl`); a dica é um segundo `dd` do mesmo termo.
  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1',
        className,
      )}
    >
      <dt className={cn('min-w-0 text-body text-foreground', strong && 'font-bold')}>{label}</dt>
      <dd
        className={cn(
          'text-right whitespace-nowrap',
          strong ? 'text-lead font-bold text-accent-foreground' : 'text-lead text-foreground',
        )}
      >
        {value}
      </dd>
      {hint ? (
        <dd data-summary-hint="" className="col-span-2 text-caption-sm text-accent-foreground">
          {hint}
        </dd>
      ) : null}
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
          // Mobile: nome e ID do token ao lado da imagem, quantidade e preço na
          // linha de baixo (o nome não precisa quebrar). Desktop: tudo numa
          // linha, como no Figma.
          <li
            key={line.itemId}
            className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-x-2 gap-y-1 bg-card py-2 pr-4 pl-1 md:grid-cols-[70px_minmax(0,1fr)_auto] md:py-0"
          >
            <img
              {...nftImageSources(item?.imageUrl ?? '', '70px')}
              alt=""
              width={70}
              height={70}
              loading="lazy"
              className="row-span-2 size-[70px] shrink-0 rounded-lg object-cover md:row-span-1"
            />
            <div className="flex min-w-0 flex-col gap-1.5 self-end md:self-center">
              <p
                data-item-name=""
                className="line-clamp-2 text-body leading-5 font-bold break-words text-foreground"
              >
                {item?.name ?? 'NFT'}
              </p>
              {/* Token e edição em linhas próprias, como no recibo: numa linha só,
                  a edição saía cortada ("Edição a…") no mobile. */}
              <p
                data-item-meta=""
                className="flex flex-col gap-1 text-body-sm leading-4 text-secondary"
              >
                <span data-item-token="" className="whitespace-nowrap">
                  ID do token: #{item?.tokenId ?? ''}
                </span>
                {item ? (
                  <>
                    <span className="sr-only">, </span>
                    <span data-item-edition="" className="whitespace-nowrap">
                      Edição {item.editionName === 'Aberta' ? 'aberta' : item.editionName}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <p className="col-start-2 flex items-center justify-between gap-3 self-start md:col-start-3 md:row-start-1 md:justify-end md:gap-5 md:self-center">
              <span className="text-body-sm text-muted-foreground">
                <span className="sr-only">Quantidade: </span>(x {line.quantity})
              </span>
              <span
                data-item-total=""
                className="text-lead leading-4 font-bold text-accent-foreground"
              >
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
      <SummaryRow
        label="Total"
        value={value(quote?.total)}
        strong
        className="border-t border-primary/30 pt-3"
      />
    </dl>
  )
}

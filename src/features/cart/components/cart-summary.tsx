import { Link, useNavigate } from '@tanstack/react-router'

import type { Cart, Quote } from '@/api/contracts'
import { errorMessage } from '@/api/errors'
import { Skeleton } from '@/components/ui/skeleton'
import { isTimeoutError } from '@/lib/query-client'
import { formatEth, isEthZero } from '@/lib/eth'
import { cn } from '@/lib/utils'

import { useCartMutating, useQuote } from '../queries'
import { CouponForm } from './coupon-form'

function Row({
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
  // `dt` e `dd` filhos diretos do `div` (único agrupamento válido em `dl`); a
  // dica é um segundo `dd` do mesmo termo, marcado com `data-summary-hint`.
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1">
      <dt className={cn('min-w-0 text-body text-foreground', strong && 'font-bold')}>{label}</dt>
      {/* O valor nunca quebra: o rótulo é quem cede espaço. */}
      <dd
        className={cn(
          'text-right whitespace-nowrap',
          strong ? 'text-lead font-bold text-accent-foreground' : 'text-body-lg text-foreground',
        )}
      >
        {value}
      </dd>
      {hint ? (
        <dd
          data-summary-hint=""
          className="col-span-2 text-right text-caption-sm text-accent-foreground"
        >
          {hint}
        </dd>
      ) : null}
    </div>
  )
}

/**
 * "Resumo da carteira" (desktop) e "Payment Summary" (mobile): cupom,
 * subtotal, desconto, taxa de rede estimada e total, todos da cotação da API.
 * Itens esgotados ou acima do estoque ficam fora da cotação e bloqueiam a
 * finalização até serem ajustados.
 */
export function CartSummary({ cart }: { cart: Cart }) {
  const quote = useQuote(cart)
  const navigate = useNavigate()
  const data: Quote | undefined = quote.data
  const updating = quote.isFetching && quote.isPlaceholderData
  const blocked = cart.items.filter(
    (item) => item.status === 'sold_out' || item.status === 'insufficient',
  )
  // Uma mudança ainda sem resposta (quantidade, remoção, cupom) também segura:
  // o resumo na tela ainda é o de antes dela.
  const mutating = useCartMutating()
  const canCheckout =
    Boolean(data) && !updating && !mutating && blocked.length === 0 && (data?.lines.length ?? 0) > 0

  const value = (amount: string | undefined, prefix = '') =>
    amount === undefined ? (
      <Skeleton className="ml-auto h-5 w-24" />
    ) : (
      `${prefix}${formatEth(amount)}`
    )

  return (
    <section
      aria-labelledby="cart-summary-title"
      className="flex flex-col gap-6 rounded-t-[28px] bg-card px-6 pt-6 pb-9 shadow-[0_-8px_24px_rgb(0_0_0/0.35)] md:rounded-none md:bg-transparent md:p-0 md:shadow-none"
    >
      <div className="hidden flex-col gap-3 border-b border-primary/30 pb-3 md:flex">
        <h2 id="cart-summary-title" className="text-lead leading-4 font-bold text-foreground">
          Resumo da carteira
        </h2>
      </div>
      <h2 className="sr-only md:hidden">Resumo do pedido</h2>

      <CouponForm appliedCode={cart.couponCode} />

      <div aria-busy={quote.isPending || updating || undefined} className="flex flex-col gap-3">
        <p role="status" className="sr-only">
          {quote.isPending
            ? 'Calculando o resumo…'
            : updating
              ? 'Atualizando o resumo…'
              : data
                ? `Total: ${formatEth(data.total)}`
                : ''}
        </p>
        {quote.isError && !data ? (
          <div role="alert" className="flex flex-col gap-2 text-body-sm">
            <p className="text-destructive-foreground">
              Não foi possível calcular o resumo.{' '}
              {isTimeoutError(quote.error)
                ? 'O servidor demorou demais para responder.'
                : errorMessage(quote.error)}
            </p>
            <button
              type="button"
              onClick={() => void quote.refetch()}
              className="w-fit cursor-pointer text-accent-foreground underline"
            >
              Tentar de novo
            </button>
          </div>
        ) : (
          <dl className={cn('flex flex-col gap-3 transition-opacity', updating && 'opacity-60')}>
            <Row label="Subtotal" value={value(data?.subtotal)} />
            <Row
              label={data?.coupon ? `Desconto (${data.coupon.code})` : 'Desconto do lançamento'}
              value={value(data?.discount, '(-) ')}
              hint={data?.coupon && !isEthZero(data.discount) ? data.coupon.description : undefined}
            />
            <Row label="Taxa de rede" value={value(data?.networkFee)} hint="Taxa estimada" />
            <Row label="Total" value={value(data?.total)} strong />
          </dl>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {blocked.length ? (
          <p role="status" className="text-body-sm text-destructive-foreground">
            Ajuste ou remova {blocked.length === 1 ? 'o item marcado' : 'os itens marcados'} para
            finalizar.
          </p>
        ) : null}
        <button
          type="button"
          disabled={!canCheckout}
          onClick={() => void navigate({ to: '/checkout' })}
          className="h-[60px] w-full cursor-pointer rounded-full bg-[linear-gradient(135deg,var(--primary-hover),var(--primary))] text-body-lg font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 md:h-10 md:rounded-sm md:bg-primary md:bg-none md:text-body"
        >
          Conectar e finalizar
        </button>
        <Link
          to="/"
          hash="catalogo"
          className="hidden text-center text-body text-accent-foreground hover:underline md:block"
        >
          Continuar explorando
        </Link>
      </div>
    </section>
  )
}

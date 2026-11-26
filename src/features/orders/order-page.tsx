import { Link } from '@tanstack/react-router'

import { NETWORK_LABELS, type Order } from '@/api/contracts'
import { errorMessage, normalizeError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { QuoteTotals } from '@/features/checkout/components/checkout-summary'
import { formatEth } from '@/lib/eth'
import { nftImageSources } from '@/lib/images'
import { cn } from '@/lib/utils'

import { useOrder } from './queries'

/**
 * Situação do pedido depois do envio. Pendente: aguarda o `order.updated` (e
 * consulta a API a cada 5 s, como reserva). Confirmado e recusado são
 * terminais. O recibo completo, no layout do Figma, entra no Passo 11.
 */
export function OrderPage({ orderId }: { orderId: string }) {
  const order = useOrder(orderId)

  if (order.isPending) {
    return (
      <Shell>
        <div aria-hidden="true" data-order-skeleton="" className="flex flex-col gap-4">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-4 w-80" />
          <Skeleton className="h-[140px]" />
        </div>
      </Shell>
    )
  }
  if (order.isError) {
    const code = normalizeError(order.error).code
    const missing = code === 'NOT_FOUND' || code === 'FORBIDDEN'
    return (
      <Shell>
        <div
          role="alert"
          className="flex flex-col items-start gap-4 rounded-md border border-destructive/60 bg-card p-6"
        >
          <h1 className="text-body-lg font-bold text-foreground">
            {missing ? 'Pedido não encontrado.' : 'Não foi possível carregar o pedido.'}
          </h1>
          <p className="text-body-sm text-destructive-foreground">
            {missing ? 'Confira o endereço ou volte ao catálogo.' : errorMessage(order.error)}
          </p>
          {missing ? (
            <Button asChild variant="secondary">
              <Link to="/">Voltar ao início</Link>
            </Button>
          ) : (
            <Button onClick={() => void order.refetch()}>Tentar de novo</Button>
          )}
        </div>
      </Shell>
    )
  }
  return (
    <Shell>
      <OrderStatus order={order.data} />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-8 px-4 pt-8 pb-12 md:px-6 md:pt-12">
      {children}
    </div>
  )
}

function OrderStatus({ order }: { order: Order }) {
  const { snapshot } = order
  const heading =
    order.status === 'pending'
      ? 'Aguardando a confirmação do pagamento'
      : order.status === 'confirmed'
        ? 'Pagamento confirmado'
        : 'Pagamento recusado'

  return (
    <section
      aria-labelledby="order-title"
      className="flex flex-col gap-6"
      data-order-status={order.status}
    >
      <div className="flex flex-col gap-2">
        <p className="text-body-sm text-muted-foreground">Pedido {order.id}</p>
        <h1
          id="order-title"
          className={cn(
            'text-h2 font-bold',
            order.status === 'confirmed' && 'text-success',
            order.status === 'rejected' && 'text-destructive-foreground',
            order.status === 'pending' && 'text-foreground',
          )}
        >
          {heading}
        </h1>
        {/* Anuncia a mudança de estado (o título muda junto). */}
        <p role="status" className="text-body-sm text-foreground">
          {order.status === 'pending'
            ? 'Estamos esperando a carteira confirmar. Pode sair desta tela: avisamos quando o pagamento for decidido.'
            : order.status === 'confirmed'
              ? 'Tudo certo. Os NFTs comprados saíram do seu carrinho.'
              : `${order.rejectionReason ?? 'O pagamento não foi aprovado.'} Seu carrinho continua com os itens.`}
        </p>
      </div>

      {order.status === 'pending' ? (
        <div className="flex items-center gap-3 text-body-sm text-muted-foreground">
          <span
            aria-hidden="true"
            className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent motion-reduce:animate-none"
          />
          Processando o pagamento…
        </div>
      ) : null}

      {order.status === 'confirmed' && order.transaction ? (
        <dl className="flex flex-col gap-1 rounded-md border border-border bg-card p-4 text-body-sm">
          <dt className="text-muted-foreground">Transação (simulada)</dt>
          <dd className="font-mono break-all text-foreground">{order.transaction.hash}</dd>
          <dd>
            <a
              href={order.transaction.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-accent-foreground hover:underline"
            >
              Ver no explorador (abre em nova aba)
            </a>
          </dd>
        </dl>
      ) : null}

      <ul aria-label="Itens do pedido" className="flex flex-col gap-3">
        {snapshot.items.map((item) => (
          <li
            key={`${item.nftId}-${item.editionId}`}
            className="flex items-center gap-3 bg-card pr-4"
          >
            <img
              {...nftImageSources(item.imageUrl, '64px')}
              alt=""
              width={64}
              height={64}
              loading="lazy"
              className="size-16 shrink-0 rounded-lg object-cover"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="truncate text-body font-bold text-foreground">{item.name}</p>
              <p className="text-caption text-secondary">
                Edição {item.editionName === 'Aberta' ? 'aberta' : item.editionName} · (x{' '}
                {item.quantity})
              </p>
            </div>
            <p className="shrink-0 text-body-lg font-bold text-accent-foreground">
              {formatEth(item.lineTotal)}
            </p>
          </li>
        ))}
      </ul>

      <QuoteTotals
        quote={{
          id: order.id,
          version: order.version,
          network: snapshot.network,
          lines: [],
          subtotal: snapshot.subtotal,
          discount: snapshot.discount,
          networkFee: snapshot.networkFee,
          total: snapshot.total,
          coupon: snapshot.couponCode ? { code: snapshot.couponCode, description: '' } : null,
          blockedItemIds: [],
          expiresAt: order.updatedAt,
        }}
      />
      <p className="text-body-sm text-muted-foreground">
        Pago com {snapshot.wallet.label} · Rede {NETWORK_LABELS[snapshot.network]}
      </p>

      <div className="flex flex-col gap-3 md:flex-row">
        {order.status === 'rejected' ? (
          <Button asChild className="h-10 font-bold">
            <Link to="/checkout">Tentar de novo</Link>
          </Button>
        ) : null}
        <Button asChild variant="secondary" className="h-10">
          <Link to="/cart">Ver carrinho</Link>
        </Button>
        <Button asChild variant="ghost" className="h-10">
          <Link to="/" hash="catalogo">
            Continuar explorando
          </Link>
        </Button>
      </div>
    </section>
  )
}

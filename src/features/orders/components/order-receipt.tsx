import { Link } from '@tanstack/react-router'
import { XIcon } from 'lucide-react'

import { NETWORK_LABELS, WALLET_TYPE_LABELS, type Order } from '@/api/contracts'
import thankYouUrl from '@/assets/thank-you.svg'
import { SummaryRow } from '@/features/checkout/components/checkout-summary'
import { formatEth, isEthZero } from '@/lib/eth'
import { nftImageSources } from '@/lib/images'

import { EXPLORER_NAMES, formatReceiptDate, shortHash } from '../receipt-format'

/**
 * Recibo do pedido confirmado ("Order Confirmation Modal" do Figma). Tudo vem
 * do snapshot gravado na criação do pedido: preços e nomes mudados depois no
 * catálogo não alteram o recibo. No Figma é um modal sobre o pagamento; aqui
 * é o conteúdo da página do pedido, que tem endereço próprio e sobrevive a
 * refresh (ver ARCHITECTURE.md).
 */
export function OrderReceipt({ order }: { order: Order }) {
  const { snapshot, transaction } = order
  const network = NETWORK_LABELS[snapshot.network]
  const explorer = EXPLORER_NAMES[snapshot.network]

  return (
    <article
      aria-labelledby="order-title"
      data-order-status={order.status}
      data-order-receipt=""
      className="relative mx-auto flex w-full max-w-[578px] flex-col bg-card"
    >
      <Link
        to="/"
        aria-label="Fechar recibo e voltar ao início"
        className="absolute top-3 right-3 flex size-10 items-center justify-center rounded-full text-primary hover:bg-accent"
      >
        <XIcon aria-hidden="true" className="size-[18px]" />
      </Link>

      <header className="flex flex-col items-center gap-2 px-6 pt-[22px] pb-[22px] text-center">
        <img src={thankYouUrl} alt="" width={65} height={80} className="mb-2 h-20 w-auto" />
        <h1 id="order-title" className="text-body-lg font-bold text-success">
          Pagamento confirmado
        </h1>
        {/* Anuncia a mudança de estado (a página trocou de "aguardando" para o recibo). */}
        <p role="status" className="text-body-lg font-bold text-muted-foreground">
          Seus NFTs agora estão na sua carteira
        </p>
        <p className="text-caption text-secondary">Pedido {order.id}</p>
      </header>

      <dl
        aria-label="Resumo da transação"
        className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-primary px-6 py-3 text-muted-foreground md:flex md:items-center md:justify-between md:px-9"
      >
        <ReceiptMeta label="ID da transação" strong>
          {transaction ? (
            <span title={transaction.hash} data-transaction-hash={transaction.hash}>
              {shortHash(transaction.hash)}
            </span>
          ) : (
            '—'
          )}
        </ReceiptMeta>
        <ReceiptMeta label="Data">
          <time dateTime={order.updatedAt}>{formatReceiptDate(order.updatedAt)}</time>
        </ReceiptMeta>
        <ReceiptMeta label="Total">{formatEth(snapshot.total)}</ReceiptMeta>
        <ReceiptMeta label="Carteira" strong>
          {WALLET_TYPE_LABELS[snapshot.wallet.type]}
        </ReceiptMeta>
      </dl>

      <section
        aria-labelledby="receipt-details"
        className="flex flex-col gap-3 px-4 pt-5 pb-8 md:px-11 md:pb-12"
      >
        <h2 id="receipt-details" className="text-body font-bold text-foreground">
          Detalhes da transação
        </h2>

        <div
          aria-hidden="true"
          className="flex items-center justify-between border-b border-primary pb-3 text-body-lg font-bold text-foreground"
        >
          <span>NFTs</span>
          <span className="flex gap-12">
            <span className="hidden md:inline">Edições</span>
            <span className="font-medium">Subtotal</span>
          </span>
        </div>

        <ul aria-label="Itens do pedido" className="flex flex-col gap-3">
          {snapshot.items.map((item) => (
            <li
              key={`${item.nftId}-${item.editionId}`}
              data-receipt-item=""
              className="grid grid-cols-[70px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-1 md:grid-cols-[70px_minmax(0,1fr)_auto] md:py-0"
            >
              <img
                {...nftImageSources(item.imageUrl, '70px')}
                alt=""
                width={70}
                height={70}
                loading="lazy"
                className="row-span-2 size-[70px] rounded-lg object-cover md:row-span-1"
              />
              <div className="flex min-w-0 flex-col gap-1.5 self-end md:self-center">
                <p className="line-clamp-2 text-body-lg leading-5 font-bold break-words text-foreground">
                  {item.name}
                </p>
                {/* Quebra em vez de cortar: a edição diferencia linhas do mesmo NFT. */}
                <p data-item-meta="" className="text-body-sm leading-4 text-secondary">
                  ID do token: #{item.tokenId} · Edição{' '}
                  {item.editionName === 'Aberta' ? 'aberta' : item.editionName}
                </p>
              </div>
              <p className="col-start-2 flex items-center justify-between gap-3 self-start md:col-start-3 md:row-start-1 md:justify-end md:gap-12 md:self-center">
                <span className="text-body-sm text-muted-foreground">
                  <span className="sr-only">Quantidade: </span>(x {item.quantity})
                </span>
                <span
                  data-item-total=""
                  className="text-lead leading-4 font-bold text-accent-foreground"
                >
                  <span className="sr-only">Subtotal do item: </span>
                  {formatEth(item.lineTotal)}
                </span>
              </p>
            </li>
          ))}
        </ul>

        <dl aria-label="Totais do pedido" className="flex flex-col gap-3 md:ml-auto md:w-[321px]">
          {isEthZero(snapshot.discount) ? null : (
            <SummaryRow
              label={snapshot.couponCode ? `Desconto (${snapshot.couponCode})` : 'Desconto'}
              value={`(-) ${formatEth(snapshot.discount)}`}
            />
          )}
          <SummaryRow label="Taxa de rede" value={formatEth(snapshot.networkFee)} />
          <SummaryRow label="Total" value={formatEth(snapshot.total)} strong />
        </dl>

        <div className="mt-3 flex flex-col items-start gap-8 border-t border-primary pt-3 md:gap-12">
          <p className="text-body-sm text-muted-foreground">
            Transação confirmada na {network} (simulada). A propriedade foi transferida para sua
            carteira conectada ({snapshot.wallet.label}) e registrada na rede.
          </p>
          {transaction ? (
            <a
              href={transaction.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-12 items-center rounded-control bg-primary px-4 text-body-lg font-bold text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-active"
            >
              Ver no {explorer}
              <span className="sr-only"> (abre em nova aba)</span>
            </a>
          ) : null}
        </div>
      </section>

      <div aria-hidden="true" className="h-2.5 bg-primary" />
    </article>
  )
}

function ReceiptMeta({
  label,
  strong = false,
  children,
}: {
  label: string
  strong?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 flex-col md:border-r md:border-primary md:pr-4 md:last:border-r-0 md:last:pr-0">
      <dt className={strong ? 'text-body-sm font-bold' : 'text-body-sm'}>{label}</dt>
      <dd className="truncate text-body">{children}</dd>
    </div>
  )
}

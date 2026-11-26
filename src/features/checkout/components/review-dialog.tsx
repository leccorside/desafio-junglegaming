import {
  NETWORK_LABELS,
  WALLET_TYPE_LABELS,
  type Buyer,
  type Cart,
  type Quote,
  type Wallet,
} from '@/api/contracts'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { shortAddress } from '@/features/account/wallet-form'

import type { PlaceOrderPhase } from '../use-place-order'
import { QuoteItems, QuoteTotals } from './checkout-summary'

export type ReviewProblem =
  { kind: 'disconnected' } | { kind: 'timeout' } | { kind: 'error'; message: string }

/**
 * Revisão antes de pagar: itens, totais, carteira, rede e dados do
 * colecionador. Se os valores mudaram desde a tela anterior (cotação
 * revalidada, evento em tempo real ou `QUOTE_OUTDATED` da API), a lista do que
 * mudou aparece em destaque e o botão pede a confirmação dos novos valores.
 */
export function ReviewDialog({
  open,
  onOpenChange,
  cart,
  quote,
  changes,
  wallet,
  buyer,
  phase,
  problem,
  onConfirm,
  onReconnect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  cart: Cart
  quote: Quote
  changes: string[]
  wallet: Wallet
  buyer: Buyer
  phase: PlaceOrderPhase
  problem: ReviewProblem | null
  onConfirm: () => void
  onReconnect: () => void
}) {
  const busy = phase !== 'idle'
  const empty = quote.lines.length === 0
  return (
    <Dialog
      open={open}
      // Não fecha enquanto o pedido está sendo enviado.
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next)
      }}
    >
      <DialogContent
        showCloseButton={!busy}
        className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto border-border-soft bg-background sm:max-w-[560px]"
      >
        <DialogHeader>
          <DialogTitle className="text-title-sm font-bold text-foreground">
            Revise sua compra
          </DialogTitle>
          <DialogDescription className="text-body-sm text-muted-foreground">
            Confira os itens, a carteira e o total antes de pagar.
          </DialogDescription>
        </DialogHeader>

        {changes.length ? (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-md border border-warning/60 bg-card p-3 text-body-sm"
          >
            <p className="font-bold text-warning">Os valores mudaram desde a última revisão:</p>
            <ul className="list-disc pl-5 text-foreground">
              {changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {empty ? (
          <p role="alert" className="text-body-sm text-destructive-foreground">
            Nenhum item do carrinho está disponível para compra. Volte ao carrinho para ajustar.
          </p>
        ) : (
          <QuoteItems cart={cart} quote={quote} />
        )}
        <QuoteTotals quote={quote} />

        <dl className="grid gap-2 rounded-md border border-border bg-card p-3 text-body-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Pagamento com:</dt>
            <dd className="text-foreground">
              {wallet.label} · {WALLET_TYPE_LABELS[wallet.type]} · {shortAddress(wallet.address)}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Rede:</dt>
            <dd className="text-foreground">{NETWORK_LABELS[quote.network]}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Colecionador:</dt>
            <dd className="min-w-0 break-words text-foreground">
              {buyer.displayName} · {buyer.email}
            </dd>
          </div>
        </dl>

        <p role="status" className="text-body-sm text-muted-foreground empty:hidden">
          {phase === 'retrying'
            ? 'O servidor está demorando. Tentando de novo com a mesma compra, sem risco de cobrança duplicada…'
            : phase === 'sending'
              ? 'Enviando o pedido…'
              : ''}
        </p>
        {problem ? (
          <p role="alert" className="text-body-sm text-destructive-foreground">
            {problem.kind === 'disconnected'
              ? 'A carteira desconectou durante o pagamento. Conecte de novo para continuar.'
              : problem.kind === 'timeout'
                ? 'O servidor não respondeu. Sua compra pode ter sido registrada: tentar de novo é seguro e não cria outro pedido.'
                : problem.message}
          </p>
        ) : null}

        <DialogFooter className="flex-col-reverse gap-3 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
            className="h-10"
          >
            Voltar
          </Button>
          {problem?.kind === 'disconnected' ? (
            <Button type="button" onClick={onReconnect} className="h-10 font-bold">
              Reconectar carteira
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onConfirm}
              disabled={busy || empty}
              aria-disabled={busy || undefined}
              className="h-10 font-bold"
            >
              {busy
                ? 'Enviando…'
                : problem?.kind === 'timeout'
                  ? 'Tentar de novo'
                  : changes.length
                    ? 'Confirmar com os novos valores'
                    : 'Confirmar e pagar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { z } from 'zod'

import {
  buyerSchema,
  quoteOutdatedDetailsSchema,
  type Buyer,
  type Cart,
  type Profile,
  type Quote,
  type Wallet,
} from '@/api/contracts'
import { errorMessage, normalizeError } from '@/api/errors'
import { ArrowLeftIcon } from '@/components/icons/figma-icons'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountLabel, accountFieldClass } from '@/features/account/components/fields'
import { useProfile, useWallets } from '@/features/account/queries'
import { useSession } from '@/features/auth/session-store'
import { FormError } from '@/features/auth/components/form-error'
import { useCartChangeListener } from '@/features/cart/cart-notices'
import { useCart, useCartOwner, useQuote, quoteQuery } from '@/features/cart/queries'
import { cartKeys, quoteKeys } from '@/features/cart/cart-cache'
import { usePendingOrders } from '@/features/orders/queries'
import { refreshQueries } from '@/features/realtime/apply-nft-updated'
import { centerFocusedField } from '@/lib/focus'
import { cn } from '@/lib/utils'

import { orderKeys, walletConnectApi } from './api'
import { QuoteItems, QuoteTotals } from './components/checkout-summary'
import { ReviewDialog, type ReviewProblem } from './components/review-dialog'
import { WalletPicker, type WalletConnectionState } from './components/wallet-picker'
import { describeQuoteDiff } from './quote-diff'
import { readCheckoutDraft, updateCheckoutDraft, type CheckoutDraft } from './storage'
import { usePlaceOrder } from './use-place-order'

/** Tela "Pagamento" (desktop) e "Pagamento com carteira" (mobile). */
export function CheckoutPage() {
  const session = useSession()
  const cart = useCart()
  const wallets = useWallets()
  const profile = useProfile()
  const queries = [cart, wallets, profile]
  const failed = queries.find((q) => q.isError)

  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 pt-6 pb-12 md:gap-8 md:px-6 md:pt-8 xl:px-0">
      <CheckoutHeader />
      {failed ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-4 rounded-md border border-destructive/60 bg-card p-6"
        >
          <p className="text-body-lg font-bold text-foreground">
            Não foi possível carregar o pagamento.
          </p>
          <p className="text-body-sm text-destructive-foreground">{errorMessage(failed.error)}</p>
          <Button onClick={() => queries.forEach((q) => q.isError && void q.refetch())}>
            Tentar de novo
          </Button>
        </div>
      ) : !cart.data || !wallets.data || !profile.data || !session ? (
        <CheckoutSkeleton />
      ) : cart.data.items.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-md bg-card p-6">
          <p className="text-body-lg font-bold text-foreground">Seu carrinho está vazio.</p>
          <p className="text-body-sm text-muted-foreground">
            Escolha um NFT no catálogo para comprar.
          </p>
          <Button asChild variant="secondary">
            <Link to="/" hash="catalogo">
              Explorar o catálogo
            </Link>
          </Button>
        </div>
      ) : (
        <CheckoutForm
          key={session.user.id}
          userId={session.user.id}
          cart={cart.data}
          wallets={wallets.data.items}
          profile={profile.data}
        />
      )}
    </div>
  )
}

function CheckoutHeader() {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const navigate = useNavigate()
  return (
    <>
      {/* Mobile: voltar e título (frame "Screen Header"). Desktop: título para leitor de tela. */}
      <div className="relative flex h-[44px] items-center justify-center md:hidden">
        <button
          type="button"
          onClick={() => (canGoBack ? router.history.back() : void navigate({ to: '/cart' }))}
          aria-label="Voltar"
          className="absolute left-0 flex size-[35px] cursor-pointer items-center justify-center rounded-full border border-border bg-popover text-muted-foreground"
        >
          <ArrowLeftIcon size={20} />
        </button>
        <h1 className="text-title-sm leading-4 font-bold text-foreground">
          Pagamento com carteira
        </h1>
      </div>
      <h1 className="hidden md:sr-only md:block">Pagamento</h1>
    </>
  )
}

function CheckoutSkeleton() {
  return (
    <div aria-hidden="true" data-checkout-skeleton="" className="flex flex-col gap-8 md:flex-row">
      <div className="flex flex-1 flex-col gap-6">
        <Skeleton className="h-4 w-48" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[69px]" />
          <Skeleton className="h-[69px]" />
        </div>
        <Skeleton className="h-[152px]" />
      </div>
      <div className="flex flex-col gap-3 md:w-[405px]">
        <Skeleton className="h-[70px]" />
        <Skeleton className="h-[70px]" />
        <Skeleton className="h-[180px]" />
      </div>
    </div>
  )
}

interface BuyerFormValues {
  displayName: string
  email: string
  note: string
}

const buyerFormSchema = z.object({
  displayName: buyerSchema.shape.displayName,
  email: buyerSchema.shape.email,
  note: z.string().max(280, 'Use no máximo 280 caracteres.'),
})

const toBuyer = (values: BuyerFormValues): Buyer => ({
  displayName: values.displayName.trim(),
  email: values.email.trim(),
  ...(values.note.trim() ? { note: values.note.trim() } : {}),
})

/** Mesma assinatura = nada que pese no que a pessoa vai pagar mudou. */
function fingerprint(quote: Quote): string {
  return JSON.stringify([
    quote.network,
    quote.lines.map((l) => [l.itemId, l.unitPrice, l.quantity]),
    quote.discount,
    quote.networkFee,
    quote.total,
    quote.blockedItemIds,
  ])
}

interface ReviewState {
  quote: Quote
  changes: string[]
  problem: ReviewProblem | null
}

function CheckoutForm({
  userId,
  cart,
  wallets,
  profile,
}: {
  userId: string
  cart: Cart
  wallets: Wallet[]
  profile: Profile
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const owner = useCartOwner()
  const [draft] = useState<CheckoutDraft | null>(() => readCheckoutDraft(userId))
  const [walletId, setWalletId] = useState<string | null>(() => {
    const saved = draft?.walletId
    if (saved && wallets.some((w) => w.id === saved)) return saved
    return (wallets.find((w) => w.role === 'primary') ?? wallets[0])?.id ?? null
  })
  const wallet = wallets.find((w) => w.id === walletId)
  const quote = useQuote(cart, wallet?.network, Boolean(wallet))
  const live = quote.data && !quote.isPlaceholderData ? quote.data : undefined
  const updating = quote.isFetching && quote.isPlaceholderData
  const names = Object.fromEntries(cart.items.map((item) => [item.nftId, item.name]))

  const [connection, setConnection] = useState<WalletConnectionState>({
    walletId: null,
    status: 'idle',
  })
  const [walletError, setWalletError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [review, setReview] = useState<ReviewState | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  // A revisão devolve o foco ao "Confirmar compra" quando fecha.
  const confirmRef = useRef<HTMLButtonElement>(null)
  // Aviso de mudança em tempo real (preço, estoque) no pagamento: no fluxo,
  // acima dos totais, sem toast. Com a revisão aberta ele é descartado: a
  // revisão já lista a mudança e pede nova confirmação.
  const [changeNotice, setChangeNotice] = useState<string | null>(null)
  useCartChangeListener((message) => {
    if (reviewOpen) return
    setChangeNotice(
      message.replace('O resumo do carrinho foi atualizado.', 'O total foi atualizado.'),
    )
  })
  const [pendingAttempt, setPendingAttempt] = useState(draft?.attempt ?? null)
  const [recoverError, setRecoverError] = useState<string | null>(null)
  const placeOrder = usePlaceOrder()
  const pendingOrders = usePendingOrders()
  const pendingOrder = pendingOrders.data?.items[0]

  const savedBuyer = draft?.buyer
  const form = useForm<BuyerFormValues>({
    resolver: zodResolver(buyerFormSchema) as unknown as Resolver<BuyerFormValues>,
    defaultValues:
      savedBuyer && (savedBuyer.displayName || savedBuyer.email || savedBuyer.note)
        ? savedBuyer
        : { displayName: profile.displayName, email: profile.email, note: '' },
  })
  const values = useWatch({ control: form.control }) as BuyerFormValues

  // Rascunho a cada mudança: sobrevive ao refresh e à expiração da sessão.
  useEffect(() => {
    updateCheckoutDraft(userId, {
      buyer: {
        displayName: values.displayName ?? '',
        email: values.email ?? '',
        note: values.note ?? '',
      },
      walletId,
    })
  }, [userId, values.displayName, values.email, values.note, walletId])

  const blocked = Boolean(live?.blockedItemIds.length)

  const connect = async (target: Wallet): Promise<boolean> => {
    setConnection({ walletId: target.id, status: 'connecting' })
    try {
      await walletConnectApi.connect(target.id)
      setConnection({ walletId: target.id, status: 'connected' })
      return true
    } catch (error) {
      const apiError = normalizeError(error)
      setConnection({
        walletId: target.id,
        status: apiError.code === 'WALLET_REJECTED' ? 'rejected' : 'error',
        message:
          apiError.code === 'WALLET_REJECTED'
            ? 'Você recusou a conexão na carteira. Tente de novo quando quiser.'
            : apiError.message,
      })
      return false
    }
  }

  /**
   * "Confirmar compra": valida os dados, conecta a carteira, revalida a
   * cotação na API e abre a revisão (com a diferença, se houver).
   */
  const onConfirm = form.handleSubmit(async () => {
    setFormError(null)
    setWalletError(null)
    if (!wallet) {
      setWalletError('Escolha uma carteira para pagar.')
      return
    }
    setPreparing(true)
    try {
      const connected =
        (connection.walletId === wallet.id && connection.status === 'connected') ||
        (await connect(wallet))
      if (!connected) return
      const shown = live
      const fresh = await queryClient.fetchQuery({
        ...quoteQuery(owner, wallet.network, cart.version),
        staleTime: 0,
      })
      setReview({
        quote: fresh,
        changes: shown ? describeQuoteDiff(shown, fresh, names) : [],
        problem: null,
      })
      setReviewOpen(true)
    } catch (error) {
      setFormError(`Não foi possível revisar a compra. ${errorMessage(error)}`)
    } finally {
      setPreparing(false)
    }
  }, centerFocusedField)

  // Com a revisão aberta, uma mudança que chega em tempo real (preço,
  // estoque) entra na revisão e pede a confirmação dos novos valores.
  const liveDiffers = Boolean(
    review && live && fingerprint(live) !== fingerprint(review.quote) && !updating,
  )
  const effectiveQuote = review ? (liveDiffers && live ? live : review.quote) : undefined
  const effectiveChanges =
    review && liveDiffers && live ? describeQuoteDiff(review.quote, live, names) : review?.changes

  const goToOrder = (orderId: string) => {
    setReviewOpen(false)
    setPendingAttempt(null)
    void queryClient.invalidateQueries({ queryKey: orderKeys.user(userId) })
    void navigate({ to: '/orders/$orderId', params: { orderId }, replace: true })
  }

  const submitOrder = async () => {
    if (!review || !effectiveQuote || !wallet) return
    const body = {
      quoteId: effectiveQuote.id,
      quoteVersion: effectiveQuote.version,
      walletId: wallet.id,
      network: effectiveQuote.network,
      buyer: toBuyer(form.getValues()),
    }
    setReview({ ...review, quote: effectiveQuote, changes: [], problem: null })
    try {
      const order = await placeOrder.place(body)
      queryClient.setQueryData(orderKeys.detail(userId, order.id), order)
      goToOrder(order.id)
    } catch (error) {
      const apiError = normalizeError(error)
      if (apiError.code === 'QUOTE_OUTDATED') {
        const details = quoteOutdatedDetailsSchema.safeParse(apiError.details)
        void refreshQueries(queryClient, cartKeys.all)
        void refreshQueries(queryClient, quoteKeys.all)
        if (details.success) {
          setReview({
            quote: details.data.quote,
            changes: details.data.changes.map((change) => change.message),
            problem: null,
          })
          return
        }
      }
      if (apiError.code === 'WALLET_DISCONNECTED') {
        setConnection({ walletId: wallet.id, status: 'disconnected' })
        setReview((current) => current && { ...current, problem: { kind: 'disconnected' } })
        return
      }
      if (['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE'].includes(apiError.code)) {
        setReview((current) => current && { ...current, problem: { kind: 'timeout' } })
        return
      }
      if (apiError.code === 'SESSION_EXPIRED' || apiError.code === 'UNAUTHENTICATED') {
        // A expiração leva ao login; o rascunho e a chave ficam guardados.
        return
      }
      setReview(
        (current) =>
          current && { ...current, problem: { kind: 'error', message: apiError.message } },
      )
    }
  }

  const reconnect = async () => {
    if (!wallet) return
    if (await connect(wallet)) {
      setReview((current) => current && { ...current, problem: null })
    }
  }

  /** Tentativa anterior sem resposta (refresh ou queda): reenvia com a mesma chave. */
  const recoverAttempt = async () => {
    if (!pendingAttempt) return
    setRecoverError(null)
    try {
      const order = await placeOrder.place(pendingAttempt.body)
      goToOrder(order.id)
    } catch (error) {
      const apiError = normalizeError(error)
      if (['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE'].includes(apiError.code)) {
        setRecoverError('O servidor não respondeu. Tente de novo em instantes.')
        return
      }
      // O pedido não chegou a existir (cotação vencida, carteira trocada...).
      updateCheckoutDraft(userId, { attempt: null })
      setPendingAttempt(null)
      setRecoverError(
        'A compra anterior não chegou a ser registrada. Revise os dados e confirme de novo.',
      )
    }
  }

  const busy = preparing || placeOrder.pending

  return (
    <Form {...form}>
      {pendingOrder ? (
        <div
          role="status"
          className="flex flex-col gap-2 rounded-md border border-warning/60 bg-card p-4 text-body-sm md:flex-row md:items-center md:justify-between"
        >
          <p className="text-foreground">
            O pedido {pendingOrder.id} está aguardando a confirmação do pagamento.
          </p>
          <Link
            to="/orders/$orderId"
            params={{ orderId: pendingOrder.id }}
            className="font-bold text-accent-foreground hover:underline"
          >
            Acompanhar pedido
          </Link>
        </div>
      ) : null}
      {pendingAttempt ? (
        <div className="flex flex-col gap-2 rounded-md border border-warning/60 bg-card p-4 text-body-sm md:flex-row md:items-center md:justify-between">
          <p className="text-foreground">
            Sua última tentativa de compra não terminou. Verifique antes de comprar de novo: se o
            pedido foi registrado, ele aparece sem duplicar.
          </p>
          <Button
            type="button"
            variant="secondary"
            disabled={placeOrder.pending}
            onClick={() => void recoverAttempt()}
            className="h-10 shrink-0"
          >
            {placeOrder.pending ? 'Verificando…' : 'Verificar compra'}
          </Button>
        </div>
      ) : null}
      {recoverError ? <FormError message={recoverError} /> : null}

      <form
        onSubmit={onConfirm}
        noValidate
        aria-label="Pagamento"
        className={cn(
          'grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,1fr)_405px] md:gap-x-8 md:gap-y-6',
          "[grid-template-areas:'wallet'_'buyer'_'summary'_'confirm']",
          "md:[grid-template-areas:'buyer_summary'_'buyer_wallet'_'buyer_confirm'_'buyer_rest']",
        )}
      >
        <section aria-labelledby="buyer-title" className="flex flex-col gap-3 [grid-area:buyer]">
          <h2 id="buyer-title" className="text-[17px] leading-4 font-bold text-foreground">
            Perfil do colecionador
          </h2>
          <div className="grid gap-3 md:grid-cols-2 md:gap-x-6">
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem className="content-start gap-0">
                  <AccountLabel required>Nome de exibição</AccountLabel>
                  <FormControl>
                    <Input autoComplete="name" className={accountFieldClass} {...field} />
                  </FormControl>
                  <FormMessage className="pt-1.5" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="content-start gap-0">
                  <AccountLabel required>E-mail</AccountLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      className={accountFieldClass}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage className="pt-1.5" />
                </FormItem>
              )}
            />
          </div>
          <Link
            to="/wallets"
            className="mt-3 w-fit text-[15px] text-foreground underline-offset-4 hover:text-accent-foreground hover:underline"
          >
            Usar outra carteira? Cadastre ou edite em Carteiras
          </Link>
          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem className="mt-3 content-start gap-3 md:max-w-[350px]">
                <AccountLabel>Observação do colecionador (opcional)</AccountLabel>
                <FormControl>
                  <textarea
                    rows={6}
                    maxLength={280}
                    className={cn(
                      'min-h-[152px] w-full resize-y border border-input bg-transparent p-3 text-body-sm text-foreground focus-visible:border-primary focus-visible:outline-none aria-invalid:border-destructive',
                      accountFieldClass,
                    )}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </section>

        <section aria-labelledby="items-title" className="flex flex-col gap-3 [grid-area:summary]">
          <h2 id="items-title" className="text-[17px] leading-4 font-bold text-foreground">
            Seus NFTs
          </h2>
          <div
            aria-hidden="true"
            className="flex justify-between border-b border-primary/30 pb-3 text-body-lg leading-4"
          >
            <span className="font-bold">NFTs</span>
            <span className="font-medium">Subtotal</span>
          </div>
          {quote.data ? (
            <QuoteItems cart={cart} quote={quote.data} />
          ) : quote.isError ? (
            <div role="alert" className="flex flex-col gap-2 text-body-sm">
              <p className="text-destructive-foreground">
                Não foi possível calcular o total. {errorMessage(quote.error)}
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
            <div aria-hidden="true" className="flex flex-col gap-3">
              <Skeleton className="h-[70px]" />
              <Skeleton className="h-[70px]" />
            </div>
          )}
          <Link to="/cart" className="w-fit text-body-sm text-foreground hover:underline">
            Tem um código promocional? Aplique no carrinho
          </Link>
          <p role="status" className="sr-only">
            {updating ? 'Atualizando o total…' : live ? `Total: ${live.total} ETH` : ''}
          </p>
          <div role="status" className={changeNotice ? 'contents' : 'sr-only'}>
            {changeNotice ? (
              <p
                data-checkout-notice=""
                className="rounded-md border border-warning/50 bg-card p-3 text-body-sm text-foreground"
              >
                {changeNotice}
              </p>
            ) : null}
          </div>
          <QuoteTotals quote={quote.data} updating={updating} />
          {blocked ? (
            <p role="alert" className="text-body-sm text-destructive-foreground">
              Há itens esgotados ou acima do estoque no carrinho.{' '}
              <Link to="/cart" className="font-bold underline">
                Ajuste o carrinho
              </Link>{' '}
              para continuar.
            </p>
          ) : null}
        </section>

        <div className="[grid-area:wallet]">
          <WalletPicker
            wallets={wallets}
            selectedId={walletId}
            onSelect={(id) => {
              setWalletId(id)
              setWalletError(null)
            }}
            connection={connection}
            onConnect={() => {
              if (wallet) void connect(wallet)
            }}
            error={walletError}
          />
        </div>

        <div className="flex flex-col gap-3 [grid-area:confirm]">
          <FormError message={formError} />
          <button
            ref={confirmRef}
            type="submit"
            disabled={busy || blocked || !live || !wallet}
            className="h-[60px] w-full cursor-pointer rounded-full bg-[linear-gradient(135deg,var(--primary-hover),var(--primary))] text-body font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 md:h-[45px] md:rounded-lg md:bg-primary md:bg-none"
          >
            {preparing
              ? connection.status === 'connecting'
                ? 'Conectando a carteira…'
                : 'Revisando…'
              : 'Confirmar compra'}
          </button>
        </div>
      </form>

      {review && effectiveQuote && wallet ? (
        <ReviewDialog
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          cart={cart}
          quote={effectiveQuote}
          changes={effectiveChanges ?? []}
          wallet={wallet}
          buyer={toBuyer(values)}
          phase={placeOrder.phase}
          problem={review.problem}
          onConfirm={() => void submitOrder()}
          onReconnect={() => void reconnect()}
          returnFocusTo={confirmRef}
        />
      ) : null}
    </Form>
  )
}

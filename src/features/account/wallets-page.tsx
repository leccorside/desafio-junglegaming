import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useId, useRef, useState } from 'react'
import { useForm, useWatch, type Resolver } from 'react-hook-form'

import {
  NETWORK_LABELS,
  WALLET_TYPE_LABELS,
  type Network,
  type Wallet,
  type WalletRole,
  type WalletType,
} from '@/api/contracts'
import { errorMessage } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { applyApiError } from '@/features/auth/form-errors'
import { centerFocusedField } from '@/lib/focus'
import { formSuccessToast } from '@/lib/form-toasts'
import { FormError } from '@/features/auth/components/form-error'

import { AccountLayout } from './components/account-layout'
import { AccountLabel, EnsInput, NativeSelect, accountFieldClass } from './components/fields'
import { useCreateWallet, useUpdateWallet, useWallets } from './queries'
import {
  addressPlaceholder,
  shortAddress,
  toWalletRequest,
  walletDefaults,
  walletFormSchema,
  type WalletFormValues,
} from './wallet-form'

/** Tela "Carteiras" (frame desktop do Figma; mobile em uma coluna). */
export function WalletsPage() {
  const wallets = useWallets()
  const items = wallets.data?.items ?? []
  const primary = items.find((w) => w.role === 'primary')
  const secondary = items.find((w) => w.role === 'secondary')

  return (
    <AccountLayout current="wallets" title="Carteiras">
      <h1 className="sr-only">Carteiras</h1>
      {wallets.isPending ? (
        <WalletsSkeleton />
      ) : wallets.isError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-4 rounded-md border border-destructive/60 bg-card p-6"
        >
          <p className="text-body-lg font-bold text-foreground">
            Não foi possível carregar as carteiras.
          </p>
          <p className="text-body-sm text-destructive-foreground">{errorMessage(wallets.error)}</p>
          <Button onClick={() => void wallets.refetch()}>Tentar de novo</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-12">
          <PrimaryWallet wallet={primary} />
          <SecondaryWallet wallet={secondary} primary={primary} />
        </div>
      )}
    </AccountLayout>
  )
}

function WalletsSkeleton() {
  return (
    <div aria-hidden="true" data-wallets-skeleton="" className="flex flex-col gap-6">
      <Skeleton className="h-4 w-48" />
      <div className="grid gap-6 md:grid-cols-2 md:gap-x-7">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10" />
          </div>
        ))}
      </div>
    </div>
  )
}

const DESCRIPTION = 'Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.'

/** Carteira principal: sempre aberta; cria se não existe, edita se existe. */
function PrimaryWallet({ wallet }: { wallet: Wallet | undefined }) {
  const titleId = useId()
  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 id={titleId} className="text-[17px] leading-4 font-bold text-foreground">
          Carteira principal
        </h2>
        <p className="text-body-sm leading-[15px] text-muted-foreground">{DESCRIPTION}</p>
      </div>
      {/* A chave é o id (não a data de atualização): salvar não remonta o
          formulário, que perderia o foco do "Salvar"; os valores salvos voltam
          pelo `form.reset` do próprio formulário. */}
      <WalletForm
        key={wallet?.id ?? 'new'}
        role="primary"
        wallet={wallet}
        initial={walletDefaults(wallet)}
      />
    </section>
  )
}

/**
 * Carteira secundária: fechada por padrão ("Adicionar" ou "Editar"). "Igual
 * à carteira principal" abre o formulário já com rede, tipo, endereço e ENS
 * da principal.
 */
function SecondaryWallet({
  wallet,
  primary,
}: {
  wallet: Wallet | undefined
  primary: Wallet | undefined
}) {
  const titleId = useId()
  const sameId = useId()
  const [open, setOpen] = useState(false)
  const [sameAsPrimary, setSameAsPrimary] = useState(false)
  // Salvar ou cancelar fecha o formulário (o elemento focado some): o foco
  // volta ao "Editar"/"Adicionar", que também traz o resumo para a tela.
  const toggleRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)
  useEffect(() => {
    if (open || !returnFocus.current) return
    returnFocus.current = false
    toggleRef.current?.focus({ preventScroll: true })
    toggleRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' })
  }, [open])

  const initial: WalletFormValues =
    sameAsPrimary && primary
      ? {
          ...walletDefaults(primary),
          label: wallet?.label ?? `${primary.label} (secundária)`,
        }
      : walletDefaults(wallet)

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <h2 id={titleId} className="text-[17px] leading-4 font-bold text-foreground">
          Carteira secundária
        </h2>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label
            htmlFor={sameId}
            className="flex cursor-pointer items-center gap-2 text-body-sm text-foreground has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <input
              id={sameId}
              type="checkbox"
              checked={sameAsPrimary}
              disabled={!primary}
              onChange={(event) => {
                setSameAsPrimary(event.target.checked)
                if (event.target.checked) setOpen(true)
              }}
              className="size-4 cursor-pointer appearance-none rounded-full border-[1.5px] border-primary checked:bg-primary checked:shadow-[inset_0_0_0_3px_var(--background)] disabled:cursor-not-allowed"
            />
            Igual à carteira principal
          </label>
          {!open ? (
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setOpen(true)}
              className="cursor-pointer text-body-lg font-medium text-accent-foreground hover:underline"
            >
              {wallet ? 'Editar' : 'Adicionar'}
              <span className="sr-only"> carteira secundária</span>
            </button>
          ) : null}
        </div>
      </div>

      {open ? (
        <div className="pt-5">
          <WalletForm
            // Refaz o formulário quando a cópia da principal liga ou desliga.
            key={`${wallet?.updatedAt ?? 'new'}-${sameAsPrimary}`}
            role="secondary"
            wallet={wallet}
            initial={initial}
            autoFocus
            onDone={() => {
              returnFocus.current = true
              setOpen(false)
              setSameAsPrimary(false)
            }}
          />
        </div>
      ) : wallet ? (
        <WalletSummary wallet={wallet} />
      ) : (
        <p className="text-body-sm leading-[15px] text-muted-foreground">
          Você ainda não adicionou uma carteira secundária.
        </p>
      )}
    </section>
  )
}

function WalletSummary({ wallet }: { wallet: Wallet }) {
  return (
    <dl className="grid gap-x-7 gap-y-2 rounded-md border border-border bg-card p-4 text-body-sm sm:grid-cols-2">
      {(
        [
          ['Apelido', wallet.label],
          ['Rede', NETWORK_LABELS[wallet.network]],
          ['Tipo', WALLET_TYPE_LABELS[wallet.type]],
          ['Endereço', shortAddress(wallet.address)],
          ['Nome ENS', wallet.ensName ? `${wallet.ensName}.eth` : 'Não informado'],
        ] as const
      ).map(([term, value]) => (
        <div key={term} className="flex min-w-0 gap-2">
          <dt className="shrink-0 text-muted-foreground">{term}:</dt>
          <dd
            className="truncate text-foreground"
            title={term === 'Endereço' ? wallet.address : undefined}
          >
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

const WALLET_FIELDS = ['label', 'network', 'type', 'address', 'ensName'] as const

function WalletForm({
  role,
  wallet,
  initial,
  autoFocus,
  onDone,
}: {
  role: WalletRole
  wallet: Wallet | undefined
  initial: WalletFormValues
  autoFocus?: boolean
  /** Secundária: fecha o formulário depois de salvar ou cancelar. */
  onDone?: () => void
}) {
  const create = useCreateWallet()
  const update = useUpdateWallet()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<WalletFormValues>({
    // Os selects começam vazios (''), fora do tipo de rede e de carteira:
    // o schema do formulário trabalha com string e acusa o vazio.
    resolver: zodResolver(walletFormSchema) as unknown as Resolver<WalletFormValues>,
    defaultValues: initial,
  })
  const network = useWatch({ control: form.control, name: 'network' })
  const pending = create.isPending || update.isPending
  const which = role === 'primary' ? 'principal' : 'secundária'

  const submit = form.handleSubmit(async (values) => {
    setFormError(null)
    const body = toWalletRequest(values)
    try {
      const saved = wallet
        ? await update.mutateAsync({ id: wallet.id, body })
        : await create.mutateAsync({ ...body, role })
      // O que a API gravou (endereço normalizado, ENS) passa a ser o padrão.
      form.reset(walletDefaults(saved))
      formSuccessToast(`Carteira ${which} salva.`)
      onDone?.()
    } catch (error) {
      setFormError(applyApiError(error, form.setError, WALLET_FIELDS))
    }
  }, centerFocusedField)
  // O botão fica com `aria-disabled` (não `disabled`) enquanto salva, para o
  // foco não cair no topo; o Enter repetido para aqui.
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (pending) {
      event.preventDefault()
      return
    }
    void submit(event)
  }

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        aria-label={`Carteira ${which}`}
        className="flex flex-col gap-8"
      >
        <div className="grid gap-6 md:grid-cols-2 md:gap-x-7">
          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem className="content-start gap-1.5">
                <AccountLabel required>Apelido da carteira</AccountLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    placeholder="Ex.: Carteira de coleção"
                    autoFocus={autoFocus}
                    className={accountFieldClass}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="network"
            render={({ field }) => (
              <FormItem className="content-start gap-1.5">
                <AccountLabel required>Rede</AccountLabel>
                <FormControl>
                  <NativeSelect {...field}>
                    <option value="">Selecione uma rede</option>
                    {(Object.keys(NETWORK_LABELS) as Network[]).map((value) => (
                      <option key={value} value={value}>
                        {NETWORK_LABELS[value]}
                      </option>
                    ))}
                  </NativeSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem className="content-start gap-1.5">
                <AccountLabel required>Endereço da carteira</AccountLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={addressPlaceholder(network)}
                    className={`${accountFieldClass} font-mono`}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem className="content-start gap-1.5">
                <AccountLabel required>Tipo de carteira</AccountLabel>
                <FormControl>
                  <NativeSelect {...field}>
                    <option value="">Selecione uma carteira</option>
                    {(Object.keys(WALLET_TYPE_LABELS) as WalletType[]).map((value) => (
                      <option key={value} value={value}>
                        {WALLET_TYPE_LABELS[value]}
                      </option>
                    ))}
                  </NativeSelect>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ensName"
            render={({ field }) => (
              <FormItem className="content-start gap-1.5">
                <AccountLabel>Nome ENS</AccountLabel>
                <FormControl>
                  <EnsInput placeholder="nome (opcional)" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormError message={formError} />
        <div className="flex flex-col gap-3 md:flex-row">
          <Button
            type="submit"
            aria-disabled={pending || undefined}
            aria-busy={pending || undefined}
            className="h-10 w-full rounded-[3px] px-4 text-body-sm font-bold aria-disabled:cursor-wait aria-disabled:opacity-60 md:w-auto md:min-w-[131px]"
          >
            {pending ? 'Salvando…' : 'Salvar carteira'}
          </Button>
          {onDone ? (
            <Button
              type="button"
              variant="ghost"
              onClick={onDone}
              className="h-10 w-full rounded-[3px] text-body-sm md:w-auto"
            >
              Cancelar
            </Button>
          ) : null}
        </div>
      </form>
    </Form>
  )
}

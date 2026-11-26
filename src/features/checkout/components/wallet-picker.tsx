import { Link } from '@tanstack/react-router'
import { useId } from 'react'

import { NETWORK_LABELS, WALLET_TYPE_LABELS, type Wallet } from '@/api/contracts'
import { shortAddress } from '@/features/account/wallet-form'
import { cn } from '@/lib/utils'

export type ConnectionStatus =
  'idle' | 'connecting' | 'connected' | 'rejected' | 'disconnected' | 'error'

export interface WalletConnectionState {
  walletId: string | null
  status: ConnectionStatus
  message?: string
}

const STATUS_TEXT: Record<ConnectionStatus, (wallet: Wallet) => string> = {
  idle: () => 'A carteira é conectada quando você confirmar a compra.',
  connecting: (w) => `Conectando ${WALLET_TYPE_LABELS[w.type]}…`,
  connected: (w) =>
    `Carteira conectada: ${WALLET_TYPE_LABELS[w.type]} · ${shortAddress(w.address)}`,
  rejected: () => 'A conexão foi recusada na carteira. Tente de novo.',
  disconnected: () => 'A carteira desconectou durante o pagamento. Conecte de novo para continuar.',
  error: () => 'Não foi possível conectar a carteira.',
}

/**
 * "Carteira e rede": as carteiras cadastradas como opções (a rede vem da
 * carteira, como na API) e a situação da conexão simulada.
 */
export function WalletPicker({
  wallets,
  selectedId,
  onSelect,
  connection,
  onConnect,
  error,
}: {
  wallets: Wallet[]
  selectedId: string | null
  onSelect: (id: string) => void
  connection: WalletConnectionState
  onConnect: () => void
  error: string | null
}) {
  const titleId = useId()
  const statusId = useId()
  const selected = wallets.find((w) => w.id === selectedId)
  const status: ConnectionStatus = connection.walletId === selectedId ? connection.status : 'idle'
  const canRetry = status === 'rejected' || status === 'disconnected' || status === 'error'

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={titleId} className="text-[17px] leading-4 font-bold text-foreground">
          Carteira e rede
        </h2>
        <Link
          to="/wallets"
          className="text-body-sm font-bold text-accent-foreground hover:underline"
        >
          Trocar carteira
        </Link>
      </div>

      {wallets.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-border bg-card p-4">
          <p className="text-body-sm text-foreground">Você ainda não tem carteira cadastrada.</p>
          <Link
            to="/wallets"
            className="text-body-sm font-bold text-accent-foreground hover:underline"
          >
            Cadastrar carteira
          </Link>
        </div>
      ) : (
        <div
          role="radiogroup"
          aria-labelledby={titleId}
          aria-describedby={statusId}
          className="flex flex-col gap-4"
        >
          {wallets.map((wallet) => {
            const checked = wallet.id === selectedId
            return (
              <label
                key={wallet.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-[3px] border px-3 py-3 transition-colors',
                  checked ? 'border-primary' : 'border-input hover:border-border-soft',
                )}
              >
                <input
                  type="radio"
                  name="checkout-wallet"
                  value={wallet.id}
                  checked={checked}
                  onChange={() => onSelect(wallet.id)}
                  className="size-4 shrink-0 cursor-pointer appearance-none rounded-full border-[1.2px] border-primary checked:bg-primary checked:shadow-[inset_0_0_0_3px_var(--background)]"
                />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-body text-foreground">
                    {wallet.label}
                    <span className="text-muted-foreground">
                      {' '}
                      ({wallet.role === 'primary' ? 'principal' : 'secundária'})
                    </span>
                  </span>
                  <span className="truncate text-caption text-muted-foreground">
                    {WALLET_TYPE_LABELS[wallet.type]} · Rede {NETWORK_LABELS[wallet.network]} ·{' '}
                    {wallet.ensName ? `${wallet.ensName}.eth` : shortAddress(wallet.address)}
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      )}

      {selected ? (
        <div className="flex flex-col gap-2">
          <p
            id={statusId}
            role="status"
            data-connection={status}
            className={cn(
              'text-body-sm',
              canRetry ? 'text-destructive-foreground' : 'text-muted-foreground',
              status === 'connected' && 'text-success',
            )}
          >
            {connection.message && connection.walletId === selectedId && canRetry
              ? connection.message
              : STATUS_TEXT[status](selected)}
          </p>
          {canRetry ? (
            <button
              type="button"
              onClick={onConnect}
              className="w-fit cursor-pointer text-body-sm font-bold text-accent-foreground underline"
            >
              {status === 'disconnected' ? 'Reconectar carteira' : 'Tentar conectar de novo'}
            </button>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-body-sm text-destructive-foreground">
          {error}
        </p>
      ) : null}
    </section>
  )
}

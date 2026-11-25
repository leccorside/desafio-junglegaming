import { MinusIcon, PlusIcon } from 'lucide-react'
import { useId, useState } from 'react'

import { cn } from '@/lib/utils'

import { clampQuantity } from '../editions'

/**
 * Seletor de quantidade (frame "01" do Figma: botões Primary arredondados com
 * o número no meio). Campo numérico com `min` e `max`, botões com rótulo e
 * aviso quando chega ao limite disponível.
 */
export function QuantityStepper({
  value,
  max,
  onChange,
  size = 'lg',
  label = 'Quantidade',
  hideLabel = size === 'lg',
  subject,
  busy = false,
}: {
  value: number
  max: number
  onChange: (value: number) => void
  size?: 'lg' | 'sm'
  label?: string
  hideLabel?: boolean
  /** Nome do item, nos rótulos dos botões quando há vários seletores na tela (carrinho). */
  subject?: string
  /** Enquanto a API confirma a mudança anterior: botões desabilitados, sem perder o foco. */
  busy?: boolean
}) {
  const inputId = useId()
  const hintId = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const disabled = max <= 0
  const atMax = !disabled && value >= max
  const of = subject ? ` de ${subject}` : ''

  const commit = (raw: string) => {
    setDraft(null)
    const next = clampQuantity(Number(raw), max)
    if (next !== value) onChange(next)
  }

  const button = cn(
    'flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-background bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40 aria-disabled:cursor-wait aria-disabled:opacity-60',
    size === 'lg' ? 'h-[50px] w-[33px]' : 'h-[30px] w-5',
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 md:gap-3">
        <label
          htmlFor={inputId}
          className={cn('text-body font-medium text-muted-foreground', hideLabel && 'sr-only')}
        >
          {label}
        </label>
        <button
          type="button"
          className={button}
          // Ocupado: aria-disabled em vez de disabled, para o foco não sair do botão.
          onClick={() => {
            if (!busy) onChange(clampQuantity(value - 1, max))
          }}
          disabled={disabled || value <= 1}
          aria-disabled={busy || undefined}
          aria-label={`Diminuir quantidade${of}`}
          aria-controls={inputId}
        >
          <MinusIcon className={size === 'lg' ? 'size-4' : 'size-3'} />
        </button>
        <input
          id={inputId}
          type="number"
          inputMode="numeric"
          min={disabled ? 0 : 1}
          max={max}
          value={draft ?? String(value)}
          disabled={disabled}
          readOnly={busy}
          aria-busy={busy || undefined}
          aria-describedby={hintId}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit(event.currentTarget.value)
          }}
          className={cn(
            'w-10 [appearance:textfield] bg-transparent text-center text-foreground focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
            size === 'lg' ? 'text-title-sm' : 'text-lead font-medium',
          )}
        />
        <button
          type="button"
          className={button}
          onClick={() => {
            if (!busy) onChange(clampQuantity(value + 1, max))
          }}
          disabled={disabled || atMax}
          aria-disabled={busy || undefined}
          aria-label={`Aumentar quantidade${of}`}
          aria-controls={inputId}
        >
          <PlusIcon className={size === 'lg' ? 'size-4' : 'size-3'} />
        </button>
      </div>
      {/* Na barra de compra (sm) o aviso fica numa linha: a barra não cresce. */}
      <p
        id={hintId}
        aria-live="polite"
        className={cn(
          'min-h-4 text-muted-foreground',
          size === 'lg' ? 'text-caption' : 'text-caption-sm whitespace-nowrap',
        )}
      >
        {disabled
          ? size === 'lg'
            ? 'Nenhuma unidade disponível.'
            : 'Sem unidades.'
          : atMax
            ? size === 'lg'
              ? `Máximo disponível: ${max} ${max === 1 ? 'unidade' : 'unidades'}.`
              : `Máximo: ${max} ${max === 1 ? 'disponível' : 'disponíveis'}.`
            : null}
      </p>
    </div>
  )
}

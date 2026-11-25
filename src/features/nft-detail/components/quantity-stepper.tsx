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
}: {
  value: number
  max: number
  onChange: (value: number) => void
  size?: 'lg' | 'sm'
  label?: string
}) {
  const inputId = useId()
  const hintId = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const disabled = max <= 0
  const atMax = !disabled && value >= max

  const commit = (raw: string) => {
    setDraft(null)
    onChange(clampQuantity(Number(raw), max))
  }

  const button = cn(
    'flex shrink-0 cursor-pointer items-center justify-center rounded-full border border-background bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40',
    size === 'lg' ? 'h-[50px] w-[33px]' : 'h-[30px] w-5',
  )

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 md:gap-3">
        <label
          htmlFor={inputId}
          className={cn('text-body font-medium text-muted-foreground', size === 'lg' && 'sr-only')}
        >
          {label}
        </label>
        <button
          type="button"
          className={button}
          onClick={() => onChange(clampQuantity(value - 1, max))}
          disabled={disabled || value <= 1}
          aria-label="Diminuir quantidade"
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
          onClick={() => onChange(clampQuantity(value + 1, max))}
          disabled={disabled || atMax}
          aria-label="Aumentar quantidade"
          aria-controls={inputId}
        >
          <PlusIcon className={size === 'lg' ? 'size-4' : 'size-3'} />
        </button>
      </div>
      <p id={hintId} aria-live="polite" className="min-h-4 text-caption text-muted-foreground">
        {disabled
          ? 'Nenhuma unidade disponível.'
          : atMax
            ? `Máximo disponível: ${max} ${max === 1 ? 'unidade' : 'unidades'}.`
            : null}
      </p>
    </div>
  )
}

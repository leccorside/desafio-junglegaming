import { useId } from 'react'

import type { NftEdition } from '@/api/contracts'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

import { editionStatusLabel, isEditionSelectable } from '../editions'

/**
 * "Edição:" com as opções em pílulas (frame "Frame 156" do Figma). É um grupo
 * de rádio: as setas trocam a opção e Tab sai do grupo. Edição esgotada ou
 * indisponível aparece riscada e não pode ser escolhida.
 */
export function EditionSelector({
  editions,
  value,
  onChange,
}: {
  editions: NftEdition[]
  value: string | undefined
  onChange: (edition: NftEdition) => void
}) {
  const labelId = useId()
  const selectable = editions.filter(isEditionSelectable)

  const move = (from: NftEdition, step: number) => {
    const position = selectable.findIndex((e) => e.id === from.id)
    const next = selectable[(position + step + selectable.length) % selectable.length]
    if (next) {
      onChange(next)
      document.getElementById(`edition-${next.id}`)?.focus()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <span id={labelId} className="text-body font-bold text-foreground">
        Edição:
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
        {editions.map((edition) => {
          const status = editionStatusLabel(edition)
          const checked = edition.id === value
          const disabled = status !== null
          return (
            <button
              key={edition.id}
              id={`edition-${edition.id}`}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={disabled || undefined}
              aria-label={`${edition.name === 'Aberta' ? 'Edição aberta' : `Edição ${edition.name}`}, ${formatEth(edition.price)}${status ? `, ${status}` : ''}`}
              tabIndex={checked || (!value && edition === selectable[0]) ? 0 : -1}
              onClick={() => {
                if (!disabled) onChange(edition)
              }}
              onKeyDown={(event) => {
                if (['ArrowRight', 'ArrowDown'].includes(event.key)) {
                  event.preventDefault()
                  move(edition, 1)
                } else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) {
                  event.preventDefault()
                  move(edition, -1)
                }
              }}
              title={status ? `Edição ${status}` : undefined}
              className={cn(
                'h-7 rounded-full border px-2 text-body-sm uppercase transition-colors',
                checked
                  ? 'border-primary font-medium text-accent-foreground'
                  : 'border-border text-muted-foreground',
                disabled
                  ? 'cursor-not-allowed line-through opacity-50'
                  : 'cursor-pointer hover:border-primary hover:text-foreground',
              )}
            >
              {edition.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

import { StarIcon } from '@/components/icons/figma-icons'
import { cn } from '@/lib/utils'

const formatRating = (value: number) => value.toFixed(1).replace('.', ',')

/** Cinco estrelas do Figma (Primary cheias, Secondary vazias), com a nota em texto. */
export function RatingStars({
  average,
  count,
  className,
}: {
  average: number
  count: number
  className?: string
}) {
  // Estrelas inteiras, como no Figma (4,8 mostra 4 cheias); a nota exata vai no texto.
  const filled = Math.floor(average)
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <span className="sr-only">
        Nota {formatRating(average)} de 5, {count} {count === 1 ? 'avaliação' : 'avaliações'} de
        colecionadores
      </span>
      <span aria-hidden="true" className="flex items-center gap-1">
        {Array.from({ length: 5 }, (_, i) => (
          <StarIcon
            key={i}
            size={15}
            className={i < filled ? 'text-primary' : 'text-muted-foreground'}
          />
        ))}
      </span>
      <span aria-hidden="true" className="ml-1 text-body text-foreground">
        {count} {count === 1 ? 'avaliação' : 'avaliações'} de colecionadores
      </span>
    </div>
  )
}

/** Versão compacta do mobile: pílula com estrela, nota e total ("4.8 (19)"). */
export function RatingPill({ average, count }: { average: number; count: number }) {
  return (
    <p className="flex h-[27px] shrink-0 items-center gap-1 rounded-full border border-primary px-2 text-body-sm">
      <StarIcon size={14} className="text-primary" />
      <span className="sr-only">Nota</span>
      <span className="font-medium text-foreground">{formatRating(average)}</span>
      <span className="text-muted-foreground">
        ({count}
        <span className="sr-only"> {count === 1 ? 'avaliação' : 'avaliações'}</span>)
      </span>
    </p>
  )
}

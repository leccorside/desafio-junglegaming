import { useRef, useState, type KeyboardEvent } from 'react'

import type { NftImage } from '@/api/contracts'
import { nftImageSources } from '@/lib/images'
import { cn } from '@/lib/utils'

const NEXT_KEYS = ['ArrowDown', 'ArrowRight']
const PREV_KEYS = ['ArrowUp', 'ArrowLeft']

/**
 * Galeria do detalhe. Desktop (frame "Product Images"): miniaturas de 100 px
 * em coluna e imagem principal de 444 px. Mobile ("Hero"): imagem grande com
 * pontos. Miniaturas e pontos são botões com `aria-current` na imagem ativa;
 * as setas do teclado andam entre as miniaturas (o foco vai junto).
 */
export function NftGallery({
  images,
  name,
  overlay,
}: {
  images: NftImage[]
  name: string
  /** Botões sobre a imagem no mobile (voltar e favoritar). */
  overlay?: React.ReactNode
}) {
  const [index, setIndex] = useState(0)
  const current = images[Math.min(index, images.length - 1)] ?? images[0]
  const thumbs = useRef<(HTMLButtonElement | null)[]>([])
  const many = images.length > 1

  const onThumbKey = (event: KeyboardEvent<HTMLButtonElement>, position: number) => {
    const step = NEXT_KEYS.includes(event.key) ? 1 : PREV_KEYS.includes(event.key) ? -1 : 0
    const target =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? images.length - 1
          : step
            ? (position + step + images.length) % images.length
            : null
    if (target === null) return
    event.preventDefault()
    setIndex(target)
    thumbs.current[target]?.focus()
  }

  if (!current) return null

  return (
    <section aria-label={`Imagens de ${name}`} className="flex flex-col gap-4 md:flex-row md:gap-7">
      {many ? (
        <ul aria-label="Miniaturas" className="hidden flex-col gap-4 md:flex" role="list">
          {images.map((image, position) => (
            <li key={`${image.url}-${position}`}>
              <button
                ref={(element) => {
                  thumbs.current[position] = element
                }}
                type="button"
                onClick={() => setIndex(position)}
                onKeyDown={(event) => onThumbKey(event, position)}
                aria-label={`Imagem ${position + 1} de ${images.length}`}
                aria-current={position === index ? 'true' : undefined}
                tabIndex={position === index ? 0 : -1}
                className={cn(
                  'block size-[100px] cursor-pointer overflow-hidden rounded-lg border transition-colors',
                  position === index ? 'border-primary' : 'border-transparent hover:border-border',
                )}
              >
                <img
                  {...nftImageSources(image.url, '100px')}
                  alt=""
                  width={100}
                  height={100}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative w-full md:size-[444px] md:shrink-0 md:rounded-md md:bg-card md:p-4">
        <img
          key={current.url + index}
          {...nftImageSources(current.url, '(min-width: 768px) 412px, 100vw')}
          alt={current.alt}
          width={current.width}
          height={current.height}
          fetchPriority="high"
          decoding="async"
          className="aspect-square w-full rounded-3xl object-cover"
        />
        {overlay}
        {many ? (
          <div
            className="mt-4 flex justify-center gap-2 md:hidden"
            role="group"
            aria-label="Imagens"
          >
            {images.map((_, position) => (
              <button
                key={position}
                type="button"
                onClick={() => setIndex(position)}
                aria-label={`Imagem ${position + 1} de ${images.length}`}
                aria-current={position === index ? 'true' : undefined}
                className="flex h-6 cursor-pointer items-center"
              >
                <span
                  className={cn(
                    'h-[7px] rounded-full bg-primary transition-all',
                    position === index ? 'w-7' : 'w-[7px] opacity-60',
                  )}
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  )
}

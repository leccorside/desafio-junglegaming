import { Link } from '@tanstack/react-router'

import { RARITY_LABELS, type Nft } from '@/api/contracts'
import { Skeleton } from '@/components/ui/skeleton'
import { FavoriteButton } from '@/features/favorites/components/favorite-button'
import { formatEth } from '@/lib/eth'
import { nftImageSources } from '@/lib/images'
import { cn } from '@/lib/utils'

import { isNftAvailable } from '../availability'

const IMAGE_SIZES = '(min-width: 768px) 250px, 168px'

/**
 * Card do catálogo. Desktop (frame "Product Grid"): fundo Surface Card de
 * 258 × 300, imagem de 250 px com raio 15, nome e preço abaixo. Mobile
 * ("Column L/R"): card em gradiente com raio 20, imagem de 168 px e selo de
 * raridade. O card todo é um link para o detalhe.
 */
export function NftCard({ nft, priority = false }: { nft: Nft; priority?: boolean }) {
  const image = nft.images[0]
  const available = isNftAvailable(nft)
  const showRarity = nft.rarity !== 'common'

  return (
    <div className="relative">
      <Link
        to="/nft/$nftId"
        params={{ nftId: nft.id }}
        className="group flex flex-col gap-2 rounded-[20px] md:gap-3 md:rounded-none"
      >
        <div className="relative flex aspect-[175/200] items-start justify-center rounded-[20px] bg-[linear-gradient(135deg,var(--card),var(--popover))] px-1 pt-3 pb-5 md:aspect-[258/300] md:items-center md:rounded-none md:bg-card md:px-1 md:pt-0 md:pb-0">
          {image ? (
            <img
              {...nftImageSources(image.url, IMAGE_SIZES)}
              alt=""
              width={image.width}
              height={image.height}
              loading={priority ? 'eager' : 'lazy'}
              fetchPriority={priority ? 'high' : 'auto'}
              decoding="async"
              className="aspect-square w-[96%] rounded-2xl object-cover transition-transform duration-300 group-hover:scale-[1.02] md:w-[97%] md:rounded-[15px]"
            />
          ) : null}
          {showRarity ? (
            <span className="absolute top-4 left-0 bg-primary px-2 py-1.5 text-caption font-medium text-primary-foreground uppercase md:top-3 md:left-3">
              {RARITY_LABELS[nft.rarity]}
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 px-2 md:gap-3 md:px-0">
          <span className="truncate text-body text-foreground md:text-body-lg md:leading-4">
            {nft.name}
          </span>
          <span
            className={cn(
              'text-body-lg leading-4 md:text-lead',
              available ? 'font-bold text-accent-foreground' : 'text-secondary',
            )}
          >
            {formatEth(nft.priceFrom)}
            {available ? null : <span className="ml-2 text-caption uppercase">Esgotado</span>}
          </span>
        </div>
      </Link>
      {/* Coração do card mobile (Figma "Column L/R"). Fora do link: botão dentro de link não é válido. */}
      <FavoriteButton nft={nft} variant="card" className="absolute top-4 right-3 md:hidden" />
    </div>
  )
}

/** Mesmas dimensões do card, para o carregamento não deslocar o layout. */
export function NftCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 md:gap-3" aria-hidden="true">
      <Skeleton className="aspect-[175/200] rounded-[20px] md:aspect-[258/300] md:rounded-none" />
      <div className="flex flex-col gap-1 px-2 md:gap-3 md:px-0">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
}

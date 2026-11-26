import { Link } from '@tanstack/react-router'

import { Skeleton } from '@/components/ui/skeleton'
import { nftImageSources } from '@/lib/images'

import { useFeaturedNfts } from '../queries'

/**
 * "NFT em destaque" da sidebar (frame "Featured NFT Banner", 310 × 470):
 * título em Accent, "Oferta limitada" e a imagem de um destaque da API.
 */
export function FeaturedBanner() {
  const featured = useFeaturedNfts()
  const nft = featured.data?.items[1] ?? featured.data?.items[0]

  if (featured.isPending) return <Skeleton className="h-[470px] w-full rounded-[22px]" />
  if (!nft) return null

  const image = nft.images[0]
  return (
    <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="group flex flex-col gap-4">
      {/* Nome do link = texto visível + o NFT (sem aria-label, que trocaria o
          texto à vista e falharia em "label-content-name-mismatch"). */}
      <div className="flex flex-col gap-1">
        <span className="text-h2 font-bold text-accent-foreground uppercase">NFT em destaque</span>
        <span className="text-title font-bold text-foreground uppercase">Oferta limitada</span>
        <span className="sr-only">: {nft.name}</span>
      </div>
      {image ? (
        <img
          {...nftImageSources(image.url, '310px')}
          alt=""
          width={image.width}
          height={image.height}
          loading="lazy"
          decoding="async"
          className="h-[368px] w-full rounded-[22px] object-cover transition-transform duration-300 group-hover:scale-[1.01]"
        />
      ) : null}
    </Link>
  )
}

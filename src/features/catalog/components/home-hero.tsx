import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import { ArrowRightIcon } from '@/components/icons/figma-icons'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { nftImageSources } from '@/lib/images'
import { cn } from '@/lib/utils'

import { useFeaturedNfts } from '../queries'

/**
 * Atalho para o catálogo na mesma tela: só conta como página atual na URL
 * exata (o padrão do Router marcaria aria-current em qualquer estado de `/`).
 */
const IN_PAGE_LINK = { exact: true, includeHash: true }

/** Pontos do carrossel: um botão por destaque, o atual em Primary. */
function Dots({
  count,
  current,
  onSelect,
  names,
}: {
  count: number
  current: number
  onSelect: (index: number) => void
  names: string[]
}) {
  if (count <= 1) return null
  return (
    // Cada ponto é desenhado com o tamanho do Figma (10 px), mas o botão tem
    // 24 × 24 px de área de toque (WCAG 2.5.8).
    <div className="flex items-center" role="group" aria-label="Destaques">
      {Array.from({ length: count }, (_, index) => (
        <button
          key={index}
          type="button"
          onClick={() => onSelect(index)}
          aria-label={`Mostrar ${names[index] ?? `destaque ${index + 1}`}`}
          aria-pressed={index === current}
          className="group/dot flex h-6 min-w-6 cursor-pointer items-center justify-center rounded-full"
        >
          <span
            aria-hidden="true"
            className={cn(
              'h-2.5 rounded-full transition-all',
              index === current
                ? 'w-6 bg-primary'
                : 'w-2.5 bg-secondary/60 group-hover/dot:bg-secondary',
            )}
          />
        </button>
      ))}
    </div>
  )
}

/**
 * Imagem fixa do projeto (asset do Figma) para quando a API não tem destaques
 * ou falha: o hero não fica com a metade direita vazia. Não é link, porque
 * não representa um NFT do catálogo.
 */
const HERO_FALLBACK_IMAGE = '/images/nfts/nft-01-960.webp'

/**
 * Destaques da tela inicial. Desktop (frame "Hero", 1200 × 450): texto à
 * esquerda, imagem do destaque à direita e pontos para trocar. Mobile
 * ("Hero Banner", 366 × 190): cartão em gradiente com duas imagens.
 * As imagens vêm de `GET /nfts/featured`; o texto é fixo, como no Figma.
 * Sem destaques, entra a `HERO_FALLBACK_IMAGE`.
 */
export function HomeHero() {
  const featured = useFeaturedNfts()
  const items = featured.data?.items ?? []
  const [current, setCurrent] = useState(0)
  const index = items.length ? current % items.length : 0
  const nft = items[index]
  const second = items[(index + 1) % Math.max(items.length, 1)]
  const names = items.map((item) => item.name)

  return (
    <section aria-labelledby="hero-title">
      {/* Desktop */}
      <div className="hidden min-h-[450px] items-center justify-between gap-12 md:flex">
        <div className="flex max-w-[560px] flex-col gap-6">
          <p className="text-body-sm font-medium text-accent-foreground">Bem-vindo à Kurio</p>
          <h1
            id="hero-title"
            className="text-display leading-[1.15] font-bold text-foreground uppercase"
          >
            Seja dono do futuro
            <br />
            da arte digital
          </h1>
          <p className="max-w-[460px] text-body-sm text-muted-foreground">
            Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital
            rara, apoie artistas e tenha uma parte da cultura da internet.
          </p>
          <Button asChild className="h-10 w-[140px] rounded-md font-bold">
            <Link to="/" hash="catalogo" activeOptions={IN_PAGE_LINK}>
              EXPLORAR
            </Link>
          </Button>
          <Dots count={items.length} current={index} onSelect={setCurrent} names={names} />
        </div>
        {featured.isPending ? (
          <Skeleton className="size-[450px] shrink-0 rounded-3xl" />
        ) : nft?.images[0] ? (
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            aria-label={`Ver ${nft.name}`}
            className="shrink-0"
          >
            <img
              key={nft.id}
              {...nftImageSources(nft.images[0].url, '450px')}
              alt=""
              width={450}
              height={450}
              fetchPriority="high"
              decoding="async"
              className="size-[450px] rounded-3xl object-cover"
            />
          </Link>
        ) : (
          <img
            {...nftImageSources(HERO_FALLBACK_IMAGE, '450px')}
            alt=""
            width={450}
            height={450}
            decoding="async"
            data-hero-fallback=""
            className="size-[450px] shrink-0 rounded-3xl object-cover"
          />
        )}
      </div>

      {/* Mobile */}
      <div className="relative flex h-[190px] overflow-hidden rounded-xl bg-[linear-gradient(135deg,color-mix(in_srgb,var(--primary)_20%,transparent),color-mix(in_srgb,var(--primary)_10%,transparent))] p-4 md:hidden">
        <div className="relative z-10 flex max-w-[54%] flex-col gap-1">
          <p className="text-caption-sm font-medium text-accent-foreground">Bem-vindo à Kurio</p>
          <h1 className="text-lead font-bold text-foreground uppercase">
            Seja dono da
            <br />
            cultura digital
          </h1>
          <p className="text-caption-sm text-muted-foreground">
            Descubra NFTs selecionados de criadores do mundo todo.
          </p>
          <Link
            to="/"
            hash="catalogo"
            activeOptions={IN_PAGE_LINK}
            className="mt-1 flex items-center gap-1 text-caption-sm font-bold text-accent-foreground uppercase"
          >
            Explorar <ArrowRightIcon size={14} />
          </Link>
        </div>
        {nft?.images[0] ? (
          <img
            {...nftImageSources(nft.images[0].url, '138px')}
            alt=""
            width={138}
            height={138}
            decoding="async"
            className="absolute top-4 right-4 size-[138px] rounded-xl object-cover"
          />
        ) : featured.isPending ? null : (
          <img
            {...nftImageSources(HERO_FALLBACK_IMAGE, '138px')}
            alt=""
            width={138}
            height={138}
            decoding="async"
            data-hero-fallback=""
            className="absolute top-4 right-4 size-[138px] rounded-xl object-cover"
          />
        )}
        {second && second.id !== nft?.id && second.images[0] ? (
          <img
            {...nftImageSources(second.images[0].url, '58px')}
            alt=""
            width={58}
            height={58}
            loading="lazy"
            decoding="async"
            className="absolute right-[100px] bottom-[30px] size-[58px] rounded-lg border-2 border-background object-cover"
          />
        ) : null}
        <div className="absolute right-4 bottom-3 flex w-[138px] justify-center">
          <Dots count={items.length} current={index} onSelect={setCurrent} names={names} />
        </div>
      </div>
    </section>
  )
}

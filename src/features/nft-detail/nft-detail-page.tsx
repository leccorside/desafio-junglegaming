import { useSuspenseQuery } from '@tanstack/react-query'
import { Link, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { NFT_CATEGORY_LABELS, RARITY_LABELS, type NftEdition } from '@/api/contracts'
import { LoadingRegion } from '@/components/feedback/loading-region'
import { ArrowLeftIcon, ShopIcon } from '@/components/icons/figma-icons'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { nftDetailQuery } from '@/features/catalog/queries'
import { FavoriteButton } from '@/features/favorites/components/favorite-button'
import { formatEth } from '@/lib/eth'
import { useAfterFirstPaint } from '@/lib/use-after-first-paint'
import { cn } from '@/lib/utils'

import { EditionSelector } from './components/edition-selector'
import { NftGallery } from './components/nft-gallery'
import { NftInfoTabs } from './components/nft-info-tabs'
import { QuantityStepper } from './components/quantity-stepper'
import { RatingPill, RatingStars } from './components/rating-stars'
import { RelatedNfts } from './components/related-nfts'
import { ShareLinks } from './components/share-links'
import { clampQuantity, maxQuantity, resolveEdition } from './editions'
import { usePurchase } from './use-purchase'

function TokenInfo({
  tokenId,
  collection,
  attributes,
}: {
  tokenId: string
  collection: string
  attributes: string[]
}) {
  return (
    <dl className="flex flex-col gap-3 text-body text-secondary">
      <div className="flex gap-1">
        <dt>ID do token:</dt>
        <dd>#{tokenId}</dd>
      </div>
      <div className="flex gap-1">
        <dt>Coleção:</dt>
        <dd>{collection}</dd>
      </div>
      {attributes.length ? (
        <div className="flex gap-1">
          <dt>Atributos:</dt>
          <dd>{attributes.join(', ')}</dd>
        </div>
      ) : null}
    </dl>
  )
}

/** Quantidade por edição: trocar de edição volta para 1; limite sempre respeitado. */
function useQuantity(edition: NftEdition | null) {
  const [state, setState] = useState({ editionId: edition?.id, value: 1 })
  if (state.editionId !== edition?.id) setState({ editionId: edition?.id, value: 1 })
  const max = maxQuantity(edition)
  const value = clampQuantity(state.editionId === edition?.id ? state.value : 1, max)
  return {
    value,
    max,
    set: (next: number) => setState({ editionId: edition?.id, value: next }),
  }
}

/**
 * Detalhe do NFT (frames "Desktop / Detalhes do NFT" e "Mobile / Detalhes do
 * NFT"). A edição escolhida vai para a URL (`?edition=`), para o link levar à
 * mesma escolha; edição esgotada ou indisponível na URL cai na padrão com aviso.
 */
export function NftDetailPage({
  nftId,
  editionId,
  onEditionChange,
}: {
  nftId: string
  editionId: string | undefined
  onEditionChange: (edition: NftEdition) => void
}) {
  const { data: nft } = useSuspenseQuery(nftDetailQuery(nftId))
  const { edition, requestedUnavailable } = resolveEdition(nft, editionId)
  const quantity = useQuantity(edition)
  const purchase = usePurchase(nft, edition, quantity.value)
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const navigate = useNavigate()
  const belowFold = useAfterFirstPaint()
  const soldOut = !edition
  const price = edition?.price ?? nft.priceFrom

  const goBack = () => (canGoBack ? router.history.back() : void navigate({ to: '/' }))

  const editionNotice = requestedUnavailable ? (
    <p
      role="status"
      className="rounded-md border border-warning/50 bg-accent px-3 py-2 text-body-sm text-warning"
    >
      A edição {requestedUnavailable.name} está{' '}
      {requestedUnavailable.status === 'unavailable' ? 'indisponível' : 'esgotada'}.
      {edition ? ` Mostrando a edição ${edition.name === 'Aberta' ? 'aberta' : edition.name}.` : ''}
    </p>
  ) : null

  const soldOutNotice = soldOut ? (
    <p role="status" className="rounded-md bg-accent px-3 py-2 text-body-sm text-muted-foreground">
      Todas as edições deste NFT estão esgotadas ou indisponíveis.
    </p>
  ) : null

  return (
    <div className="mx-auto flex max-w-content flex-col gap-12 px-4 pt-4 md:gap-24 md:px-6 md:pt-8 xl:px-0">
      {/* data-nft-id: a volta do login (intenção de favoritar) começa aqui, no topo. */}
      <div className="flex flex-col gap-3" data-nft-id={nft.id} data-reveal="start">
        <nav aria-label="Trilha de navegação" className="hidden md:block">
          <ol className="flex gap-1 text-body font-bold text-foreground">
            <li>
              <Link to="/" className="hover:text-accent-foreground">
                Início
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link to="/" hash="catalogo" className="hover:text-accent-foreground">
                Mercado
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-normal text-muted-foreground">
              {nft.name}
            </li>
          </ol>
        </nav>

        {/* Duas colunas só a partir de 1024 px: no tablet, a galeria (cerca de
            550 px) deixaria uns 140 px para as informações e os botões. */}
        <div className="flex flex-col gap-6 md:gap-8 lg:flex-row">
          <NftGallery
            images={nft.images}
            name={nft.name}
            overlay={
              <div className="absolute inset-x-3 top-3 flex justify-between md:hidden">
                <button
                  type="button"
                  onClick={goBack}
                  aria-label="Voltar"
                  className="flex size-[35px] cursor-pointer items-center justify-center rounded-full border border-border bg-popover text-muted-foreground"
                >
                  <ArrowLeftIcon size={20} />
                </button>
                <FavoriteButton nft={nft} variant="round" />
              </div>
            }
          />

          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <div className="flex flex-col gap-3 border-b border-primary/30 pb-3">
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-title font-bold text-foreground md:text-h1">{nft.name}</h1>
                <div className="md:hidden">
                  <RatingPill average={nft.rating.average} count={nft.rating.count} />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-title font-bold text-accent-foreground">
                  <span className="sr-only">Preço: </span>
                  {formatEth(price)}
                  {soldOut ? (
                    <span className="ml-2 text-body-sm font-normal text-secondary uppercase">
                      Esgotado
                    </span>
                  ) : null}
                </p>
                <RatingStars
                  average={nft.rating.average}
                  count={nft.rating.count}
                  className="hidden md:flex"
                />
              </div>
              <p className="flex flex-wrap gap-2 text-caption text-muted-foreground">
                <span>{NFT_CATEGORY_LABELS[nft.category]}</span>
                {nft.rarity !== 'common' ? (
                  <span className="bg-primary px-1.5 font-medium text-primary-foreground uppercase">
                    {RARITY_LABELS[nft.rarity]}
                  </span>
                ) : null}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-body font-bold text-foreground">Sobre este NFT:</h2>
              <p className="text-body-sm text-muted-foreground">{nft.description}</p>
            </div>

            {editionNotice}
            {soldOutNotice}

            <EditionSelector
              editions={nft.editions}
              value={edition?.id}
              onChange={onEditionChange}
            />

            {/* Desktop: quantidade e botões na própria coluna (frame "Frame 167"). */}
            <div className="hidden flex-wrap items-start justify-between gap-4 md:flex">
              <QuantityStepper value={quantity.value} max={quantity.max} onChange={quantity.set} />
              <div className="flex gap-2">
                <Button
                  onClick={purchase.buy}
                  disabled={!purchase.canBuy}
                  aria-disabled={purchase.pending || undefined}
                  aria-busy={purchase.pending}
                  className="h-10 w-[130px] rounded-md font-bold aria-disabled:cursor-wait aria-disabled:opacity-60"
                >
                  {purchase.pending ? 'Adicionando…' : 'COMPRAR'}
                </Button>
                <FavoriteButton nft={nft} variant="outline" />
              </div>
            </div>

            <TokenInfo
              tokenId={nft.tokenId}
              collection={nft.collection.name}
              attributes={nft.attributes}
            />
            <ShareLinks name={nft.name} />
          </div>
        </div>
      </div>

      {/* Abaixo da dobra: entram depois da primeira pintura, numa transição,
          fora da tarefa longa da primeira renderização (as abas do Radix leem
          o estilo calculado ao montar, o que força um recálculo de estilo). */}
      {belowFold ? (
        <>
          <NftInfoTabs nft={nft} />
          <RelatedNfts nft={nft} />
        </>
      ) : (
        // Reserva menor que as abas e "Mais desta coleção" juntos: no desktop
        // o rodapé fica fora da tela até elas entrarem e só desce, fora da
        // vista, sem deslocamento visível (antes, CLS de 0,097).
        <div aria-hidden="true" data-below-fold-placeholder="" className="min-h-[600px]" />
      )}

      {/* Mobile: barra de compra fixa (frame "Buy Bar"), no lugar da barra de navegação. */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-4 rounded-t-[28px] bg-card px-6 pt-4 shadow-[0_-8px_24px_rgb(0_0_0/0.35)] md:hidden"
        style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-start justify-between gap-3">
          <QuantityStepper
            value={quantity.value}
            max={quantity.max}
            onChange={quantity.set}
            size="sm"
            label="Qtd."
          />
          <p className="shrink-0 pt-1 text-title-sm font-bold whitespace-nowrap text-accent-foreground">
            <span className="sr-only">Preço: </span>
            {formatEth(price)}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={purchase.buy}
            // Enviando: `aria-disabled` (o foco fica no botão); `disabled` só sem edição.
            disabled={!purchase.canBuy}
            aria-disabled={purchase.pending || undefined}
            aria-busy={purchase.pending}
            className={cn(
              'h-[60px] flex-1 cursor-pointer rounded-full bg-[linear-gradient(135deg,var(--primary-hover),var(--primary))] text-body-lg font-bold text-primary-foreground',
              'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-wait aria-disabled:opacity-60',
            )}
          >
            {purchase.pending ? 'Adicionando…' : soldOut ? 'Esgotado' : 'Comprar NFT'}
          </button>
          <button
            type="button"
            onClick={purchase.addToCart}
            disabled={!purchase.canBuy}
            aria-disabled={purchase.pending || undefined}
            aria-busy={purchase.pending}
            aria-label="Adicionar ao carrinho"
            className="flex size-[60px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-popover text-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-wait aria-disabled:opacity-60"
          >
            <ShopIcon size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Mesmo esqueleto da página, para o carregamento não deslocar o layout. */
export function NftDetailSkeleton() {
  return (
    <LoadingRegion
      label="Carregando NFT…"
      className="mx-auto flex max-w-content flex-col gap-6 px-4 pt-4 md:gap-8 md:px-6 md:pt-[60px] lg:flex-row xl:px-0"
    >
      <div className="flex gap-7">
        <div className="hidden flex-col gap-4 md:flex">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="size-[100px] rounded-lg" />
          ))}
        </div>
        <Skeleton className="aspect-square w-full rounded-3xl md:size-[444px]" />
      </div>
      <div className="flex flex-1 flex-col gap-5">
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-12 w-3/4" />
      </div>
    </LoadingRegion>
  )
}

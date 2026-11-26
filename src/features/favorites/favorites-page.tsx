import { Link } from '@tanstack/react-router'

import { errorMessage } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { NftCard, NftCardSkeleton } from '@/features/catalog/components/nft-card'

import { useFavorites } from './queries'

const grid = 'grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-x-8 md:gap-y-10 lg:grid-cols-4'

/**
 * "Lista de interesse" (nome do Figma para os favoritos), rota privada. O
 * Figma não desenha a tela: usa a grade e o card do catálogo.
 */
export function FavoritesPage() {
  const favorites = useFavorites()
  const items = favorites.data?.items ?? []

  return (
    <section
      aria-labelledby="favorites-title"
      className="mx-auto flex max-w-content flex-col gap-6 px-4 pt-6 md:gap-8 md:px-6 md:pt-10 xl:px-0"
    >
      <div className="flex flex-col gap-2 border-b border-primary/30 pb-3">
        <h1 id="favorites-title" className="text-h2 font-bold text-foreground md:text-h1">
          Lista de interesse
        </h1>
        <p className="text-body-sm text-muted-foreground" role="status">
          {favorites.isPending
            ? 'Carregando sua lista…'
            : favorites.isError
              ? 'Não foi possível carregar sua lista.'
              : `${items.length} ${items.length === 1 ? 'NFT salvo' : 'NFTs salvos'}`}
        </p>
      </div>

      {favorites.isPending ? (
        // `aria-busy` só na área do skeleton: o "Carregando sua lista…" acima
        // (role="status") fica fora dela, para o leitor de tela anunciar.
        <div aria-busy="true" data-favorites-skeleton="">
          <ul className={grid} aria-hidden="true">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i}>
                <NftCardSkeleton />
              </li>
            ))}
          </ul>
        </div>
      ) : favorites.isError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-4 rounded-md border border-destructive/60 bg-card p-6"
        >
          <p className="text-body-lg font-bold text-foreground">
            Não foi possível carregar a lista de interesse.
          </p>
          <p className="text-body-sm text-destructive-foreground">
            {errorMessage(favorites.error)}
          </p>
          <Button onClick={() => void favorites.refetch()}>Tentar de novo</Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-start gap-4 rounded-md bg-card p-6">
          <p className="text-body-lg font-bold text-foreground">
            Sua lista de interesse está vazia.
          </p>
          <p className="text-body-sm text-muted-foreground">
            Toque no coração de um NFT para guardá-lo aqui.
          </p>
          <Button asChild variant="secondary">
            <Link to="/" hash="catalogo">
              Explorar o catálogo
            </Link>
          </Button>
        </div>
      ) : (
        <ul className={grid}>
          {items.map((nft) => (
            <li key={nft.id}>
              <NftCard nft={nft} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

import { createFileRoute, type ErrorComponentProps } from '@tanstack/react-router'
import { z } from 'zod'

import { isApiError } from '@/api/errors'
import { RouteErrorPage } from '@/components/feedback/route-error-page'
import { nftDetailQuery } from '@/features/catalog/queries'
import { NftDetailPage, NftDetailSkeleton } from '@/features/nft-detail/nft-detail-page'
import { NftNotFound } from '@/features/nft-detail/nft-not-found'
import { GALLERY_IMAGE_SIZES, preloadNftImage } from '@/lib/images'

export const Route = createFileRoute('/nft/$nftId')({
  // Edição escolhida na URL: o link leva à mesma escolha. Valor inválido é ignorado.
  validateSearch: z.object({ edition: z.string().max(80).optional().catch(undefined) }),
  // O loader só começa a busca, sem esperar: a tela entra com o esqueleto e a
  // página suspende até o NFT chegar. A renderização com os dados vira uma
  // retentativa de Suspense, que o React fatia, em vez de uma tarefa longa
  // síncrona no fim do loader (300 ms com a CPU do Lighthouse mobile). A
  // imagem principal começa a baixar assim que a resposta chega, sem esperar
  // essa renderização.
  loader: ({ context: { queryClient }, params }) => {
    void queryClient.prefetchQuery(nftDetailQuery(params.nftId)).then(() => {
      const image = queryClient.getQueryData(nftDetailQuery(params.nftId).queryKey)?.images[0]
      if (image) preloadNftImage(image.url, GALLERY_IMAGE_SIZES)
    })
  },
  pendingComponent: NftDetailSkeleton,
  // 404 da API vira a página própria; o resto, a página de erro com "Tentar de novo".
  errorComponent: NftDetailError,
  component: NftDetailRoute,
})

function NftDetailError(props: ErrorComponentProps) {
  if (isApiError(props.error) && props.error.code === 'NOT_FOUND') return <NftNotFound />
  return <RouteErrorPage {...props} />
}

function NftDetailRoute() {
  const { nftId } = Route.useParams()
  const { edition } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <NftDetailPage
      // Trocar de NFT (ex.: "Mais desta coleção") recomeça galeria e quantidade.
      key={nftId}
      nftId={nftId}
      editionId={edition}
      onEditionChange={(next) =>
        void navigate({ search: { edition: next.id }, replace: true, resetScroll: false })
      }
    />
  )
}

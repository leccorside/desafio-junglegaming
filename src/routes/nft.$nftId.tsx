import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { isApiError } from '@/api/errors'
import { RouteErrorPage } from '@/components/feedback/route-error-page'
import { nftDetailQuery } from '@/features/catalog/queries'
import { NftDetailPage, NftDetailSkeleton } from '@/features/nft-detail/nft-detail-page'
import { NftNotFound } from '@/features/nft-detail/nft-not-found'

export const Route = createFileRoute('/nft/$nftId')({
  // Edição escolhida na URL: o link leva à mesma escolha. Valor inválido é ignorado.
  validateSearch: z.object({ edition: z.string().max(80).optional().catch(undefined) }),
  // Acesso direto e refresh: o NFT vem antes da tela; 404 da API vira a página própria.
  loader: async ({ context: { queryClient }, params }) => {
    try {
      await queryClient.ensureQueryData(nftDetailQuery(params.nftId))
    } catch (error) {
      if (isApiError(error) && error.code === 'NOT_FOUND') throw notFound()
      throw error
    }
  },
  pendingComponent: NftDetailSkeleton,
  notFoundComponent: NftNotFound,
  errorComponent: RouteErrorPage,
  component: NftDetailRoute,
})

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

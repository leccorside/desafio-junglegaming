import { createFileRoute } from '@tanstack/react-router'

import { PagePlaceholder } from '@/components/feedback/page-placeholder'

// Detalhe do NFT: Passo 6.
export const Route = createFileRoute('/nft/$nftId')({
  component: function NftDetailPage() {
    return <PagePlaceholder title="Detalhes do NFT" />
  },
})

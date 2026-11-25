import { useQuery } from '@tanstack/react-query'

import type { Nft } from '@/api/contracts'
import { NftCard, NftCardSkeleton } from '@/features/catalog/components/nft-card'
import { RELATED_LIMIT, relatedNftsQuery } from '@/features/catalog/queries'

/**
 * "Mais desta coleção" (frame "Related Products"): até 5 NFTs da mesma
 * coleção. Some quando a coleção não tem outros ou a busca falha, porque é
 * conteúdo complementar e não deve atrapalhar a compra.
 */
export function RelatedNfts({ nft }: { nft: Nft }) {
  const related = useQuery(relatedNftsQuery(nft))
  if (related.isError || (related.data && related.data.length === 0)) return null

  return (
    <section aria-labelledby="related-title" className="flex flex-col gap-8">
      <div className="border-b border-primary/30 pb-3">
        <h2 id="related-title" className="text-[17px] leading-4 font-bold text-accent-foreground">
          Mais desta coleção
          <span className="sr-only">: {nft.collection.name}</span>
        </h2>
      </div>
      <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-7 md:overflow-visible md:px-0 lg:grid-cols-5">
        {related.isPending
          ? Array.from({ length: RELATED_LIMIT }, (_, i) => (
              <li key={i} className="w-[175px] shrink-0 snap-start md:w-auto" aria-hidden="true">
                <NftCardSkeleton />
              </li>
            ))
          : related.data.map((item) => (
              <li key={item.id} className="w-[175px] shrink-0 snap-start md:w-auto">
                <NftCard nft={item} />
              </li>
            ))}
      </ul>
    </section>
  )
}

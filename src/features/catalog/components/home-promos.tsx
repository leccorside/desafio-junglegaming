import { Link } from '@tanstack/react-router'

import { ArrowRightIcon } from '@/components/icons/figma-icons'
import { Button } from '@/components/ui/button'
import type { NftCategory, NftFeed } from '@/api/contracts'

interface Promo {
  title: [string, string]
  text: string
  image: string
  search: { feed?: NftFeed; category?: NftCategory[] }
}

const PROMOS: Promo[] = [
  {
    title: ['Lançamentos gênesis', 'de edição limitada'],
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: '/images/nfts/nft-02-480.webp',
    search: { feed: 'new' },
  },
  {
    title: ['Arte digital selecionada', 'e muito mais'],
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: '/images/nfts/nft-04-480.webp',
    search: { category: ['digital-art'] },
  },
]

/** Dois cartões de 586 × 250 (Figma) que abrem o catálogo já filtrado. */
export function HomePromos() {
  return (
    <section aria-label="Coleções em destaque" className="grid gap-6 md:grid-cols-2 md:gap-7">
      {PROMOS.map((promo) => (
        <article
          key={promo.title[0]}
          className="relative flex min-h-[220px] overflow-hidden rounded-lg bg-card md:min-h-[250px]"
        >
          <div className="relative z-10 flex max-w-[62%] flex-col justify-center gap-3 p-6 md:p-8">
            <h2 className="text-title-sm font-bold text-foreground md:text-h2">
              {promo.title[0]}
              <br />
              {promo.title[1]}
            </h2>
            <p className="text-body-sm text-muted-foreground">{promo.text}</p>
            <Button asChild className="mt-1 h-9 w-fit gap-1 rounded-md px-4 font-bold">
              <Link to="/" search={promo.search} hash="catalogo">
                Explorar <ArrowRightIcon size={16} />
                <span className="sr-only">{`${promo.title[0]} ${promo.title[1]}`}</span>
              </Link>
            </Button>
          </div>
          <img
            src={promo.image}
            alt=""
            width={480}
            height={480}
            loading="lazy"
            decoding="async"
            className="absolute inset-y-0 right-0 h-full w-[45%] [mask-image:linear-gradient(to_right,transparent,black_40%)] object-cover"
          />
        </article>
      ))}
    </section>
  )
}

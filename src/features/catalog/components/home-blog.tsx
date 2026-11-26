import { ArrowRightIcon } from '@/components/icons/figma-icons'
import { UnavailableAction } from '@/components/layout/unavailable-action'

const POSTS = [
  {
    meta: '12 de setembro | Leitura de 6 min',
    title: 'Como funciona a propriedade de NFTs',
    text: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
    image: '/images/nfts/nft-01-480.webp',
  },
  {
    meta: '13 de setembro | Leitura de 2 min',
    title: '10 artistas digitais para acompanhar',
    text: 'Conheça criadores que moldam a cultura digital.',
    image: '/images/nfts/nft-02-480.webp',
  },
  {
    meta: '15 de setembro | Leitura de 3 min',
    title: 'Raridade, atributos e procedência',
    text: 'Entenda raridade, procedência, direitos autorais e utilidade.',
    image: '/images/nfts/nft-03-480.webp',
  },
  {
    meta: '15 de setembro | Leitura de 2 min',
    title: 'Como proteger sua carteira',
    text: 'Proteja sua carteira, seus ativos e sua identidade.',
    image: '/images/nfts/nft-04-480.webp',
  },
] as const

/**
 * "Diário da Cunhagem" (Figma). O blog está fora do escopo do desafio: os
 * cartões aparecem, mas o "Ler mais" fica marcado como indisponível em vez
 * de levar a uma página vazia.
 */
export function HomeBlog() {
  return (
    <section aria-labelledby="blog-title" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h2 id="blog-title" className="text-h1 font-bold text-foreground">
          Diário da Cunhagem
        </h2>
        <p className="text-body-sm text-muted-foreground">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>
      </div>
      <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <li key={post.title}>
            <article className="flex h-full flex-col overflow-hidden rounded-lg bg-card">
              <img
                src={post.image}
                alt=""
                width={480}
                height={480}
                loading="lazy"
                decoding="async"
                className="h-[195px] w-full object-cover"
              />
              <div className="flex flex-1 flex-col gap-2 p-4">
                <p className="text-caption-sm font-medium text-accent-foreground">{post.meta}</p>
                <h3 className="text-body-lg font-bold text-foreground">{post.title}</h3>
                <p className="flex-1 text-body-sm text-muted-foreground">{post.text}</p>
                <UnavailableAction
                  what="O artigo completo"
                  className="mt-2 flex w-fit items-center gap-1 text-body-sm font-bold text-accent-foreground"
                >
                  Ler mais <ArrowRightIcon size={14} />
                </UnavailableAction>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}

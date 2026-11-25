import { CatalogSection } from './components/catalog-section'
import { HomeBlog } from './components/home-blog'
import { HomeHero } from './components/home-hero'
import { HomePromos } from './components/home-promos'
import type { CatalogSearch } from './search'

/**
 * Tela inicial (Figma "Desktop / Início" e "Mobile / Início"): destaques,
 * catálogo com filtros, promoções e blog. Recebe o estado da URL por prop
 * porque também aparece atrás do modal de login, fora da rota `/`.
 */
export function HomePage({ search }: { search: CatalogSearch }) {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-10 px-4 pt-6 md:gap-16 md:px-6 md:pt-8 xl:px-0">
      <HomeHero />
      <CatalogSection search={search} />
      <HomePromos />
      <HomeBlog />
    </div>
  )
}

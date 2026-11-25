import { createFileRoute, stripSearchParams } from '@tanstack/react-router'

import { HomePage } from '@/features/catalog/home-page'
import { CATALOG_SEARCH_DEFAULTS, catalogSearchSchema } from '@/features/catalog/search'

export const Route = createFileRoute('/')({
  // Busca, filtros, ordenação e página vivem na URL; valores padrão não aparecem nela.
  validateSearch: catalogSearchSchema,
  search: { middlewares: [stripSearchParams(CATALOG_SEARCH_DEFAULTS)] },
  component: Home,
})

function Home() {
  const search = Route.useSearch()
  return <HomePage search={search} />
}

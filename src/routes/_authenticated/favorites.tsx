import { createFileRoute } from '@tanstack/react-router'

import { PagePlaceholder } from '@/components/feedback/page-placeholder'

// Rota privada: Passo 6.
export const Route = createFileRoute('/_authenticated/favorites')({
  component: function FavoritesPage() {
    return <PagePlaceholder title="Lista de interesse" />
  },
})

import { createFileRoute } from '@tanstack/react-router'

import { FavoritesPage } from '@/features/favorites/favorites-page'

// Lista de interesse (favoritos): rota privada, protegida pelo layout _authenticated.
export const Route = createFileRoute('/_authenticated/favorites')({
  component: FavoritesPage,
})

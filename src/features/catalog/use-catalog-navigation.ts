import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

import type { CatalogSearch } from './search'

/**
 * Atualiza o estado do catálogo na URL. Qualquer mudança de busca, aba,
 * filtro ou ordenação volta para a página 1; só a paginação escolhe página.
 * Não rola a tela (o catálogo continua onde está).
 */
export function useCatalogNavigation() {
  const navigate = useNavigate()

  const update = useCallback(
    (patch: Partial<CatalogSearch>, options: { replace?: boolean } = {}) =>
      navigate({
        to: '/',
        search: (prev: Partial<CatalogSearch>) => ({ ...prev, ...patch, page: patch.page ?? 1 }),
        replace: options.replace,
        resetScroll: false,
      }),
    [navigate],
  )

  const goToPage = useCallback(
    (page: number) =>
      navigate({
        to: '/',
        search: (prev: Partial<CatalogSearch>) => ({ ...prev, page }),
        hash: 'catalogo',
        resetScroll: false,
      }),
    [navigate],
  )

  const reset = useCallback(() => navigate({ to: '/', search: {}, resetScroll: false }), [navigate])

  return { update, goToPage, reset }
}

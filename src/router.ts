import { createRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

import { setupSession } from '@/features/auth/session'
import { queryClient } from '@/lib/query-client'

import { routeTree } from './routeTree.gen'

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  // Os loaders usam o cache do TanStack Query; o router não guarda cópia própria.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

/**
 * Liga a sessão ao Axios e ao cache. Na expiração: em rota privada, o
 * `router.invalidate()` reexecuta a proteção, que leva ao login com aviso e
 * volta depois; em rota pública, a pessoa fica onde está e recebe o aviso.
 */
setupSession({
  queryClient,
  onExpired: () => {
    const onPrivate = router.state.matches.some((m) => m.routeId.startsWith('/_authenticated'))
    if (!onPrivate) toast.warning('Sua sessão expirou. Entre de novo para ver seus dados.')
    void router.invalidate()
  },
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

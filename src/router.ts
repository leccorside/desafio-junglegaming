import { createRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

import { clearSessionEndReason, setupSession } from '@/features/auth/session'
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
 * O destino da navegação (ou do carregamento) é uma rota privada? Usa a
 * localização mais recente, e não as rotas já resolvidas: durante a navegação
 * (e no primeiro carregamento) elas ainda são as da tela de origem.
 */
function targetIsPrivate(): boolean {
  return router
    .matchRoutes(router.latestLocation)
    .some((match) => match.routeId.startsWith('/_authenticated'))
}

/**
 * Liga a sessão ao Axios e ao cache. Na expiração: se o destino é privado, a
 * proteção da rota leva ao login, que já mostra o aviso (sem toast duplicado);
 * se é público, a pessoa fica onde está e recebe o aviso por toast. O
 * `router.invalidate()` reexecuta a proteção da rota atual.
 */
setupSession({
  queryClient,
  onExpired: () => {
    if (!targetIsPrivate()) toast.warning('Sua sessão expirou. Entre de novo para ver seus dados.')
    void router.invalidate()
  },
})

/**
 * O motivo "expirou" vale até a pessoa sair das telas de entrada: quando uma
 * navegação termina em outra tela (fechou o modal, seguiu como visitante),
 * ele é esquecido, e a próxima ida a uma rota privada não repete o aviso.
 * Decide no fim da navegação, e não no desmonte da tela de login, porque a
 * proteção da rota e o `invalidate()` podem desmontar e remontar o login no meio.
 */
router.subscribe('onResolved', ({ toLocation }) => {
  if (toLocation.pathname !== '/login' && toLocation.pathname !== '/register') {
    clearSessionEndReason()
  }
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

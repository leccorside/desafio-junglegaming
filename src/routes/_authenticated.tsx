import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { ensureSession, getLocalSession, lastSessionEndReason } from '@/features/auth/session'

/**
 * Rotas privadas (checkout, pedidos, perfil, carteiras, lista de interesse).
 * Revalida a sessão na API a cada entrada. Sem sessão, leva ao login
 * guardando a URL para voltar depois, e avisa quando foi expiração.
 *
 * No preload (passar o mouse num link, `defaultPreload: 'intent'`) a checagem
 * é só local: nenhuma requisição por hover e nenhuma expiração sem clique.
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location, preload }) => {
    const session = preload ? getLocalSession() : await ensureSession({ revalidate: true })
    if (!session) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
          reason: !preload && lastSessionEndReason() === 'expired' ? 'expired' : undefined,
        },
      })
    }
    return { session }
  },
  component: Outlet,
})

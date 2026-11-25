import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { ensureSession, lastSessionEndReason } from '@/features/auth/session'

/**
 * Rotas privadas (checkout, pedidos, perfil, carteiras, lista de interesse).
 * Revalida a sessão na API a cada entrada. Sem sessão, leva ao login
 * guardando a URL para voltar depois, e avisa quando foi expiração.
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ location }) => {
    const session = await ensureSession({ revalidate: true })
    if (!session) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
          reason: lastSessionEndReason() === 'expired' ? 'expired' : undefined,
        },
      })
    }
    return { session }
  },
  component: Outlet,
})

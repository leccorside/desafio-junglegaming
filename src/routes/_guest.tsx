import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

import { safeRedirect } from '@/features/auth/redirect'
import { authSearchSchema } from '@/features/auth/search'
import { getSession } from '@/features/auth/session-store'

/**
 * Telas só para visitantes (entrar e criar conta). Quem já tem sessão volta
 * para o destino pedido ou para o início.
 */
export const Route = createFileRoute('/_guest')({
  validateSearch: authSearchSchema,
  beforeLoad: ({ search }) => {
    if (getSession()) throw redirect({ href: safeRedirect(search.redirect) })
  },
  component: Outlet,
})

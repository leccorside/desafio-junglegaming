import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

import { NotFoundPage } from '@/components/feedback/not-found-page'
import { RouteErrorPage } from '@/components/feedback/route-error-page'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { SiteFooter } from '@/components/layout/site-footer'
import { SiteHeader } from '@/components/layout/site-header'
import { SkipLink } from '@/components/layout/skip-link'
import { Toaster } from '@/components/ui/sonner'
import { ensureSession } from '@/features/auth/session'
import { PendingFavoriteRunner } from '@/features/favorites/components/pending-favorite-runner'
import { useOrderEvents } from '@/features/orders/use-order-events'
import { RealtimeStatusBanner } from '@/features/realtime/components/realtime-status-banner'
import { useRealtime } from '@/features/realtime/use-realtime'
import { env } from '@/lib/env'

export interface RouterContext {
  queryClient: QueryClient
}

// Devtools só no desenvolvimento, fora do bundle de produção.
const Devtools = import.meta.env.DEV
  ? lazy(async () => {
      const [{ TanStackRouterDevtools }, { ReactQueryDevtools }] = await Promise.all([
        import('@tanstack/react-router-devtools'),
        import('@tanstack/react-query-devtools'),
      ])
      return {
        default: () => (
          <>
            <TanStackRouterDevtools position="bottom-right" />
            {/* No canto de cima: o de baixo à esquerda é do painel de cenários. */}
            <ReactQueryDevtools buttonPosition="top-left" />
          </>
        ),
      }
    })
  : () => null

// Painel de cenários dos mocks: carregado sob demanda, só com os mocks ligados.
const MockPanel = env.enableMocks ? lazy(() => import('@/mocks/panel/mock-panel')) : () => null

export const Route = createRootRouteWithContext<RouterContext>()({
  // Valida a sessão salva uma vez por carregamento (depois fica em cache).
  // No preload (passar o mouse num link) não consulta a API.
  beforeLoad: async ({ preload }) => {
    if (!preload) await ensureSession()
  },
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
})

function RootLayout() {
  useRealtime()
  useOrderEvents()
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <SkipLink />
      <SiteHeader />
      <RealtimeStatusBanner />
      <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <SiteFooter />
      <MobileTabBar />
      <Toaster />
      <PendingFavoriteRunner />
      <Suspense>
        <MockPanel />
        <Devtools />
      </Suspense>
    </div>
  )
}

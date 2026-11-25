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
            <ReactQueryDevtools buttonPosition="bottom-left" />
          </>
        ),
      }
    })
  : () => null

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
})

function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col overflow-x-clip">
      <SkipLink />
      <SiteHeader />
      <main id="conteudo" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <SiteFooter />
      <MobileTabBar />
      <Toaster />
      <Suspense>
        <Devtools />
      </Suspense>
    </div>
  )
}

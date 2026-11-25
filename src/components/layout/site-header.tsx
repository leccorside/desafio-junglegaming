import { Link, useLocation } from '@tanstack/react-router'

import { CartIcon, LogoutIcon, SearchIcon } from '@/components/icons/figma-icons'
import { Button } from '@/components/ui/button'
import { UserMenu } from '@/features/auth/components/user-menu'
import { useSession } from '@/features/auth/session-store'

import { Logo } from './logo'
import { MobileMenu } from './mobile-menu'
import { mainNav } from './nav-config'
import { NavLink } from './nav-link'

/**
 * Header do Figma (frame "Header With Divider"): logo, navegação com o item
 * ativo sublinhado e ações (busca, carrinho, conta), com divisória fina abaixo.
 * Em telas menores que 1024 px a navegação vai para o menu lateral, e abaixo
 * de 768 px o header dá lugar à barra inferior (MobileTabBar), como no Figma.
 */
export function SiteHeader() {
  const session = useSession()
  const location = useLocation()

  return (
    <header className="hidden pt-6 md:block">
      <div className="mx-auto max-w-content px-6 xl:px-0">
        <div className="flex h-[45px] items-start justify-between gap-6">
          <div className="flex h-[34px] w-40 items-center">
            <Logo />
          </div>

          <nav aria-label="Principal" className="hidden h-full lg:block">
            <ul className="flex h-full gap-10">
              {mainNav.map((item) => (
                <li key={item.label} className="h-full">
                  <NavLink
                    item={item}
                    className="relative flex h-full items-start text-body-lg transition-colors hover:text-accent-foreground"
                    activeClassName="font-bold text-accent-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-primary"
                    inactiveClassName="text-foreground"
                  />
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex h-[35px] items-center gap-7">
            <Link
              to="/"
              hash="busca"
              aria-label="Buscar NFTs"
              className="text-foreground transition-colors hover:text-accent-foreground"
            >
              <SearchIcon size={20} />
            </Link>
            <Link
              to="/cart"
              aria-label="Carrinho"
              className="relative text-foreground transition-colors hover:text-accent-foreground"
            >
              <CartIcon size={24} />
              {/* O contador aparece no Passo 7, com os dados do carrinho. */}
            </Link>
            {session ? (
              <div className="hidden lg:block">
                <UserMenu user={session.user} />
              </div>
            ) : (
              <Button
                asChild
                className="hidden h-[35px] gap-1 rounded-md px-[9px] font-medium lg:inline-flex"
              >
                <Link to="/login" search={{ redirect: location.href }}>
                  <LogoutIcon size={20} />
                  Entrar
                </Link>
              </Button>
            )}
            <div className="lg:hidden">
              <MobileMenu />
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto h-px max-w-content bg-primary/30" />
    </header>
  )
}

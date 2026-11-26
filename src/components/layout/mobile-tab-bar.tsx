import { Link, type LinkProps } from '@tanstack/react-router'
import type { ComponentType } from 'react'

import tabBarBackground from '@/assets/tab-bar-background.svg'
import type { IconProps } from '@/components/icons/create-icon'
import { HeartIcon, HomeIcon, ScanIcon, ShopIcon, UserIcon } from '@/components/icons/figma-icons'

import { cartLabel } from '@/features/cart/cart-label'
import { CartBadge } from '@/features/cart/components/cart-badge'
import { useCartCount } from '@/features/cart/queries'

import { useBottomBar } from './bottom-bar'
import { MobileMenu } from './mobile-menu'

interface TabItem {
  label: string
  to: LinkProps['to']
  icon: ComponentType<IconProps>
}

const leftTabs: TabItem[] = [
  { label: 'Início', to: '/', icon: HomeIcon },
  { label: 'Lista de interesse', to: '/favorites', icon: HeartIcon },
]

const rightTabs: TabItem[] = [
  { label: 'Carrinho', to: '/cart', icon: ShopIcon },
  { label: 'Perfil', to: '/profile', icon: UserIcon },
]

/**
 * Barra de navegação inferior do Figma (frame "Tab Bar", 414 × 126 px),
 * só abaixo de 768 px. O botão central abre o menu lateral. Some nas telas de
 * entrada e cadastro, que no Figma mobile ocupam a tela inteira.
 * A forma curva vem do Figma (src/assets/tab-bar-background.svg), com a sombra
 * embutida numa margem de 30 px nas laterais e 40 px em cima.
 */
export function MobileTabBar() {
  const bottomBar = useBottomBar()
  const cartCount = useCartCount()
  // No detalhe do NFT e no carrinho, a barra de compra ou o resumo ocupam o lugar dela (Figma mobile).
  if (bottomBar !== 'tabs') return null

  const renderTab = ({ label, to, icon: Icon }: TabItem) => {
    const isCart = to === '/cart'
    return (
      <li key={label}>
        <Link
          to={to}
          aria-label={isCart ? cartLabel(cartCount) : label}
          activeOptions={{ exact: to === '/' }}
          className="relative flex size-11 items-center justify-center rounded-full transition-colors"
          // Cor só por estado: o Link concatena classes sem tailwind-merge (ver NavLink).
          activeProps={{ className: 'text-accent-foreground' }}
          inactiveProps={{ className: 'text-muted-foreground hover:text-foreground' }}
        >
          <Icon size={20} />
          {isCart ? <CartBadge count={cartCount} className="top-1 right-0.5" /> : null}
        </Link>
      </li>
    )
  }

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-40 h-[126px] md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <img
        src={tabBarBackground}
        alt=""
        aria-hidden="true"
        width={474}
        height={155}
        className="pointer-events-none absolute top-[-9px] left-[calc(-30/414*100%)] h-[155px] w-[calc(474/414*100%)] max-w-none select-none"
      />
      <div className="absolute top-0 left-1/2 -translate-x-1/2">
        <MobileMenu
          trigger={
            <button
              type="button"
              aria-label="Abrir menu"
              className="flex size-[65px] items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--primary-hover),var(--primary))] text-foreground shadow-lg transition-transform active:scale-95"
            >
              <ScanIcon size={27} />
            </button>
          }
        />
      </div>
      <ul className="absolute inset-x-0 top-[59px] grid grid-cols-[1fr_1fr_90px_1fr_1fr] items-center justify-items-center px-3">
        {leftTabs.map(renderTab)}
        <li aria-hidden="true" />
        {rightTabs.map(renderTab)}
      </ul>
    </nav>
  )
}

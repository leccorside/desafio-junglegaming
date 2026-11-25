import { useLocation } from '@tanstack/react-router'
import type { ComponentType } from 'react'

import tabBarBackground from '@/assets/tab-bar-background.svg'
import type { IconProps } from '@/components/icons/create-icon'
import { HeartIcon, HomeIcon, ScanIcon, ShopIcon, UserIcon } from '@/components/icons/figma-icons'
import { cn } from '@/lib/utils'

import { MobileMenu } from './mobile-menu'

interface TabItem {
  label: string
  href: string
  icon: ComponentType<IconProps>
}

const leftTabs: TabItem[] = [
  { label: 'Início', href: '/', icon: HomeIcon },
  { label: 'Favoritos', href: '/profile#favoritos', icon: HeartIcon },
]

const rightTabs: TabItem[] = [
  { label: 'Carrinho', href: '/cart', icon: ShopIcon },
  { label: 'Perfil', href: '/profile', icon: UserIcon },
]

/**
 * Barra de navegação inferior do Figma (frame "Tab Bar", 414 × 126 px),
 * só abaixo de 768 px. O botão central abre o menu lateral.
 * A forma curva vem do Figma (src/assets/tab-bar-background.svg), com a sombra
 * embutida numa margem de 30 px nas laterais e 40 px em cima.
 */
export function MobileTabBar() {
  const { pathname } = useLocation()

  const renderTab = ({ label, href, icon: Icon }: TabItem) => {
    const active = href === '/' ? pathname === '/' : pathname === href.split('#')[0]
    return (
      <li key={label}>
        <a
          href={href}
          aria-label={label}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'flex size-11 items-center justify-center rounded-full transition-colors',
            active ? 'text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon size={20} />
        </a>
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

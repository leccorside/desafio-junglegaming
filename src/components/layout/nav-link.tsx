import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import type { NavItem } from './nav-config'

interface NavLinkProps {
  item: NavItem
  className?: string
  /** Classes só da rota ativa (o Link também marca `aria-current="page"`). */
  activeClassName?: string
  /**
   * Classes só da rota inativa. Cor e peso que mudam com o estado vão aqui e em
   * `activeClassName`, nunca em `className`: o Link concatena as classes sem
   * tailwind-merge, e `text-foreground` + `text-accent-foreground` juntos
   * deixariam a cor por conta da ordem do CSS.
   */
  inactiveClassName?: string
  disabledClassName?: string
  onClick?: () => void
  children?: ReactNode
}

/**
 * Link de navegação tipado. Sem `to`, o item é uma área fora do escopo: vira
 * texto não interativo, com aviso para leitores de tela, em vez de link morto.
 */
export function NavLink({
  item,
  className,
  activeClassName,
  inactiveClassName,
  disabledClassName,
  onClick,
  children,
}: NavLinkProps) {
  if (!item.to) {
    return (
      <span
        aria-disabled="true"
        title="Indisponível nesta demonstração"
        className={cn(
          className,
          inactiveClassName,
          'cursor-not-allowed opacity-60',
          disabledClassName,
        )}
      >
        {children ?? item.label}
        <span className="sr-only"> (indisponível nesta demonstração)</span>
      </span>
    )
  }

  return (
    <Link
      to={item.to}
      hash={item.hash}
      search={item.search}
      onClick={onClick}
      // Itens exatos comparam também o hash: "Início" (/) não fica ativo junto
      // com "Mercado" (/#catalogo).
      activeOptions={{ exact: item.exact ?? false, includeHash: item.exact ?? false }}
      className={className}
      activeProps={{ className: activeClassName }}
      inactiveProps={{ className: inactiveClassName }}
    >
      {children ?? item.label}
    </Link>
  )
}

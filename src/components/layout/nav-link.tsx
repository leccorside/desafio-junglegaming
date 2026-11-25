import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import type { NavItem } from './nav-config'

interface NavLinkProps {
  item: NavItem
  className?: string
  disabledClassName?: string
  active?: boolean
  children?: ReactNode
}

/**
 * Link de navegação. Sem `href`, o item é uma área fora do escopo: vira texto
 * não interativo, com aviso para leitores de tela, em vez de um link morto.
 */
export function NavLink({ item, className, disabledClassName, active, children }: NavLinkProps) {
  if (!item.href) {
    return (
      <span
        aria-disabled="true"
        title="Indisponível nesta demonstração"
        className={cn(className, 'cursor-not-allowed opacity-60', disabledClassName)}
      >
        {children ?? item.label}
        <span className="sr-only"> (indisponível nesta demonstração)</span>
      </span>
    )
  }

  return (
    <a href={item.href} aria-current={active ? 'page' : undefined} className={className}>
      {children ?? item.label}
    </a>
  )
}

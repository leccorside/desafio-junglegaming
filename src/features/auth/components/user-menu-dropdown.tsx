import { Link } from '@tanstack/react-router'
import { useRef } from 'react'

import type { User } from '@/api/contracts'
import { LogoutIcon } from '@/components/icons/figma-icons'
import { accountNav } from '@/components/layout/nav-config'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Activation } from '@/lib/lazy-module'

import { useSignOut } from '../use-sign-out'
import { UserMenuTriggerContent, userMenuTriggerClass } from './user-avatar'

/**
 * Menu da conta no header: atalhos privados e "Sair". Carregado sob demanda
 * por `UserMenu` (Radix Menu, Popper e floating-ui fora do bundle inicial).
 * `activation` monta o menu já aberto, como se o gatilho tivesse sido usado.
 */
export function UserMenuDropdown({
  user,
  activation,
}: {
  user: User
  activation: Activation | null
}) {
  const { signOut, pending } = useSignOut()
  // Só a abertura que montou o menu; as seguintes seguem o Radix.
  const keyboardOnMount = useRef(Boolean(activation?.keyboard))

  return (
    <DropdownMenu defaultOpen={Boolean(activation)}>
      <DropdownMenuTrigger className={userMenuTriggerClass}>
        <UserMenuTriggerContent user={user} />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-60 border-border-soft bg-popover"
        // Aberto pelo teclado antes de o módulo chegar: o Radix não viu a
        // tecla e foca o painel; como no menu já carregado, o foco vai ao 1º
        // item, no quadro seguinte ao foco automático do Radix.
        ref={(content: HTMLDivElement | null) => {
          if (!content || !keyboardOnMount.current) return
          keyboardOnMount.current = false
          requestAnimationFrame(() =>
            content.querySelector<HTMLElement>('[role="menuitem"]')?.focus(),
          )
        }}
      >
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-body-sm font-bold text-foreground">
            {user.displayName}
          </span>
          <span className="truncate text-caption font-normal text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-border" />
        {accountNav.map((item) => (
          <DropdownMenuItem key={item.label} asChild>
            <Link to={item.to!} className="cursor-pointer text-body-sm">
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem
          disabled={pending}
          onSelect={() => void signOut()}
          className="cursor-pointer text-body-sm"
        >
          <LogoutIcon size={18} />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

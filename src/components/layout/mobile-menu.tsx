import { Link, useLocation } from '@tanstack/react-router'
import { MenuIcon } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'

import { LogoutIcon } from '@/components/icons/figma-icons'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { UserAvatar } from '@/features/auth/components/user-menu'
import { useSignOut } from '@/features/auth/use-sign-out'
import { useSession } from '@/features/auth/session-store'

import { Logo } from './logo'
import { accountNav, mainNav } from './nav-config'
import { NavLink } from './nav-link'

interface MobileMenuProps {
  /** Gatilho próprio (o botão central da barra inferior usa este caminho). */
  trigger?: ReactNode
}

/**
 * Menu lateral para telas menores que 1024 px. O Radix prende o foco dentro do
 * painel, fecha com Esc e devolve o foco ao botão que o abriu.
 */
export function MobileMenu({ trigger }: MobileMenuProps) {
  const [open, setOpen] = useState(false)
  const session = useSession()
  const location = useLocation()
  const { signOut, pending } = useSignOut()
  const close = () => setOpen(false)
  // Ao sair, o foco vai para o título da tela (useSignOut); o menu não pode
  // devolvê-lo ao botão que o abriu quando termina de fechar.
  const signingOut = useRef(false)
  const linkClass = 'rounded-md px-3 py-3 text-body-lg hover:bg-accent'

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon-sm" aria-label="Abrir menu">
            <MenuIcon />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent
        side="left"
        className="w-72 border-border bg-card p-0"
        onCloseAutoFocus={(event) => {
          if (!signingOut.current) return
          signingOut.current = false
          event.preventDefault()
        }}
      >
        <SheetHeader className="border-b border-border p-6">
          <SheetTitle asChild>
            <div onClick={close}>
              <Logo />
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Navegação principal do marketplace
          </SheetDescription>
        </SheetHeader>
        <nav aria-label="Menu" className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
          {mainNav.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              onClick={close}
              className={linkClass}
              activeClassName="font-bold text-accent-foreground"
              inactiveClassName="text-foreground"
            />
          ))}
          {session ? (
            <>
              <div className="mt-4 mb-1 flex items-center gap-3 border-t border-border px-3 pt-5">
                <UserAvatar user={session.user} size={32} />
                <span className="truncate text-body-sm font-bold">{session.user.displayName}</span>
              </div>
              {accountNav.map((item) => (
                <NavLink
                  key={item.label}
                  item={item}
                  onClick={close}
                  className={linkClass}
                  activeClassName="font-bold text-accent-foreground"
                  inactiveClassName="text-foreground"
                />
              ))}
            </>
          ) : null}
        </nav>
        <div className="border-t border-border p-4">
          {session ? (
            <Button
              size="lg"
              variant="secondary"
              className="w-full"
              disabled={pending}
              onClick={() => {
                signingOut.current = true
                close()
                void signOut()
              }}
            >
              <LogoutIcon size={20} />
              Sair
            </Button>
          ) : (
            <Button asChild size="lg" className="w-full">
              <Link to="/login" search={{ redirect: location.href }} onClick={close}>
                <LogoutIcon size={20} />
                Entrar
              </Link>
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

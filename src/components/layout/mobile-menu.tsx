import { MenuIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'

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

import { Logo } from './logo'
import { mainNav } from './nav-config'
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon-sm" aria-label="Abrir menu">
            <MenuIcon />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-border bg-card p-0">
        <SheetHeader className="border-b border-border p-6">
          <SheetTitle asChild>
            <div>
              <Logo />
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Navegação principal do marketplace
          </SheetDescription>
        </SheetHeader>
        <nav aria-label="Menu" className="flex flex-1 flex-col gap-1 p-4">
          {mainNav.map((item) => (
            <NavLink
              key={item.label}
              item={item}
              className="rounded-md px-3 py-3 text-body-lg text-foreground hover:bg-accent"
            />
          ))}
        </nav>
        <div className="border-t border-border p-4">
          <Button asChild size="lg" className="w-full">
            <a href="/login">
              <LogoutIcon size={20} />
              Entrar
            </a>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

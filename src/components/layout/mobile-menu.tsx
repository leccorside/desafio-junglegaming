import { MenuIcon } from 'lucide-react'
import { cloneElement, isValidElement, type MouseEvent, type ReactElement } from 'react'

import { Button } from '@/components/ui/button'
import { lazyModule, useLazyMenu } from '@/lib/lazy-module'

const panel = lazyModule(() => import('./mobile-menu-panel'))

type TriggerProps = {
  onClick?: (event: MouseEvent<HTMLElement>) => void
  onPointerEnter?: () => void
  onFocus?: () => void
  'aria-haspopup'?: 'dialog'
  'aria-expanded'?: boolean
  'aria-busy'?: boolean
}

interface MobileMenuProps {
  /** Gatilho próprio (o botão central da barra inferior usa este caminho). */
  trigger?: ReactElement<TriggerProps>
}

/**
 * Menu lateral para telas menores que 1024 px. Até o primeiro uso, só o
 * botão: o painel (`MobileMenuPanel`, com o Sheet do Radix) baixa quando o
 * ponteiro passa ou o foco chega ao botão, e monta já aberto quando ele é
 * acionado. A partir daí o Radix cuida do foco e o devolve a este botão.
 */
export function MobileMenu({ trigger }: MobileMenuProps) {
  const menu = useLazyMenu(panel)
  const element =
    trigger ??
    ((
      <Button variant="ghost" size="icon-sm" aria-label="Abrir menu">
        <MenuIcon />
      </Button>
    ) as ReactElement<TriggerProps>)

  if (menu.loaded) {
    return <menu.loaded.MobileMenuPanel trigger={element} defaultOpen={Boolean(menu.activation)} />
  }

  if (!isValidElement(element)) return null
  return cloneElement(element, {
    'aria-haspopup': 'dialog',
    'aria-expanded': false,
    'aria-busy': menu.activation ? true : undefined,
    onPointerEnter: menu.prefetch,
    onFocus: menu.prefetch,
    onClick: (event: MouseEvent<HTMLElement>) => {
      element.props.onClick?.(event)
      menu.activate(event.detail === 0)
    },
  })
}

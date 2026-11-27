import type { User } from '@/api/contracts'
import { lazyModule, useLazyMenu } from '@/lib/lazy-module'

import { UserMenuTriggerContent, userMenuTriggerClass } from './user-avatar'

const dropdown = lazyModule(() => import('./user-menu-dropdown'))

/**
 * Menu da conta no header. Até o primeiro uso, só o botão: o menu (Radix Menu,
 * Popper e floating-ui) baixa quando o ponteiro passa ou o foco chega ao
 * botão, e monta já aberto quando ele é acionado (clique, Enter, Espaço ou
 * seta para baixo, como no gatilho do Radix).
 */
export function UserMenu({ user }: { user: User }) {
  const menu = useLazyMenu(dropdown)

  if (menu.loaded) return <menu.loaded.UserMenuDropdown user={user} activation={menu.activation} />

  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={false}
      aria-busy={menu.activation ? true : undefined}
      className={userMenuTriggerClass}
      onPointerEnter={menu.prefetch}
      onFocus={menu.prefetch}
      // `detail === 0`: clique gerado pelo teclado (Enter ou Espaço).
      onClick={(event) => menu.activate(event.detail === 0)}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowDown') return
        event.preventDefault()
        menu.activate(true)
      }}
    >
      <UserMenuTriggerContent user={user} />
    </button>
  )
}

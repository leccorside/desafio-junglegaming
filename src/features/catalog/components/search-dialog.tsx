import { SearchIcon } from '@/components/icons/figma-icons'
import { lazyModule, useLazyMenu } from '@/lib/lazy-module'

const panel = lazyModule(() => import('./search-dialog-panel'))

export const searchTriggerClass =
  'cursor-pointer text-foreground transition-colors hover:text-accent-foreground'

/**
 * Busca do header. Até o primeiro uso, só a lupa: o diálogo (Dialog do Radix)
 * baixa quando o ponteiro passa ou o foco chega a ela, e monta já aberto
 * quando ela é acionada. A partir daí o Radix cuida do foco (vai ao campo ao
 * abrir e volta à lupa ao fechar).
 */
export function SearchDialog() {
  const menu = useLazyMenu(panel)

  if (menu.loaded) return <menu.loaded.SearchDialogPanel defaultOpen={Boolean(menu.activation)} />

  return (
    <button
      type="button"
      aria-label="Buscar NFTs"
      aria-haspopup="dialog"
      aria-expanded={false}
      aria-busy={menu.activation ? true : undefined}
      className={searchTriggerClass}
      onPointerEnter={menu.prefetch}
      onFocus={menu.prefetch}
      onClick={(event) => menu.activate(event.detail === 0)}
    >
      <SearchIcon size={20} />
    </button>
  )
}

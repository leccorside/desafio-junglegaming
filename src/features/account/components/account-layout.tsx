import { Link, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import {
  ActivityIcon,
  ArrowLeftIcon,
  DangerIcon,
  DownloadIcon,
  HeartIcon,
  LocationIcon,
  LogoutIcon,
  ShopIcon,
  UserIcon,
} from '@/components/icons/figma-icons'
import { UnavailableAction } from '@/components/layout/unavailable-action'
import { useSignOut } from '@/features/auth/use-sign-out'
import { cn } from '@/lib/utils'

type Section = 'profile' | 'wallets'

interface SidebarItem {
  label: string
  icon: typeof UserIcon
  to?: '/profile' | '/wallets' | '/favorites'
  section?: Section
}

/** Menu "Meu perfil" do Figma. Sem `to`: fora do escopo da demonstração. */
const SIDEBAR_ITEMS: SidebarItem[] = [
  { label: 'Dados do perfil', icon: UserIcon, to: '/profile', section: 'profile' },
  { label: 'Carteiras', icon: LocationIcon, to: '/wallets', section: 'wallets' },
  { label: 'Atividade', icon: ShopIcon },
  { label: 'Lista de interesse', icon: HeartIcon, to: '/favorites' },
  { label: 'Ofertas', icon: ActivityIcon },
  { label: 'Arquivos baixados', icon: DownloadIcon },
  { label: 'Suporte', icon: DangerIcon },
]

const itemClass =
  'flex h-[45px] items-center gap-3 border border-transparent px-4 text-[15px] text-accent-foreground'

/**
 * Menu lateral do desktop (frame "Account Sidebar": 310 px, `Surface Card`).
 * A seção atual ganha a borda `Primary` e o ícone em `Primary`.
 */
function AccountSidebar({ current }: { current: Section }) {
  const { signOut, pending } = useSignOut()
  return (
    <nav
      aria-label="Minha conta"
      className="hidden w-[310px] shrink-0 flex-col self-start bg-card py-2 md:flex"
    >
      <p className="p-2.5 text-[18px] leading-4 font-bold text-foreground">Meu perfil</p>
      <ul className="flex flex-col">
        {SIDEBAR_ITEMS.map(({ label, icon: Icon, to, section }) => {
          const active = section === current
          return (
            <li key={label}>
              {to ? (
                <Link
                  to={to}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    itemClass,
                    'transition-colors hover:bg-accent',
                    active && 'border-primary',
                  )}
                >
                  <Icon size={18} className={active ? 'text-primary' : 'text-secondary'} />
                  {label}
                </Link>
              ) : (
                <UnavailableAction what={label} className={cn(itemClass, 'w-full')}>
                  <Icon size={18} className="text-secondary" />
                  {label}
                </UnavailableAction>
              )}
            </li>
          )
        })}
      </ul>
      <div className="mt-2 border-t border-primary/30">
        <button
          type="button"
          disabled={pending}
          onClick={() => void signOut()}
          className="flex h-10 w-full cursor-pointer items-center gap-2 px-4 text-[15px] font-bold text-accent-foreground transition-colors hover:bg-accent disabled:cursor-wait"
        >
          <LogoutIcon size={20} className="text-primary" />
          Sair
        </button>
      </div>
    </nav>
  )
}

/**
 * Mobile (sem frame no Figma): voltar e título como no carrinho, e as seções
 * da conta em abas roláveis. "Sair" e as áreas fora do escopo ficam no menu
 * lateral, para a tela começar direto no formulário.
 */
function AccountMobileHeader({ current, title }: { current: Section; title: string }) {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const navigate = useNavigate()
  const tabs = SIDEBAR_ITEMS.filter((item) => item.to)
  return (
    <div className="flex flex-col gap-4 md:hidden">
      <div className="relative flex h-[44px] items-center justify-center">
        <button
          type="button"
          onClick={() => (canGoBack ? router.history.back() : void navigate({ to: '/' }))}
          aria-label="Voltar"
          className="absolute left-0 flex size-[35px] cursor-pointer items-center justify-center rounded-full border border-border bg-popover text-muted-foreground"
        >
          <ArrowLeftIcon size={20} />
        </button>
        <p aria-hidden="true" className="text-title-sm font-bold text-foreground">
          {title}
        </p>
      </div>
      <nav aria-label="Minha conta" className="-mx-4 overflow-x-auto px-4">
        <ul className="flex w-max gap-2">
          {tabs.map(({ label, to, section }) => {
            const active = section === current
            return (
              <li key={label}>
                <Link
                  to={to!}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-10 items-center rounded-full border px-4 text-body-sm whitespace-nowrap',
                    active
                      ? 'border-primary font-bold text-accent-foreground'
                      : 'border-border text-foreground',
                  )}
                >
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

/** Moldura das telas da conta: menu lateral no desktop, abas no mobile. */
export function AccountLayout({
  current,
  title,
  children,
}: {
  current: Section
  /** Título curto do mobile ("Meu perfil", "Carteiras"). */
  title: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto flex max-w-content flex-col gap-6 px-4 pt-6 pb-12 md:flex-row md:gap-7 md:px-6 md:pt-8 xl:px-0">
      <AccountMobileHeader current={current} title={title} />
      <AccountSidebar current={current} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

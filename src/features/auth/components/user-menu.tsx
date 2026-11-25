import { Link } from '@tanstack/react-router'

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

import { initials, useSignOut } from '../use-sign-out'

export function UserAvatar({ user, size = 35 }: { user: User; size?: number }) {
  return user.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt=""
      width={size}
      height={size}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex items-center justify-center rounded-full bg-primary text-body-sm font-bold text-primary-foreground"
      style={{ width: size, height: size }}
    >
      {initials(user.displayName)}
    </span>
  )
}

/** Menu da conta no header: atalhos privados e "Sair". */
export function UserMenu({ user }: { user: User }) {
  const { signOut, pending } = useSignOut()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Conta de ${user.displayName}`}
        className="flex items-center gap-2 rounded-full text-body-sm text-foreground transition-colors hover:text-accent-foreground"
      >
        <UserAvatar user={user} />
        <span className="hidden max-w-[140px] truncate xl:inline">{user.displayName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 border-border-soft bg-popover">
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

import type { User } from '@/api/contracts'

import { initials } from '../use-sign-out'

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

export const userMenuTriggerClass =
  'flex items-center gap-2 rounded-full text-body-sm text-foreground transition-colors hover:text-accent-foreground'

/**
 * Conteúdo do botão "Conta de Ana Ribeiro", o mesmo no gatilho leve e no do
 * Radix: o nome visível (xl) faz parte do nome acessível, e as iniciais do
 * avatar ficam fora (aria-hidden).
 */
export function UserMenuTriggerContent({ user }: { user: User }) {
  return (
    <>
      <span aria-hidden="true" className="contents">
        <UserAvatar user={user} />
      </span>
      <span className="sr-only">Conta de </span>
      <span className="sr-only xl:not-sr-only xl:max-w-[140px] xl:truncate">
        {user.displayName}
      </span>
    </>
  )
}

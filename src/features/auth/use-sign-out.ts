import { useNavigate, useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'

import { useLogoutMutation } from './hooks'

/** Sair da conta. Usado pelo menu do header e pelo menu lateral. */
export function useSignOut() {
  const logout = useLogoutMutation()
  const navigate = useNavigate()
  const router = useRouter()

  return {
    pending: logout.isPending,
    signOut: async () => {
      await logout.mutateAsync()
      toast.success('Você saiu da sua conta.')
      // Em rota privada, volta ao início; nas públicas, só atualiza.
      const onPrivate = router.state.matches.some((m) => m.routeId.startsWith('/_authenticated'))
      if (onPrivate) await navigate({ to: '/' })
      else await router.invalidate()
    },
  }
}

/** Iniciais do nome de exibição, para o avatar sem foto. */
export function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

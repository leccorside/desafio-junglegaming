import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type {
  ChangePasswordRequest,
  CreateWalletRequest,
  Profile,
  UpdateProfileRequest,
  UpdateWalletRequest,
  Wallet,
  WalletsResponse,
} from '@/api/contracts'
import { SENSITIVE_MUTATION } from '@/features/auth/hooks'
import { sessionKeys } from '@/features/auth/keys'
import { getSession, updateSessionUser, useSession } from '@/features/auth/session-store'

import { profileApi, walletsApi } from './api'

/** Chaves com o ID do usuário: duas contas nunca dividem cache (STATE_MANAGEMENT.md). */
export const profileKeys = {
  all: ['profile'] as const,
  me: (userId: string) => ['profile', userId] as const,
}

export const walletKeys = {
  all: (userId: string) => ['wallets', userId] as const,
}

const FIVE_MINUTES = 5 * 60 * 1000

export const profileQuery = (userId: string) =>
  queryOptions({
    queryKey: profileKeys.me(userId),
    queryFn: ({ signal }) => profileApi.get(signal),
    staleTime: FIVE_MINUTES,
  })

export const walletsQuery = (userId: string) =>
  queryOptions({
    queryKey: walletKeys.all(userId),
    queryFn: ({ signal }) => walletsApi.list(signal),
    staleTime: FIVE_MINUTES,
  })

/** Rotas privadas: a sessão existe (o layout autenticado garante). */
function useUserId(): string {
  const session = useSession()
  return session?.user.id ?? 'anonymous'
}

export function useProfile() {
  return useQuery(profileQuery(useUserId()))
}

export function useWallets() {
  return useQuery(walletsQuery(useUserId()))
}

/**
 * Grava o perfil devolvido pela API no cache e no usuário da sessão (o header
 * mostra nome e avatar). Toda mutation de perfil passa por aqui.
 */
function useWriteProfile() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return (profile: Profile) => {
    queryClient.setQueryData(profileKeys.me(userId), profile)
    updateSessionUser(userId, {
      displayName: profile.displayName,
      username: profile.username,
      avatarUrl: profile.avatarUrl,
    })
    // A raiz confere a sessão pelo cache (`ensureSession`): sem isto, a próxima
    // navegação gravaria de volta o nome antigo guardado ali.
    const session = getSession()
    if (session?.user.id === userId) {
      queryClient.setQueryData(sessionKeys.current(session.token), session)
    }
  }
}

export function useUpdateProfile() {
  const write = useWriteProfile()
  return useMutation({
    mutationFn: (body: UpdateProfileRequest) => profileApi.update(body),
    onSuccess: write,
  })
}

export function useUploadAvatar() {
  const write = useWriteProfile()
  return useMutation({
    mutationFn: (file: File) => profileApi.uploadAvatar(file),
    onSuccess: write,
  })
}

export function useRemoveAvatar() {
  const write = useWriteProfile()
  return useMutation({ mutationFn: () => profileApi.removeAvatar(), onSuccess: write })
}

export function useChangePassword() {
  return useMutation({
    // Leva a senha atual e a nova: sai do cache assim que o formulário desmonta.
    ...SENSITIVE_MUTATION,
    mutationFn: (body: ChangePasswordRequest) => profileApi.changePassword(body),
  })
}

/** Troca a carteira salva na lista em cache (mesmo papel), sem nova busca. */
function useWriteWallet() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return (wallet: Wallet) =>
    queryClient.setQueryData<WalletsResponse>(walletKeys.all(userId), (current) => {
      const others = (current?.items ?? []).filter((w) => w.id !== wallet.id)
      const items = [...others, wallet].sort((a, b) =>
        a.role === b.role ? 0 : a.role === 'primary' ? -1 : 1,
      )
      return { items }
    })
}

export function useCreateWallet() {
  const write = useWriteWallet()
  return useMutation({
    mutationFn: (body: CreateWalletRequest) => walletsApi.create(body),
    onSuccess: write,
  })
}

export function useUpdateWallet() {
  const write = useWriteWallet()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateWalletRequest }) =>
      walletsApi.update(id, body),
    onSuccess: write,
  })
}

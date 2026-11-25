import {
  AVATAR_MAX_BYTES,
  AVATAR_MIME_TYPES,
  type ChangePasswordRequest,
  type CreateWalletRequest,
  type Profile,
  type UpdateProfileRequest,
  type UpdateWalletRequest,
  type Wallet,
  type WalletConnection,
} from '@/api/contracts'

import { getDb, mutate, nextId } from '../db/store'
import type { DbUser, DbWallet } from '../db/state'
import { fail } from '../errors'
import { consumeOnce, isActive } from '../scenarios'
import { hashPassword } from './auth'

/* -------------------------------------------------------------------------- */
/* Perfil                                                                     */
/* -------------------------------------------------------------------------- */

export function toProfile(user: DbUser): Profile {
  return {
    id: user.id,
    displayName: user.displayName,
    username: user.username,
    email: user.email,
    ensName: user.ensName,
    avatarUrl: user.avatarUrl,
    updatedAt: user.updatedAt,
  }
}

function findUser(userId: string): DbUser {
  return getDb().users.find((u) => u.id === userId) ?? fail('UNAUTHENTICATED')
}

export function getProfile(userId: string): Profile {
  return toProfile(findUser(userId))
}

export function updateProfile(userId: string, body: UpdateProfileRequest): Profile {
  if (isActive('validation-error')) {
    fail('VALIDATION_ERROR', { fields: { displayName: 'Este nome de exibição não é permitido.' } })
  }
  const taken = getDb().users.some(
    (u) => u.id !== userId && u.username.toLowerCase() === body.username.toLowerCase(),
  )
  if (taken)
    fail('USERNAME_TAKEN', { fields: { username: 'Este nome de usuário já está em uso.' } })

  return mutate((state) => {
    const user = state.users.find((u) => u.id === userId)!
    Object.assign(user, body, { updatedAt: new Date().toISOString() })
    return toProfile(user)
  })
}

/** Guarda o avatar como data URL (não há servidor de arquivos na simulação). */
export async function updateAvatar(userId: string, file: File | null): Promise<Profile> {
  if (!file) fail('VALIDATION_ERROR', { fields: { avatar: 'Escolha uma imagem.' } })
  if (!(AVATAR_MIME_TYPES as readonly string[]).includes(file.type)) {
    fail('VALIDATION_ERROR', { fields: { avatar: 'Use uma imagem PNG, JPEG ou WebP.' } })
  }
  if (file.size > AVATAR_MAX_BYTES) {
    fail('VALIDATION_ERROR', { fields: { avatar: 'A imagem pode ter no máximo 2 MB.' } })
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const dataUrl = `data:${file.type};base64,${btoa(binary)}`

  return mutate((state) => {
    const user = state.users.find((u) => u.id === userId)!
    user.avatarUrl = dataUrl
    user.updatedAt = new Date().toISOString()
    return toProfile(user)
  })
}

export function removeAvatar(userId: string): Profile {
  return mutate((state) => {
    const user = state.users.find((u) => u.id === userId)!
    user.avatarUrl = null
    user.updatedAt = new Date().toISOString()
    return toProfile(user)
  })
}

export async function changePassword(userId: string, body: ChangePasswordRequest): Promise<null> {
  const user = findUser(userId)
  const current = await hashPassword(user.passwordSalt, body.currentPassword)
  if (current !== user.passwordHash) {
    fail('INVALID_PASSWORD', { fields: { currentPassword: 'A senha atual está incorreta.' } })
  }
  const next = await hashPassword(user.passwordSalt, body.newPassword)
  mutate((state) => {
    const target = state.users.find((u) => u.id === userId)!
    target.passwordHash = next
    target.updatedAt = new Date().toISOString()
  })
  return null
}

/* -------------------------------------------------------------------------- */
/* Carteiras                                                                  */
/* -------------------------------------------------------------------------- */

export function toWallet(wallet: DbWallet): Wallet {
  const { userId: _userId, ...rest } = wallet
  return rest
}

function ownWallet(userId: string, walletId: string): DbWallet {
  if (isActive('forbidden')) fail('FORBIDDEN')
  const wallet = getDb().wallets.find((w) => w.id === walletId)
  if (!wallet) fail('NOT_FOUND', { message: 'Carteira não encontrada.' })
  if (wallet.userId !== userId) fail('FORBIDDEN')
  return wallet
}

export function listWallets(userId: string): { items: Wallet[] } {
  if (isActive('forbidden')) fail('FORBIDDEN')
  const items = getDb()
    .wallets.filter((w) => w.userId === userId)
    .sort((a, b) => (a.role === b.role ? 0 : a.role === 'primary' ? -1 : 1))
    .map(toWallet)
  return { items }
}

export function createWallet(userId: string, body: CreateWalletRequest): Wallet {
  if (isActive('validation-error')) {
    fail('VALIDATION_ERROR', {
      fields: { address: 'Este endereço não pôde ser verificado na rede.' },
    })
  }
  const exists = getDb().wallets.some((w) => w.userId === userId && w.role === body.role)
  if (exists) {
    fail('VALIDATION_ERROR', {
      fields: {
        role:
          body.role === 'primary'
            ? 'Você já tem uma carteira principal. Edite a existente.'
            : 'Você já tem uma carteira secundária. Edite a existente.',
      },
    })
  }

  return mutate((state) => {
    const wallet: DbWallet = {
      id: nextId(state, 'wallet', 'wallet'),
      userId,
      role: body.role,
      label: body.label,
      network: body.network,
      type: body.type,
      address: body.address,
      ensName: body.ensName ?? null,
      updatedAt: new Date().toISOString(),
    }
    state.wallets.push(wallet)
    return toWallet(wallet)
  })
}

export function updateWallet(userId: string, walletId: string, body: UpdateWalletRequest): Wallet {
  ownWallet(userId, walletId)
  if (isActive('validation-error')) {
    fail('VALIDATION_ERROR', {
      fields: { address: 'Este endereço não pôde ser verificado na rede.' },
    })
  }
  return mutate((state) => {
    const wallet = state.wallets.find((w) => w.id === walletId)!
    Object.assign(wallet, {
      ...body,
      ensName: body.ensName ?? null,
      updatedAt: new Date().toISOString(),
    })
    return toWallet(wallet)
  })
}

/** Conexão simulada da carteira no pagamento. */
export function connectWallet(userId: string, walletId: string): WalletConnection {
  const wallet = ownWallet(userId, walletId)
  if (consumeOnce('wallet-rejected')) fail('WALLET_REJECTED')
  return {
    walletId: wallet.id,
    network: wallet.network,
    address: wallet.address,
    connectedAt: new Date().toISOString(),
  }
}

export type { WalletConnection }

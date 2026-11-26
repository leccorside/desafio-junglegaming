import { describe, expect, it } from 'vitest'

import type { Profile } from '@/api/contracts'

import {
  profileChanged,
  profileDefaults,
  profileFormSchema,
  toProfileRequest,
  wantsPasswordChange,
} from './profile-form'
import { EMPTY_WALLET, shortAddress, toWalletRequest, walletFormSchema } from './wallet-form'

const ana: Profile = {
  id: 'user-ana',
  displayName: 'Ana Ribeiro',
  username: 'ana.colecionadora',
  email: 'ana@example.com',
  ensName: 'ana-coleciona',
  avatarUrl: null,
  updatedAt: new Date(0).toISOString(),
}

const messages = (result: {
  success: boolean
  error?: { issues: { path: PropertyKey[]; message: string }[] }
}) => {
  // Primeira mensagem de cada campo: é a que o formulário mostra.
  const out: Record<string, string> = {}
  for (const issue of result.error?.issues ?? []) out[String(issue.path[0])] ??= issue.message
  return out
}

describe('formulário do perfil', () => {
  it('sem campos de senha preenchidos, só valida os dados', () => {
    const values = profileDefaults(ana)
    expect(wantsPasswordChange(values)).toBe(false)
    expect(profileFormSchema.safeParse(values).success).toBe(true)
    expect(profileChanged(ana, values)).toBe(false)
  })

  it('ENS vazio vira null e com maiúsculas vira minúsculas; mudança detectada', () => {
    const values = { ...profileDefaults(ana), ensName: '' }
    expect(toProfileRequest(values).ensName).toBeNull()
    expect(profileChanged(ana, values)).toBe(true)
    expect(toProfileRequest({ ...values, ensName: ' Ana-Arte ' }).ensName).toBe('ana-arte')
  })

  it('senha: atual obrigatória, regras da nova, confirmação e nova diferente da atual', () => {
    const base = profileDefaults(ana)
    expect(messages(profileFormSchema.safeParse({ ...base, newPassword: 'curta' }))).toMatchObject({
      currentPassword: 'Informe a senha atual.',
      newPassword: 'A senha precisa ter pelo menos 8 caracteres.',
    })
    expect(
      messages(
        profileFormSchema.safeParse({
          ...base,
          currentPassword: 'Senha@123',
          newPassword: 'Nova@Senha1',
          confirmPassword: 'Outra@1',
        }),
      ),
    ).toMatchObject({ confirmPassword: 'As senhas não conferem.' })
    expect(
      messages(
        profileFormSchema.safeParse({
          ...base,
          currentPassword: 'Senha@123',
          newPassword: 'Senha@123',
          confirmPassword: 'Senha@123',
        }),
      ),
    ).toMatchObject({ newPassword: 'A nova senha precisa ser diferente da atual.' })
  })
})

describe('formulário da carteira', () => {
  it('vazio: um erro por campo obrigatório', () => {
    expect(messages(walletFormSchema.safeParse(EMPTY_WALLET))).toEqual({
      label: 'Informe um apelido.',
      network: 'Selecione uma rede.',
      type: 'Selecione uma carteira.',
      address: 'Informe o endereço da carteira.',
    })
  })

  it('endereço conferido pela rede escolhida', () => {
    const evm = '0x7A42c1F0b9E35d6A8e2B4c7D90a1F3e5B8d219E8'
    const wallet = {
      label: 'Minha',
      network: 'solana',
      type: 'metamask',
      address: evm,
      ensName: '',
    } as const
    expect(messages(walletFormSchema.safeParse(wallet))).toEqual({
      address: 'Use um endereço Solana em base58, com 32 a 44 caracteres.',
    })
    expect(walletFormSchema.safeParse({ ...wallet, network: 'polygon' }).success).toBe(true)
    expect(toWalletRequest({ ...wallet, network: 'polygon', ensName: ' Ana ' })).toMatchObject({
      ensName: 'ana',
      address: evm,
    })
  })

  it('endereço abreviado no resumo', () => {
    expect(shortAddress('0x3F9e21A4c6B8d0E2f4A6c8E0b2D4f6A8c0E2b4D6')).toBe('0x3F9e…b4D6')
  })
})

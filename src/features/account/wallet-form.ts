import { z } from 'zod'

import {
  networkSchema,
  updateWalletRequestSchema,
  walletTypeSchema,
  type Network,
  type UpdateWalletRequest,
  type Wallet,
  type WalletType,
} from '@/api/contracts'

/** Campos da carteira no formulário (selects começam vazios: "Selecione..."). */
export interface WalletFormValues {
  label: string
  network: Network | ''
  type: WalletType | ''
  address: string
  /** Sem o ".eth"; vazio = sem ENS. */
  ensName: string
}

export const EMPTY_WALLET: WalletFormValues = {
  label: '',
  network: '',
  type: '',
  address: '',
  ensName: '',
}

export function walletDefaults(wallet: Wallet | undefined): WalletFormValues {
  if (!wallet) return EMPTY_WALLET
  return {
    label: wallet.label,
    network: wallet.network,
    type: wallet.type,
    address: wallet.address,
    ensName: wallet.ensName ?? '',
  }
}

/** Corpo do POST/PATCH (sem o papel). Selects vazios viram erro antes daqui. */
export function toWalletRequest(values: WalletFormValues): UpdateWalletRequest {
  const ens = values.ensName.trim()
  return {
    label: values.label.trim(),
    network: values.network as Network,
    type: values.type as WalletType,
    address: values.address.trim(),
    ensName: ens ? ens.toLowerCase() : null,
  }
}

/**
 * Validação com as regras do contrato (`updateWalletRequestSchema`: apelido,
 * endereço conforme a rede, ENS), mais as mensagens dos selects vazios.
 */
export const walletFormSchema = z
  .object({
    label: z.string(),
    network: z.string(),
    type: z.string(),
    address: z.string(),
    ensName: z.string(),
  })
  .superRefine((values, ctx) => {
    const networkOk = networkSchema.safeParse(values.network).success
    const typeOk = walletTypeSchema.safeParse(values.type).success
    const addressEmpty = !values.address.trim()
    if (!networkOk) {
      ctx.addIssue({ code: 'custom', path: ['network'], message: 'Selecione uma rede.' })
    }
    if (!typeOk) {
      ctx.addIssue({ code: 'custom', path: ['type'], message: 'Selecione uma carteira.' })
    }
    if (addressEmpty) {
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message: 'Informe o endereço da carteira.',
      })
    }
    // Contrato para o resto (apelido, ENS e endereço conforme a rede). Rede e
    // tipo vazios já têm erro próprio: entram com um valor qualquer só para
    // as outras regras rodarem.
    const parsed = updateWalletRequestSchema.safeParse({
      ...toWalletRequest(values as WalletFormValues),
      network: networkOk ? values.network : 'ethereum',
      type: typeOk ? values.type : 'metamask',
    })
    if (parsed.success) return
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === 'address' && (!networkOk || addressEmpty)) continue
      ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message })
    }
  })

/** Placeholder do endereço conforme a rede (o Figma mostra o de EVM). */
export function addressPlaceholder(network: WalletFormValues['network']): string {
  return network === 'solana' ? 'Endereço Solana (base58)' : 'Endereço 0x da carteira'
}

/** "0x12ab…cdef": o endereço inteiro fica no título para quem quiser conferir. */
export function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address
}

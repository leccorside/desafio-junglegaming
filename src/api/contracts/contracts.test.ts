import { describe, expect, it } from 'vitest'

import {
  API_ERROR_STATUS,
  apiErrorBodySchema,
  apiErrorCodeSchema,
  changePasswordFormSchema,
  createOrderRequestSchema,
  createWalletRequestSchema,
  ethAmountSchema,
  isTerminalOrderStatus,
  missingPasswordRules,
  nftListParamsSchema,
  parseNftListQuery,
  passwordSchema,
  realtimeEventSchema,
  registerFormSchema,
  toNftListQuery,
  usernameProblems,
  usernameSchema,
} from './index'

describe('ethAmountSchema', () => {
  it.each(['0', '1', '1.19', '0.016', '26.846', '0.000000000000000001'])('aceita %s', (value) => {
    expect(ethAmountSchema.safeParse(value).success).toBe(true)
  })

  it.each(['', '-1', '1.', '.5', '01', '1e3', '1,19', '0.0000000000000000001'])(
    'recusa "%s"',
    (value) => {
      expect(ethAmountSchema.safeParse(value).success).toBe(false)
    },
  )

  it('recusa number', () => {
    expect(ethAmountSchema.safeParse(1.19).success).toBe(false)
  })
})

describe('erros', () => {
  it('todo código de erro da API tem status HTTP', () => {
    for (const code of apiErrorCodeSchema.options) {
      expect(API_ERROR_STATUS[code]).toBeGreaterThanOrEqual(400)
    }
  })

  it('valida o corpo de erro com campos', () => {
    const body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Alguns campos estão inválidos.',
        fields: { email: 'E-mail inválido.' },
        retryable: false,
      },
    }
    expect(apiErrorBodySchema.parse(body).error.fields?.email).toBe('E-mail inválido.')
  })
})

describe('regras de senha e de nome de usuário, todas de uma vez', () => {
  const messageOf = (
    schema: { safeParse: (v: string) => { error?: { issues: { message: string }[] } } },
    value: string,
  ) => schema.safeParse(value).error?.issues.map((i) => i.message)

  it('senha: lista as regras que faltam numa mensagem só', () => {
    expect(messageOf(passwordSchema, 'abc')).toEqual([
      'A senha precisa de: pelo menos 8 caracteres, uma letra maiúscula, um número e um símbolo.',
    ])
    expect(messageOf(passwordSchema, '')).toEqual([
      'A senha precisa de: pelo menos 8 caracteres, uma letra minúscula, uma letra maiúscula, um número e um símbolo.',
    ])
    expect(messageOf(passwordSchema, 'Senha123')).toEqual(['A senha precisa de: um símbolo.'])
    expect(missingPasswordRules('senha@123')).toEqual(['uma letra maiúscula'])
    expect(passwordSchema.safeParse('Senha@123').success).toBe(true)
    expect(messageOf(passwordSchema, `Aa1@${'x'.repeat(69)}`)).toEqual([
      'A senha pode ter no máximo 72 caracteres.',
    ])
  })

  it('nome de usuário: tamanho e caracteres juntos, citando os que não valem', () => {
    expect(messageOf(usernameSchema, 'a!')).toEqual([
      'Use pelo menos 3 caracteres e só letras, números, ponto, hífen e sublinhado ("!" não vale).',
    ])
    expect(messageOf(usernameSchema, 'ana maria#')).toEqual([
      'Use só letras, números, ponto, hífen e sublinhado (espaço e "#" não valem).',
    ])
    expect(messageOf(usernameSchema, 'x'.repeat(31))).toEqual(['Use no máximo 30 caracteres.'])
    expect(usernameProblems('ana.ribeiro')).toEqual([])
  })
})

describe('cadastro e senha', () => {
  const valid = {
    username: 'ana.colecionadora',
    email: '  Ana@Example.com ',
    password: 'Senha@123',
    confirmPassword: 'Senha@123',
  }

  it('normaliza o e-mail', () => {
    expect(registerFormSchema.parse(valid).email).toBe('ana@example.com')
  })

  it('exige senha forte', () => {
    const result = registerFormSchema.safeParse({
      ...valid,
      password: 'senha',
      confirmPassword: 'senha',
    })
    expect(result.success).toBe(false)
  })

  it('aponta a confirmação divergente no campo certo', () => {
    const result = registerFormSchema.safeParse({ ...valid, confirmPassword: 'Senha@124' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['confirmPassword'])
  })

  it('não aceita a nova senha igual à atual', () => {
    const result = changePasswordFormSchema.safeParse({
      currentPassword: 'Senha@123',
      newPassword: 'Senha@123',
      confirmPassword: 'Senha@123',
    })
    expect(result.error?.issues.map((issue) => issue.path.join('.'))).toContain('newPassword')
  })
})

describe('listagem de NFTs', () => {
  it('aplica os padrões', () => {
    expect(nftListParamsSchema.parse({})).toEqual({
      feed: 'all',
      sort: 'recent',
      page: 1,
      pageSize: 9,
    })
  })

  it('serializa e lê a query string sem perder filtros', () => {
    const params = nftListParamsSchema.parse({
      q: 'ape',
      category: ['digital-art', 'music'],
      network: ['ethereum'],
      minPrice: '0.02',
      maxPrice: '12.3',
      sort: 'price_asc',
      page: 2,
    })
    const query = toNftListQuery(params)
    expect(query.toString()).toBe(
      'q=ape&category=digital-art%2Cmusic&network=ethereum&minPrice=0.02&maxPrice=12.3&sort=price_asc&page=2',
    )
    expect(parseNftListQuery(query).data).toEqual(params)
  })

  it('serializa e lê o filtro de coleção', () => {
    const params = nftListParamsSchema.parse({ collection: 'col-kurio-apes', pageSize: 6 })
    const query = toNftListQuery(params)
    expect(query.toString()).toBe('collection=col-kurio-apes&pageSize=6')
    expect(parseNftListQuery(query).data).toEqual(params)
  })

  it('omite os valores padrão da query string', () => {
    expect(toNftListQuery(nftListParamsSchema.parse({})).toString()).toBe('')
  })

  it('recusa faixa de preço invertida e categoria desconhecida', () => {
    expect(nftListParamsSchema.safeParse({ minPrice: '5', maxPrice: '1' }).success).toBe(false)
    expect(parseNftListQuery(new URLSearchParams('category=pintura')).success).toBe(false)
  })
})

describe('carteiras', () => {
  const base = { role: 'primary', label: 'Principal', type: 'metamask' } as const

  it('valida o endereço conforme a rede', () => {
    const evm = '0x7A42a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d619E8'
    expect(
      createWalletRequestSchema.safeParse({ ...base, network: 'ethereum', address: evm }).success,
    ).toBe(true)
    expect(
      createWalletRequestSchema.safeParse({ ...base, network: 'solana', address: evm }).success,
    ).toBe(false)
    expect(
      createWalletRequestSchema.safeParse({
        ...base,
        network: 'solana',
        address: '7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV',
      }).success,
    ).toBe(true)
  })

  it('aponta o erro no campo address', () => {
    const result = createWalletRequestSchema.safeParse({
      ...base,
      network: 'polygon',
      address: '0x123',
    })
    expect(result.error?.issues[0]?.path).toEqual(['address'])
  })
})

describe('pedidos', () => {
  it('valida a criação do pedido', () => {
    const result = createOrderRequestSchema.safeParse({
      quoteId: 'quote-1',
      quoteVersion: 3,
      walletId: 'wallet-1',
      network: 'ethereum',
      buyer: { displayName: 'Ana', email: 'ana@example.com' },
    })
    expect(result.success).toBe(true)
  })

  it('reconhece os estados terminais', () => {
    expect(isTerminalOrderStatus('pending')).toBe(false)
    expect(isTerminalOrderStatus('confirmed')).toBe(true)
    expect(isTerminalOrderStatus('rejected')).toBe(true)
  })
})

describe('eventos em tempo real', () => {
  const nftEvent = {
    eventId: 'evt-1',
    type: 'nft.updated',
    resource: { type: 'nft', id: 'nft-042' },
    version: 7,
    occurredAt: '2026-11-25T15:00:00.000Z',
    userId: null,
    data: {
      nftId: 'nft-042',
      priceFrom: '1.29',
      editions: [{ id: 'ed-1', price: '1.29', available: 3, status: 'available' }],
    },
  }

  it('aceita nft.updated público', () => {
    expect(realtimeEventSchema.parse(nftEvent).type).toBe('nft.updated')
  })

  it('recusa nft.updated com dono e preço numérico', () => {
    expect(realtimeEventSchema.safeParse({ ...nftEvent, userId: 'user-1' }).success).toBe(false)
    expect(
      realtimeEventSchema.safeParse({ ...nftEvent, data: { ...nftEvent.data, priceFrom: 1.29 } })
        .success,
    ).toBe(false)
  })

  it('exige dono em order.updated', () => {
    const orderEvent = {
      eventId: 'evt-2',
      type: 'order.updated',
      resource: { type: 'order', id: 'order-1' },
      version: 2,
      occurredAt: '2026-11-25T15:00:05.000Z',
      userId: 'user-1',
      data: { orderId: 'order-1', status: 'confirmed', rejectionReason: null, transaction: null },
    }
    expect(realtimeEventSchema.safeParse(orderEvent).success).toBe(true)
    expect(realtimeEventSchema.safeParse({ ...orderEvent, userId: null }).success).toBe(false)
  })
})

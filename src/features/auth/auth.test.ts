import { describe, expect, it } from 'vitest'

import { safeRedirect } from './redirect'
import { isSessionExpired } from './session-store'
import { initials } from './use-sign-out'

describe('safeRedirect', () => {
  it.each([
    ['/profile', '/profile'],
    ['/nft/nft-042?edition=1#galeria', '/nft/nft-042?edition=1#galeria'],
    ['/?page=2', '/?page=2'],
  ])('aceita caminho interno %s', (input, expected) => {
    expect(safeRedirect(input)).toBe(expected)
  })

  it.each([
    'https://site-malicioso.example',
    '//site-malicioso.example',
    '/\\site-malicioso.example',
    'javascript:alert(1)',
    'profile',
    '/login?redirect=/profile',
    '/register',
    undefined,
    42,
  ])('recusa %s', (input) => {
    expect(safeRedirect(input)).toBe('/')
  })
})

describe('validade local da sessão', () => {
  const session = (expiresAt: string) => ({
    token: 't',
    expiresAt,
    user: { id: 'u', username: 'u', displayName: 'U', email: 'u@example.com', avatarUrl: null },
  })

  it('expira quando a data passou', () => {
    const now = Date.parse('2026-11-25T12:00:00.000Z')
    expect(isSessionExpired(session('2026-11-25T11:59:59.000Z'), now)).toBe(true)
    expect(isSessionExpired(session('2026-11-25T12:30:00.000Z'), now)).toBe(false)
  })
})

describe('initials', () => {
  it('usa as iniciais do nome de exibição', () => {
    expect(initials('Ana Ribeiro')).toBe('AR')
    expect(initials('carla.arte')).toBe('CA')
    expect(initials('bruno')).toBe('B')
    expect(initials('  ')).toBe('?')
  })
})

import { describe, expect, it } from 'vitest'

import { DEFAULT_TITLE, pageTitle } from './page-title'

describe('título da aba', () => {
  it('usa o título da tela com a marca', () => {
    expect(pageTitle('Emerald Ape #042')).toBe('Emerald Ape #042 | KURIO')
    expect(pageTitle('  Carrinho de\n NFTs ')).toBe('Carrinho de NFTs | KURIO')
  })

  it('volta ao título padrão sem título na tela', () => {
    expect(pageTitle(null)).toBe(DEFAULT_TITLE)
    expect(pageTitle('   ')).toBe(DEFAULT_TITLE)
  })
})

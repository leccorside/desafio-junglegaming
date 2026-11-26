import { describe, expect, it } from 'vitest'

import { DEFAULT_DESCRIPTION, DEFAULT_TITLE, pageDescription, pageTitle } from './page-title'

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

describe('descrição da página', () => {
  it('usa o nome do NFT no detalhe', () => {
    expect(pageDescription('/nft/nft-042', 'Emerald Ape #042')).toBe(
      'Emerald Ape #042 no KURIO: edições disponíveis, preço em ETH e detalhes da coleção.',
    )
    expect(pageDescription('/nft/nft-042', null)).toBe(DEFAULT_DESCRIPTION)
  })

  it('tem um texto próprio por rota e o padrão nas demais', () => {
    const routes = ['/cart', '/checkout', '/favorites', '/orders/ord-0001', '/profile', '/wallets']
    const texts = [...routes, '/login', '/register'].map((path) => pageDescription(path, 'X'))
    expect(new Set(texts).size).toBe(texts.length)
    expect(texts).not.toContain(DEFAULT_DESCRIPTION)
    expect(pageDescription('/', 'Slogan')).toBe(DEFAULT_DESCRIPTION)
    expect(pageDescription('/qualquer', null)).toBe(DEFAULT_DESCRIPTION)
  })
})

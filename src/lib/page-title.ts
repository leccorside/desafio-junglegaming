export const DEFAULT_TITLE = 'KURIO | Marketplace de NFTs'

export const DEFAULT_DESCRIPTION =
  'KURIO: marketplace de NFTs para descobrir, colecionar e comprar edições digitais.'

/** Título da aba a partir do título da tela ("Emerald Ape #042 | KURIO"). */
export function pageTitle(heading: string | null | undefined): string {
  const text = heading?.replace(/\s+/g, ' ').trim()
  return text ? `${text} | KURIO` : DEFAULT_TITLE
}

const DESCRIPTIONS: [RegExp, string][] = [
  [
    /^\/cart\/?$/,
    'Carrinho do KURIO: revise os NFTs escolhidos, aplique cupons e siga para o pagamento.',
  ],
  [
    /^\/checkout\/?$/,
    'Pagamento no KURIO: confira os itens, a carteira e o total em ETH antes de confirmar.',
  ],
  [/^\/favorites\/?$/, 'Lista de interesse do KURIO: os NFTs que você marcou para acompanhar.'],
  [/^\/orders\//, 'Pedido no KURIO: status do pagamento, recibo e transação na blockchain.'],
  [/^\/profile\/?$/, 'Perfil no KURIO: dados da conta, foto e troca de senha.'],
  [/^\/wallets\/?$/, 'Carteiras no KURIO: carteira principal e secundária usadas nas compras.'],
  [/^\/login\/?$/, 'Entre na sua conta KURIO para comprar NFTs e acompanhar seus pedidos.'],
  [
    /^\/register\/?$/,
    'Crie sua conta no KURIO para colecionar e comprar edições digitais de NFTs.',
  ],
]

/**
 * Descrição da página (`<meta name="description">`) por rota. No detalhe usa
 * o nome do NFT, que vem do título da tela.
 */
export function pageDescription(pathname: string, heading: string | null | undefined): string {
  const text = heading?.replace(/\s+/g, ' ').trim()
  if (/^\/nft\/[^/]+\/?$/.test(pathname)) {
    return text
      ? `${text} no KURIO: edições disponíveis, preço em ETH e detalhes da coleção.`
      : DEFAULT_DESCRIPTION
  }
  return DESCRIPTIONS.find(([pattern]) => pattern.test(pathname))?.[1] ?? DEFAULT_DESCRIPTION
}

/** Atualiza a `<meta name="description">` do `index.html`. */
export function setPageDescription(content: string) {
  document.querySelector('meta[name="description"]')?.setAttribute('content', content)
}

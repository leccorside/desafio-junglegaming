/**
 * NFT e edição que o detalhe está mostrando agora (ou `null` fora do detalhe).
 * Quem lê é o painel de cenários dos mocks, para abrir o bloco "Estoque" já
 * no NFT e na edição da página.
 */
export interface ShownEdition {
  nftId: string
  editionId: string
}

let current: ShownEdition | null = null

export function getShownEdition(): ShownEdition | null {
  return current
}

export function setShownEdition(next: ShownEdition | null) {
  current = next
}

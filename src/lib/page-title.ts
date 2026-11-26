export const DEFAULT_TITLE = 'KURIO | Marketplace de NFTs'

/** Título da aba a partir do título da tela ("Emerald Ape #042 | KURIO"). */
export function pageTitle(heading: string | null | undefined): string {
  const text = heading?.replace(/\s+/g, ' ').trim()
  return text ? `${text} | KURIO` : DEFAULT_TITLE
}

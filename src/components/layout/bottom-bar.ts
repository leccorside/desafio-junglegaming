import { useMatches, useMatchRoute } from '@tanstack/react-router'

/**
 * Barra fixa na base da tela abaixo de 768 px, conforme a tela (Figma mobile):
 * - `tabs`: barra de navegação (126 px);
 * - `buy`: barra de compra do detalhe do NFT, que substitui a de navegação;
 * - `none`: entrar e criar conta ocupam a tela inteira.
 */
export type BottomBar = 'tabs' | 'buy' | 'none'

/** Altura da barra de compra do detalhe (frame "Buy Bar": 164 px com a área segura). */
export const BUY_BAR_HEIGHT = 164

export function useBottomBar(): BottomBar {
  const matchRoute = useMatchRoute()
  // Só com o detalhe carregado: no 404, no erro e no carregamento não há barra
  // de compra, e a de navegação continua.
  const detailLoaded = useMatches({
    select: (matches) =>
      matches.some((match) => match.routeId === '/nft/$nftId' && match.status === 'success'),
  })
  if (matchRoute({ to: '/login' }) || matchRoute({ to: '/register' })) return 'none'
  if (detailLoaded) return 'buy'
  return 'tabs'
}

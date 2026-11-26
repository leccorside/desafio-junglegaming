import { useMatches, useMatchRoute } from '@tanstack/react-router'

import { useCartCount } from '@/features/cart/queries'

/**
 * Barra fixa na base da tela abaixo de 768 px, conforme a tela (Figma mobile):
 * - `tabs`: barra de navegação (126 px);
 * - `buy`: barra de compra do detalhe do NFT, que substitui a de navegação;
 * - `cart`: o resumo do carrinho fica preso na base enquanto a lista rola
 *   (frame "Payment Summary"), também no lugar da barra de navegação;
 * - `none`: entrar e criar conta ocupam a tela inteira.
 */
export type BottomBar = 'tabs' | 'buy' | 'cart' | 'none'

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
  // Só com itens: carrinho vazio, carregando ou com erro não tem resumo, e a
  // navegação (abas e menu) precisa continuar na tela.
  const cartCount = useCartCount()
  if (matchRoute({ to: '/login' }) || matchRoute({ to: '/register' })) return 'none'
  if (detailLoaded) return 'buy'
  if (matchRoute({ to: '/cart' }) && cartCount > 0) return 'cart'
  return 'tabs'
}

import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { Session } from '@/api/contracts'

import { cartApi } from './api'
import { writeCart } from './cart-cache'
import { peekGuestCartId, resetGuestCartId } from './guest-cart-id'

/**
 * No login (ou cadastro), junta o carrinho do visitante ao da conta. Itens
 * iguais somam a quantidade, limitada ao estoque; o que não coube é avisado.
 * Depois o carrinho de visitante é trocado por um novo. Se a API falhar, o
 * carrinho do visitante continua guardado e é juntado na próxima entrada.
 *
 * Devolve o que fazer depois que a sessão reinicia o cache: gravar o carrinho
 * juntado. Gravado antes, o reinício o apagaria, e a tela do carrinho voltaria
 * ao skeleton com uma busca a mais.
 */
export async function mergeGuestCart(
  queryClient: QueryClient,
  session: Session,
): Promise<(() => void) | undefined> {
  const guestCartId = peekGuestCartId()
  if (!guestCartId) return undefined
  try {
    const { cart, adjustments } = await cartApi.merge(guestCartId)
    resetGuestCartId()
    if (adjustments.length) {
      const lines = adjustments.map((a) =>
        a.added === 0
          ? `${a.name}: não coube nenhuma unidade`
          : `${a.name}: entraram ${a.added} de ${a.requested}`,
      )
      toast.warning(`Alguns itens do carrinho não couberam no estoque. ${lines.join('; ')}.`, {
        duration: 10_000,
      })
    }
    return () => void writeCart(queryClient, `user:${session.user.id}`, cart)
  } catch {
    toast.error(
      'Não foi possível juntar o carrinho de visitante à sua conta. Os itens continuam guardados e entram na próxima vez que você entrar.',
    )
    return undefined
  }
}

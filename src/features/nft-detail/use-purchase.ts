import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { Nft, NftEdition } from '@/api/contracts'
import { errorMessage } from '@/api/errors'
import { useAddToCart } from '@/features/cart/queries'

/**
 * Adicionar ao carrinho a partir do detalhe. "Comprar" adiciona e leva ao
 * carrinho; o botão do carrinho (mobile) só adiciona e confirma por toast,
 * com atalho para o carrinho. Falha (ex.: estoque mudou) vira toast de erro.
 */
export function usePurchase(nft: Nft, edition: NftEdition | null, quantity: number) {
  const navigate = useNavigate()
  const addToCart = useAddToCart()
  const canBuy = Boolean(edition) && quantity > 0

  const add = (goToCart: boolean) => {
    if (!edition || quantity <= 0) return
    addToCart.mutate(
      { nftId: nft.id, editionId: edition.id, quantity },
      {
        onSuccess: () => {
          const what = `${nft.name} (${edition.name === 'Aberta' ? 'edição aberta' : edition.name})`
          if (goToCart) {
            toast.success(`${what} adicionado ao carrinho.`)
            void navigate({ to: '/cart' })
          } else {
            toast.success(`${what} adicionado ao carrinho.`, {
              action: { label: 'Ver carrinho', onClick: () => void navigate({ to: '/cart' }) },
            })
          }
        },
        onError: (error) => {
          toast.error(`Não foi possível adicionar ao carrinho. ${errorMessage(error)}`)
        },
      },
    )
  }

  return {
    canBuy,
    pending: addToCart.isPending,
    buy: () => add(true),
    addToCart: () => add(false),
  }
}

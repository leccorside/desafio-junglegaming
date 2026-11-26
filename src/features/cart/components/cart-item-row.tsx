import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { CartItem } from '@/api/contracts'
import { errorMessage } from '@/api/errors'
import { DeleteIcon } from '@/components/icons/figma-icons'
import { QuantityStepper } from '@/features/nft-detail/components/quantity-stepper'
import { ethMul, formatEth } from '@/lib/eth'
import { nftImageSources } from '@/lib/images'
import { cn } from '@/lib/utils'

import { cartApi } from '../api'
import { writeCart } from '../cart-cache'
import { useCartOwner, useRemoveCartItem, useUpdateCartItem } from '../queries'

const editionLabel = (name: string) => (name === 'Aberta' ? 'aberta' : name)

/** "Desfazer" da remoção: devolve a mesma edição e quantidade e avisa o resultado. */
async function restoreRemoved(
  queryClient: QueryClient,
  owner: string,
  item: CartItem,
  title: string,
) {
  try {
    const cart = await cartApi.addItem({
      nftId: item.nftId,
      editionId: item.editionId,
      quantity: item.quantity,
    })
    writeCart(queryClient, owner, cart)
    toast.success(`${title} voltou ao carrinho.`)
  } catch (error) {
    toast.error(`Não foi possível devolver ${title} ao carrinho. ${errorMessage(error)}`)
  }
}

/** Aviso do item frente ao catálogo atual (preço mudou, estoque menor, esgotado). */
function ItemNotice({ item }: { item: CartItem }) {
  if (item.status === 'ok') return null
  const text =
    item.status === 'sold_out'
      ? 'Esgotado: remova do carrinho para finalizar.'
      : item.status === 'insufficient'
        ? `Só ${item.available} ${item.available === 1 ? 'disponível' : 'disponíveis'}: ajuste a quantidade para finalizar.`
        : `O preço mudou de ${formatEth(item.previousUnitPrice ?? item.unitPrice)} para ${formatEth(item.unitPrice)}.`
  return (
    <p
      className={cn(
        'text-caption',
        item.status === 'price_changed' ? 'text-warning' : 'text-destructive-foreground',
      )}
    >
      {text}
    </p>
  )
}

/**
 * Linha do carrinho. Desktop (frame "Cart Item"): imagem de 70 px, nome e ID do
 * token, preço, quantidade ("Edições" no Figma), total e lixeira, em colunas.
 * Mobile ("Item"): cartão em gradiente com imagem de 100 px, edição, total da
 * linha e quantidade. Cada mudança vai à API, que devolve o carrinho inteiro.
 */
export function CartItemRow({
  item,
  quotedTotal,
}: {
  item: CartItem
  /** Total da linha na cotação da API; antes dela chegar, a conta é só para exibição. */
  quotedTotal: string | undefined
}) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  const busy = update.isPending || remove.isPending
  const lineTotal = quotedTotal ?? ethMul(item.unitPrice, item.quantity)
  const title = `${item.name} (edição ${editionLabel(item.editionName)})`

  const changeQuantity = (quantity: number) =>
    update.mutate(
      { itemId: item.id, quantity },
      {
        onError: (error) =>
          toast.error(`Não foi possível alterar a quantidade. ${errorMessage(error)}`),
      },
    )

  const removeItem = () =>
    remove.mutate(item.id, {
      onSuccess: () =>
        toast.success(`${title} saiu do carrinho.`, {
          // Mais tempo que o padrão (4 s) para dar tempo de decidir desfazer.
          duration: 10_000,
          action: {
            label: 'Desfazer',
            // A linha já saiu da tela: o desfazer não pode depender dela (os
            // callbacks de um `mutate` de componente desmontado não rodam).
            onClick: () => void restoreRemoved(queryClient, owner, item, title),
          },
        }),
      onError: (error) => toast.error(`Não foi possível remover o item. ${errorMessage(error)}`),
    })

  return (
    <li
      aria-busy={busy || undefined}
      className={cn(
        'relative grid grid-cols-[100px_1fr_auto] items-center gap-x-2.5 gap-y-1 rounded-[14px] bg-[linear-gradient(135deg,var(--card),var(--popover))] pr-2 transition-opacity',
        'md:grid-cols-[250px_1fr_1fr_1fr_24px] md:gap-x-6 md:rounded-none md:bg-card md:bg-none md:pr-6',
        busy && 'opacity-70',
      )}
    >
      <div className="row-span-3 flex items-center gap-4 md:row-span-1">
        <img
          {...nftImageSources(item.imageUrl, '(min-width: 768px) 70px, 100px')}
          alt=""
          width={100}
          height={100}
          loading="lazy"
          decoding="async"
          className="size-[100px] shrink-0 rounded-[14px] object-cover md:size-[70px] md:rounded-md"
        />
        <div className="hidden min-w-0 flex-col gap-1.5 md:flex">
          <Link
            to="/nft/$nftId"
            params={{ nftId: item.nftId }}
            search={{ edition: item.editionId }}
            className="truncate text-body-lg leading-4 font-bold text-foreground hover:text-accent-foreground"
          >
            {item.name}
          </Link>
          <span className="text-body-sm leading-4 text-secondary">
            ID do token: #{item.tokenId} · Edição {editionLabel(item.editionName)}
          </span>
        </div>
      </div>

      {/* Mobile: nome, edição e total da linha ao lado da imagem. */}
      <div className="col-start-2 flex min-w-0 flex-col gap-1 pt-3 md:hidden">
        <Link
          to="/nft/$nftId"
          params={{ nftId: item.nftId }}
          search={{ edition: item.editionId }}
          className="line-clamp-2 text-body leading-5 font-bold text-foreground"
        >
          {item.name}
        </Link>
        <span className="text-body-sm leading-4 text-muted-foreground">
          Edição: {editionLabel(item.editionName)}
        </span>
      </div>

      <p className="hidden text-body-lg font-bold text-muted-foreground md:block">
        <span className="sr-only">Preço unitário: </span>
        {formatEth(item.unitPrice)}
      </p>

      <div className="col-start-3 row-start-2 md:col-start-auto md:row-start-auto">
        <QuantityStepper
          value={item.quantity}
          max={Math.max(item.available, 0)}
          onChange={changeQuantity}
          size="sm"
          label={`Quantidade de ${item.name}`}
          hideLabel
          subject={item.name}
          busy={busy}
          compactHint
        />
      </div>

      {/* Esgotado não entra na cotação: mostrar o total da linha contradiria o resumo. */}
      <p
        data-line-total=""
        className="col-start-2 row-start-3 pb-3 text-lead font-bold text-accent-foreground md:col-start-auto md:row-start-auto md:pb-0 md:text-body-lg"
      >
        {item.status === 'sold_out' ? (
          <span className="sr-only">Esgotado, fora do total.</span>
        ) : (
          <>
            <span className="sr-only">Total do item: </span>
            {formatEth(lineTotal)}
          </>
        )}
      </p>

      <button
        type="button"
        onClick={() => {
          if (!busy) removeItem()
        }}
        aria-disabled={busy || undefined}
        aria-label={`Remover ${title} do carrinho`}
        className="col-start-3 row-start-1 flex size-8 cursor-pointer items-center justify-center justify-self-end rounded-full text-foreground transition-colors hover:bg-accent hover:text-destructive-foreground md:col-start-auto md:row-start-auto md:size-6"
      >
        <DeleteIcon size={22} />
      </button>

      {item.status !== 'ok' ? (
        <div className="col-span-3 px-3 pb-3 md:col-span-5 md:px-0 md:pb-2 md:pl-[86px]">
          <ItemNotice item={item} />
        </div>
      ) : null}
    </li>
  )
}

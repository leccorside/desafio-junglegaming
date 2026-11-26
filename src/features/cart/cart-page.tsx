import { useQuery } from '@tanstack/react-query'
import { Link, useCanGoBack, useNavigate, useRouter } from '@tanstack/react-router'
import { TriangleAlertIcon as WarningIcon, XIcon } from 'lucide-react'

import { errorMessage } from '@/api/errors'
import { ArrowLeftIcon } from '@/components/icons/figma-icons'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NftCard, NftCardSkeleton } from '@/features/catalog/components/nft-card'
import { nftListQuery } from '@/features/catalog/queries'

import { useCartChangeNotice } from './cart-notices'
import { CartItemRow } from './components/cart-item-row'
import { CartSummary } from './components/cart-summary'
import { useCart, useQuote } from './queries'

const RELATED_COUNT = 5

/** "Colecionadores também viram": os mais populares que não estão no carrinho. */
function AlsoViewed({ exclude }: { exclude: string[] }) {
  const popular = useQuery({
    ...nftListQuery({ feed: 'all', sort: 'popular', page: 1, pageSize: 12 }),
    placeholderData: undefined,
  })
  if (popular.isError) return null
  const items = popular.data?.items
    .filter((nft) => !exclude.includes(nft.id))
    .slice(0, RELATED_COUNT)
  if (items && items.length === 0) return null

  return (
    <section aria-labelledby="also-viewed-title" className="flex flex-col gap-8">
      <div className="border-b border-primary/30 pb-3">
        <h2
          id="also-viewed-title"
          className="text-[17px] leading-4 font-bold text-accent-foreground"
        >
          Colecionadores também viram
        </h2>
      </div>
      <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-7 md:overflow-visible md:px-0 lg:grid-cols-5">
        {items
          ? items.map((nft) => (
              <li key={nft.id} className="w-[175px] shrink-0 snap-start md:w-auto">
                <NftCard nft={nft} />
              </li>
            ))
          : Array.from({ length: RELATED_COUNT }, (_, i) => (
              <li key={i} aria-hidden="true" className="w-[175px] shrink-0 md:w-auto">
                <NftCardSkeleton />
              </li>
            ))}
      </ul>
    </section>
  )
}

/**
 * Aviso de mudança em tempo real (preço, estoque) com a página do carrinho
 * aberta. Fica no fluxo, acima da lista: um toast no topo cobria o nome do
 * primeiro item no mobile. A região `role="status"` existe sempre, para o
 * leitor de tela anunciar o texto quando ele chega.
 */
function CartChangeNotice() {
  const [message, dismiss] = useCartChangeNotice()
  return (
    <div
      className={
        message
          ? 'flex items-start gap-3 rounded-md border border-warning/50 bg-card p-3'
          : 'contents'
      }
    >
      {message ? (
        <WarningIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
      ) : null}
      <p role="status" className={message ? 'flex-1 text-body-sm text-foreground' : 'sr-only'}>
        {message ?? ''}
      </p>
      {message ? (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fechar aviso"
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <XIcon aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  )
}

function CartSkeleton() {
  return (
    <ul aria-hidden="true" data-cart-skeleton="" className="flex flex-col gap-5 md:gap-3">
      {Array.from({ length: 3 }, (_, i) => (
        <li key={i}>
          <Skeleton className="h-[100px] rounded-[14px] md:h-[70px] md:rounded-none" />
        </li>
      ))}
    </ul>
  )
}

/**
 * Carrinho (frames "Desktop / Carrinho de NFTs" e "Mobile / Carrinho de NFTs"):
 * itens com quantidade e remoção, cupom e resumo da cotação. No mobile o
 * resumo fica fixo na base enquanto a lista rola, no lugar da barra de
 * navegação (como no Figma).
 */
export function CartPage() {
  const cart = useCart()
  const quote = useQuote(cart.data)
  const router = useRouter()
  const canGoBack = useCanGoBack()
  const navigate = useNavigate()
  const items = cart.data?.items ?? []
  const quotedTotals = new Map(quote.data?.lines.map((line) => [line.itemId, line.lineTotal]))
  const units = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <div className="mx-auto flex max-w-content flex-col gap-12 px-4 pt-8 md:gap-24 md:px-6 md:pt-8 xl:px-0">
      <section aria-labelledby="cart-title" className="flex flex-col gap-3">
        <nav aria-label="Trilha de navegação" className="hidden md:block">
          <ol className="flex gap-1 text-body font-bold text-foreground">
            <li>
              <Link to="/" className="hover:text-accent-foreground">
                Início
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link to="/" hash="catalogo" className="hover:text-accent-foreground">
                Mercado
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-normal text-muted-foreground">
              Carrinho
            </li>
          </ol>
        </nav>

        {/* Mobile: voltar e título (frame "Screen Header"). Desktop: só a trilha, título para leitor de tela. */}
        <div className="relative flex h-[44px] items-center justify-center md:h-auto">
          <button
            type="button"
            onClick={() => (canGoBack ? router.history.back() : void navigate({ to: '/' }))}
            aria-label="Voltar"
            className="absolute left-0 flex size-[35px] cursor-pointer items-center justify-center rounded-full border border-border bg-popover text-muted-foreground md:hidden"
          >
            <ArrowLeftIcon size={20} />
          </button>
          <h1 id="cart-title" className="text-title-sm font-bold text-foreground md:sr-only">
            Carrinho de NFTs
          </h1>
        </div>

        <p role="status" className="text-body-sm text-muted-foreground md:hidden">
          {cart.data ? `${units} ${units === 1 ? 'unidade' : 'unidades'} no carrinho` : ''}
        </p>

        {cart.isPending ? (
          <div className="flex flex-col gap-8 md:flex-row md:justify-between">
            <div className="md:w-[782px]">
              <CartSkeleton />
            </div>
            <Skeleton className="h-[300px] md:w-[332px]" />
          </div>
        ) : cart.isError ? (
          <div
            role="alert"
            className="flex flex-col items-start gap-4 rounded-md border border-destructive/60 bg-card p-6"
          >
            <p className="text-body-lg font-bold text-foreground">
              Não foi possível carregar o carrinho.
            </p>
            <p className="text-body-sm text-destructive-foreground">{errorMessage(cart.error)}</p>
            <Button onClick={() => void cart.refetch()}>Tentar de novo</Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-md bg-card p-6">
            <p className="text-body-lg font-bold text-foreground">Seu carrinho está vazio.</p>
            <p className="text-body-sm text-muted-foreground">
              Escolha um NFT e a edição no catálogo para começar.
            </p>
            <Button asChild variant="secondary">
              <Link to="/" hash="catalogo">
                Explorar o catálogo
              </Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between md:gap-10">
            <div className="flex min-w-0 flex-col gap-3 md:max-w-[782px] md:flex-1">
              <CartChangeNotice />
              <div
                aria-hidden="true"
                className="hidden grid-cols-[250px_1fr_1fr_1fr_24px] gap-x-6 border-b border-primary/30 pr-6 pb-3 text-body-lg leading-4 text-foreground md:grid"
              >
                <span className="font-bold">NFTs</span>
                <span className="font-medium">Preço</span>
                <span className="font-bold">Edições</span>
                <span className="font-medium">Total</span>
                <span />
              </div>
              <ul aria-label="Itens do carrinho" className="flex flex-col gap-5 md:gap-3">
                {items.map((item) => (
                  <CartItemRow key={item.id} item={item} quotedTotal={quotedTotals.get(item.id)} />
                ))}
              </ul>
            </div>
            <div className="sticky bottom-0 z-30 -mx-4 md:static md:mx-0 md:w-[332px] md:shrink-0">
              <CartSummary cart={cart.data} />
            </div>
          </div>
        )}
      </section>

      <AlsoViewed exclude={items.map((item) => item.nftId)} />
    </div>
  )
}

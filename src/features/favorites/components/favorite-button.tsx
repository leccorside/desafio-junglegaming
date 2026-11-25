import type { Nft } from '@/api/contracts'
import { createIcon } from '@/components/icons/create-icon'
import { HeartIcon } from '@/components/icons/figma-icons'
import { cn } from '@/lib/utils'

import { useIsFavorite, useToggleFavorite } from '../queries'

/** Coração preenchido: o contorno externo do ícone Heart do Figma, sem o vazado. */
const HeartFilledIcon = createIcon(
  'HeartFilled',
  '0 0 16 15',
  <path
    d="M8 14.2349C7.77222 14.2349 7.55261 14.1523 7.38147 14.0024C6.73511 13.4373 6.11194 12.9061 5.56213 12.4376L5.55933 12.4352C3.94739 11.0615 2.55542 9.87524 1.58691 8.70667C0.504272 7.40027 0 6.16162 0 4.80847C0 3.49377 0.450806 2.28088 1.26929 1.39307C2.09753 0.494751 3.23401 0 4.46973 0C5.39331 0 6.23914 0.291992 6.98364 0.867798C7.35938 1.15845 7.69995 1.51416 8 1.92908C8.30017 1.51416 8.64062 1.15845 9.01648 0.867798C9.76099 0.291992 10.6068 0 11.5304 0C12.766 0 13.9026 0.494751 14.7308 1.39307C15.5493 2.28088 16 3.49377 16 4.80847C16 6.16162 15.4958 7.40027 14.4132 8.70654C13.4447 9.87524 12.0529 11.0614 10.4412 12.4349C9.89038 12.9042 9.26624 13.4362 8.61841 14.0027C8.44739 14.1523 8.22766 14.2349 8 14.2349Z"
    fill="currentColor"
  />,
)

type Variant = 'outline' | 'round' | 'card'

const VARIANTS: Record<Variant, string> = {
  // Desktop do detalhe: botão "Favoritar" de 130 × 40 com borda Primary.
  outline:
    'h-10 w-[130px] gap-2 rounded-md border border-primary px-3 text-body-sm font-medium text-accent-foreground hover:bg-accent',
  // Mobile do detalhe: círculo de 35 px sobre a imagem.
  round: 'size-[35px] rounded-full border border-border bg-popover text-foreground',
  // Card do catálogo no mobile: círculo de 28 px no canto da imagem.
  card: 'size-7 rounded-full bg-popover/90 text-foreground',
}

/**
 * Coração de favoritos. É um toggle (`aria-pressed`) com o nome do NFT no
 * rótulo. Visitante vai ao login e volta; logado, muda na hora e volta ao
 * estado anterior se a API falhar.
 */
export function FavoriteButton({
  nft,
  variant,
  className,
}: {
  nft: Nft
  variant: Variant
  className?: string
}) {
  const favorite = useIsFavorite(nft.id)
  const { toggle, isGuest } = useToggleFavorite()
  const label = isGuest
    ? `Entre para favoritar ${nft.name}`
    : favorite
      ? `Tirar ${nft.name} da lista de interesse`
      : `Adicionar ${nft.name} à lista de interesse`

  return (
    <button
      type="button"
      onClick={() => toggle(nft, !favorite)}
      aria-pressed={isGuest ? undefined : favorite}
      aria-label={variant === 'outline' ? undefined : label}
      title={label}
      className={cn(
        'inline-flex shrink-0 cursor-pointer items-center justify-center transition-colors',
        VARIANTS[variant],
        className,
      )}
    >
      {favorite ? (
        <HeartFilledIcon size={variant === 'card' ? 16 : 20} className="text-highlight" />
      ) : (
        <HeartIcon size={variant === 'card' ? 16 : 20} />
      )}
      {variant === 'outline' ? (
        <>
          <span aria-hidden="true">{favorite ? 'Favoritado' : 'Favoritar'}</span>
          <span className="sr-only">{label}</span>
        </>
      ) : null}
    </button>
  )
}

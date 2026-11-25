import { cn } from '@/lib/utils'

/**
 * Contador do carrinho (Figma: círculo Primary de 16 px com borda Ink e número
 * de 10 px). Só aparece com itens; o número vai no nome do link (`cartLabel`).
 */
export function CartBadge({ count, className }: { count: number; className?: string }) {
  if (count === 0) return null
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-background bg-primary px-0.5 text-tiny font-medium text-primary-foreground tabular-nums',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}

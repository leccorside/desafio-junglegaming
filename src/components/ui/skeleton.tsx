import { cn } from '@/lib/utils'

/**
 * Placeholder de carregamento com shimmer: base `Surface Card` e faixa de
 * brilho em `Surface Raised`. A animação para com `prefers-reduced-motion`.
 * Deve receber as mesmas dimensões do conteúdo final para não deslocar o layout.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        'animate-shimmer rounded-md bg-card bg-[linear-gradient(90deg,var(--card)_0%,var(--popover)_50%,var(--card)_100%)] bg-size-[200%_100%] motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }

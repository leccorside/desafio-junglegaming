import { cn } from '@/lib/utils'

/** Wordmark KURIO, texto em Roboto Mono bold como no Figma. */
export function Logo({ className }: { className?: string }) {
  return (
    <a
      href="/"
      className={cn(
        'inline-flex items-center text-body-sm font-bold tracking-normal text-foreground',
        className,
      )}
    >
      KURIO
      <span className="sr-only"> (página inicial)</span>
    </a>
  )
}

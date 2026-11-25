import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Campo de texto do Figma: 40 px de altura, raio de 5 px e padding 12 × 16 px.
 * A borda usa `--input` (#8a5c40) em vez de `Color/Border`, para atingir o
 * contraste de 3:1 exigido em componentes de interface.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full min-w-0 rounded-control border border-input bg-transparent px-4 text-body-sm text-foreground transition-colors placeholder:text-secondary',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-body-sm file:font-medium file:text-foreground',
        'focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }

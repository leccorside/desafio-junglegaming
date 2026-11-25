import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Botão adaptado ao Figma. As cinco alturas do layout (35, 36, 40, 45 e 48 px)
 * viraram três tamanhos, com raio de 5 px (ver docs/DESIGN_SYSTEM.md).
 * O foco usa o anel global de `:focus-visible`.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-control font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active',
        secondary:
          'border-[1.5px] border-secondary bg-transparent text-foreground hover:bg-secondary hover:text-secondary-foreground',
        outline:
          'border border-border bg-transparent text-foreground hover:border-border-soft hover:bg-accent',
        ghost: 'text-foreground hover:bg-accent',
        destructive:
          'border border-destructive bg-transparent text-destructive-foreground hover:bg-destructive/15',
        link: 'h-auto px-0 text-accent-foreground underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3 text-body-sm',
        default: 'h-10 px-4 text-body-lg',
        lg: 'h-12 px-6 text-body-lg font-bold',
        icon: 'size-10',
        'icon-sm': 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  type,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      // Botão sem tipo explícito vira "button" para não enviar formulários por engano.
      type={asChild ? type : (type ?? 'button')}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

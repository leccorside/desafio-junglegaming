import { forwardRef, useState, type ComponentProps } from 'react'

import { HideIcon } from '@/components/icons/figma-icons'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Campo de senha com o botão de mostrar/ocultar do Figma (ícone Iconly "Hide"). */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<ComponentProps<'input'>, 'type'>>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false)

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('pr-12', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
          className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-control text-muted-foreground transition-colors hover:text-foreground"
        >
          <HideIcon size={20} />
        </button>
      </div>
    )
  },
)

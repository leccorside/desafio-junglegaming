import type { ComponentProps, ReactNode } from 'react'

import { ChevronDownIcon } from '@/components/icons/figma-icons'
import { FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/** Campo do perfil e das carteiras no Figma: 40 px, raio de 3 px. */
export const accountFieldClass = 'rounded-[3px]'

/**
 * Rótulo do Figma (15 px) com o asterisco coral nos obrigatórios. O asterisco
 * é decorativo; "obrigatório" vai no texto para leitor de tela.
 */
export function AccountLabel({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <FormLabel className="gap-0.5 text-[15px] leading-[29px] font-normal text-foreground">
      {children}
      {required ? (
        <>
          <span aria-hidden="true" className="text-[22px] leading-[29px] text-highlight">
            *
          </span>
          <span className="sr-only"> (obrigatório)</span>
        </>
      ) : null}
    </FormLabel>
  )
}

/**
 * Nome ENS: o Figma põe o sufixo ".eth" numa caixa à esquerda do campo. Como
 * só existe ".eth", a caixa não é um seletor (sem a seta do desenho).
 */
export function EnsInput({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <div className="flex gap-2.5">
      <span
        aria-hidden="true"
        className={cn(
          'flex h-10 w-[78px] shrink-0 items-center justify-center border border-input text-[15px] text-foreground',
          accountFieldClass,
        )}
      >
        .eth
      </span>
      <Input className={cn(accountFieldClass, className)} {...props} />
    </div>
  )
}

/** Select nativo com a seta do Figma (acessível e simples de testar). */
export function NativeSelect({
  className,
  children,
  ...props
}: ComponentProps<'select'> & { children: ReactNode }) {
  return (
    <div className="relative">
      <select
        className={cn(
          'h-10 w-full cursor-pointer appearance-none border border-input bg-background pr-10 pl-[13px] text-body-sm text-foreground focus-visible:border-primary focus-visible:outline-none aria-invalid:border-destructive',
          accountFieldClass,
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon
        size={20}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-secondary"
      />
    </div>
  )
}

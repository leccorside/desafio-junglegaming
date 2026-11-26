import type { ReactNode } from 'react'

import { notifyUnavailable } from '@/lib/unavailable'
import { cn } from '@/lib/utils'

/**
 * Item fora do escopo do desafio (Criadores, Aprenda, Atividade, Suporte, "Ler
 * mais", redes sociais...). Fica visível, como no Figma, mas não finge
 * funcionar: é um botão com `aria-disabled` que, ao ser acionado (clique,
 * toque ou teclado), explica que a área não existe nesta demonstração. O
 * `title` repete a explicação para quem passa o mouse.
 */
export function UnavailableAction({
  what,
  className,
  children,
  label,
}: {
  /** Nome da área no aviso ("Criadores", "Perfil da Kurio no Instagram"). */
  what: string
  className?: string
  children?: ReactNode
  /** Nome acessível, quando o conteúdo é só um ícone. */
  label?: string
}) {
  return (
    <button
      type="button"
      aria-disabled="true"
      aria-label={label ? `${label} (indisponível nesta demonstração)` : undefined}
      title="Indisponível nesta demonstração"
      onClick={() => notifyUnavailable(what)}
      className={cn('cursor-not-allowed text-left opacity-60', className)}
    >
      {children ?? what}
      {label ? null : <span className="sr-only"> (indisponível nesta demonstração)</span>}
    </button>
  )
}

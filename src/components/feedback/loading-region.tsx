import type { HTMLAttributes, ReactNode } from 'react'

/**
 * Área de carregamento com skeleton (ACCESSIBILITY.md, "Skeletons"): o
 * contêiner fica com `aria-busy`, o desenho do skeleton fica escondido do
 * leitor de tela e um aviso só para ele ("Carregando as carteiras…") diz o que
 * está acontecendo. O aviso fica fora da área ocupada, porque leitores de tela
 * costumam calar o que muda dentro de um `aria-busy`. Os filhos continuam
 * itens do layout do contêiner (o invólucro escondido é `display: contents`).
 */
export function LoadingRegion({
  label,
  children,
  ...props
}: {
  /** Aviso para o leitor de tela. */
  label: string
  children: ReactNode
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <>
      <p role="status" className="sr-only" data-loading-status="">
        {label}
      </p>
      <div aria-busy="true" {...props}>
        <div aria-hidden="true" className="contents">
          {children}
        </div>
      </div>
    </>
  )
}

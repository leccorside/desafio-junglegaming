import type { ReactNode, SVGProps } from 'react'

export interface IconProps extends SVGProps<SVGSVGElement> {
  /** Tamanho em pixels (largura e altura). Padrão: 20. */
  size?: number
  /**
   * Texto alternativo. Sem ele o ícone é decorativo (`aria-hidden`), que é o
   * caso quando o botão ou link que o contém já tem nome acessível.
   */
  title?: string
}

/** Cria um componente de ícone que herda a cor do texto (`currentColor`). */
export function createIcon(name: string, viewBox: string, body: ReactNode) {
  function Icon({ size = 20, title, ...props }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={viewBox}
        width={size}
        height={size}
        fill="none"
        focusable="false"
        role={title ? 'img' : undefined}
        aria-hidden={title ? undefined : true}
        {...props}
      >
        {title ? <title>{title}</title> : null}
        {body}
      </svg>
    )
  }
  Icon.displayName = `${name}Icon`
  return Icon
}

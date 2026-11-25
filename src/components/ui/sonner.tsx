import { Toaster as Sonner, type ToasterProps } from 'sonner'

import { BUY_BAR_HEIGHT, useBottomBar } from '@/components/layout/bottom-bar'
import { DESKTOP_QUERY, useMediaQuery } from '@/hooks/use-media-query'

/**
 * Distância do toast até a base da tela quando há barra inferior (< 768 px).
 * A barra ocupa 126 px (frame "Tab Bar" do Figma) e o rodapé do menu lateral,
 * com o botão "Sair", uns 81 px: 142 px deixa o toast acima dos dois, com
 * 16 px de folga, mais a área segura do aparelho (home indicator do iPhone).
 */
export const MOBILE_TOAST_BOTTOM = 'calc(142px + env(safe-area-inset-bottom))'

/** No detalhe do NFT, a barra de compra (164 px) toma o lugar da de navegação. */
export const BUY_BAR_TOAST_BOTTOM = `calc(${BUY_BAR_HEIGHT + 16}px + env(safe-area-inset-bottom))`

/**
 * Toasts do projeto. Tema fixo escuro (não há tema claro no Figma).
 * O Sonner anuncia as mensagens numa região `aria-live` para leitores de tela.
 *
 * O "mobile" do Sonner começa abaixo de 600 px, mas a barra inferior aparece
 * abaixo de 768 px. Por isso a posição segue a nossa media query: entre 600 e
 * 767 px o toast também sobe para cima da barra.
 */
function Toaster(props: ToasterProps) {
  const bottomBar = useBottomBar()
  const hasBottomBar = !useMediaQuery(DESKTOP_QUERY) && bottomBar !== 'none'
  const bottom = bottomBar === 'buy' ? BUY_BAR_TOAST_BOTTOM : MOBILE_TOAST_BOTTOM
  const offset = hasBottomBar ? { bottom, right: 16, left: 16 } : 24

  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      offset={offset}
      mobileOffset={hasBottomBar ? offset : 16}
      className="toaster group"
      containerAriaLabel="Notificações"
      toastOptions={{
        classNames: {
          toast: 'font-sans text-body-sm',
          error: 'text-destructive-foreground!',
          success: 'text-foreground!',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border-soft)',
          '--border-radius': 'var(--radius-md)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }

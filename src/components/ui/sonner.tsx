import { Toaster as Sonner, type ToasterProps } from 'sonner'

/**
 * Toasts do projeto. Tema fixo escuro (não há tema claro no Figma).
 * O Sonner anuncia as mensagens numa região `aria-live` para leitores de tela.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
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

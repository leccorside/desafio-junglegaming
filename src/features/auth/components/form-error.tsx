/** Mensagem geral do formulário, anunciada pelos leitores de tela. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="rounded-control border border-destructive/60 bg-destructive/10 px-3 py-2 text-body-sm text-destructive-foreground"
    >
      {message}
    </p>
  )
}

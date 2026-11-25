/** Atalho de teclado para pular a navegação e ir direto ao conteúdo. */
export function SkipLink() {
  return (
    <a
      href="#conteudo"
      className="sr-only z-50 rounded-control bg-primary px-4 py-2 font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
    >
      Pular para o conteúdo
    </a>
  )
}

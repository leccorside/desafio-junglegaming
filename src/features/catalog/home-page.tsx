/**
 * Tela inicial. Provisória: destaques e catálogo entram no Passo 5.
 * No desktop, o login e o cadastro aparecem em modal sobre ela (Figma).
 */
export function HomePage() {
  return (
    <section
      id="catalogo"
      className="mx-auto flex max-w-content flex-col items-start gap-4 px-6 py-24 xl:px-0"
    >
      <h1 className="text-display-sm font-bold text-foreground uppercase">KURIO</h1>
      <p className="max-w-xl text-body-lg text-muted-foreground">
        Marketplace de NFTs em construção. O catálogo chega nas próximas etapas.
      </p>
    </section>
  )
}

import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

// Página provisória. A tela inicial real (destaques e catálogo) entra no Passo 5.
function HomePage() {
  return (
    <section className="mx-auto flex max-w-content flex-col items-start gap-4 px-6 py-24 xl:px-0">
      <h1 className="text-display-sm font-bold text-foreground uppercase">KURIO</h1>
      <p className="max-w-xl text-body-lg text-muted-foreground">
        Marketplace de NFTs em construção. O catálogo chega nas próximas etapas.
      </p>
    </section>
  )
}

import { createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: HomePage,
})

// Página provisória do Passo 0. A tela inicial real entra no Passo 5.
function HomePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-bold">GreenMint</h1>
      <p className="max-w-md text-muted-foreground">
        Marketplace de NFTs em construção. Esta página confirma que a stack está configurada.
      </p>
      <Button asChild>
        <a href="https://github.com/leccorside/desafio-junglegaming">Ver repositório</a>
      </Button>
    </main>
  )
}

import type { ReactNode } from 'react'

/**
 * Página com rota e proteção prontas, mas conteúdo ainda não implementado.
 * Some à medida que os passos de cada tela são entregues.
 */
export function PagePlaceholder({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="mx-auto flex max-w-content flex-col gap-4 px-6 py-24 xl:px-0">
      <h1 className="text-h1 font-bold text-foreground">{title}</h1>
      <p className="max-w-xl text-body-lg text-muted-foreground">Esta tela está em construção.</p>
      {children}
    </section>
  )
}

import type { ReactNode } from 'react'

interface StatusPageProps {
  code?: string
  title: string
  description: ReactNode
  actions?: ReactNode
}

/** Página de estado (404, erro de rota) no mesmo padrão visual do restante. */
export function StatusPage({ code, title, description, actions }: StatusPageProps) {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
      {code ? (
        <p aria-hidden="true" className="text-display font-bold text-primary">
          {code}
        </p>
      ) : null}
      <h1 className="text-h2 font-bold text-foreground">{title}</h1>
      <div className="text-body-sm text-muted-foreground">{description}</div>
      {actions ? <div className="mt-4 flex flex-wrap justify-center gap-3">{actions}</div> : null}
    </section>
  )
}

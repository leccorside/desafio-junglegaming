import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

import { StatusPage } from './status-page'

/** Erro inesperado numa rota: oferece nova tentativa sem recarregar a página. */
export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const queryErrorResetBoundary = useQueryErrorResetBoundary()

  useEffect(() => {
    queryErrorResetBoundary.reset()
  }, [queryErrorResetBoundary])

  const retry = () => {
    reset()
    void router.invalidate()
  }

  return (
    <div role="alert">
      <StatusPage
        title="Algo deu errado"
        description={
          <>
            <p>Não foi possível carregar esta página. Tente de novo em instantes.</p>
            {import.meta.env.DEV ? (
              <pre className="mt-4 overflow-x-auto rounded-md bg-card p-3 text-left text-caption-sm text-destructive-foreground">
                {error instanceof Error ? error.message : String(error)}
              </pre>
            ) : null}
          </>
        }
        actions={
          <>
            <Button size="lg" onClick={retry}>
              Tentar de novo
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/">Voltar ao início</Link>
            </Button>
          </>
        }
      />
    </div>
  )
}

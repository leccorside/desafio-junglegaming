import { Link } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

import { StatusPage } from './status-page'

export function NotFoundPage() {
  return (
    <StatusPage
      code="404"
      title="Página não encontrada"
      description="O endereço pode ter mudado ou não existe. Volte ao início para continuar explorando o catálogo."
      actions={
        <Button asChild size="lg">
          <Link to="/">Voltar ao início</Link>
        </Button>
      }
    />
  )
}

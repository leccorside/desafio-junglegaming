import { Link } from '@tanstack/react-router'

import { StatusPage } from '@/components/feedback/status-page'
import { Button } from '@/components/ui/button'

/** NFT inexistente (a API respondeu 404): página própria, com caminho de volta ao catálogo. */
export function NftNotFound() {
  return (
    <StatusPage
      code="404"
      title="NFT não encontrado"
      description="Este NFT não existe ou saiu do catálogo. Confira o endereço ou explore outros NFTs no mercado."
      actions={
        <>
          <Button asChild size="lg">
            <Link to="/" hash="catalogo">
              Explorar o catálogo
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </>
      }
    />
  )
}

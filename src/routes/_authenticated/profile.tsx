import { createFileRoute } from '@tanstack/react-router'

import { PagePlaceholder } from '@/components/feedback/page-placeholder'

// Rota privada: Passo 9.
export const Route = createFileRoute('/_authenticated/profile')({
  component: function ProfilePage() {
    return <PagePlaceholder title="Perfil do colecionador" />
  },
})

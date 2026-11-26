import { toast } from 'sonner'

import facebookLogo from '@/assets/facebook-logo.svg'
import googleLogo from '@/assets/google-logo.svg'

const providers = [
  { name: 'Google', logo: googleLogo },
  { name: 'Facebook', logo: facebookLogo },
] as const

/**
 * "Ou continue com" do Figma. Login social está fora do escopo do desafio: os
 * botões continuam visíveis e focáveis, mas avisam que não estão disponíveis,
 * sem simular sucesso.
 */
export function SocialSignIn() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-caption text-foreground">Ou continue com</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <p className="sr-only">Entrar com redes sociais</p>
      {providers.map(({ name, logo }) => (
        <button
          key={name}
          type="button"
          aria-disabled="true"
          // `id` fixo: cliques repetidos não empilham o mesmo aviso.
          onClick={() =>
            toast.info(`Entrar com ${name} não está disponível nesta demonstração.`, {
              id: `unavailable:sign-in-${name}`,
            })
          }
          className="flex h-10 cursor-pointer items-center justify-center gap-3 rounded-control border border-border text-caption font-medium text-muted-foreground transition-colors hover:border-border-soft hover:bg-accent"
        >
          <img src={logo} alt="" width={20} height={20} />
          Continuar com {name}
          <span className="sr-only"> (indisponível nesta demonstração)</span>
        </button>
      ))}
    </div>
  )
}

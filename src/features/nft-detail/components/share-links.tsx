import { LinkIcon } from 'lucide-react'
import { toast } from 'sonner'

import { LinkedinIcon, TwitterIcon } from '@/components/icons/figma-icons'

const linkClass =
  'flex size-8 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent hover:text-accent-foreground'

/**
 * "Compartilhar este NFT:" (Figma): LinkedIn, copiar link e X. As redes
 * recebem só o endereço público da página, em nova aba.
 */
export function ShareLinks({ name }: { name: string }) {
  const url = typeof window === 'undefined' ? '' : window.location.origin + window.location.pathname
  const encoded = encodeURIComponent(url)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link do NFT copiado.')
    } catch {
      toast.error('Não foi possível copiar o link. Copie pela barra de endereço.')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-body font-bold text-foreground">Compartilhar este NFT:</span>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Compartilhar ${name} no LinkedIn (abre em nova aba)`}
        className={linkClass}
      >
        <LinkedinIcon size={15} />
      </a>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copiar o link de ${name}`}
        className={`${linkClass} cursor-pointer`}
      >
        <LinkIcon className="size-4" />
      </button>
      <a
        href={`https://x.com/intent/post?url=${encoded}&text=${encodeURIComponent(name)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Compartilhar ${name} no X (abre em nova aba)`}
        className={linkClass}
      >
        <TwitterIcon size={16} />
      </a>
    </div>
  )
}

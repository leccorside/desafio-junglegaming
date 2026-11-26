import { toast } from 'sonner'

/** Texto do aviso de área fora do escopo ("Criadores: indisponível nesta demonstração."). */
export function unavailableMessage(what: string) {
  return `${what}: indisponível nesta demonstração.`
}

/**
 * Aviso de área fora do escopo (páginas editoriais, suporte, atividade,
 * ofertas, downloads, redes sociais). É `info`, nunca `success`: nada
 * aconteceu. O `id` evita empilhar o mesmo aviso em cliques repetidos.
 */
export function notifyUnavailable(what: string) {
  toast.info(unavailableMessage(what), { id: `unavailable:${what}` })
}

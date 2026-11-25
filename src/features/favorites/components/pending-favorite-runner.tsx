import { isCancelledError, useQueryClient } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { useSession } from '@/features/auth/session-store'
import { nftDetailQuery } from '@/features/catalog/queries'

import { takePendingFavorite } from '../pending-favorite'
import { favoritesQuery, useFavoriteMutation } from '../queries'

const AUTH_PATHS = ['/login', '/register']
const REVEAL_TIMEOUT_MS = 6000

/**
 * O login reinicia o cache (`resetCache`): cancela e refaz as buscas ativas.
 * Uma busca nossa pega nesse meio é cancelada sem ter falhado; tenta de novo.
 */
async function untilNotCancelled<T>(load: () => Promise<T>, attempts = 3): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (attempts > 1 && isCancelledError(error)) return untilNotCancelled(load, attempts - 1)
    throw error
  }
}

const isVisible = (element: Element) =>
  element instanceof HTMLElement && element.offsetParent !== null

/**
 * Leva a tela de volta ao NFT (card do catálogo ou detalhe) quando ele
 * aparecer, e põe o foco no coração visível, para quem usa teclado ou leitor
 * de tela continuar dali.
 */
function revealNft(nftId: string) {
  const selector = `[data-nft-id="${CSS.escape(nftId)}"]`
  const reveal = () => {
    const target = [...document.querySelectorAll(selector)].find(isVisible)
    if (!(target instanceof HTMLElement)) return false
    // Card: no meio da tela. Detalhe (`data-reveal="start"`): do topo.
    target.scrollIntoView({ block: target.dataset.reveal === 'start' ? 'start' : 'center' })
    const heart = [...target.querySelectorAll('button[aria-pressed]')].find(isVisible)
    if (heart instanceof HTMLElement) heart.focus({ preventScroll: true })
    return true
  }
  if (reveal()) return
  // O catálogo chega depois da navegação: espera o card aparecer.
  const observer = new MutationObserver(() => {
    if (reveal()) stop()
  })
  const timer = window.setTimeout(() => stop(), REVEAL_TIMEOUT_MS)
  const stop = () => {
    observer.disconnect()
    window.clearTimeout(timer)
  }
  observer.observe(document.body, { childList: true, subtree: true })
}

/**
 * Conclui o favorito que o visitante pediu antes de entrar: assim que há
 * sessão e a tela de destino carregou, grava o favorito (otimista, com o
 * mesmo rollback dos outros), avisa por toast e volta ao NFT.
 */
export function PendingFavoriteRunner() {
  const session = useSession()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const queryClient = useQueryClient()
  const { mutate } = useFavoriteMutation()
  const userId = session?.user.id

  useEffect(() => {
    if (!userId || AUTH_PATHS.includes(pathname)) return
    const pending = takePendingFavorite()
    if (!pending) return

    void (async () => {
      try {
        const [favorites, nft] = await Promise.all([
          untilNotCancelled(() => queryClient.ensureQueryData(favoritesQuery(userId))),
          untilNotCancelled(() => queryClient.ensureQueryData(nftDetailQuery(pending.nftId))),
        ])
        if (favorites.nftIds.includes(nft.id)) {
          toast.info(`${nft.name} já está na sua lista de interesse.`)
        } else {
          mutate(
            { nft, favorite: true },
            { onSuccess: () => toast.success(`${nft.name} adicionado à lista de interesse.`) },
          )
        }
      } catch {
        toast.error(
          `Não foi possível adicionar ${pending.name} à lista de interesse. Tente de novo.`,
        )
      }
      revealNft(pending.nftId)
    })()
  }, [userId, pathname, queryClient, mutate])

  return null
}

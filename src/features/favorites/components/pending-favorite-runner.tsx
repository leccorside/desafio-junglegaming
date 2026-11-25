import { isCancelledError, useQueryClient } from '@tanstack/react-query'
import { useRouter, useRouterState, type AnyRouter } from '@tanstack/react-router'
import { useEffect } from 'react'
import { toast } from 'sonner'

import { useSession } from '@/features/auth/session-store'
import { nftDetailQuery } from '@/features/catalog/queries'

import {
  clearPendingFavorite,
  peekPendingFavorite,
  type PendingFavorite,
} from '../pending-favorite'
import { favoritesQuery, useFavoriteMutation } from '../queries'

const AUTH_PATHS = ['/login', '/register']
const REVEAL_TIMEOUT_MS = 6000

/** Um pedido por vez (o efeito pode rodar de novo, inclusive no StrictMode). */
let running = false

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

const inViewport = (element: Element) => {
  const rect = element.getBoundingClientRect()
  return rect.top >= 0 && rect.bottom <= window.innerHeight
}

/**
 * Roda `callback` depois que a tela de destino foi desenhada e o router já
 * aplicou a rolagem dele (restauração ou topo). Antes disso, uma rolagem
 * nossa seria desfeita. Devolve a função que cancela a espera.
 */
function afterRouteRendered(router: AnyRouter, callback: () => void): () => void {
  let frame = 0
  const schedule = () => {
    frame = window.requestAnimationFrame(callback)
  }
  const state = router.state
  const settled = state.status === 'idle' && state.resolvedLocation?.href === state.location.href
  if (settled) {
    schedule()
    return () => window.cancelAnimationFrame(frame)
  }
  const unsubscribe = router.subscribe('onRendered', () => {
    unsubscribe()
    schedule()
  })
  return () => {
    unsubscribe()
    window.cancelAnimationFrame(frame)
  }
}

/**
 * Leva a tela de volta ao NFT (card do catálogo ou detalhe) quando ele
 * aparecer, e põe o foco no coração visível. Só na tela em que o pedido foi
 * concluído: qualquer navegação (outra tela, outro filtro) cancela, para não
 * rolar nem tirar o foco de onde a pessoa já está. Se o NFT já está na tela,
 * não rola.
 */
function revealNft(router: AnyRouter, nftId: string, href: string) {
  if (router.state.location.href !== href) return
  const selector = `[data-nft-id="${CSS.escape(nftId)}"]`
  let observer: MutationObserver | null = null
  let timer = 0

  const stop = () => {
    observer?.disconnect()
    window.clearTimeout(timer)
    cancelWait()
    unsubscribeNavigation()
  }
  const unsubscribeNavigation = router.subscribe('onBeforeNavigate', () => stop())

  const reveal = () => {
    const target = [...document.querySelectorAll(selector)].find(isVisible)
    if (!(target instanceof HTMLElement)) return false
    const heart = [...target.querySelectorAll('button[aria-pressed]')].find(isVisible)
    // Detalhe (`data-reveal="start"`): basta o coração estar na tela. Card: o card inteiro.
    const start = target.dataset.reveal === 'start'
    const check = start && heart ? heart : target
    if (!inViewport(check)) target.scrollIntoView({ block: start ? 'start' : 'center' })
    if (heart instanceof HTMLElement) heart.focus({ preventScroll: true })
    return true
  }

  const cancelWait = afterRouteRendered(router, () => {
    if (reveal()) {
      stop()
      return
    }
    // O catálogo chega depois da tela: espera o card aparecer.
    observer = new MutationObserver(() => {
      if (reveal()) stop()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    timer = window.setTimeout(stop, REVEAL_TIMEOUT_MS)
  })
}

/**
 * Conclui o favorito que o visitante pediu antes de entrar: assim que há
 * sessão e a tela de destino carregou, grava o favorito (otimista, com o
 * mesmo rollback dos outros), avisa por toast e volta ao NFT.
 *
 * O pedido só sai do armazenamento depois do sucesso (ou quando o NFT já
 * estava na lista). Se os dados não carregam, ele fica guardado, o toast
 * oferece "Tentar de novo" e nada rola. Se a gravação falha, o coração volta
 * ao estado anterior com o aviso de sempre e fica em foco para nova tentativa.
 */
export function PendingFavoriteRunner() {
  const session = useSession()
  const router = useRouter()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const queryClient = useQueryClient()
  const { mutate } = useFavoriteMutation()
  const userId = session?.user.id

  useEffect(() => {
    if (!userId || AUTH_PATHS.includes(pathname) || running) return
    const pending = peekPendingFavorite()
    if (!pending) return

    const run = async (request: PendingFavorite) => {
      if (running) return
      running = true
      const href = router.state.location.href
      try {
        const [favorites, nft] = await Promise.all([
          untilNotCancelled(() => queryClient.ensureQueryData(favoritesQuery(userId))),
          untilNotCancelled(() => queryClient.ensureQueryData(nftDetailQuery(request.nftId))),
        ])
        if (favorites.nftIds.includes(nft.id)) {
          clearPendingFavorite()
          toast.info(`${nft.name} já está na sua lista de interesse.`)
          running = false
        } else {
          mutate(
            { nft, favorite: true },
            {
              onSuccess: () => {
                clearPendingFavorite()
                toast.success(`${nft.name} adicionado à lista de interesse.`)
              },
              // O aviso e o rollback vêm da própria mutation; o coração fica em
              // foco na tela para a pessoa tentar de novo.
              onError: () => clearPendingFavorite(),
              onSettled: () => {
                running = false
              },
            },
          )
        }
        revealNft(router, nft.id, href)
      } catch {
        running = false
        toast.error(
          `Não foi possível adicionar ${request.name} à lista de interesse. Tente de novo.`,
          {
            id: 'pending-favorite',
            action: { label: 'Tentar de novo', onClick: () => void run(request) },
          },
        )
      }
    }

    void run(pending)
  }, [userId, pathname, queryClient, mutate, router])

  return null
}

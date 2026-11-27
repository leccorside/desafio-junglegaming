import { useRouterState } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import { takeNextFocusTarget } from '@/lib/next-focus'
import { DEFAULT_TITLE, pageDescription, pageTitle, setPageDescription } from '@/lib/page-title'

const HEADING_WAIT_MS = 4000

/** Título da tela: o do diálogo aberto ou o `h1` visível do conteúdo. */
function currentHeading(): HTMLElement | null {
  const dialog = document.querySelector<HTMLElement>('[role="dialog"][data-state="open"]')
  if (dialog) {
    const id = dialog.getAttribute('aria-labelledby')
    return (id && document.getElementById(id)) || null
  }
  // Só um `h1` aparece; o de um fundo inerte (a tela inicial atrás do modal de
  // entrar) não conta: o título vem do modal, que monta logo depois.
  const headings = document.querySelectorAll<HTMLElement>('main#conteudo h1')
  return [...headings].find((h) => h.checkVisibility() && !h.closest('[inert]')) ?? null
}

/** Foco em campo de texto ou dentro de um diálogo: a pessoa já está fazendo algo. */
function focusIsBusy(): boolean {
  const active = document.activeElement
  if (!active || active === document.body) return false
  if (active.closest('[role="dialog"]')) return true
  return active.matches('input, textarea, select, [contenteditable="true"]')
}

const GUARD_MS = 1500

/**
 * Logo depois de o título receber o foco, outra parte da tela pode tirá-lo:
 * o toast que levou à página (ação "Ver carrinho") fecha e devolve o foco ao
 * último elemento antes dele, que pode estar no rodapé. Por 1,5 s, se o foco
 * cair no `body` ou sair do conteúdo sem a pessoa apertar tecla nem clicar,
 * ele volta ao título.
 */
function guardFocus(heading: HTMLElement): () => void {
  let userActed = false
  const onUser = () => {
    userActed = true
  }
  // Alvo fora do conteúdo (o "Entrar" do header depois de sair): só volta se
  // o foco cair no `body`.
  const targetInMain = Boolean(heading.closest('main#conteudo'))
  const restore = () => {
    if (userActed || !heading.isConnected) return
    const active = document.activeElement
    if (active === heading) return
    // Foco levado para dentro do conteúdo é intencional (ex.: o coração do
    // favorito concluído depois do login); só volta se caiu no `body` ou foi
    // parar fora do conteúdo (rodapé, header).
    if (active && active !== document.body) {
      if (!targetInMain || active.closest('main#conteudo')) return
    }
    if (focusIsBusy()) return
    heading.focus({ preventScroll: true })
  }
  // `focusout` cobre o elemento focado que some (o foco cai no `body`).
  const onFocusOut = () => window.setTimeout(restore, 0)
  document.addEventListener('keydown', onUser, true)
  document.addEventListener('pointerdown', onUser, true)
  document.addEventListener('focusin', restore, true)
  heading.addEventListener('focusout', onFocusOut)
  const stop = () => {
    window.clearTimeout(timer)
    document.removeEventListener('keydown', onUser, true)
    document.removeEventListener('pointerdown', onUser, true)
    document.removeEventListener('focusin', restore, true)
    heading.removeEventListener('focusout', onFocusOut)
  }
  const timer = window.setTimeout(stop, GUARD_MS)
  return stop
}

/**
 * Ao mudar de página (caminho, não busca nem âncora), anuncia a nova tela: o
 * título da aba vira "<título da tela> | KURIO" e o foco vai para o `h1`
 * (`tabindex=-1`, sem rolar), para leitor de tela e teclado começarem do
 * conteúdo novo. O `h1` pode chegar depois dos dados: espera até 4 s. Não
 * mexe no foco no primeiro carregamento (o primeiro Tab é o "Pular para o
 * conteúdo"), com âncora na URL, com diálogo aberto ou com foco num campo.
 */
export function RouteFocus() {
  const pathname = useRouterState({ select: (s) => s.resolvedLocation?.pathname })
  const hash = useRouterState({ select: (s) => s.resolvedLocation?.hash })
  const first = useRef(true)

  useEffect(() => {
    if (pathname === undefined) return
    const initial = first.current
    first.current = false
    // Alvo pedido por quem navegou (ex.: sair da conta → "Entrar" do header).
    const requested = takeNextFocusTarget()
    let done = false
    const started = Date.now()

    const apply = () => {
      if (done) return
      const heading = currentHeading()
      if (!heading && Date.now() - started < HEADING_WAIT_MS) return
      done = true
      observer.disconnect()
      window.clearTimeout(timeout)
      // A tela inicial fica com o título da marca (o `h1` dela é o slogan).
      const inDialog = Boolean(heading?.closest('[role="dialog"]'))
      document.title =
        pathname === '/' && !inDialog ? DEFAULT_TITLE : pageTitle(heading?.textContent)
      setPageDescription(pageDescription(pathname, inDialog ? null : heading?.textContent))
      if (initial || hash || !heading || focusIsBusy()) return
      if (heading.closest('[role="dialog"]')) return
      const target = requested?.() ?? heading
      if (!target.matches('a, button, input, select, textarea, [tabindex]')) {
        target.setAttribute('tabindex', '-1')
      }
      target.focus({ preventScroll: true })
      stopGuard = guardFocus(target)
    }
    let stopGuard = () => {}

    const observer = new MutationObserver(apply)
    observer.observe(document.body, { childList: true, subtree: true })
    // Sem `h1` até o fim da espera: aplica o título padrão e não mexe no foco.
    const timeout = window.setTimeout(apply, HEADING_WAIT_MS)
    apply()
    return () => {
      done = true
      observer.disconnect()
      window.clearTimeout(timeout)
      stopGuard()
    }
  }, [pathname, hash])

  return null
}

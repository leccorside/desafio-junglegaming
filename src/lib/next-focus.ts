/**
 * Onde o foco deve ficar depois de uma ação que troca o elemento focado (sair
 * da conta, por exemplo). Quem dispara a ação registra o alvo; o `RouteFocus`
 * usa esse alvo no lugar do título da tela quando a ação também muda de página.
 */
type FocusTarget = () => HTMLElement | null

let pending: FocusTarget | null = null

export function setNextFocusTarget(target: FocusTarget) {
  pending = target
}

/** Devolve e limpa o alvo registrado (cada alvo vale uma vez). */
export function takeNextFocusTarget(): FocusTarget | null {
  const target = pending
  pending = null
  return target
}

/** Primeiro elemento visível que casa com o seletor. */
export function firstVisible(selector: string): HTMLElement | null {
  return (
    [...document.querySelectorAll<HTMLElement>(selector)].find((el) => el.checkVisibility()) ?? null
  )
}

/**
 * Foca o alvo assim que ele existir (até `timeoutMs`): depois de sair, o
 * "Entrar" do header só aparece quando o cabeçalho é desenhado de novo.
 */
export function focusWhenReady(target: FocusTarget, timeoutMs = 1500) {
  const started = Date.now()
  const attempt = () => {
    const element = target()
    if (element) {
      if (!element.matches('a, button, input, select, textarea, [tabindex]')) {
        element.setAttribute('tabindex', '-1')
      }
      element.focus({ preventScroll: true })
      return
    }
    if (Date.now() - started < timeoutMs) window.setTimeout(attempt, 50)
  }
  attempt()
}

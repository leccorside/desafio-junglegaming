import { dismissFormSuccessToasts } from './form-toasts'

/**
 * Centraliza na tela o campo que acabou de receber o foco por erro.
 *
 * O foco do navegador rola só o mínimo para o campo aparecer, e ele costuma
 * parar perto da base, onde os toasts do mobile ficam (142 px acima da base):
 * o aviso de sucesso de outra parte do formulário cobria o campo com erro.
 * Chamada depois do foco (o React Hook Form foca no fim do `handleSubmit`,
 * e o `setError` com `shouldFocus` também), por isso espera o próximo quadro.
 * Rolagem instantânea: sem animação para quem prefere menos movimento.
 */
export function centerFocusedField() {
  if (typeof window === 'undefined') return
  // Erro na tela: os avisos de sucesso anteriores saem (não cobrem o campo
  // nem dizem "salvo" enquanto há algo para corrigir).
  dismissFormSuccessToasts()
  requestAnimationFrame(() => {
    const element = document.activeElement
    if (!(element instanceof HTMLElement) || element === document.body) return
    if (!element.matches('input, select, textarea, button')) return
    element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' })
  })
}

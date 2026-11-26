import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Esperas por condição, no lugar de `waitForTimeout` (TESTING.md: espera fixa
 * só nas checagens de ausência, listadas lá).
 */

/** Espera as animações e transições CSS da página terminarem. */
export async function animationsDone(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== 'running'),
  )
}

/**
 * Caixa do elemento depois de ele parar de se mexer (animação de entrada do
 * toast, por exemplo): duas leituras seguidas iguais.
 */
export async function settledBox(locator: Locator) {
  let previous = ''
  let box: Awaited<ReturnType<Locator['boundingBox']>> = null
  await expect
    .poll(
      async () => {
        box = await locator.boundingBox()
        const current = JSON.stringify(box)
        const same = current === previous
        previous = current
        return same && box !== null
      },
      { intervals: [50, 50, 100, 100, 200] },
    )
    .toBe(true)
  return box!
}

/**
 * Espera o servidor simulado registrar o envio de um evento de tempo real
 * (`/__mocks/realtime/log`). Usado antes das checagens de que a tela **não**
 * muda: sem isso, a checagem poderia rodar antes de o evento existir.
 */
export async function realtimeSent(page: Page, type: string, after: number) {
  await expect
    .poll(async () => {
      const log = await page.evaluate(async () => {
        const response = await fetch('/api/__mocks/realtime/log')
        return ((await response.json()) as { events: { type: string }[] }).events
      })
      return log.filter((event) => event.type === type).length
    })
    .toBeGreaterThan(after)
}

/** Quantos eventos desse tipo o servidor simulado já enviou. */
export async function realtimeCount(page: Page, type: string) {
  return page.evaluate(async (t) => {
    const response = await fetch('/api/__mocks/realtime/log')
    return ((await response.json()) as { events: { type: string }[] }).events.filter(
      (event) => event.type === t,
    ).length
  }, type)
}

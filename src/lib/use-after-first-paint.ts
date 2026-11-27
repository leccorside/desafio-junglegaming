import { startTransition, useEffect, useState } from 'react'

/**
 * `false` na primeira renderização e `true` logo depois de a tela ser
 * pintada. Serve para deixar o que está abaixo da dobra para uma segunda
 * renderização: o `requestAnimationFrame` roda antes da pintura e o
 * `setTimeout` dentro dele, depois. A atualização vai numa transição, que o
 * React fatia em pedaços pequenos, sem uma tarefa longa só.
 */
export function useAfterFirstPaint(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let timer = 0
    const frame = requestAnimationFrame(() => {
      timer = window.setTimeout(() => startTransition(() => setReady(true)))
    })
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [])

  return ready
}

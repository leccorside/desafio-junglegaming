import { useState } from 'react'

/**
 * Módulo carregado sob demanda e guardado depois da primeira carga: quem
 * monta de novo (outra tela, outro gatilho) já recebe o módulo pronto.
 */
export function lazyModule<T>(load: () => Promise<T>) {
  let loaded: T | null = null
  let pending: Promise<T> | null = null
  return {
    get: () => loaded,
    load: () =>
      (pending ??= load().then(
        (module) => (loaded = module),
        (error: unknown) => {
          // Falhou (rede): a próxima tentativa baixa de novo.
          pending = null
          throw error
        },
      )),
  }
}

export type LazyModule<T> = ReturnType<typeof lazyModule<T>>

/** Como a ativação aconteceu: o teclado leva o foco ao primeiro item do menu. */
export type Activation = { keyboard: boolean }

/**
 * Gatilho leve de um menu carregado sob demanda. `prefetch` baixa o módulo
 * sem abrir (ponteiro em cima ou foco no gatilho); `activate` baixa e pede
 * para montar o menu já aberto. Enquanto o módulo não chega, `activation`
 * guarda o pedido.
 */
export function useLazyMenu<T>(module: LazyModule<T>) {
  const [loaded, setLoaded] = useState(module.get)
  const [activation, setActivation] = useState<Activation | null>(null)

  const prefetch = () => {
    void module.load().catch(() => {})
  }
  const activate = (keyboard: boolean) => {
    setActivation({ keyboard })
    void module.load().then(
      (value) => setLoaded(() => value),
      () => setActivation(null),
    )
  }

  return { loaded, activation, prefetch, activate }
}

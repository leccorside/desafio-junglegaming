import { toast, type ExternalToast } from 'sonner'

/** Toasts de sucesso dos formulários ainda na tela. */
const successToasts = new Set<string | number>()

/**
 * Toast de sucesso de formulário (perfil, carteiras). Fica registrado para
 * sair da tela se um formulário mostrar erros em seguida: no mobile, o aviso
 * "Carteira principal salva." cobria o erro de um campo da secundária.
 */
export function formSuccessToast(message: string, options?: ExternalToast) {
  const forget = (t: { id: string | number }) => successToasts.delete(t.id)
  const id = toast.success(message, {
    ...options,
    onDismiss: (t) => {
      forget(t)
      options?.onDismiss?.(t)
    },
    onAutoClose: (t) => {
      forget(t)
      options?.onAutoClose?.(t)
    },
  })
  successToasts.add(id)
  return id
}

/** Tira da tela os avisos de sucesso anteriores (os erros passam a valer). */
export function dismissFormSuccessToasts() {
  for (const id of successToasts) toast.dismiss(id)
  successToasts.clear()
}

import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { couponCodeSchema } from '@/api/contracts'
import { errorMessage, isApiError } from '@/api/errors'
import { cn } from '@/lib/utils'

import { useApplyCoupon, useRemoveCoupon } from '../queries'

/**
 * "Código promocional" (frame "Promo Code"). Erro do código (inválido,
 * expirado, valor mínimo) aparece no campo, ligado por `aria-describedby`.
 * Com cupom aplicado, mostra o código e o botão para remover.
 */
export function CouponForm({ appliedCode }: { appliedCode: string | null }) {
  const inputId = useId()
  const errorId = useId()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const apply = useApplyCoupon()
  const remove = useRemoveCoupon()

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = couponCodeSchema.safeParse(code)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Informe o código promocional.')
      return
    }
    setError(null)
    apply.mutate(parsed.data, {
      onSuccess: () => {
        setCode('')
        toast.success(`Cupom ${parsed.data} aplicado.`)
      },
      // A API explica o motivo (inválido, expirado, valor mínimo) no campo ou na mensagem.
      onError: (failure) =>
        setError((isApiError(failure) && failure.fields?.code) || errorMessage(failure)),
    })
  }

  if (appliedCode) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-sm border border-primary px-3 py-2">
        <p className="text-body-sm text-foreground">
          Cupom <strong className="text-accent-foreground">{appliedCode}</strong> aplicado
        </p>
        <button
          type="button"
          onClick={() =>
            remove.mutate(undefined, {
              onSuccess: () => toast.success(`Cupom ${appliedCode} removido.`),
              onError: (failure) =>
                toast.error(`Não foi possível remover o cupom. ${errorMessage(failure)}`),
            })
          }
          disabled={remove.isPending}
          className="cursor-pointer text-body-sm text-accent-foreground underline-offset-2 hover:underline disabled:cursor-wait disabled:opacity-60"
        >
          {remove.isPending ? 'Removendo…' : 'Remover cupom'}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-body-sm font-bold text-foreground">
        Código promocional
      </label>
      <div
        className={cn(
          'flex h-[50px] overflow-hidden rounded-full border bg-card md:h-10 md:rounded-sm',
          error ? 'border-destructive' : 'border-border md:border-primary',
        )}
      >
        <input
          id={inputId}
          value={code}
          onChange={(event) => {
            setCode(event.target.value)
            if (error) setError(null)
          }}
          placeholder="Digite o código promocional..."
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="h-full min-w-0 flex-1 bg-transparent px-4 text-body-sm text-foreground uppercase placeholder:text-secondary placeholder:normal-case focus-visible:outline-none md:px-2 md:text-caption-sm"
        />
        <button
          type="submit"
          disabled={apply.isPending}
          // Texto escuro também no mobile: o claro do Figma (#f5f1eb) sobre o
          // gradiente cobre dá 2,2:1, abaixo dos 4,5:1 (ver ACCESSIBILITY.md).
          className="h-full w-[97px] shrink-0 cursor-pointer rounded-full bg-[linear-gradient(135deg,var(--primary-hover),var(--primary))] text-body font-bold text-primary-foreground disabled:cursor-wait disabled:opacity-60 md:w-[102px] md:rounded-none md:bg-primary md:bg-none"
        >
          {apply.isPending ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-caption text-destructive-foreground">
          {error}
        </p>
      ) : null}
    </form>
  )
}
